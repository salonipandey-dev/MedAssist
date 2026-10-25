import type { Appointment, CaseStatus, DemoState, Role } from '../../types';
import { createSeed, DOCTOR_ID, PATIENT_ID, REVIEW_NOTES, SAMPLE_TODAY, SLOTS } from './seed';

export type DemoAction =
  | { type: 'profile'; alias: string; language: string }
  | { type: 'requestAppointment'; date: string; time: string; doctorId: string }
  | { type: 'appointmentStatus'; id: string; status: Appointment['status'] }
  | { type: 'review'; caseId: string; note: string; status: CaseStatus }
  | { type: 'submitSample' }
  | { type: 'toggleUser'; id: string }
  | { type: 'readNotification'; id: string }
  | { type: 'reminders'; value: boolean }
  | { type: 'reset' };
const nextId = (prefix: string, length: number) => `${prefix}-${length + 1001}`;
const event = (
  state: DemoState,
  action: DemoState['events'][number]['action'],
  description: string,
) => ({
  id: nextId('EV', state.events.length),
  actor: 'Demo session',
  action,
  description,
  time: new Date(Date.UTC(2026, 9, 25, 16, 0, state.events.length)).toISOString(),
});
export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'reset':
      return createSeed();
    case 'profile':
      return {
        ...state,
        profile: { ...state.profile, alias: action.alias, language: action.language },
      };
    case 'reminders':
      return { ...state, profile: { ...state.profile, reminders: action.value } };
    case 'readNotification':
      return { ...state, readNotifications: [...new Set([...state.readNotifications, action.id])] };
    case 'toggleUser':
      return {
        ...state,
        users: state.users.map((u) => (u.id === action.id ? { ...u, active: !u.active } : u)),
        events: [
          event(state, 'User', `${action.id} · sample account availability toggled`),
          ...state.events,
        ],
      };
    case 'submitSample': {
      const record: DemoState['cases'][number] = {
        id: nextId('MA', state.cases.length),
        patientId: PATIENT_ID,
        title: 'Sample assessment walkthrough',
        status: 'Submitted',
        submitted: SAMPLE_TODAY,
        assessmentId: 'sample-a',
        reportIds: [],
      };
      return {
        ...state,
        cases: [record, ...state.cases],
        events: [
          event(state, 'Case', `${record.id} · predefined sample submitted in memory`),
          ...state.events,
        ],
      };
    }
    case 'requestAppointment': {
      if (
        !SLOTS.includes(action.time) ||
        action.date <= SAMPLE_TODAY ||
        action.date > '2026-12-31' ||
        !state.users.some((u) => u.id === action.doctorId && u.role === 'doctor' && u.active)
      )
        return state;
      const date = new Date(action.date + 'T12:00:00Z');
      if (
        Number.isNaN(date.valueOf()) ||
        date.toISOString().slice(0, 10) !== action.date ||
        [0, 6].includes(date.getUTCDay())
      )
        return state;
      if (
        state.appointments.some(
          (a) =>
            a.doctorId === action.doctorId &&
            a.date === action.date &&
            a.time === action.time &&
            ['Requested', 'Confirmed'].includes(a.status),
        )
      )
        return state;
      const record: Appointment = {
        id: nextId('APT', state.appointments.length),
        patientId: PATIENT_ID,
        doctorId: action.doctorId,
        date: action.date,
        time: action.time,
        status: 'Requested',
        kind: 'Demo consultation',
      };
      return {
        ...state,
        appointments: [record, ...state.appointments],
        events: [
          event(state, 'Appointment', `${record.id} · sample request created`),
          ...state.events,
        ],
      };
    }
    case 'appointmentStatus': {
      const current = state.appointments.find((a) => a.id === action.id);
      if (
        !current ||
        !['Requested', 'Confirmed'].includes(current.status) ||
        !['Confirmed', 'Cancelled'].includes(action.status)
      )
        return state;
      return {
        ...state,
        appointments: state.appointments.map((a) =>
          a.id === action.id ? { ...a, status: action.status } : a,
        ),
        events: [
          event(state, 'Appointment', `${action.id} · ${action.status.toLowerCase()} in demo`),
          ...state.events,
        ],
      };
    }
    case 'review': {
      const record = state.cases.find((c) => c.id === action.caseId);
      if (
        !record ||
        record.doctorId !== DOCTOR_ID ||
        record.status === 'Closed' ||
        !REVIEW_NOTES.includes(action.note) ||
        !['Reviewed', 'Closed'].includes(action.status)
      )
        return state;
      const review = {
        id: nextId('REV', state.reviews.length),
        caseId: action.caseId,
        doctorId: DOCTOR_ID,
        created: new Date(Date.UTC(2026, 9, 25, 16, 0, state.events.length)).toISOString(),
        note: action.note,
        assessment: 'Demonstration review recorded. No clinical conclusion.',
      };
      return {
        ...state,
        cases: state.cases.map((c) =>
          c.id === action.caseId ? { ...c, status: action.status } : c,
        ),
        reviews: [review, ...state.reviews],
        events: [
          event(state, 'Review', `${action.caseId} · sample professional review recorded`),
          ...state.events,
        ],
      };
    }
  }
}
export const roleCases = (state: DemoState, role: Role) =>
  state.cases.filter((c) =>
    role === 'patient'
      ? c.patientId === PATIENT_ID
      : role === 'doctor'
        ? c.doctorId === DOCTOR_ID
        : true,
  );
export const roleAppointments = (state: DemoState, role: Role) =>
  state.appointments.filter((a) =>
    role === 'patient'
      ? a.patientId === PATIENT_ID
      : role === 'doctor'
        ? a.doctorId === DOCTOR_ID
        : true,
  );
