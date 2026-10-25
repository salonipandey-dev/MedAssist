import { ArrowRight, Check, ShieldCheck, Stethoscope, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar, Badge, Button, Notice } from '../../components/ui';
import { DEMO_ACCOUNTS } from '../../data/mock/seed';
import type { Role } from '../../types';
export function DemoAccess() {
  const icons = { patient: UserRound, doctor: Stethoscope, admin: ShieldCheck };
  const copies = {
    patient: 'A clearer picture of your cases, appointments and documents.',
    doctor: 'A focused review workspace with patient context, side by side.',
    admin: 'A considered command center for sample operations and analytics.',
  };
  return (
    <section className="container demo-access">
      <div className="section-header centered">
        <Badge tone="teal">No account needed</Badge>
        <h1>
          One platform.
          <br />
          Choose your perspective.
        </h1>
        <p>Step inside MedAssist with an entirely fictional demo account.</p>
      </div>
      <div className="demo-role-grid">
        {(['patient', 'doctor', 'admin'] as Role[]).map((role) => {
          const account = DEMO_ACCOUNTS[role];
          const Icon = icons[role];
          return (
            <article className={`demo-role-card demo-role-${role}`} key={role}>
              <div className="flex-between">
                <span className="feature-icon">
                  <Icon size={23} />
                </span>
                <Badge>Fictional account</Badge>
              </div>
              <h2>{account.label}</h2>
              <p>{copies[role]}</p>
              <div className="demo-identity">
                <Avatar name={account.name} />
                <div>
                  <strong>{account.name}</strong>
                  <small>
                    {role === 'admin' ? 'Administrator' : role[0].toUpperCase() + role.slice(1)} ·
                    Demo
                  </small>
                </div>
              </div>
              <Button
                className="full-width"
                asChild
                variant={role === 'patient' ? 'primary' : 'secondary'}
              >
                <Link to={`/app/${role}`}>
                  Explore {role === 'admin' ? 'administrator' : role} demo <ArrowRight size={15} />
                </Link>
              </Button>
            </article>
          );
        })}
      </div>
      <div className="demo-access-notice">
        <Notice kind="safe">
          <strong>This is demonstration access, not authentication.</strong> All records are
          fictional. Changes stay in memory and reset on reload. Do not enter real health
          information. Clinical triage, real report uploads and secure patient storage are
          unavailable.
        </Notice>
      </div>
      <div className="demo-footnote">
        <Check size={14} />
        No credentials <span />
        No real patient data <span />
        No clinical decision support
      </div>
    </section>
  );
}
