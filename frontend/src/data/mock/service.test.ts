import { describe, expect, it } from 'vitest';
import { analytics } from './analytics';
import { createSeed, DOCTOR_ID, REVIEW_NOTES } from './seed';
import { demoReducer } from './service';
describe('fictional dataset and memory-only workflows', () => {
  it('has consistent relationships and analytics computed from records', () => {
    const s = createSeed();
    for (const c of s.cases) {
      expect(s.users.some((u) => u.id === c.patientId)).toBe(true);
      for (const id of c.reportIds)
        expect(s.reports.some((r) => r.id === id && r.caseId === c.id)).toBe(true);
    }
    const a = analytics(s);
    expect(a.trend.reduce((n, m) => n + m.cases, 0)).toBe(s.cases.length);
    expect(a.roles.reduce((n, r) => n + r.value, 0)).toBe(s.users.length);
    expect(a.workflow.reduce((n, r) => n + r.value, 0)).toBe(s.cases.length);
  });
  it('submits only the predefined sample, without an urgency result', () => {
    const s = demoReducer(createSeed(), { type: 'submitSample' });
    expect(s.cases[0].status).toBe('Submitted');
    expect(s.cases[0].assessmentId).toBe('sample-a');
    expect(s.cases[0]).not.toHaveProperty('prediction');
    expect(s.cases[0]).not.toHaveProperty('risk');
  });
  it('rejects a duplicate slot and permits rebooking after cancellation', () => {
    const action = {
      type: 'requestAppointment' as const,
      date: '2026-11-02',
      time: '09:00',
      doctorId: DOCTOR_ID,
    };
    const s = demoReducer(createSeed(), action);
    expect(s.appointments.length).toBe(25);
    expect(demoReducer(s, action)).toBe(s);
    const cancelled = demoReducer(s, {
      type: 'appointmentStatus',
      id: s.appointments[0].id,
      status: 'Cancelled',
    });
    expect(demoReducer(cancelled, action).appointments.length).toBe(26);
  });
  it('rejects past, weekend, invalid-date and unknown-doctor availability', () => {
    const s = createSeed();
    for (const date of ['2026-10-24', '2026-11-01', '2026-11-31', '2027-01-01'])
      expect(
        demoReducer(s, { type: 'requestAppointment', date, time: '09:00', doctorId: DOCTOR_ID }),
      ).toBe(s);
    expect(
      demoReducer(s, {
        type: 'requestAppointment',
        date: '2026-11-02',
        time: '09:00',
        doctorId: 'unknown',
      }),
    ).toBe(s);
  });
  it('records a doctor review independently without inventing a prediction', () => {
    const s = createSeed();
    const c = s.cases.find((c) => c.status === 'Assigned')!;
    const next = demoReducer(s, {
      type: 'review',
      caseId: c.id,
      note: REVIEW_NOTES[0],
      status: 'Reviewed',
    });
    expect(next.reviews.length).toBe(s.reviews.length + 1);
    expect(next.cases.find((x) => x.id === c.id)?.status).toBe('Reviewed');
    expect(next.reviews[0].assessment).toMatch(/No clinical conclusion/);
    expect(next.reviews[0]).not.toHaveProperty('prediction');
  });
  it('rejects review changes on unassigned or closed cases and arbitrary notes', () => {
    const s = createSeed();
    for (const c of s.cases.filter((c) => ['Submitted', 'Closed'].includes(c.status)))
      expect(
        demoReducer(s, { type: 'review', caseId: c.id, note: REVIEW_NOTES[0], status: 'Reviewed' }),
      ).toBe(s);
    const c = s.cases.find((c) => c.status === 'Assigned')!;
    expect(
      demoReducer(s, { type: 'review', caseId: c.id, note: 'arbitrary input', status: 'Reviewed' }),
    ).toBe(s);
  });
  it('resets all mutations with a fresh seed', () => {
    const s = demoReducer(createSeed(), { type: 'submitSample' });
    expect(demoReducer(s, { type: 'reset' })).toEqual(createSeed());
  });
  it('uses the selected date range consistently across aggregates', () => {
    const s = createSeed();
    const a = analytics(s, 'October');
    expect(a.cases.every((c) => c.submitted.startsWith('2026-10'))).toBe(true);
    expect(a.trend[0].cases).toBe(a.cases.length);
    expect(a.roles.reduce((n, r) => n + r.value, 0)).toBe(a.users.length);
  });
});
