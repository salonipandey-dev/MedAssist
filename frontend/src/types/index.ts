export type Role = 'patient' | 'doctor' | 'admin';
export type CaseStatus = 'Submitted' | 'Assigned' | 'Reviewed' | 'Closed';
export type AppointmentStatus = 'Requested' | 'Confirmed' | 'Completed' | 'Cancelled';
export interface DemoUser { id: string; name: string; role: Role; joined: string; active: boolean; specialty?: string }
export interface CaseRecord { id: string; patientId: string; doctorId?: string; title: string; submitted: string; status: CaseStatus; assessmentId: string; reportIds: string[] }
export interface Review { id: string; caseId: string; doctorId: string; created: string; note: string; assessment: string }
export interface Appointment { id: string; patientId: string; doctorId: string; date: string; time: string; status: AppointmentStatus; kind: string }
export interface DemoReport { id: string; patientId: string; caseId: string; name: string; date: string; type: 'PDF' | 'TXT'; category: 'Summary' | 'Intake'; pages: number }
export interface AuditEvent { id: string; actor: string; action: 'Case' | 'Appointment' | 'User' | 'Review' | 'System'; description: string; time: string }
export interface DemoState { users: DemoUser[]; cases: CaseRecord[]; appointments: Appointment[]; reports: DemoReport[]; reviews: Review[]; events: AuditEvent[]; readNotifications: string[]; profile: { alias: string; language: string; reminders: boolean } }
