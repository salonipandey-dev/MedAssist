import {
  ArrowRight,
  Bell,
  CheckCheck,
  ChevronRight,
  ClipboardList,
  FileText,
  Plus,
  Stethoscope,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useDemo } from '../../app/Provider';
import {
  Avatar,
  Button,
  EmptyState,
  Notice,
  PageHeading,
  Panel,
  Stat,
  Status,
  TextLink,
} from '../../components/ui';
import { PATIENT_ID } from '../../data/mock/seed';
import { roleAppointments, roleCases } from '../../data/mock/service';
import type { DemoReport, Role } from '../../types';
import { formatDate } from '../../utils/format';
import { CaseDrawer } from '../cases/Cases';
import { ReportPreview } from '../reports/Reports';
export function PatientOverview() {
  const { state } = useDemo();
  const [selected, setSelected] = useState<string | null>(null);
  const [report, setReport] = useState<DemoReport | null>(null);
  const cases = [...roleCases(state, 'patient')].sort((a, b) =>
    b.submitted.localeCompare(a.submitted),
  );
  const appointments = roleAppointments(state, 'patient')
    .filter((a) => ['Requested', 'Confirmed'].includes(a.status))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const next = appointments[0];
  const nextDoctor = state.users.find((user) => user.id === next?.doctorId);
  const reports = state.reports.filter((r) => r.patientId === PATIENT_ID);
  const events = state.events
    .filter((e) => cases.some((c) => e.description.includes(c.id)))
    .slice(0, 4);
  const pending = cases.filter((c) => ['Submitted', 'Assigned'].includes(c.status)).length;
  return (
    <>
      <PageHeading
        eyebrow="Patient overview · Demo clock 25 Oct 2026"
        title={`Welcome back, ${state.profile.alias.split(' ')[0]}.`}
        description="Your sample cases, appointment requests and documents. All records are fictional."
        action={
          <Button asChild>
            <Link to="/app/patient/assessments">
              <Plus size={15} />
              Explore sample assessment
            </Link>
          </Button>
        }
      />
      <div className="stat-grid">
        <Stat label="My cases" value={cases.length} detail="Sample records" />
        <Stat label="Awaiting review" value={pending} detail="Workflow status only" />
        <Stat label="Appointments" value={appointments.length} detail="Requested or confirmed" />
        <Stat label="Documents" value={reports.length} detail="Built-in previews" />
      </div>
      <div className="patient-main-grid">
        <div className="stack">
          <Panel
            title="Recent cases"
            description="Select a case to see its workflow history"
            action={<TextLink to="/app/patient/cases">View all</TextLink>}
          >
            <div className="patient-case-list">
              {cases.slice(0, 3).map((c) => (
                <button key={c.id} className="patient-case-row" onClick={() => setSelected(c.id)}>
                  <span className="patient-case-title">
                    <strong>{c.title}</strong>
                    <small>
                      {c.id} <span>·</span> Submitted {formatDate(c.submitted)}
                    </small>
                  </span>
                  <Status status={c.status} />
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
            <div className="panel-footnote">
              Case status describes workflow progress, not medical urgency.
            </div>
          </Panel>
          <Panel
            title="Recent activity"
            description="Workflow events recorded in this demo session"
            action={<TextLink to="/app/patient/history">View history</TextLink>}
          >
            <ul className="timeline">
              {events.map((event) => (
                <li key={event.id}>
                  <span className="timeline-icon">
                    {event.action === 'Review' ? (
                      <Stethoscope size={12} />
                    ) : (
                      <ClipboardList size={12} />
                    )}
                  </span>
                  <div>
                    <strong>{event.description}</strong>
                    <p>{event.actor}</p>
                  </div>
                  <time>
                    {formatDate(event.time, { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                  </time>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
        <div className="stack">
          <Panel title="Next appointment" description="Fictional availability · not a booking">
            {next ? (
              <div className="next-appointment">
                <div className="appointment-day">
                  <strong>{formatDate(next.date, { day: '2-digit', timeZone: 'UTC' })}</strong>
                  <span>{formatDate(next.date, { month: 'short', timeZone: 'UTC' })}</span>
                </div>
                <div>
                  <Status status={next.status} />
                  <h3>{next.kind}</h3>
                  <p>{next.time} IST</p>
                </div>
                <div className="appointment-doctor">
                  <Avatar name={nextDoctor?.name ?? 'Not assigned'} size="sm" />
                  <div>
                    <strong>{nextDoctor?.name ?? 'Professional not assigned'}</strong>
                    <small>
                      {nextDoctor?.specialty ?? 'Sample workspace'} · Fictional professional
                    </small>
                  </div>
                </div>
                <Button variant="secondary" className="full-width" asChild>
                  <Link to="/app/patient/appointments">
                    View appointments <ArrowRight size={14} />
                  </Link>
                </Button>
              </div>
            ) : (
              <EmptyState
                title="No upcoming sample appointment"
                description="Choose a fictional slot on the appointments page to try a request."
                action={
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/app/patient/appointments">Open appointments</Link>
                  </Button>
                }
              />
            )}
          </Panel>
          <Panel title="Documents" description="Built-in previews · no uploaded files">
            {reports.slice(0, 2).map((r) => (
              <button className="document-shortcut" key={r.id} onClick={() => setReport(r)}>
                <span className="file-icon">
                  <FileText size={17} />
                </span>
                <span>
                  <strong>{r.name}</strong>
                  <small>
                    {r.caseId} · {formatDate(r.date)} · {r.type} metadata
                  </small>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
            <div className="panel-link-row">
              <TextLink to="/app/patient/reports">Open document library</TextLink>
            </div>
          </Panel>
        </div>
      </div>
      <CaseDrawer
        record={state.cases.find((c) => c.id === selected) ?? null}
        onClose={() => setSelected(null)}
      />
      <ReportPreview report={report} onClose={() => setReport(null)} />
    </>
  );
}
export function PatientHistory() {
  const { state } = useDemo();
  const cases = roleCases(state, 'patient');
  const reviews = state.reviews.filter((r) => cases.some((c) => c.id === r.caseId));
  return (
    <>
      <PageHeading
        eyebrow="Patient · Health history"
        title="Health history"
        description="Fixed fictional context and the sample case history for this patient."
      />
      <div className="grid-2">
        <Panel title="Fictional patient context" description="Predefined demonstration only">
          <div className="padded" style={{ paddingTop: 0 }}>
            <dl className="detail-grid">
              <div>
                <dt>Patient</dt>
                <dd>Mira Chen · Fictional adult</dd>
              </div>
              <div>
                <dt>Medical conditions</dt>
                <dd>Not specified in sample</dd>
              </div>
              <div>
                <dt>Medications</dt>
                <dd>Not collected</dd>
              </div>
              <div>
                <dt>Allergies</dt>
                <dd>Not collected</dd>
              </div>
            </dl>
            <div className="mt-6">
              <Notice>
                No absence of an illness or allergy is implied. This is illustrative sample context,
                not a medical record.
              </Notice>
            </div>
          </div>
        </Panel>
        <Panel title="Sample record summary">
          <div className="padded" style={{ paddingTop: 0 }}>
            <div className="history-counts">
              <div>
                <strong>{cases.length}</strong>
                <span>Sample cases</span>
              </div>
              <div>
                <strong>{reviews.length}</strong>
                <span>Review records</span>
              </div>
            </div>
            <p className="muted text-small mt-6">
              Professional reviews are kept separately from future AI predictions. No diagnosis or
              treatment history is available.
            </p>
          </div>
        </Panel>
      </div>
      <div className="mt-6">
        <ActivityView role="patient" embedded />
      </div>
    </>
  );
}
export function ActivityView({ role, embedded = false }: { role: Role; embedded?: boolean }) {
  const { state, dispatch } = useDemo();
  const cases = roleCases(state, role);
  const events = state.events.filter(
    (e) => role === 'admin' || cases.some((c) => e.description.includes(c.id)),
  );
  const [filter, setFilter] = useState('All');
  const [unread, setUnread] = useState(false);
  const filtered = events.filter(
    (e) =>
      (filter === 'All' || e.action === filter) &&
      (!unread || !state.readNotifications.includes(e.id)),
  );
  return (
    <>
      {!embedded && (
        <PageHeading
          eyebrow={role === 'patient' ? 'Patient · Notifications' : 'Activity'}
          title={role === 'patient' ? 'Notifications' : 'Activity'}
          description="Sample workflow updates held in page memory. No real alerts are sent."
        />
      )}
      <Panel
        title={embedded ? 'Sample history timeline' : 'Workspace updates'}
        description="Fictional events · Not a production audit system"
        action={
          role === 'patient' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                events.forEach((e) => dispatch({ type: 'readNotification', id: e.id }));
                toast.success('Sample notifications marked as read.');
              }}
            >
              <CheckCheck size={14} />
              Mark all read
            </Button>
          )
        }
      >
        <div className="toolbar">
          <label className="field">
            <span className="sr-only">Filter activity type</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="All">All activity</option>
              <option>Case</option>
              <option>Review</option>
            </select>
          </label>
          {role === 'patient' && (
            <label className="switch">
              <input
                type="checkbox"
                checked={unread}
                onChange={(e) => setUnread(e.target.checked)}
              />
              Unread only
            </label>
          )}
        </div>
        {filtered.length ? (
          <ul className="notification-list">
            {filtered.slice(0, 30).map((e) => (
              <li key={e.id} className={state.readNotifications.includes(e.id) ? 'is-read' : ''}>
                <span className="notification-symbol">
                  {e.action === 'Review' ? <Stethoscope size={18} /> : <Bell size={18} />}
                </span>
                <div>
                  <strong>{e.description}</strong>
                  <p>
                    {formatDate(e.time)} · {e.actor}
                  </p>
                </div>
                {role === 'patient' && !state.readNotifications.includes(e.id) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dispatch({ type: 'readNotification', id: e.id })}
                  >
                    Mark read
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="You’re all caught up"
            description="No sample notifications match this view."
          />
        )}
      </Panel>
    </>
  );
}
