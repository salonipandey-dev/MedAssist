// Presentation helpers shared by the API view and the offline demo. Both views render
// the API's listing shape, so the offline fixtures are adapted to it here.
import type { ConsultationFilters, ConsultationOption } from '../../data/mock/consultations';
import type {
  ConsultationListing,
  ConsultationMode,
  ConsultationQuery,
} from '../../services/api/consultations';

export const MODE_LABELS: Record<ConsultationMode, string> = {
  in_person: 'In person',
  video: 'Video',
  phone: 'Phone',
};

export const PROVIDER_TYPE_LABELS: Record<ConsultationListing['provider_type'], string> = {
  clinic: 'Clinic',
  hospital_outpatient: 'Hospital outpatient',
  teleconsultation: 'Teleconsultation',
  community_camp: 'Community camp',
};

/** "Up to ₹300" in paise, the unit the API filters on. */
export const AFFORDABLE_MAX_FEE_MINOR = 30000;

/** Translate the screen's filter labels into the API's query parameters. */
export function toConsultationQuery(filters: ConsultationFilters): ConsultationQuery {
  const query: ConsultationQuery = {};
  if (filters.query.trim()) query.q = filters.query;
  if (filters.specialty !== 'All specialties') query.specialty = filters.specialty;
  const mode = (Object.keys(MODE_LABELS) as ConsultationMode[]).find(
    (key) => MODE_LABELS[key] === filters.mode,
  );
  if (mode) query.mode = mode;
  if (filters.fee === 'Free (illustrative)') query.feeState = 'free';
  if (filters.fee === 'Fee not listed') query.feeState = 'unknown';
  if (filters.fee === 'Up to ₹300') query.maxFeeMinor = AFFORDABLE_MAX_FEE_MINOR;
  return query;
}

function rupees(amountMinor: number): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

/**
 * Label the fee from its state; an unknown fee is never shown as free or zero.
 * The demo seed keeps its illustrative wording. Pilot listings show "Free" only when
 * the server says the check is current; a stale free listing reads "Needs recheck".
 * Fixture records add "(fixture)" so a fictional test value never looks real.
 */
export function feeLabel(listing: ConsultationListing): string {
  const { fee, source, verification } = listing;
  if (source.kind === 'fictional_seed') {
    if (fee.state === 'known') return `₹${rupees(fee.amount_minor)} (illustrative)`;
    if (fee.state === 'free') return 'Free (illustrative, not verified)';
    return 'Not listed in sample';
  }
  const suffix = source.kind === 'pilot_fixture' ? ' (fixture)' : '';
  if (verification.free_label_suppressed) return `Needs recheck${suffix}`;
  if (fee.state === 'known') return `₹${rupees(fee.amount_minor)}${suffix}`;
  if (fee.state === 'free') return `Free${suffix}`;
  return `Fee not listed${suffix}`;
}

/** "Checked 2 Nov 2026 · current" style, from the server's verification. */
export function checkedLabel(listing: ConsultationListing): string {
  const { verification } = listing;
  if (verification.status === 'fictional_demo' || !verification.checked_on)
    return 'Fictional record, never checked against a source';
  const checked = `Last checked ${formatDate(verification.checked_on)}`;
  return verification.status === 'current'
    ? `${checked} · current until ${formatDate(verification.recheck_due_on!)}`
    : `${checked} · Needs recheck`;
}

export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function sourceLabel(listing: ConsultationListing): string {
  const { source } = listing;
  const checked =
    source.kind === 'fictional_seed'
      ? 'fictional record, not externally verified'
      : source.last_checked_on
        ? `last checked ${source.last_checked_on}`
        : 'no check date recorded';
  return `${source.name} · version ${source.version} · ${checked}`;
}

export const LISTING_ROWS: { label: string; value: (listing: ConsultationListing) => string }[] = [
  { label: 'Specialty', value: (l) => l.specialty },
  { label: 'Provider type', value: (l) => PROVIDER_TYPE_LABELS[l.provider_type] },
  { label: 'Mode', value: (l) => l.modes.map((mode) => MODE_LABELS[mode]).join(', ') },
  { label: 'Location', value: (l) => l.area },
  { label: 'Fee', value: feeLabel },
  // Eligibility sits right beside the fee: a free or low fee may only apply to some people.
  { label: 'Eligibility and access', value: (l) => l.access_conditions ?? 'None recorded' },
  {
    label: 'Fee basis',
    value: (l) =>
      l.verification.free_label_suppressed
        ? 'Listed as free when last checked; hidden until the listing is rechecked'
        : (l.fee.basis ?? 'No fee information recorded'),
  },
  { label: 'Languages', value: (l) => l.languages.join(', ') || 'Not listed' },
  { label: 'Hours', value: (l) => l.hours ?? 'Not listed' },
  { label: 'Last checked', value: checkedLabel },
];

const OFFLINE_SOURCE: ConsultationListing['source'] = {
  kind: 'fictional_seed',
  id: 'frontend-offline-demo',
  name: 'Offline demo sample built into this app',
  version: '1',
  url: null,
  last_checked_on: null,
  listing_url: null,
  publisher: null,
  locality: null,
  reuse_basis: null,
  reuse_basis_url: null,
};
const OFFLINE_VERIFICATION: ConsultationListing['verification'] = {
  status: 'fictional_demo',
  checked_on: null,
  recheck_due_on: null,
  free_label_suppressed: false,
};

/** Present a built-in demo fixture in the same shape as an API listing. */
export function fromOfflineOption(option: ConsultationOption): ConsultationListing {
  const fee: ConsultationListing['fee'] =
    option.fee.kind === 'illustrative'
      ? {
          state: 'known',
          amount_minor: option.fee.amountInr * 100,
          currency: 'INR',
          basis: 'Illustrative sample fee.',
        }
      : option.fee.kind === 'free-illustrative'
        ? { state: 'free', amount_minor: 0, currency: 'INR', basis: option.note }
        : { state: 'unknown', amount_minor: null, currency: null, basis: null };
  return {
    id: option.id,
    provider_name: option.name,
    provider_type: (
      Object.keys(PROVIDER_TYPE_LABELS) as ConsultationListing['provider_type'][]
    ).find((key) => PROVIDER_TYPE_LABELS[key] === option.providerType)!,
    specialty: option.specialty,
    modes: option.modes.map(
      (label) =>
        (Object.keys(MODE_LABELS) as ConsultationMode[]).find((key) => MODE_LABELS[key] === label)!,
    ),
    area: option.area,
    fee,
    access_conditions: null,
    languages: option.languages,
    hours: option.hours === 'Not listed in this sample' ? null : option.hours,
    notes: option.note,
    is_fictional: true,
    source: OFFLINE_SOURCE,
    verification: OFFLINE_VERIFICATION,
  };
}
