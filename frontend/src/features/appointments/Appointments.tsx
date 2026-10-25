import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useDemo } from '../../app/Provider';
import {
  Avatar,
  Badge,
  Button,
  DialogPanel,
  Notice,
  PageHeading,
  Panel,
  Status,
  Tabs,
} from '../../components/ui';
import { DataTable } from '../../components/ui/DataTable';
import { DOCTOR_ID, SAMPLE_TODAY, SLOTS } from '../../data/mock/seed';
import { roleAppointments } from '../../data/mock/service';
import type { Role } from '../../types';
import { cx, formatDate } from '../../utils/format';
export function SampleCalendar({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (date: string) => void;
}) {
  const [month, setMonth] = useState(9);
  const first = new Date(Date.UTC(2026, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(2026, month + 1, 0)).getUTCDate();
  return (
    <div className="sample-calendar">
      <div className="calendar-header">
        <strong>
          {formatDate(first.toISOString(), { month: 'long', year: 'numeric', timeZone: 'UTC' })}
        </strong>
        <div className="inline-actions">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous sample month"
            disabled={month === 9}
            onClick={() => setMonth((m) => m - 1)}
          >
            <ChevronLeft size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next sample month"
            disabled={month === 11}
            onClick={() => setMonth((m) => m + 1)}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
      <div className="calendar-grid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <span className="weekday" key={d}>
            {d}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={'empty' + i} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const date = `2026-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
          const weekend = [0, 6].includes(new Date(date + 'T12:00:00Z').getUTCDay());
          return (
            <button
              key={date}
              className={cx(date === selected && 'selected', date === SAMPLE_TODAY && 'today')}
              disabled={date <= SAMPLE_TODAY || weekend}
              aria-pressed={date === selected}
              aria-label={formatDate(date, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              })}
              onClick={() => onSelect(date)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <p className="calendar-legend">
        <span />
        Selected day <i />
        Weekdays only · Fictional availability
      </p>
    </div>
  );
}
export function AppointmentRequest() {
  const { state, dispatch } = useDemo();
  const [date, setDate] = useState('2026-10-26');
  const [doctorId, setDoctorId] = useState(DOCTOR_ID);
  const [time, setTime] = useState('');
  const [confirm, setConfirm] = useState(false);
  const activeDoctors = state.users.filter((u) => u.role === 'doctor' && u.active);
  const chosenDoctorId = activeDoctors.some((u) => u.id === doctorId)
    ? doctorId
    : (activeDoctors[0]?.id ?? '');
  const doctor = activeDoctors.find((u) => u.id === chosenDoctorId);
  const unavailable = (slot: string) =>
    state.appointments.some(
      (a) =>
        a.doctorId === chosenDoctorId &&
        a.date === date &&
        a.time === slot &&
        ['Requested', 'Confirmed'].includes(a.status),
    );
  function request() {
    if (!doctor || !time || unavailable(time)) {
      setConfirm(false);
      toast.error('That sample slot is unavailable. Choose another time.');
      return;
    }
    dispatch({ type: 'requestAppointment', date, time, doctorId: chosenDoctorId });
    setConfirm(false);
    setTime('');
    toast.success('Sample appointment requested in memory. No real booking was made.');
  }
  return (
    <Panel
      title="Find a little space in your day"
      description="Try an appointment request using fictional availability only"
    >
      <div className="appointment-request-grid">
        <SampleCalendar
          selected={date}
          onSelect={(d) => {
            setDate(d);
            setTime('');
          }}
        />
        <div className="appointment-slots">
          <label className="field">
            <span>Demo professional</span>
            <select
              value={chosenDoctorId}
              disabled={!activeDoctors.length}
              onChange={(e) => {
                setDoctorId(e.target.value);
                setTime('');
              }}
            >
              {!activeDoctors.length && <option value="">No sample professionals available</option>}
              {activeDoctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <h3 className="mt-6">
            {formatDate(date, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}
          </h3>
          <p className="muted text-small mt-4" style={{ marginTop: 6 }}>
            Sample time slots · Demo time zone: Asia/Kolkata
          </p>
          <div className="slot-grid">
            {SLOTS.map((slot) => (
              <button
                key={slot}
                className={cx('time-slot', time === slot && 'selected')}
                disabled={!doctor || unavailable(slot)}
                aria-pressed={time === slot}
                onClick={() => setTime(slot)}
              >
                {slot}
                {unavailable(slot) && <small>Unavailable</small>}
              </button>
            ))}
          </div>
          <Button
            className="full-width"
            disabled={!time || !doctor}
            onClick={() => setConfirm(true)}
          >
            <Plus size={15} />
            Request sample appointment
          </Button>
          <p className="muted text-small mt-4">
            No real clinician availability is connected. Nothing is booked outside this demo.
          </p>
        </div>
      </div>
      <DialogPanel
        open={confirm}
        onOpenChange={setConfirm}
        title="Request this sample appointment?"
        description="Fictional availability · Not a real healthcare booking"
      >
        <div className="appointment-confirm-card">
          <Avatar name={doctor?.name ?? 'Unavailable'} size="lg" />
          <h3>{doctor?.name ?? 'Unavailable'}</h3>
          <p className="muted text-small">Fictional healthcare professional</p>
          <div className="flex-center">
            <CalendarDays size={16} />
            {formatDate(date)}
            <span>·</span>
            <Clock3 size={15} />
            {time} IST
          </div>
        </div>
        <Notice>
          This request is stored only in page memory. Reloading removes it. No appointment message
          is sent.
        </Notice>
        <div className="form-actions">
          <Button variant="secondary" onClick={() => setConfirm(false)}>
            Go back
          </Button>
          <Button onClick={request}>Confirm sample request</Button>
        </div>
      </DialogPanel>
    </Panel>
  );
}
export function Appointments({ role }: { role: Role }) {
  const { state, dispatch } = useDemo();
  const [tab, setTab] = useState('Upcoming');
  const [selected, setSelected] = useState<string | null>(null);
  const [cancel, setCancel] = useState(false);
  const records = roleAppointments(state, role).filter((a) =>
    tab === 'Upcoming'
      ? ['Requested', 'Confirmed'].includes(a.status)
      : ['Completed', 'Cancelled'].includes(a.status),
  );
  const appointment = state.appointments.find((a) => a.id === selected);
  return (
    <>
      <PageHeading
        eyebrow={role === 'patient' ? 'MAKE ROOM FOR WHAT MATTERS' : 'APPOINTMENT COORDINATION'}
        title={role === 'patient' ? 'My appointments' : 'Appointments'}
        description="Fictional schedules, thoughtful details and a clear view of what comes next."
        action={<Badge tone="teal">Sample Data · IST</Badge>}
      />
      {role === 'patient' && (
        <div className="mb-4">
          <AppointmentRequest />
        </div>
      )}
      <Tabs items={['Upcoming', 'History']} value={tab} onChange={setTab}>
        <Panel
          title={tab === 'Upcoming' ? 'Upcoming appointments' : 'Appointment history'}
          description="Fictional appointment records · Filter by workflow state"
        >
          <DataTable
            rows={records}
            label="appointments"
            getId={(a) => a.id}
            getSearch={(a) =>
              `${a.id} ${state.users.find((u) => u.id === a.patientId)?.name} ${a.date} ${a.time}`
            }
            getStatus={(a) => a.status}
            filterOptions={
              tab === 'Upcoming' ? ['Requested', 'Confirmed'] : ['Completed', 'Cancelled']
            }
            columns={[
              {
                key: 'id',
                label: 'Appointment',
                sortValue: (a) => a.id,
                render: (a) => (
                  <div>
                    <strong className="mono">{a.id}</strong>
                    <p className="muted text-small" style={{ fontSize: 10, marginTop: 5 }}>
                      {a.kind}
                    </p>
                  </div>
                ),
              },
              {
                key: 'person',
                label: role === 'patient' ? 'Professional' : 'Patient',
                sortValue: (a) =>
                  state.users.find((u) => u.id === (role === 'patient' ? a.doctorId : a.patientId))
                    ?.name ?? '',
                render: (a) => {
                  const user = state.users.find(
                    (u) => u.id === (role === 'patient' ? a.doctorId : a.patientId),
                  )!;
                  return (
                    <div className="table-person">
                      <Avatar name={user.name} size="sm" />
                      <span className="text-small">{user.name}</span>
                    </div>
                  );
                },
              },
              {
                key: 'date',
                label: 'Date & time',
                sortValue: (a) => a.date + a.time,
                render: (a) => (
                  <div className="text-small">
                    {formatDate(a.date)}
                    <p className="muted" style={{ fontSize: 10, marginTop: 4 }}>
                      {a.time} IST
                    </p>
                  </div>
                ),
              },
              { key: 'status', label: 'Status', render: (a) => <Status status={a.status} /> },
              {
                key: 'details',
                label: 'Details',
                render: (a) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelected(a.id);
                      setCancel(false);
                    }}
                  >
                    View details
                  </Button>
                ),
              },
            ]}
          />
        </Panel>
      </Tabs>
      <DialogPanel
        open={!!appointment}
        onOpenChange={(open) => !open && setSelected(null)}
        title={appointment?.id ?? 'Appointment'}
        description="Fictional appointment detail · No real booking"
      >
        {appointment && (
          <>
            <div className="case-id-row">
              <h3>{appointment.kind}</h3>
              <Status status={appointment.status} />
            </div>
            <dl className="detail-grid mt-6">
              <div>
                <dt>Patient</dt>
                <dd>{state.users.find((u) => u.id === appointment.patientId)?.name}</dd>
              </div>
              <div>
                <dt>Professional</dt>
                <dd>{state.users.find((u) => u.id === appointment.doctorId)?.name}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{formatDate(appointment.date)}</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>{appointment.time} · Asia/Kolkata</dd>
              </div>
            </dl>
            <div className="mt-6">
              <Notice>
                {cancel
                  ? 'Confirm cancellation of this sample appointment. This changes page memory only.'
                  : 'All appointments are fictional. No real clinician or calendar is connected.'}
              </Notice>
            </div>
            {['Requested', 'Confirmed'].includes(appointment.status) && (
              <div className="form-actions">
                {role !== 'patient' && appointment.status === 'Requested' && !cancel && (
                  <Button
                    onClick={() => {
                      dispatch({
                        type: 'appointmentStatus',
                        id: appointment.id,
                        status: 'Confirmed',
                      });
                      toast.success('Sample appointment confirmed in memory.');
                    }}
                  >
                    Confirm sample
                  </Button>
                )}
                {cancel ? (
                  <>
                    <Button variant="secondary" onClick={() => setCancel(false)}>
                      Keep appointment
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        dispatch({
                          type: 'appointmentStatus',
                          id: appointment.id,
                          status: 'Cancelled',
                        });
                        setCancel(false);
                        toast.success('Sample appointment cancelled.');
                      }}
                    >
                      Confirm cancellation
                    </Button>
                  </>
                ) : (
                  <Button variant="secondary" onClick={() => setCancel(true)}>
                    Cancel sample appointment
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </DialogPanel>
    </>
  );
}
