import type { AppointmentStatus, CaseStatus, DemoState, Role } from '../../types';

// Every person, document, event and time slot in this module is fictional.
export const SAMPLE_TODAY = '2026-10-25';
export const PATIENT_ID = 'p-01';
export const DOCTOR_ID = 'd-01';
export const DEMO_ACCOUNTS: Record<Role, { name: string; initials: string; label: string }> = {
  patient: { name: 'Mira Chen', initials: 'MC', label: 'Patient portal' },
  doctor: { name: 'Dr. Avery Morgan', initials: 'AM', label: 'Doctor workspace' },
  admin: { name: 'Jordan Ellis', initials: 'JE', label: 'Admin command center' },
};
export const SLOTS = ['09:00', '10:00', '11:30', '14:00', '15:30'];
export const REVIEW_NOTES = [
  'Sample documentation checked; review workflow demonstrated.',
  'Sample attachment references checked; coordination step recorded.',
  'Sample case chronology checked; demonstration review completed.',
];
export const SAMPLE_ASSESSMENT = {
  label: 'Fictional sample A',
  symptom: 'Intermittent headache — predefined example only',
  duration: 'Two days — fixed sample value',
  severity: 'Mild — fictional self-description, not an urgency category',
  context: 'Fictional adult, no additional history recorded in this sample.',
};
const iso = (month: number, day: number) =>
  `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const pad = (n: number) => String(n).padStart(2, '0');
export function createSeed(): DemoState {
  const names = [
    'Mira Chen',
    'Leo Brooks',
    'Ada Wells',
    'Theo Park',
    'Nina Reed',
    'Evan Vale',
    'Zara Moon',
    'Finn Lane',
    'Isla Gray',
    'Noah West',
    'Luna Hart',
    'Owen Dale',
  ];
  const users: DemoState['users'] = [
    ...names.map((name, i) => ({
      id: `p-${pad(i + 1)}`,
      name,
      role: 'patient' as const,
      joined: iso(8 + (i % 3), 2 + i),
      active: true,
    })),
    ...['Avery Morgan', 'Robin Hale', 'Casey Rowan', 'Alex Quinn'].map((name, i) => ({
      id: `d-${pad(i + 1)}`,
      name: `Dr. ${name}`,
      role: 'doctor' as const,
      specialty: ['General practice', 'Internal medicine', 'General practice', 'Family medicine'][
        i
      ],
      joined: iso(8, 3 + i),
      active: true,
    })),
    { id: 'a-01', name: 'Jordan Ellis', role: 'admin', joined: iso(8, 1), active: true },
  ];
  const statuses: CaseStatus[] = ['Submitted', 'Assigned', 'Reviewed', 'Closed'];
  const cases: DemoState['cases'] = Array.from({ length: 36 }, (_, i) => ({
    id: `MA-${String(2401 + i)}`,
    patientId: `p-${pad((i % 12) + 1)}`,
    doctorId: i % 4 === 0 ? undefined : `d-${pad((i % 4) + 1)}`,
    title: ['Sample intake', 'Document follow-up', 'Record review'][Math.floor(i / 12)],
    submitted: iso(i < 8 ? 8 : i < 20 ? 9 : 10, 3 + (i % 12) * 2),
    status: statuses[(i + Math.floor(i / 12)) % 4],
    assessmentId: 'sample-a',
    reportIds: i % 3 === 0 ? [`R-${2401 + i}`] : [],
  }));
  // Keep assignment semantics consistent with workflow status.
  cases.forEach((c) => {
    if (c.status === 'Submitted') c.doctorId = undefined;
    else c.doctorId = DOCTOR_ID;
  });
  const reports: DemoState['reports'] = cases
    .filter((c) => c.reportIds.length)
    .map((c, i) => ({
      id: c.reportIds[0],
      patientId: c.patientId,
      caseId: c.id,
      name: i % 2 ? 'Fictional intake record' : 'Sample visit summary',
      date: c.submitted,
      type: i % 2 ? 'TXT' : 'PDF',
      category: i % 2 ? 'Intake' : 'Summary',
      pages: i % 2 ? 1 : 2,
    }));
  const apptStatuses: AppointmentStatus[] = ['Requested', 'Confirmed', 'Requested', 'Cancelled'];
  const appointments: DemoState['appointments'] = Array.from({ length: 24 }, (_, i) => ({
    id: `APT-${701 + i}`,
    patientId: `p-${pad((i % 12) + 1)}`,
    doctorId: DOCTOR_ID,
    date: i < 12 ? iso(9, 3 + i * 2) : iso(10, 26 + Math.floor((i - 12) / 5)),
    time: SLOTS[i % 5],
    status: i < 12 ? 'Completed' : apptStatuses[(i - 12) % 4],
    kind: i % 2 ? 'Follow-up' : 'Record review',
  }));
  const reviews = cases
    .filter((c) => ['Reviewed', 'Closed'].includes(c.status))
    .map((c, i) => ({
      id: `REV-${i + 1}`,
      caseId: c.id,
      doctorId: DOCTOR_ID,
      created: c.submitted + 'T15:00:00Z',
      note: REVIEW_NOTES[i % 3],
      assessment: 'Demonstration review recorded. No clinical conclusion.',
    }));
  const events = [
    ...cases.flatMap((c) => [
      {
        id: `EV-${c.id}-submitted`,
        actor: 'Demo coordinator',
        action: 'Case' as const,
        description: `${c.id} · submitted in sample workflow`,
        time: c.submitted + 'T09:00:00Z',
      },
      ...(c.doctorId
        ? [
            {
              id: `EV-${c.id}-assigned`,
              actor: 'Demo coordinator',
              action: 'Case' as const,
              description: `${c.id} · assigned to demo professional`,
              time: c.submitted + 'T10:00:00Z',
            },
          ]
        : []),
      ...(c.status === 'Closed'
        ? [
            {
              id: `EV-${c.id}-closed`,
              actor: 'Demo coordinator',
              action: 'Case' as const,
              description: `${c.id} · closed in sample workflow`,
              time: c.submitted + 'T16:00:00Z',
            },
          ]
        : []),
    ]),
    ...reviews.map((r) => ({
      id: `EV-${r.id}`,
      actor: 'Dr. Avery Morgan',
      action: 'Review' as const,
      description: `${r.caseId} · sample professional review recorded`,
      time: r.created,
    })),
  ].sort((a, b) => b.time.localeCompare(a.time));
  return {
    users,
    cases,
    appointments,
    reports,
    reviews,
    events,
    readNotifications: [],
    profile: { alias: 'Mira Chen (Demo)', language: 'English', reminders: true },
  };
}
