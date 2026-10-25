import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCheck,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Stethoscope,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { useDemo } from '../../app/Provider';
import { DistributionChart } from '../../components/charts/Charts';
import {
  Avatar,
  Badge,
  Button,
  DialogPanel,
  EmptyState,
  Notice,
  PageHeading,
  Panel,
  Stat,
  Status,
  TextLink,
} from '../../components/ui';
import { AIConcept } from '../../components/ui/AIConcept';
import { DataTable } from '../../components/ui/DataTable';
import { DOCTOR_ID, REVIEW_NOTES } from '../../data/mock/seed';
import { roleAppointments, roleCases } from '../../data/mock/service';
import type { CaseRecord, DemoUser } from '../../types';
import { formatDate } from '../../utils/format';
import { SampleCalendar } from '../appointments/Appointments';
import { CaseContent, CaseDrawer } from '../cases/Cases';
export function DoctorOverview() {
  const { state } = useDemo();
  const [selected, setSelected] = useState<string | null>(null);
  const cases = roleCases(state, 'doctor');
  const pending = cases.filter((c) => c.status === 'Assigned');
  const appointments = roleAppointments(state, 'doctor')
    .filter((a) => ['Confirmed', 'Requested'].includes(a.status))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const reviews = state.reviews.filter((r) => r.doctorId === DOCTOR_ID);
  return (
    <>
      <PageHeading
        eyebrow="DOCTOR WORKSPACE · FICTIONAL PROFESSIONAL"
        title="Good to see you, Dr. Morgan."
        description="The context you need. The space to make your own assessment."
        action={
          <Button asChild>
            <Link to={pending[0] ? `/app/doctor/reviews/${pending[0].id}` : '/app/doctor/cases'}>
              <Stethoscope size={15} />
              Open review workspace
            </Link>
          </Button>
        }
      />
      <div className="doctor-focus-bar">
        <div>
          <span className="doctor-focus-icon">
            <Stethoscope size={22} />
          </span>
          <div>
            <h2>Your next review starts with context.</h2>
            <p>{pending.length} assigned sample cases await a professional workflow review.</p>
          </div>
        </div>
        <Badge tone="indigo">Human-led · Independent reviews</Badge>
      </div>
      <div className="stat-grid">
        <Stat
          label="Assigned cases"
          value={cases.length}
          detail="Fictional case records"
          icon={<ClipboardList />}
          tone="indigo"
        />
        <Stat
          label="Awaiting review"
          value={pending.length}
          detail="Workflow queue, not urgency"
          icon={<Clock3 />}
          tone="amber"
        />
        <Stat
          label="Upcoming appointments"
          value={appointments.length}
          detail="Fictional availability only"
          icon={<CalendarDays />}
        />
        <Stat
          label="Review records"
          value={reviews.length}
          detail="Independent sample records"
          icon={<ClipboardCheck />}
        />
      </div>
      <div className="doctor-overview-grid">
        <Panel
          title="Your review queue"
          description="Assigned sample cases, ordered by submission"
          action={<TextLink to="/app/doctor/cases">All assigned cases</TextLink>}
        >
          <DataTable
            rows={[...pending].sort((a, b) => a.submitted.localeCompare(b.submitted))}
            label="review queue"
            getId={(c) => c.id}
            getSearch={(c) => `${c.id} ${state.users.find((u) => u.id === c.patientId)?.name}`}
            pageSize={5}
            columns={[
              {
                key: 'patient',
                label: 'Patient & case',
                sortValue: (c) => c.id,
                render: (c) => (
                  <div className="table-person">
                    <Avatar name={state.users.find((u) => u.id === c.patientId)!.name} />
                    <div>
                      <strong>{state.users.find((u) => u.id === c.patientId)!.name}</strong>
                      <small>{c.id} · Fictional patient</small>
                    </div>
                  </div>
                ),
              },
              {
                key: 'date',
                label: 'Submitted',
                sortValue: (c) => c.submitted,
                render: (c) => <span className="text-small">{formatDate(c.submitted)}</span>,
              },
              { key: 'status', label: 'Status', render: (c) => <Status status={c.status} /> },
              {
                key: 'review',
                label: 'Action',
                render: (c) => (
                  <Button asChild size="sm" variant="secondary">
                    <Link to={`/app/doctor/reviews/${c.id}`}>
                      Review <ArrowRight size={13} />
                    </Link>
                  </Button>
                ),
              },
            ]}
          />
        </Panel>
        <DistributionChart
          title="Case workflow"
          description="Assigned sample cases by coordination status"
          data={['Assigned', 'Reviewed', 'Closed'].map((name) => ({
            name,
            value: cases.filter((c) => c.status === name).length,
          }))}
        />
      </div>
      <div className="grid-2 mt-6">
        <Panel
          title="Next in your schedule"
          description="Sample appointments · Asia/Kolkata"
          action={<TextLink to="/app/doctor/schedule">View schedule</TextLink>}
        >
          {appointments.slice(0, 4).map((a) => (
            <div className="schedule-row" key={a.id}>
              <span className="schedule-time">
                {a.time}
                <small>IST</small>
              </span>
              <Avatar name={state.users.find((u) => u.id === a.patientId)!.name} size="sm" />
              <div>
                <strong>{state.users.find((u) => u.id === a.patientId)!.name}</strong>
                <p>
                  {formatDate(a.date)} · {a.kind}
                </p>
              </div>
              <Status status={a.status} />
            </div>
          ))}
        </Panel>
        <Panel
          title="Recent professional reviews"
          description="Independent from any future AI assistance"
          action={<TextLink to="/app/doctor/activity">View activity</TextLink>}
        >
          {[...reviews]
            .sort((a, b) => b.created.localeCompare(a.created))
            .slice(0, 4)
            .map((r) => (
              <button className="review-list-row" key={r.id} onClick={() => setSelected(r.caseId)}>
                <span className="timeline-icon">
                  <CheckCheck size={13} />
                </span>
                <div>
                  <strong>{r.caseId} · Sample review recorded</strong>
                  <p>{r.note}</p>
                </div>
                <span className="muted text-small">
                  {formatDate(r.created, { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                </span>
              </button>
            ))}
        </Panel>
      </div>
      <div className="mt-6">
        <Notice kind="safe">
          <strong>Professional review is a separate record.</strong> No triage model is integrated.
          Case workflow labels never indicate medical urgency and no clinical conclusions are
          generated.
        </Notice>
      </div>
      <CaseDrawer
        role="doctor"
        record={state.cases.find((c) => c.id === selected) ?? null}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
const reviewSchema = z.object({
  note: z.enum(REVIEW_NOTES as [string, ...string[]]),
  status: z.enum(['Reviewed', 'Closed']),
  confirm: z
    .boolean()
    .refine((v) => v, { message: 'Confirm that this is a fictional workflow review.' }),
});
type ReviewInput = z.infer<typeof reviewSchema>;
function ReviewForm({ record }: { record: CaseRecord }) {
  const { dispatch } = useDemo();
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ReviewInput>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { note: REVIEW_NOTES[0], status: 'Reviewed', confirm: false },
  });
  if (record.status === 'Closed')
    return (
      <Panel title="This sample case is closed">
        <div className="padded">
          <Notice>
            The case is closed in the demonstration workflow. Its professional review history
            remains available in the case chronology.
          </Notice>
        </div>
      </Panel>
    );
  return (
    <Panel
      title="Independent professional review"
      description="Predefined sample notes only · No clinical conclusion"
    >
      <form
        className="review-form"
        noValidate
        onSubmit={handleSubmit((values) => {
          dispatch({ type: 'review', caseId: record.id, note: values.note, status: values.status });
          setSaved(true);
          toast.success(
            'Independent sample review recorded in memory. No clinical assessment was made.',
          );
        })}
      >
        <div className="review-author">
          <Avatar name="Avery Morgan" />
          <div>
            <strong>Dr. Avery Morgan</strong>
            <small>Fictional professional · {DOCTOR_ID}</small>
          </div>
          <Badge tone="indigo">Human review</Badge>
        </div>
        <label className="field" htmlFor="sample-note">
          <span>Professional note template</span>
          <select id="sample-note" {...register('note')}>
            {REVIEW_NOTES.map((note) => (
              <option key={note}>{note}</option>
            ))}
          </select>
          <small>
            Free-text clinical notes are disabled to avoid collecting real health information.
          </small>
        </label>
        <div className="review-conclusion">
          <span className="divider-label">DOCTOR’S ASSESSMENT · FIXED SAMPLE</span>
          <p>Demonstration review recorded. No clinical conclusion.</p>
        </div>
        <label className="field" htmlFor="review-status">
          <span>Case workflow status</span>
          <select id="review-status" {...register('status')}>
            <option>Reviewed</option>
            <option>Closed</option>
          </select>
          <small>Coordination status only. This does not assign medical urgency.</small>
        </label>
        <label className="switch review-confirm">
          <input
            type="checkbox"
            {...register('confirm')}
            aria-describedby={errors.confirm ? 'confirm-error' : undefined}
          />
          <span>I understand this records a fictional workflow review only.</span>
        </label>
        {errors.confirm && (
          <p className="field-error" role="alert" id="confirm-error">
            {errors.confirm.message}
          </p>
        )}
        {saved && (
          <div className="notice notice-safe" role="status">
            <Check size={16} />
            <span>Sample professional review recorded separately. No AI prediction exists.</span>
          </div>
        )}
        <div className="form-actions">
          <Button type="submit">
            <Check size={15} />
            Record sample review
          </Button>
        </div>
      </form>
    </Panel>
  );
}
export function ReviewWorkspace() {
  const { state } = useDemo();
  const { caseId } = useParams();
  const navigate = useNavigate();
  const cases = roleCases(state, 'doctor');
  const record = caseId
    ? cases.find((c) => c.id === caseId)
    : (cases.find((c) => c.status === 'Assigned') ?? cases[0]);
  if (!record)
    return (
      <EmptyState
        title="Sample case not found"
        description="Choose an assigned sample case to open the review workspace."
        action={
          <Button asChild>
            <Link to="/app/doctor/cases">Open assigned cases</Link>
          </Button>
        }
      />
    );
  return (
    <>
      <Link className="text-link mb-4" to="/app/doctor/cases">
        <ArrowLeft size={14} />
        Back to assigned cases
      </Link>
      <PageHeading
        eyebrow="FOCUSED REVIEW WORKSPACE"
        title="Context first. Your review, independent."
        description="Review a fictional sample case and record a separate demonstration review."
        action={
          <label className="field">
            <span className="sr-only">Select sample case for review</span>
            <select
              value={record.id}
              onChange={(e) => navigate(`/app/doctor/reviews/${e.target.value}`)}
            >
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} · {c.status}
                </option>
              ))}
            </select>
          </label>
        }
      />
      <div className="review-workspace">
        <div>
          <Panel title="Patient context & case record" action={<Badge>Sample Data</Badge>}>
            <div className="padded" style={{ paddingTop: 0 }}>
              <CaseContent record={record} />
            </div>
          </Panel>
        </div>
        <div className="stack review-right">
          <ReviewForm record={record} key={record.id} />
          <AIConcept />
        </div>
      </div>
    </>
  );
}
export function PatientRecords() {
  const { state } = useDemo();
  const [selected, setSelected] = useState<DemoUser | null>(null);
  const cases = roleCases(state, 'doctor');
  const patients = state.users.filter((u) => cases.some((c) => c.patientId === u.id));
  return (
    <>
      <PageHeading
        eyebrow="CONTEXT, THOUGHTFULLY CONNECTED"
        title="Patient records"
        description="Fictional patients linked to assigned sample cases. These UI filters are not authorization."
      />
      <Panel
        title="Connected sample patients"
        description="Read-only sample context · No medical information is collected"
      >
        <DataTable
          rows={patients}
          label="patients"
          getId={(p) => p.id}
          getSearch={(p) => `${p.id} ${p.name}`}
          columns={[
            {
              key: 'name',
              label: 'Patient',
              sortValue: (p) => p.name,
              render: (p) => (
                <div className="table-person">
                  <Avatar name={p.name} />
                  <div>
                    <strong>{p.name}</strong>
                    <small>Fictional adult · {p.id}</small>
                  </div>
                </div>
              ),
            },
            {
              key: 'cases',
              label: 'Assigned cases',
              sortValue: (p) => cases.filter((c) => c.patientId === p.id).length,
              render: (p) => cases.filter((c) => c.patientId === p.id).length,
            },
            {
              key: 'date',
              label: 'Joined',
              sortValue: (p) => p.joined,
              render: (p) => formatDate(p.joined),
            },
            {
              key: 'detail',
              label: 'Details',
              render: (p) => (
                <Button size="sm" variant="ghost" onClick={() => setSelected(p)}>
                  Open sample record
                </Button>
              ),
            },
          ]}
        />
      </Panel>
      <DialogPanel
        drawer
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected?.name ?? 'Patient record'}
        description="Fixed fictional patient context · Not a medical record"
      >
        {selected && (
          <>
            <div className="case-patient">
              <Avatar name={selected.name} size="lg" />
              <div>
                <h3>{selected.name}</h3>
                <p>Fictional adult · {selected.id}</p>
              </div>
            </div>
            <div className="mt-6">
              <Notice>
                Medical conditions, medications and allergies are not specified in this sample. No
                absence of these is implied.
              </Notice>
            </div>
            <h3 className="mt-6">Assigned sample cases</h3>
            {cases
              .filter((c) => c.patientId === selected.id)
              .map((c) => (
                <div className="patient-record-case" key={c.id}>
                  <div>
                    <strong>{c.id}</strong>
                    <p>{c.title}</p>
                  </div>
                  <Status status={c.status} />
                  <Button variant="ghost" size="sm" asChild>
                    <Link
                      to={`/app/doctor/${c.status === 'Closed' ? 'cases' : 'reviews'}/${c.id}`}
                      onClick={() => setSelected(null)}
                    >
                      Open <ArrowRight size={13} />
                    </Link>
                  </Button>
                </div>
              ))}
          </>
        )}
      </DialogPanel>
    </>
  );
}
export function DoctorSchedule() {
  const { state } = useDemo();
  const [date, setDate] = useState('2026-10-26');
  const appointments = roleAppointments(state, 'doctor')
    .filter((a) => a.date === date && a.status !== 'Cancelled')
    .sort((a, b) => a.time.localeCompare(b.time));
  return (
    <>
      <PageHeading
        eyebrow="A CONSIDERED VIEW OF YOUR DAY"
        title="Your schedule"
        description="Fictional availability and sample appointments. Demo time zone: Asia/Kolkata."
      />
      <div className="schedule-layout">
        <Panel title="Choose a sample day">
          <div className="padded" style={{ paddingTop: 0 }}>
            <SampleCalendar selected={date} onSelect={setDate} />
          </div>
        </Panel>
        <Panel
          title={formatDate(date, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            timeZone: 'UTC',
          })}
          description={`${appointments.length} sample appointment${appointments.length === 1 ? '' : 's'} · IST`}
        >
          {appointments.length ? (
            appointments.map((a) => (
              <div className="schedule-row" key={a.id}>
                <span className="schedule-time">
                  {a.time}
                  <small>IST</small>
                </span>
                <Avatar name={state.users.find((u) => u.id === a.patientId)!.name} />
                <div>
                  <strong>{state.users.find((u) => u.id === a.patientId)!.name}</strong>
                  <p>
                    {a.kind} · {a.id}
                  </p>
                </div>
                <Status status={a.status} />
              </div>
            ))
          ) : (
            <EmptyState
              title="A clear day in this sample"
              description="Choose 26–28 October to explore the seeded appointment schedule."
            />
          )}
          <div className="padded">
            <Notice>
              Real schedule editing and external calendar synchronization require authenticated
              scheduling APIs and conflict checks.
            </Notice>
          </div>
        </Panel>
      </div>
    </>
  );
}
