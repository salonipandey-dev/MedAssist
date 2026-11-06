import { describe, expect, it } from 'vitest';
import {
  COMPARE_LIMIT,
  CONSULTATION_OPTIONS,
  EMPTY_FILTERS,
  feeLabel,
  filterConsultations,
  toggleCompare,
} from './consultations';

describe('fictional consultation directory', () => {
  it('labels every provider as fictional and never presents a fee as verified', () => {
    for (const option of CONSULTATION_OPTIONS) {
      expect(option.name).toMatch(/\(fictional\)$/);
      expect(feeLabel(option.fee)).toMatch(/illustrative|Not listed in sample/);
    }
  });

  it('filters by specialty, mode, fee and search text together', () => {
    const all = filterConsultations(CONSULTATION_OPTIONS, EMPTY_FILTERS);
    expect(all).toHaveLength(CONSULTATION_OPTIONS.length);
    const video = filterConsultations(CONSULTATION_OPTIONS, { ...EMPTY_FILTERS, mode: 'Video' });
    expect(video.every((o) => o.modes.includes('Video'))).toBe(true);
    const free = filterConsultations(CONSULTATION_OPTIONS, {
      ...EMPTY_FILTERS,
      fee: 'Free (illustrative)',
    });
    expect(free.every((o) => o.fee.kind === 'free-illustrative')).toBe(true);
    const cheap = filterConsultations(CONSULTATION_OPTIONS, {
      ...EMPTY_FILTERS,
      fee: 'Up to ₹300',
    });
    expect(cheap.some((o) => o.fee.kind === 'unavailable')).toBe(false);
    const none = filterConsultations(CONSULTATION_OPTIONS, {
      ...EMPTY_FILTERS,
      specialty: 'ENT',
      mode: 'Video',
    });
    expect(none).toHaveLength(0);
    const search = filterConsultations(CONSULTATION_OPTIONS, {
      ...EMPTY_FILTERS,
      query: 'riverside',
    });
    expect(search.length).toBeGreaterThan(0);
    expect(search.every((o) => /riverside/i.test(o.name + o.area))).toBe(true);
  });

  it('compares at most three options and lets one be removed', () => {
    let selected: string[] = [];
    for (const option of CONSULTATION_OPTIONS.slice(0, 4))
      selected = toggleCompare(selected, option.id);
    expect(selected).toHaveLength(COMPARE_LIMIT);
    expect(selected).not.toContain(CONSULTATION_OPTIONS[3].id);
    const full = selected;
    expect(toggleCompare(full, CONSULTATION_OPTIONS[3].id)).toBe(full);
    expect(toggleCompare(full, full[0])).toHaveLength(COMPARE_LIMIT - 1);
  });
});
