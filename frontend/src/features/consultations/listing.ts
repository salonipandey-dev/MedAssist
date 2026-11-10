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
  const q = filters.query.trim().split(/\s+/).filter(Boolean).join(' ');
  if (q) query.q = q;
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

/** Label the fee from its state; an unknown fee is never shown as free or zero. */
export function feeLabel(listing: ConsultationListing): string {
  const { fee, is_fictional: fictional } = listing;
  if (fee.state === 'known')
    return `₹${rupees(fee.amount_minor)}${fictional ? ' (illustrative)' : ''}`;
  if (fee.state === 'free') return fictional ? 'Free (illustrative, not verified)' : 'Free';
  return fictional ? 'Not listed in sample' : 'Not listed';
}

export function sourceLabel(listing: ConsultationListing): string {
  const { source } = listing;
  const checked = listing.is_fictional
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
  { label: 'Fee basis', value: (l) => l.fee.basis ?? 'No fee information recorded' },
  { label: 'Access conditions', value: (l) => l.access_conditions ?? 'None recorded' },
  { label: 'Languages', value: (l) => l.languages.join(', ') || 'Not listed' },
  { label: 'Hours', value: (l) => l.hours ?? 'Not listed' },
];

const OFFLINE_SOURCE: ConsultationListing['source'] = {
  kind: 'fictional_seed',
  id: 'frontend-offline-demo',
  name: 'Offline demo sample built into this app',
  version: '1',
  url: null,
  last_checked_on: null,
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
    modes: option.modes.map((label) =>
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
  };
}
