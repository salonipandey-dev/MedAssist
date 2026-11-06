// Fictional consultation directory for the frontend demonstration.
// Every provider, area and fee below is invented. Nothing here comes from a real listing,
// and no availability, price or free service is verified or bookable.

export type ConsultationMode = 'In person' | 'Video' | 'Phone';
export type ConsultationFee =
  | { kind: 'illustrative'; amountInr: number }
  | { kind: 'free-illustrative' }
  | { kind: 'unavailable' };

export interface ConsultationOption {
  id: string;
  name: string;
  providerType: 'Clinic' | 'Hospital outpatient' | 'Teleconsultation' | 'Community camp';
  specialty: string;
  modes: ConsultationMode[];
  area: string;
  fee: ConsultationFee;
  languages: string[];
  hours: string;
  note: string;
}

export const CONSULTATION_SPECIALTIES = [
  'General practice',
  'Internal medicine',
  'Dermatology',
  'Paediatrics',
  'ENT',
] as const;

export const COMPARE_LIMIT = 3;

export const CONSULTATION_OPTIONS: ConsultationOption[] = [
  {
    id: 'c-01',
    name: 'Riverside Family Clinic (fictional)',
    providerType: 'Clinic',
    specialty: 'General practice',
    modes: ['In person'],
    area: 'Riverside, Sample City',
    fee: { kind: 'illustrative', amountInr: 300 },
    languages: ['English', 'Hindi'],
    hours: 'Weekdays · morning and evening (illustrative)',
    note: 'Illustrative fee for a first consultation.',
  },
  {
    id: 'c-02',
    name: 'Lakeview Teleconsult (fictional)',
    providerType: 'Teleconsultation',
    specialty: 'General practice',
    modes: ['Video', 'Phone'],
    area: 'Remote only',
    fee: { kind: 'illustrative', amountInr: 199 },
    languages: ['English', 'Hindi'],
    hours: 'Daily · 08:00–20:00 (illustrative)',
    note: 'Remote consultation; some concerns would need an in-person visit.',
  },
  {
    id: 'c-03',
    name: 'Sample Community Health Camp (fictional)',
    providerType: 'Community camp',
    specialty: 'General practice',
    modes: ['In person'],
    area: 'Old Market, Sample City',
    fee: { kind: 'free-illustrative' },
    languages: ['Hindi'],
    hours: 'First Saturday of the month (illustrative)',
    note: 'Shown as free for demonstration only. A real free service would need a verified source.',
  },
  {
    id: 'c-04',
    name: 'Northgate Hospital Outpatients (fictional)',
    providerType: 'Hospital outpatient',
    specialty: 'Internal medicine',
    modes: ['In person'],
    area: 'Northgate, Sample City',
    fee: { kind: 'illustrative', amountInr: 500 },
    languages: ['English', 'Hindi'],
    hours: 'Weekdays · morning (illustrative)',
    note: 'Illustrative registration and consultation fee.',
  },
  {
    id: 'c-05',
    name: 'Meadow Skin Clinic (fictional)',
    providerType: 'Clinic',
    specialty: 'Dermatology',
    modes: ['In person', 'Video'],
    area: 'Meadow Park, Sample City',
    fee: { kind: 'illustrative', amountInr: 600 },
    languages: ['English'],
    hours: 'Tuesday to Saturday (illustrative)',
    note: 'Video follow-ups shown for demonstration.',
  },
  {
    id: 'c-06',
    name: 'Little Steps Children’s Clinic (fictional)',
    providerType: 'Clinic',
    specialty: 'Paediatrics',
    modes: ['In person'],
    area: 'Riverside, Sample City',
    fee: { kind: 'unavailable' },
    languages: ['English', 'Hindi'],
    hours: 'Not listed in this sample',
    note: 'No fee information in the sample record.',
  },
  {
    id: 'c-07',
    name: 'Harbour ENT Centre (fictional)',
    providerType: 'Clinic',
    specialty: 'ENT',
    modes: ['In person'],
    area: 'Harbour Road, Sample City',
    fee: { kind: 'illustrative', amountInr: 450 },
    languages: ['English'],
    hours: 'Weekdays · afternoon (illustrative)',
    note: 'Illustrative fee for a first consultation.',
  },
  {
    id: 'c-08',
    name: 'Civic Polyclinic OPD (fictional)',
    providerType: 'Hospital outpatient',
    specialty: 'Internal medicine',
    modes: ['In person'],
    area: 'Civic Centre, Sample City',
    fee: { kind: 'free-illustrative' },
    languages: ['Hindi', 'English'],
    hours: 'Weekdays · morning (illustrative)',
    note: 'Shown as free for demonstration only. A real free service would need a verified source.',
  },
  {
    id: 'c-09',
    name: 'Brightline Online Dermatology (fictional)',
    providerType: 'Teleconsultation',
    specialty: 'Dermatology',
    modes: ['Video'],
    area: 'Remote only',
    fee: { kind: 'unavailable' },
    languages: ['English'],
    hours: 'Not listed in this sample',
    note: 'No fee information in the sample record.',
  },
];

export type FeeFilter = 'Any' | 'Free (illustrative)' | 'Up to ₹300' | 'Fee not listed';

export interface ConsultationFilters {
  query: string;
  specialty: string;
  mode: string;
  fee: FeeFilter;
}

export const EMPTY_FILTERS: ConsultationFilters = {
  query: '',
  specialty: 'All specialties',
  mode: 'All modes',
  fee: 'Any',
};

export function filterConsultations(
  options: ConsultationOption[],
  filters: ConsultationFilters,
): ConsultationOption[] {
  const q = filters.query.trim().toLowerCase();
  return options.filter((o) => {
    if (q && ![o.name, o.specialty, o.area].some((v) => v.toLowerCase().includes(q))) return false;
    if (filters.specialty !== 'All specialties' && o.specialty !== filters.specialty) return false;
    if (filters.mode !== 'All modes' && !o.modes.includes(filters.mode as ConsultationMode))
      return false;
    if (filters.fee === 'Free (illustrative)' && o.fee.kind !== 'free-illustrative') return false;
    if (
      filters.fee === 'Up to ₹300' &&
      !(
        o.fee.kind === 'free-illustrative' ||
        (o.fee.kind === 'illustrative' && o.fee.amountInr <= 300)
      )
    )
      return false;
    if (filters.fee === 'Fee not listed' && o.fee.kind !== 'unavailable') return false;
    return true;
  });
}

/** Adds or removes an option from the comparison; refuses a fourth option. */
export function toggleCompare(selected: string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter((s) => s !== id);
  if (selected.length >= COMPARE_LIMIT) return selected;
  return [...selected, id];
}

export function feeLabel(fee: ConsultationFee): string {
  if (fee.kind === 'illustrative') return `₹${fee.amountInr} (illustrative)`;
  if (fee.kind === 'free-illustrative') return 'Free (illustrative, not verified)';
  return 'Not listed in sample';
}
