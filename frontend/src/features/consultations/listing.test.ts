import { describe, expect, it } from 'vitest';
import page from '../../../tests/e2e/fixtures/consultations.json';
import pilotPage from '../../../tests/e2e/fixtures/consultations-pilot.json';
import {
  CONSULTATION_OPTIONS,
  EMPTY_FILTERS,
  feeLabel as offlineFeeLabel,
} from '../../data/mock/consultations';
import type { ConsultationListing } from '../../services/api/consultations';
import {
  checkedLabel,
  feeLabel,
  formatDate,
  fromOfflineOption,
  LISTING_ROWS,
  sourceLabel,
  toConsultationQuery,
} from './listing';

const listings = page.items as ConsultationListing[];
const byId = (id: string) => listings.find((listing) => listing.id === id)!;
const pilot = pilotPage.items as ConsultationListing[];
const pilotById = (id: string) => pilot.find((listing) => listing.id === id)!;
const row = (label: string) => LISTING_ROWS.find((item) => item.label === label)!.value;

describe('consultation filter mapping', () => {
  it('sends nothing for the default filters', () => {
    expect(toConsultationQuery(EMPTY_FILTERS)).toEqual({});
  });

  it('maps each screen label to the documented API parameter', () => {
    expect(toConsultationQuery({ ...EMPTY_FILTERS, fee: 'Up to ₹300' })).toEqual({
      maxFeeMinor: 30000,
    });
    expect(toConsultationQuery({ ...EMPTY_FILTERS, fee: 'Free (illustrative)' })).toEqual({
      feeState: 'free',
    });
    expect(toConsultationQuery({ ...EMPTY_FILTERS, fee: 'Fee not listed' })).toEqual({
      feeState: 'unknown',
    });
    expect(toConsultationQuery({ ...EMPTY_FILTERS, mode: 'In person' })).toEqual({
      mode: 'in_person',
    });
    expect(toConsultationQuery({ ...EMPTY_FILTERS, mode: 'Video' })).toEqual({ mode: 'video' });
    expect(toConsultationQuery({ ...EMPTY_FILTERS, mode: 'Phone' })).toEqual({ mode: 'phone' });
  });

  it('combines filters and preserves the search text as typed', () => {
    expect(
      toConsultationQuery({
        query: '  Remote   DERMATOLOGY ',
        specialty: 'Dermatology',
        mode: 'Video',
        fee: 'Fee not listed',
      }),
    ).toEqual({
      q: '  Remote   DERMATOLOGY ',
      specialty: 'Dermatology',
      mode: 'video',
      feeState: 'unknown',
    });
    expect(toConsultationQuery({ ...EMPTY_FILTERS, query: '   ' })).toEqual({});
  });
});

describe('listing labels', () => {
  it('labels fictional fees as illustrative and keeps free and unknown apart', () => {
    expect(feeLabel(byId('c-01'))).toBe('₹300 (illustrative)');
    expect(feeLabel(byId('c-02'))).toBe('₹199 (illustrative)');
    expect(feeLabel(byId('c-03'))).toBe('Free (illustrative, not verified)');
    expect(feeLabel(byId('c-06'))).toBe('Not listed in sample');
  });

  it('does not call a reviewed listing illustrative or fixture', () => {
    const fixture = pilotById('fx-civil-opd');
    const reviewed: ConsultationListing = {
      ...fixture,
      is_fictional: false,
      fee: { state: 'known', amount_minor: 125050, currency: 'INR', basis: 'Listed fee' },
      source: {
        ...fixture.source,
        kind: 'reviewed_external',
        id: 'sample-source',
        name: 'Sample source',
        version: '3',
        last_checked_on: '2026-10-01',
      },
      verification: { ...fixture.verification, checked_on: '2026-10-01' },
    };

    expect(feeLabel(reviewed)).toBe('₹1,250.50');
    expect(feeLabel({ ...reviewed, fee: { ...pilotById('fx-wellness-free').fee } })).toBe('Free');
    expect(feeLabel({ ...reviewed, fee: { ...pilotById('fx-tele-unknown').fee } })).toBe(
      'Fee not listed',
    );
    expect(sourceLabel(reviewed)).toBe('Sample source · version 3 · last checked 2026-10-01');
    expect(sourceLabel(byId('c-01'))).toContain('fictional record, not externally verified');
  });

  it('shows the fee basis and eligibility, with a plain fallback', () => {
    expect(row('Fee basis')(byId('c-03'))).toMatch(/^Shown as free for demonstration only/);
    expect(row('Fee basis')(byId('c-06'))).toBe('No fee information recorded');
    expect(row('Eligibility and access')(byId('c-03'))).toBe(
      'Fictional example: walk-in on camp days only.',
    );
    expect(row('Eligibility and access')(byId('c-01'))).toBe('None recorded');
    expect(row('Last checked')(byId('c-01'))).toBe(
      'Fictional record, never checked against a source',
    );
    // Eligibility is the row right after the fee.
    const labels = LISTING_ROWS.map((item) => item.label);
    expect(labels[labels.indexOf('Fee') + 1]).toBe('Eligibility and access');
    expect(row('Hours')(byId('c-06'))).toBe('Not listed');
    expect(row('Mode')(byId('c-02'))).toBe('Video, Phone');
    expect(row('Provider type')(byId('c-04'))).toBe('Hospital outpatient');
  });
});

describe('pilot listing labels (fictional fixture)', () => {
  it('labels a known fee, a current free fee and an unknown fee', () => {
    expect(feeLabel(pilotById('fx-civil-opd'))).toBe('₹10 (fixture)');
    expect(feeLabel(pilotById('fx-skin-clinic'))).toBe('₹250 (fixture)');
    expect(feeLabel(pilotById('fx-wellness-free'))).toBe('Free (fixture)');
    expect(feeLabel(pilotById('fx-tele-unknown'))).toBe('Fee not listed (fixture)');
    expect(row('Eligibility and access')(pilotById('fx-wellness-free'))).toBe(
      'Free for residents of Ward 4 who register with an identity document (fixture condition).',
    );
  });

  it('never shows Free for a stale listing and says it needs a recheck', () => {
    const camp = pilotById('fx-child-camp');

    expect(camp.verification).toEqual({
      status: 'needs_recheck',
      checked_on: '2026-06-01',
      recheck_due_on: '2026-08-30',
      free_label_suppressed: true,
    });
    expect(feeLabel(camp)).toBe('Needs recheck (fixture)');
    expect(row('Fee basis')(camp)).toBe(
      'Listed as free when last checked; hidden until the listing is rechecked',
    );
    expect(checkedLabel(camp)).toBe('Last checked 1 Jun 2026 · Needs recheck');
    // A stale known fee keeps its amount but is still marked for a recheck.
    expect(feeLabel(pilotById('fx-ent-opd'))).toBe('₹50 (fixture)');
    expect(checkedLabel(pilotById('fx-ent-opd'))).toBe('Last checked 1 Jul 2026 · Needs recheck');
  });

  it('shows the check date and how long it stays current', () => {
    expect(checkedLabel(pilotById('fx-civil-opd'))).toBe(
      'Last checked 2 Nov 2026 · current until 31 Jan 2027',
    );
    expect(formatDate('2026-11-13')).toBe('13 Nov 2026');
    for (const listing of pilot) {
      expect(listing.is_fictional).toBe(true);
      expect(listing.source.kind).toBe('pilot_fixture');
      expect(listing.source.listing_url).toMatch(/^https:\/\/pilot-source\.example\.org\//);
    }
  });
});

describe('offline demo adapter', () => {
  it('presents every built-in fixture with the same IDs, names and fee labels', () => {
    const adapted = CONSULTATION_OPTIONS.map(fromOfflineOption);

    expect(adapted.map((listing) => listing.id)).toEqual(listings.map((listing) => listing.id));
    for (const [index, option] of CONSULTATION_OPTIONS.entries()) {
      expect(adapted[index].provider_name).toBe(option.name);
      expect(feeLabel(adapted[index])).toBe(offlineFeeLabel(option.fee));
      expect(adapted[index].is_fictional).toBe(true);
      expect(adapted[index].source.last_checked_on).toBeNull();
    }
  });

  it('matches the seeded API records on the fields both carry', () => {
    for (const option of CONSULTATION_OPTIONS) {
      const offline = fromOfflineOption(option);
      const api = byId(option.id);
      for (const field of ['provider_type', 'specialty', 'modes', 'area', 'languages', 'hours'])
        expect(offline[field as keyof ConsultationListing], `${option.id} ${field}`).toEqual(
          api[field as keyof ConsultationListing],
        );
      expect(offline.fee.state).toBe(api.fee.state);
      expect(offline.fee.amount_minor).toBe(api.fee.amount_minor);
    }
  });
});
