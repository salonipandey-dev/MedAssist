import {
  Activity,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  FileText,
  HeartPulse,
  LayoutDashboard,
  MoreHorizontal,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useDemo } from '../../app/Provider';
import { Avatar, Badge, Status } from '../../components/ui';
import { roleCases } from '../../data/mock/service';
import type { Role } from '../../types';
export function ProductPreview({
  role = 'patient',
  floating = false,
}: {
  role?: Role;
  floating?: boolean;
}) {
  const { state } = useDemo();
  const records = [...roleCases(state, role)].sort((a, b) =>
    b.submitted.localeCompare(a.submitted),
  );
  const person =
    role === 'doctor' ? 'Dr. Avery Morgan' : role === 'admin' ? 'Jordan Ellis' : 'Mira Chen';
  return (
    <div className={`product-stage preview-${role}`}>
      <div className="preview-dashboard">
        <aside className="preview-sidebar" aria-hidden="true">
          <span className="preview-brand">
            <HeartPulse size={17} />
            MedAssist.
          </span>
          <div className="preview-workspace">
            <span className="preview-ws-icon">
              <UserRound size={13} />
            </span>
            {role === 'patient'
              ? 'Patient portal'
              : role === 'doctor'
                ? 'Doctor workspace'
                : 'Command center'}
            <ChevronDown size={9} />
          </div>
          {[LayoutDashboard, ClipboardList, CalendarDays, FileText].map((Icon, i) => (
            <div key={i} className={`preview-nav ${i === 0 ? 'selected' : ''}`}>
              <Icon size={12} />
              {
                [
                  'Overview',
                  role === 'patient' ? 'My cases' : 'Assigned cases',
                  'Appointments',
                  'Documents',
                ][i]
              }
            </div>
          ))}
          <div className="preview-side-bottom">
            <ShieldCheck size={12} />
            Sample Data
          </div>
        </aside>
        <div className="preview-main">
          <div className="preview-top">
            <span>
              Workspace <b>/ Overview</b>
            </span>
            <div>
              <Bell size={12} />
              <Avatar name={person} size="sm" />
            </div>
          </div>
          <div className="preview-body">
            <div className="preview-welcome">
              <div>
                <small>YOUR {role === 'patient' ? 'HEALTH' : 'WORKSPACE'}, AT A GLANCE</small>
                <h3>
                  {role === 'patient'
                    ? 'Good morning, Mira.'
                    : role === 'doctor'
                      ? 'Ready for your next review?'
                      : 'A clear view of operations.'}
                </h3>
                <p>
                  {role === 'patient'
                    ? 'A little clarity for your health journey.'
                    : 'Everything you need, thoughtfully organized.'}
                </p>
              </div>
              <span className="preview-calendar">
                <CalendarDays size={12} />
                25 Oct
              </span>
            </div>
            <div className="preview-stats">
              {[
                { label: 'Total cases', n: records.length },
                {
                  label: 'Awaiting review',
                  n: records.filter((c) => ['Submitted', 'Assigned'].includes(c.status)).length,
                },
                { label: 'Reviewed', n: records.filter((c) => c.status === 'Reviewed').length },
              ].map(({ label, n }, i) => (
                <div key={label}>
                  <span>
                    {label}
                    <span className={`mini-stat-icon mini-${i}`}>
                      <Activity size={11} />
                    </span>
                  </span>
                  <strong>{String(n).padStart(2, '0')}</strong>
                  <small>Sample workflow</small>
                </div>
              ))}
            </div>
            <div className="preview-content">
              <div className="preview-case-panel">
                <div className="preview-panel-title">
                  Recent cases <MoreHorizontal size={13} />
                </div>
                {records.slice(0, 3).map((c) => (
                  <div className="preview-case" key={c.id}>
                    <span className="mini-case-icon">
                      <ClipboardList size={13} />
                    </span>
                    <div>
                      <strong>{c.title}</strong>
                      <small>{c.id} · Fictional sample</small>
                    </div>
                    <Status status={c.status} />
                  </div>
                ))}
                <div className="preview-view-all">
                  View all cases <ArrowRight size={11} />
                </div>
              </div>
              <div className="preview-appointment">
                <div className="preview-panel-title">Your care, connected.</div>
                <span className="care-ring">
                  <HeartPulse size={25} />
                </span>
                <h4>One shared view.</h4>
                <p>Patient context and professional review, together.</p>
                <Badge tone="teal">Human-led workflow</Badge>
              </div>
            </div>
            <div className="preview-bottom-line">
              <ShieldCheck size={10} />
              Academic prototype · Fictional records only
            </div>
          </div>
        </div>
      </div>
      {floating && (
        <>
          <div className="floating-review">
            <span className="floating-check">
              <Check size={16} />
            </span>
            <div>
              <strong>A more connected workflow</strong>
              <small>Context ready for professional review</small>
            </div>
            <span className="float-avatar">
              <Avatar name="Avery Morgan" size="sm" />
            </span>
          </div>
          <div className="floating-record">
            <span className="file-icon">
              <FileText size={19} />
            </span>
            <div>
              <strong>Sample patient record</strong>
              <small>Organized. Accessible. Connected.</small>
            </div>
            <span className="record-line" />
          </div>
        </>
      )}
    </div>
  );
}
export function CareIllustration() {
  return (
    <svg
      viewBox="0 0 260 200"
      className="care-illustration"
      role="img"
      aria-label="Patient information connects to a human review, with no automated clinical decision"
    >
      <defs>
        <linearGradient id="careGradient" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#0D9488" />
          <stop offset="1" stopColor="#2DD4BF" />
        </linearGradient>
      </defs>
      <circle cx="130" cy="100" r="77" stroke="currentColor" strokeOpacity=".12" fill="none" />
      <circle cx="130" cy="100" r="54" stroke="currentColor" strokeOpacity=".12" fill="none" />
      <path
        d="M55 60Q130 100 200 140M55 140Q130 100 200 60"
        stroke="currentColor"
        strokeOpacity=".3"
        fill="none"
        strokeDasharray="3 5"
      />
      <rect x="104" y="74" width="52" height="52" rx="18" fill="url(#careGradient)" />
      <path
        d="M113 101h9l4-11 6 21 5-10h10"
        stroke="white"
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {[
        [45, 45],
        [185, 45],
        [45, 130],
        [185, 130],
      ].map(([x, y], i) => (
        <g key={i}>
          <rect
            x={x}
            y={y}
            width="36"
            height="36"
            rx="11"
            fill="var(--surface)"
            stroke="var(--border)"
          />
          <path
            d={`M${x + 10} ${y + 13}h16m-16 6h11m-11 6h14`}
            stroke="currentColor"
            strokeOpacity=".6"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      ))}
    </svg>
  );
}
