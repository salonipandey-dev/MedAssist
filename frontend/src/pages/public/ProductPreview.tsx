import {
  Activity,
  ArrowRight,
  Bell,
  CalendarDays,
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
export function ProductPreview({ role = 'patient' }: { role?: Role }) {
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
                : 'Administrator workspace'}
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
                <small>
                  {role === 'patient' ? 'PATIENT' : role === 'doctor' ? 'DOCTOR' : 'ADMINISTRATOR'}{' '}
                  OVERVIEW
                </small>
                <h3>
                  {role === 'patient'
                    ? 'Welcome back, Mira.'
                    : role === 'doctor'
                      ? 'Doctor overview'
                      : 'Administrator overview'}
                </h3>
                <p>Fictional records · demonstration only</p>
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
                <div className="preview-panel-title">Prototype boundary</div>
                <span className="care-ring">
                  <HeartPulse size={25} />
                </span>
                <h4>No clinical decisions</h4>
                <p>Status shows workflow progress, not medical urgency.</p>
                <Badge tone="teal">Human review</Badge>
              </div>
            </div>
            <div className="preview-bottom-line">
              <ShieldCheck size={10} />
              Academic prototype · Fictional records only
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
