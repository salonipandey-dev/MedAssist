import { describe, expect, it } from 'vitest';
import page from '../../../tests/e2e/fixtures/consultations.json';
import {
  CONSULTATION_OPTIONS,
  EMPTY_FILTERS,
  feeLabel as offlineFeeLabel,
} from '../../data/mock/consultations';
import type { ConsultationListing } from '../../services/api/consultations';
import {
  feeLabel,
  fromOfflineOption,
  LISTING_ROWS,
  sourceLabel,
  toConsultationQuery,
} from './listing';

const listings = page.items as ConsultationListing[];
const byId = (id: string) => listings.find((listing) => listing.id === id)!;

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

  it('combines filters and normalises the search text', () => {
    expect(
      toConsultationQuery({
        query: '  Remote   DERMATOLOGY ',
        specialty: 'Dermatology',
        mode: 'Video',
        fee: 'Fee not listed',
      }),
    ).toEqual({
      q: 'Remote DERMATOLOGY',
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

  it('does not call a reviewed listing illustrative', () => {
    const reviewed: ConsultationListing = {
      ...byId('c-01'),
      is_fictional: false,
      fee: { state: 'known', amount_minor: 125050, currency: 'INR', basis: 'Listed fee' },
      source: {
        kind: 'reviewed_external',
        id: 'sample-source',
        name: 'Sample source',
        version: '3',
        url: null,
        last_checked_on: '2026-10-01',
      },
    };

    expect(feeLabel(reviewed)).toBe('₹1,250.50');
    expect(sourceLabel(reviewed)).toBe('Sample source · version 3 · last checked 2026-10-01');
    expect(sourceLabel(byId('c-01'))).toContain('fictional record, not externally verified');
  });

  it('shows the fee basis and access conditions, with a plain fallback', () => {
    const row = (label: string) => LISTING_ROWS.find((item) => item.label === label)!.value;
    expect(row('Fee basis')(byId('c-03'))).toMatch(/^Shown as free for demonstration only/);
    expect(row('Fee basis')(byId('c-06'))).toBe('No fee information recorded');
    expect(row('Access conditions')(byId('c-03'))).toBe(
      'Fictional example: walk-in on camp days only.',
    );
    expect(row('Access conditions')(byId('c-01'))).toBe('None recorded');
    expect(row('Hours')(byId('c-06'))).toBe('Not listed');
    expect(row('Mode')(byId('c-02'))).toBe('Video, Phone');
    expect(row('Provider type')(byId('c-04'))).toBe('Hospital outpatient');
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
