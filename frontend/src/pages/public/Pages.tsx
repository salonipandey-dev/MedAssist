import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  CheckCheck,
  ChevronRight,
  ClipboardList,
  Code2,
  Database,
  FileText,
  Layers3,
  LockKeyhole,
  ScanLine,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Waypoints,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Notice, Panel, TextLink } from '../../components/ui';
import { AIConcept } from '../../components/ui/AIConcept';
import type { Role } from '../../types';
import { ProductPreview } from './ProductPreview';
export function FinalCTA() {
  return (
    <section className="final-cta container">
      <div>
        <h2>Explore the fictional demo</h2>
        <p>
          Choose a patient, doctor or administrator perspective. No account or personal information
          is needed.
        </p>
      </div>
      <Button asChild>
        <Link to="/demo">
          Explore the demo <ArrowRight size={15} />
        </Link>
      </Button>
    </section>
  );
}
const features = [
  {
    icon: ClipboardList,
    title: 'Every case. In context.',
    copy: 'Keep structured information, record references and review progress in one clear view.',
  },
  {
    icon: CalendarDays,
    title: 'Less friction. More clarity.',
    copy: 'A considered appointment experience, from the first sample request to the next follow-up.',
  },
  {
    icon: Stethoscope,
    title: 'Designed around people.',
    copy: 'A dedicated workspace that brings relevant context to an independent professional review.',
  },
];
export function Workflow({ standalone = false }: { standalone?: boolean }) {
  const [step, setStep] = useState(0);
  const steps = [
    {
      title: 'Bring information together',
      label: 'Patient context',
      copy: 'A patient profile, structured sample assessment and document references create a shared starting point.',
      icon: UserRound,
    },
    {
      title: 'Follow the case, clearly',
      label: 'Case coordination',
      copy: 'A separate workflow status shows whether a sample case is submitted, assigned, reviewed or closed.',
      icon: Waypoints,
    },
    {
      title: 'Keep people in the loop',
      label: 'Professional review',
      copy: 'The assigned professional sees the relevant context and records an independent review. AI assistance remains unavailable.',
      icon: Stethoscope,
    },
    {
      title: 'See what happens next',
      label: 'Connected follow-up',
      copy: 'Patients can follow case progress and appointment requests. The demo keeps each change in memory until reload.',
      icon: CheckCheck,
    },
  ];
  const current = steps[step];
  return (
    <section className={`workflow-section ${standalone ? '' : 'section'}`}>
      <div className="container">
        <div className="section-header">
          <p className="eyebrow">How a sample case moves</p>
          <h2>From a sample submission to an independent review</h2>
          <p>Select a stage to see what the prototype demonstrates at that point.</p>
        </div>
        <div className="workflow-grid">
          <div className="workflow-steps" aria-label="Workflow stages">
            {steps.map(({ title, label }, i) => (
              <button
                key={label}
                className={step === i ? 'workflow-step active' : 'workflow-step'}
                aria-pressed={step === i}
                onClick={() => setStep(i)}
              >
                <span className="step-number">0{i + 1}</span>
                <span>
                  <small>{label}</small>
                  <strong>{title}</strong>
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
          <div className="workflow-visual">
            <Badge tone="teal">Fictional workflow walkthrough</Badge>
            <div className="workflow-caption" aria-live="polite">
              <span className="feature-icon">
                <current.icon size={20} />
              </span>
              <div>
                <h3>{current.title}</h3>
                <p>{current.copy}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
const homeModules = [
  {
    to: '/app/patient',
    icon: UserRound,
    title: 'Patient overview, cases and documents',
    note: 'Fictional records held in page memory',
  },
  {
    to: '/app/patient/assessments',
    icon: ClipboardList,
    title: 'Fixed assessment walkthrough',
    note: 'Predefined content · no symptom analysis',
  },
  {
    to: '/app/doctor/reviews/MA-2402',
    icon: Stethoscope,
    title: 'Independent professional review',
    note: 'Predefined notes · no clinical conclusion',
  },
  {
    to: '/app/patient/appointments',
    icon: CalendarDays,
    title: 'Appointment requests',
    note: 'Fictional slots · nothing is booked',
  },
  {
    to: '/app/admin/analytics',
    icon: ChartNoAxesCombined,
    title: 'Administrator analytics',
    note: 'Counts from synthetic sample records',
  },
];
export function Home() {
  return (
    <>
      <section className="home-hero">
        <div className="container home-hero-grid">
          <div className="home-hero-copy">
            <Badge tone="teal">Academic prototype · Fictional data</Badge>
            <h1>Healthcare records and case review in one workspace</h1>
            <p>
              MedAssist is an academic prototype. Explore fictional patient records, a fixed
              assessment walkthrough, case tracking, professional review and appointment requests.
            </p>
            <div className="home-actions">
              <Button asChild>
                <Link to="/demo">
                  Explore Demo <ArrowRight size={16} />
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/how-it-works">How it works</Link>
              </Button>
            </div>
            <p className="home-note">
              <ShieldCheck size={16} />
              No real patient data, accounts or clinical advice.
            </p>
          </div>
          <section className="panel home-modules" aria-labelledby="home-modules-title">
            <div className="panel-heading">
              <div>
                <h2 id="home-modules-title">What you can explore</h2>
                <p>Every module is a demonstration with fictional records.</p>
              </div>
            </div>
            <ul>
              {homeModules.map(({ to, icon: Icon, title, note }) => (
                <li key={to}>
                  <Link to={to}>
                    <Icon size={18} />
                    <span>
                      <strong>{title}</strong>
                      <small>{note}</small>
                    </span>
                    <ChevronRight size={16} />
                  </Link>
                </li>
              ))}
              <li className="home-module-unavailable">
                <div>
                  <LockKeyhole size={18} />
                  <span>
                    <strong>AI urgency classification</strong>
                    <small>No trained or evaluated model</small>
                  </span>
                  <Badge>Not available</Badge>
                </div>
              </li>
            </ul>
          </section>
        </div>
      </section>
      <Workflow />
      <section className="section container home-boundaries">
        <div>
          <p className="eyebrow">Prototype boundaries</p>
          <h2>What this prototype does not do</h2>
          <ul className="boundary-list">
            <li>
              <ShieldCheck size={18} />
              No sign-in or server-side permissions. Demo roles are switched in the browser.
            </li>
            <li>
              <ShieldCheck size={18} />
              No stored patient data. Records are fictional and reset when the page reloads.
            </li>
            <li>
              <ShieldCheck size={18} />
              No clinical assessment, urgency classification or medical advice.
            </li>
            <li>
              <ShieldCheck size={18} />
              No real report uploads, appointment bookings or outgoing messages.
            </li>
          </ul>
          <TextLink to="/security">Read the prototype boundaries</TextLink>
        </div>
        <AIConcept />
      </section>
    </>
  );
}
const pageIntro: Record<string, { tag: string; title: string; copy: string }> = {
  platform: {
    tag: 'THE MEDASSIST PLATFORM',
    title: 'A connected workspace.\nA considered experience.',
    copy: 'One coherent product concept for patient information, professional review and operational coordination.',
  },
  patients: {
    tag: 'THE PATIENT EXPERIENCE',
    title: 'A calmer way to follow\nyour health information.',
    copy: 'A welcoming portal makes case progress, sample appointments and documents easier to understand.',
  },
  professionals: {
    tag: 'THE PROFESSIONAL EXPERIENCE',
    title: 'More context.\nRoom for your judgment.',
    copy: 'A focused workspace that keeps submitted information, document references and independent review side by side.',
  },
};
export function PlatformPage({
  kind = 'platform',
}: {
  kind?: 'platform' | 'patients' | 'professionals';
}) {
  const intro = pageIntro[kind];
  const [role, setRole] = useState<Role>(kind === 'professionals' ? 'doctor' : 'patient');
  return (
    <>
      <section className="public-page-hero container">
        <p className="eyebrow">{intro.tag}</p>
        <h1>{intro.title}</h1>
        <p>{intro.copy}</p>
        <div className="inline-actions">
          <Button asChild>
            <Link to={`/app/${kind === 'professionals' ? 'doctor' : 'patient'}`}>
              Explore {kind === 'professionals' ? 'doctor' : 'patient'} demo{' '}
              <ArrowUpRight size={15} />
            </Link>
          </Button>
          <Badge tone="teal">Academic prototype · Sample Data</Badge>
        </div>
      </section>
      <section className="container platform-preview">
        <div className="preview-role-tabs" aria-label="Product preview role">
          {(['patient', 'doctor', 'admin'] as Role[]).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              aria-pressed={r === role}
              className={r === role ? 'active' : ''}
            >
              {r === 'patient' ? (
                <UserRound size={15} />
              ) : r === 'doctor' ? (
                <Stethoscope size={15} />
              ) : (
                <ShieldCheck size={15} />
              )}
              <span>{r === 'admin' ? 'Administrator' : r[0].toUpperCase() + r.slice(1)}</span>
            </button>
          ))}
        </div>
        <ProductPreview role={role} />
      </section>
      <section className="section container">
        <div className="section-header">
          <p className="eyebrow">PURPOSEFUL BY DESIGN</p>
          <h2>
            {kind === 'professionals'
              ? 'A review workspace that respects the workflow.'
              : kind === 'patients'
                ? 'A shared view of what happens next.'
                : 'Three perspectives. A single connected thread.'}
          </h2>
        </div>
        <div className="feature-grid">
          {(kind === 'professionals'
            ? [
                {
                  icon: ScanLine,
                  title: 'Context on one side',
                  copy: 'Submitted sample information, relevant history, attachments and case chronology stay in view.',
                },
                {
                  icon: Stethoscope,
                  title: 'Independent review',
                  copy: 'Professional review has its own record. Workflow changes never masquerade as medical urgency.',
                },
                {
                  icon: CalendarDays,
                  title: 'A considered schedule',
                  copy: 'Fictional appointment requests, confirmations and a day-by-day sample schedule.',
                },
              ]
            : kind === 'patients'
              ? [
                  {
                    icon: ClipboardList,
                    title: 'Know where things stand',
                    copy: 'See clearly whether a sample case is submitted, assigned, reviewed or closed.',
                  },
                  {
                    icon: FileText,
                    title: 'Your information, organized',
                    copy: 'Browse safe built-in document previews and a fixed sample history.',
                  },
                  {
                    icon: CalendarDays,
                    title: 'Your next step, in view',
                    copy: 'Try appointment requests using fictional availability and reversible memory-only changes.',
                  },
                ]
              : features.map((f) => ({ icon: f.icon, title: f.title, copy: f.copy }))
          ).map((f) => (
            <Panel key={f.title}>
              <div className="padded">
                <span className="feature-icon">
                  <f.icon size={21} />
                </span>
                <h3 className="mt-6">{f.title}</h3>
                <p className="muted text-small mt-4">{f.copy}</p>
              </div>
            </Panel>
          ))}
        </div>
        <div className="mt-6">
          <Notice>
            <strong>What you can explore today:</strong> an interactive frontend with fictional
            records. Secure sign-in, persistent patient management, real scheduling, private file
            storage and AI inference still require backend implementation.
          </Notice>
        </div>
      </section>
      <FinalCTA />
    </>
  );
}
export function HowItWorks() {
  return (
    <>
      <section className="public-page-hero container">
        <p className="eyebrow">HOW MEDASSIST WORKS</p>
        <h1>
          One case.
          <br />A clearer path through it.
        </h1>
        <p>
          Explore the intended patient-to-professional workflow, with each responsibility visible
          and each decision kept in context.
        </p>
      </section>
      <Workflow standalone />
      <section className="container section">
        <div className="grid-2">
          <Panel title="Workflow status" description="What stage is this case in?">
            <div className="padded">
              <div className="workflow-pills">
                {['Submitted', 'Assigned', 'Reviewed', 'Closed'].map((s) => (
                  <Badge key={s}>{s}</Badge>
                ))}
              </div>
              <p className="muted text-small mt-4">
                These labels describe case coordination. They do not indicate medical urgency,
                severity or a clinical conclusion.
              </p>
            </div>
          </Panel>
          <Panel
            title="Future urgency classification"
            description="Separate research component · Not available"
          >
            <div className="padded">
              <p className="muted text-small">
                The synopsis proposes Routine, Needs Medical Review and Urgent Review. These
                categories remain disabled until a suitable dataset, model evaluation and
                appropriate validation exist.
              </p>
              <TextLink to="/security">Understand the current boundaries</TextLink>
            </div>
          </Panel>
        </div>
      </section>
      <FinalCTA />
    </>
  );
}
export function SecurityPage() {
  return (
    <>
      <section className="public-page-hero container">
        <p className="eyebrow">SECURITY & PRIVACY</p>
        <h1>
          Trust begins
          <br />
          with clear boundaries.
        </h1>
        <p>
          MedAssist is an academic prototype. Good intentions are a starting point; implemented
          controls and verified evidence must come before real healthcare use.
        </p>
      </section>
      <section className="container security-content">
        <Notice kind="safe">
          <strong>Use fictional data only.</strong> This demonstration does not provide medical
          advice, emergency handling, secure patient storage or real authentication. Do not enter
          personal health information.
        </Notice>
        <div className="grid-2 mt-6">
          <Panel title="Built into this frontend" action={<Badge tone="teal">Implemented</Badge>}>
            <ul className="security-list">
              {[
                'Fictional records and fixed sample assessments',
                'No editable clinical inputs or real report uploads',
                'In-memory demo changes, cleared on page reload',
                'Separate mock workflows and system API client',
                'Unavailable AI outputs are explicitly labeled',
                'Human-review records separate from future predictions',
              ].map((t) => (
                <li key={t}>
                  <Check size={16} />
                  {t}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Required before real use" action={<Badge>Planned</Badge>}>
            <ul className="security-list">
              {[
                'Authentication with secure credential handling',
                'Server-enforced roles and record ownership',
                'Persistent data model and database migrations',
                'Private report storage and authorized access',
                'Production audit logging and operational controls',
                'Formal clinical and security evaluation',
              ].map((t) => (
                <li key={t}>
                  <LockKeyhole size={15} />
                  {t}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
        <div className="security-faq">
          <h2>Clarity, without the fine print.</h2>
          {[
            [
              'Is demo access a real login?',
              'No. The role picker changes the frontend demonstration. There are no passwords, sessions or server-enforced record permissions.',
            ],
            [
              'Where do demonstration changes go?',
              'Changes stay in React memory for this page session. They are not written to browser storage or sent to the backend. A reload restores the sample dataset.',
            ],
            [
              'Does MedAssist assess symptoms?',
              'No. The assessment walkthrough displays predefined fictional information only. There is no trained or validated triage model and no diagnosis or treatment advice.',
            ],
            [
              'Is the platform certified or clinically deployed?',
              'No clinical deployment, regulatory compliance or certification is claimed. The project is an academic engineering demonstration.',
            ],
            [
              'What does the existing API do?',
              'The FastAPI backend exposes welcome and liveness endpoints, with request IDs and optional exact-origin CORS. It does not implement patient workflows.',
            ],
          ].map(([q, a]) => (
            <details className="accordion" key={q}>
              <summary>
                {q}
                <ChevronRight size={16} />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <FinalCTA />
    </>
  );
}
export function AboutPage() {
  return (
    <>
      <section className="public-page-hero container">
        <p className="eyebrow">ABOUT MEDASSIST</p>
        <h1>
          Built with curiosity.
          <br />
          Designed with care.
        </h1>
        <p>
          MedAssist — An AI-Assisted Healthcare Triage and Patient Management Platform — is a
          final-year engineering project exploring the intersection of thoughtful software and
          responsible healthcare workflows.
        </p>
      </section>
      <section className="container section about-section">
        <div>
          <p className="eyebrow">THE PROJECT</p>
          <h2>
            A practical engineering journey,
            <br />
            with an honest scope.
          </h2>
          <p className="lead-copy">
            Created by Saloni Pandey, B.Tech CSE, SOEIT, with faculty guide Mr. Amit Jain. The
            project synopsis proposes a connected platform for patients, healthcare professionals
            and administrators.
          </p>
          <p className="lead-copy">
            This build brings that interface to life as a synthetic-data product demonstration.
            Secure data workflows and an evaluated ML service remain future work.
          </p>
          <Button asChild variant="secondary">
            <a
              href="https://github.com/salonipandey-dev/MedAssist"
              target="_blank"
              rel="noreferrer"
            >
              <Code2 size={16} />
              Explore the source <ArrowUpRight size={14} />
            </a>
          </Button>
        </div>
        <Panel title="From proposal to a working prototype">
          <div className="about-milestones">
            {[
              {
                icon: FileText,
                title: 'A documented foundation',
                copy: 'Synopsis, evaluation report and proposed relational architecture.',
              },
              {
                icon: Layers3,
                title: 'A considered frontend',
                copy: 'React, TypeScript, accessible components and role-specific experiences.',
              },
              {
                icon: Database,
                title: 'An honest next chapter',
                copy: 'Authentication, authorized persistence and validated research integration.',
              },
            ].map((m, i) => (
              <div className="principle-row" key={m.title}>
                <m.icon size={22} />
                <div>
                  <Badge tone={i === 2 ? 'neutral' : 'teal'}>
                    {i === 2 ? 'Future work' : 'Available'}
                  </Badge>
                  <h3 className="mt-4">{m.title}</h3>
                  <p>{m.copy}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>
      <FinalCTA />
    </>
  );
}
