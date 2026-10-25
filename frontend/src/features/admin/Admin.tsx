import {
  Activity,
  ArrowRight,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  Clock3,
  Download,
  Stethoscope,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useDemo } from '../../app/Provider';
import { DistributionChart, TrendChart } from '../../components/charts/Charts';
import {
  Avatar,
  Badge,
  Button,
  DialogPanel,
  Notice,
  PageHeading,
  Panel,
  Stat,
  Status,
  TextLink,
} from '../../components/ui';
import { DataTable } from '../../components/ui/DataTable';
import { analytics, type SampleRange } from '../../data/mock/analytics';
import { formatDate } from '../../utils/format';
function PeriodSelector({
  value,
  onChange,
}: {
  value: SampleRange;
  onChange: (range: SampleRange) => void;
}) {
  return (
    <label className="period-selector">
      <CalendarDays size={14} />
      <span className="sr-only">Sample date range</span>
      <select value={value} onChange={(e) => onChange(e.target.value as SampleRange)}>
        {['All months', 'October', 'September', 'August'].map((r) => (
          <option key={r}>{r}</option>
        ))}
      </select>
      <span>2026</span>
    </label>
  );
}
function exportSample(data: ReturnType<typeof analytics>) {
  const lines = [
    'Period,Cases,Appointments,Users',
    ...data.trend.map((row) => `${row.name} 2026,${row.cases},${row.appointments},${row.users}`),
  ];
  const url = URL.createObjectURL(
    new Blob(['Sample Data - MedAssist fictional dataset\n' + lines.join('\n')], {
      type: 'text/csv',
    }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'medassist-sample-activity.csv';
  anchor.click();
  URL.revokeObjectURL(url);
  toast.success('Fictional activity summary exported.');
}
export function AdminOverview({ detailed = false }: { detailed?: boolean }) {
  const { state } = useDemo();
  const [range, setRange] = useState<SampleRange>('All months');
  const [chart, setChart] = useState<'area' | 'bar'>('area');
  const data = analytics(state, range);
  const pending = data.cases.filter((c) => ['Submitted', 'Assigned'].includes(c.status));
  return (
    <>
      <PageHeading
        eyebrow="ADMINISTRATOR COMMAND CENTER"
        title={detailed ? 'A closer look at the bigger picture.' : 'Your platform, at a glance.'}
        description="A clear, connected view of fictional activity. Every number comes from the sample dataset."
        action={
          <div className="inline-actions">
            <PeriodSelector value={range} onChange={setRange} />
            <Button variant="secondary" onClick={() => exportSample(data)}>
              <Download size={14} />
              Export sample
            </Button>
          </div>
        }
      />
      <div className="admin-sample-banner">
        <div>
          <span className="admin-sample-icon">
            <ChartNoAxesCombined size={19} />
          </span>
          <div>
            <strong>Good data tells a clear story.</strong>
            <p>
              These metrics illustrate product workflows. They are not real hospital statistics.
            </p>
          </div>
        </div>
        <Badge tone="teal">
          <span className="status-dot" />
          Sample Data
        </Badge>
      </div>
      <div className="stat-grid">
        <Stat
          label={range === 'All months' ? 'Registered users' : 'Users joined in period'}
          value={data.users.length}
          detail={`${data.roles.find((r) => r.name === 'patient')?.value} patients · ${data.roles.find((r) => r.name === 'doctor')?.value} doctors · ${data.roles.find((r) => r.name === 'admin')?.value} admins`}
          icon={<Users />}
        />
        <Stat
          label="Case activity"
          value={data.cases.length}
          detail={
            range === 'All months'
              ? 'August–October sample records'
              : `${range} 2026 · Sample records`
          }
          icon={<ClipboardList />}
          tone="indigo"
        />
        <Stat
          label="Pending case reviews"
          value={pending.length}
          detail="Submitted + assigned workflows"
          icon={<Clock3 />}
          tone="amber"
        />
        <Stat
          label="Appointment records"
          value={data.appointments.length}
          detail={`${data.appointments.filter((a) => a.status === 'Requested').length} requested · ${data.appointments.filter((a) => a.status === 'Confirmed').length} confirmed`}
          icon={<CalendarDays />}
        />
      </div>
      <div className="admin-chart-grid">
        <div className="stack">
          <div className="chart-view-control">
            <span className="eyebrow">ACTIVITY OVER TIME</span>
            <div className="segmented" aria-label="Chart type">
              <button
                aria-pressed={chart === 'area'}
                className={chart === 'area' ? 'active' : ''}
                onClick={() => setChart('area')}
              >
                Trend
              </button>
              <button
                aria-pressed={chart === 'bar'}
                className={chart === 'bar' ? 'active' : ''}
                onClick={() => setChart('bar')}
              >
                Compare
              </button>
            </div>
          </div>
          <TrendChart
            title="Case & appointment activity"
            data={data.trend}
            kind={chart}
            description="Counts derived from fictional case submissions and appointment dates"
          />
        </div>
        <DistributionChart
          title="Cases by workflow status"
          data={data.workflow}
          description="Case coordination only · Not medical urgency"
        />
      </div>
      <div className="grid-2 mt-6">
        {detailed ? (
          <>
            <TrendChart
              title="Monthly activity comparison"
              data={data.trend}
              kind="bar"
              series={[
                { key: 'cases', label: 'Cases', color: '#0D9488' },
                { key: 'appointments', label: 'Appointments', color: '#6366F1' },
                { key: 'users', label: 'New users', color: '#5BA5B7' },
              ]}
              description="Sample records per month in the selected period"
            />
            <TrendChart
              title="Appointment trends"
              data={data.trend}
              series={[{ key: 'appointments', label: 'Appointments', color: '#6366F1' }]}
              description="Fictional appointment records by scheduled month"
            />
          </>
        ) : (
          <>
            <Panel
              title="Recent application activity"
              description="Illustrative events, not a secure production audit log"
              action={<TextLink to="/app/admin/audit">All activity</TextLink>}
            >
              <ul className="timeline admin-activity">
                {state.events.slice(0, 5).map((e) => (
                  <li key={e.id}>
                    <span className="timeline-icon">
                      {e.action === 'Review' ? <Stethoscope size={12} /> : <Activity size={12} />}
                    </span>
                    <div>
                      <strong>{e.description}</strong>
                      <p>{e.actor} · Sample event</p>
                    </div>
                    <time>
                      {formatDate(e.time, { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                    </time>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel
              title="Workspace shortcuts"
              description="Keep the next useful action within reach"
            >
              <div className="admin-shortcuts">
                {[
                  {
                    to: 'users',
                    label: 'Review sample accounts',
                    copy: 'Search users and inspect fictional role details',
                    icon: Users,
                  },
                  {
                    to: 'cases',
                    label: 'Explore case coordination',
                    copy: 'Follow the shared workflow across sample cases',
                    icon: ClipboardList,
                  },
                  {
                    to: 'analytics',
                    label: 'Take a closer look',
                    copy: 'Inspect activity trends and data summaries',
                    icon: ChartNoAxesCombined,
                  },
                ].map((item) => (
                  <Link key={item.to} to={`/app/admin/${item.to}`}>
                    <span className="action-icon">
                      <item.icon size={18} />
                    </span>
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.copy}</p>
                    </div>
                    <ArrowRight size={15} />
                  </Link>
                ))}
              </div>
            </Panel>
          </>
        )}
      </div>
      <div className="grid-2 mt-6">
        <DistributionChart
          title="User role breakdown"
          data={data.roles}
          description={
            range === 'All months'
              ? 'All registered fictional accounts'
              : `Fictional users joined in ${range.toLowerCase()}`
          }
        />
        <DistributionChart
          title="Appointment workflow states"
          data={data.appointmentStates}
          description="Fictional coordination states in the selected period"
        />
      </div>
      <div className="mt-6">
        <Notice>
          <strong>Consistent by construction.</strong> Date filters recompute the metrics and charts
          from the same in-memory records. Frontend role controls, sample events and displayed
          status labels are not production authorization or secure audit logging.
        </Notice>
      </div>
    </>
  );
}
export function UserManagement({ doctorsOnly = false }: { doctorsOnly?: boolean }) {
  const { state, dispatch } = useDemo();
  const [selected, setSelected] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const users = state.users.filter((u) => !doctorsOnly || u.role === 'doctor');
  const user = state.users.find((u) => u.id === selected);
  return (
    <>
      <PageHeading
        eyebrow="PEOPLE, THOUGHTFULLY ORGANIZED"
        title={doctorsOnly ? 'Doctor management' : 'User management'}
        description="Explore fictional accounts, role details and reversible demonstration controls."
        action={<Badge tone="teal">{users.length} sample accounts</Badge>}
      />
      <Panel
        title={doctorsOnly ? 'Fictional healthcare professionals' : 'All sample users'}
        description="Search, filter and sort the consistent sample directory"
      >
        <DataTable
          rows={users}
          label="users"
          getId={(u) => u.id}
          getSearch={(u) => `${u.name} ${u.id} ${u.role} ${u.specialty ?? ''}`}
          getStatus={(u) => u.role}
          filterOptions={doctorsOnly ? undefined : ['patient', 'doctor', 'admin']}
          columns={[
            {
              key: 'name',
              label: 'Name',
              sortValue: (u) => u.name,
              render: (u) => (
                <div className="table-person">
                  <Avatar name={u.name} />
                  <div>
                    <strong>{u.name}</strong>
                    <small>{u.id} · Fictional account</small>
                  </div>
                </div>
              ),
            },
            {
              key: 'role',
              label: doctorsOnly ? 'Specialty' : 'Role',
              sortValue: (u) => u.role,
              render: (u) =>
                doctorsOnly ? (
                  <span className="text-small">{u.specialty}</span>
                ) : (
                  <Badge
                    tone={
                      u.role === 'doctor' ? 'indigo' : u.role === 'patient' ? 'teal' : 'neutral'
                    }
                  >
                    {u.role}
                  </Badge>
                ),
            },
            {
              key: 'joined',
              label: 'Joined',
              sortValue: (u) => u.joined,
              render: (u) => formatDate(u.joined),
            },
            {
              key: 'status',
              label: 'Demo state',
              sortValue: (u) => (u.active ? 1 : 0),
              render: (u) => <Status status={u.active ? 'Active' : 'Paused'} />,
            },
            {
              key: 'details',
              label: 'Details',
              render: (u) => (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelected(u.id);
                    setConfirm(false);
                  }}
                >
                  View user <ArrowRight size={13} />
                </Button>
              ),
            },
          ]}
        />
      </Panel>
      <div className="mt-6">
        <Notice>
          Role labels and availability controls are demonstrations. There is no real account
          administration, credential handling or server-enforced access control.
        </Notice>
      </div>
      <DialogPanel
        drawer
        open={!!user}
        onOpenChange={(open) => !open && setSelected(null)}
        title={user?.name ?? 'User details'}
        description="Fictional account record · Sample Data"
      >
        {user && (
          <>
            <div className="user-drawer-header">
              <Avatar name={user.name} size="lg" />
              <h3>{user.name}</h3>
              <Badge tone={user.role === 'doctor' ? 'indigo' : 'teal'}>{user.role}</Badge>
            </div>
            <dl className="detail-grid mt-6">
              <div>
                <dt>Sample user ID</dt>
                <dd>{user.id}</dd>
              </div>
              <div>
                <dt>Joined</dt>
                <dd>{formatDate(user.joined)}</dd>
              </div>
              <div>
                <dt>Demo availability</dt>
                <dd>{user.active ? 'Active' : 'Paused'}</dd>
              </div>
              <div>
                <dt>{user.role === 'doctor' ? 'Specialty' : 'Contact details'}</dt>
                <dd>{user.specialty ?? 'Not collected'}</dd>
              </div>
              <div>
                <dt>Connected sample cases</dt>
                <dd>
                  {
                    state.cases.filter((c) => c.patientId === user.id || c.doctorId === user.id)
                      .length
                  }
                </dd>
              </div>
              <div>
                <dt>Real authentication</dt>
                <dd>Not implemented</dd>
              </div>
            </dl>
            <div className="mt-6">
              <Notice>
                {confirm
                  ? `Confirm ${user.active ? 'pausing' : 'resuming'} this fictional account’s demo availability. Historical records remain visible. This is not a security control.`
                  : 'This demonstration changes only the sample directory availability label and future fictional doctor-slot selection. It does not restrict a real account.'}
              </Notice>
            </div>
            <div className="form-actions">
              {confirm ? (
                <>
                  <Button variant="secondary" onClick={() => setConfirm(false)}>
                    Go back
                  </Button>
                  <Button
                    onClick={() => {
                      dispatch({ type: 'toggleUser', id: user.id });
                      setConfirm(false);
                      toast.success('Fictional account availability updated in memory.');
                    }}
                  >
                    Confirm demo change
                  </Button>
                </>
              ) : (
                <Button variant="secondary" onClick={() => setConfirm(true)}>
                  {user.active ? 'Pause demo availability' : 'Resume demo availability'}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogPanel>
    </>
  );
}
export function AuditActivity() {
  const { state } = useDemo();
  const [period, setPeriod] = useState('All');
  const events = state.events.filter((e) => period === 'All' || e.time.startsWith(period));
  return (
    <>
      <PageHeading
        eyebrow="A TRACEABLE DEMONSTRATION"
        title="Audit activity"
        description="A chronological viewer for fictional and session-generated sample events."
        action={
          <label className="period-selector">
            <CalendarDays size={14} />
            <span className="sr-only">Audit month</span>
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="All">All sample months</option>
              <option value="2026-10">October 2026</option>
              <option value="2026-09">September 2026</option>
              <option value="2026-08">August 2026</option>
            </select>
          </label>
        }
      />
      <Notice>
        <strong>Illustrative activity only.</strong> Frontend sample events do not constitute a
        secure, immutable production audit trail. Authenticated server-side audit logging is future
        work.
      </Notice>
      <Panel
        className="mt-6"
        title="Application events"
        description="Search, sort and filter the synthetic event history"
      >
        <DataTable
          rows={[...events].sort((a, b) => b.time.localeCompare(a.time))}
          label="audit events"
          getId={(e) => e.id}
          getSearch={(e) => `${e.id} ${e.description} ${e.actor}`}
          getStatus={(e) => e.action}
          filterOptions={['Case', 'Review', 'Appointment', 'User', 'System']}
          pageSize={8}
          columns={[
            {
              key: 'time',
              label: 'Timestamp (UTC)',
              sortValue: (e) => e.time,
              render: (e) => (
                <div className="mono">
                  {formatDate(e.time)}
                  <p className="muted" style={{ fontSize: 10, marginTop: 4 }}>
                    {new Date(e.time).toISOString().slice(11, 19)} UTC
                  </p>
                </div>
              ),
            },
            {
              key: 'type',
              label: 'Action',
              sortValue: (e) => e.action,
              render: (e) => (
                <Badge tone={e.action === 'Review' ? 'indigo' : 'neutral'}>{e.action}</Badge>
              ),
            },
            {
              key: 'event',
              label: 'Event',
              render: (e) => (
                <div>
                  <strong className="text-small" style={{ fontWeight: 500 }}>
                    {e.description}
                  </strong>
                  <p className="muted" style={{ fontSize: 9, marginTop: 5 }}>
                    {e.id} · Sample event
                  </p>
                </div>
              ),
            },
            {
              key: 'actor',
              label: 'Actor',
              sortValue: (e) => e.actor,
              render: (e) => <span className="text-small">{e.actor}</span>,
            },
          ]}
        />
      </Panel>
    </>
  );
}
