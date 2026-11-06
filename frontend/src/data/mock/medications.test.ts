import { describe, expect, it } from 'vitest';
import { FOLLOW_UP_TEXT, MEDICATION_SCENARIOS, scenarioCoverage } from './medications';

describe('scripted medication-information demonstration', () => {
  it('covers the four proposed notice categories plus missing information', () => {
    const categories = new Set(
      MEDICATION_SCENARIOS.flatMap((s) => s.notices.map((n) => n.category)),
    );
    for (const category of [
      'Interaction between medicines',
      'Allergy conflict',
      'Duplicate ingredient',
      'Medicine and condition',
      'Missing information',
    ])
      expect(categories.has(category as never)).toBe(true);
  });

  it('distinguishes insufficient data from a possible issue', () => {
    const incomplete = MEDICATION_SCENARIOS.find((s) => s.id === 'incomplete')!;
    const coverage = scenarioCoverage(incomplete);
    expect(coverage.complete).toBe(false);
    expect(coverage.medicinesMissing).toEqual(['Calmora syrup']);
    expect(coverage.allergiesRecorded).toBe(false);
    expect(incomplete.notices.every((n) => n.state === 'insufficient-data')).toBe(true);
    const duplicate = MEDICATION_SCENARIOS.find((s) => s.id === 'duplicate')!;
    expect(scenarioCoverage(duplicate).complete).toBe(true);
    expect(duplicate.notices[0].state).toBe('possible-issue');
  });

  it('never presents the absence of a notice as safety and gives no medicine instructions', () => {
    const none = MEDICATION_SCENARIOS.find((s) => s.id === 'none')!;
    expect(none.notices[0].state).toBe('no-scripted-notice');
    expect(none.notices[0].explanation).toMatch(/does not mean/);
    const text = JSON.stringify(MEDICATION_SCENARIOS) + FOLLOW_UP_TEXT;
    expect(text).not.toMatch(/\b(dose|dosage|mg|stop taking|start taking|prescri)/i);
    expect(FOLLOW_UP_TEXT).toMatch(/pharmacist or doctor/);
  });
});
