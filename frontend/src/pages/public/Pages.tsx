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
  Pill,
  ScanLine,
  Search,
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
    title: 'Case tracking',
    copy: 'Follow structured sample information, document references and review progress for each fictional case.',
  },
  {
    icon: CalendarDays,
    title: 'Appointment requests',
    copy: 'Request, view and cancel fictional appointment slots. Nothing is booked and no message is sent.',
  },
  {
    icon: Stethoscope,
    title: 'Independent review',
    copy: 'A doctor workspace shows case context next to a separate demonstration review.',
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
const priorityModules = [
  {
    to: '/app/patient/consultations',
    icon: Search,
    title: 'Find Consultations',
    note: 'Fictional providers · illustrative fees · no booking',
  },
  {
    to: '/app/patient/medications',
    icon: Pill,
    title: 'Medication Information',
    note: 'Scripted notices · nothing is typed or checked',
  },
];
const perspectiveModules = [
  {
    to: '/app/patient',
    icon: UserRound,
    title: 'Patient: cases, appointments and documents',
    note: 'Fictional records held in page memory',
  },
  {
    to: '/app/doctor/reviews/MA-2402',
    icon: Stethoscope,
    title: 'Doctor: independent professional review',
    note: 'Predefined notes · no clinical conclusion',
  },
  {
    to: '/app/admin/analytics',
    icon: ChartNoAxesCombined,
    title: 'Administrator: sample analytics',
    note: 'Counts from synthetic sample records',
  },
];
function HomeModuleLink({ to, icon: Icon, title, note }: (typeof priorityModules)[number]) {
  return (
    <li>
      <Link to={to}>
        <Icon size={18} />
        <span>
          <strong>{title}</strong>
          <small>{note}</small>
        </span>
        <ChevronRight size={16} />
      </Link>
    </li>
  );
}
export function Home() {
  return (
    <>
      <section className="home-hero">
        <div className="container home-hero-grid">
          <div className="home-hero-copy">
            <Badge tone="teal">Academic prototype · Fictional data</Badge>
            <h1>Healthcare consultations and medication information in one demo</h1>
            <p>
              MedAssist is an academic prototype with fictional data. Compare consultation options
              from an invented directory, and step through scripted medication examples that keep
              “not enough information” separate from “no scripted notice”.
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
              No real providers, bookings, medication checks, accounts or clinical advice.
            </p>
          </div>
          <section className="panel home-modules" aria-labelledby="home-modules-title">
            <div className="panel-heading">
              <div>
                <h2 id="home-modules-title">What you can explore</h2>
                <p>Every module is a demonstration with fictional records.</p>
              </div>
            </div>
            <h3 className="home-module-group" id="home-priority-title">
              Start with the priority demos
            </h3>
            <ul className="home-module-priority" aria-labelledby="home-priority-title">
              {priorityModules.map((module) => (
                <HomeModuleLink key={module.to} {...module} />
              ))}
            </ul>
            <h3 className="home-module-group" id="home-perspectives-title">
              Patient, doctor and administrator perspectives
            </h3>
            <ul aria-labelledby="home-perspectives-title">
              {perspectiveModules.map((module) => (
                <HomeModuleLink key={module.to} {...module} />
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
              Demo roles are switched in the browser, without sign-in. Only the private Health
              Profile signs in, with fictional demo accounts, when the API is connected.
            </li>
            <li>
              <ShieldCheck size={18} />
              Role-demo records are fictional and reset when the page reloads. Only Health Profile
              entries are saved, to a fictional account.
            </li>
            <li>
              <ShieldCheck size={18} />
              No clinical assessment, urgency classification or medical advice.
            </li>
            <li>
              <ShieldCheck size={18} />
              No real report uploads, appointment bookings or outgoing messages.
            </li>
            <li>
              <ShieldCheck size={18} />
              No real provider listings or medication checking. Fees are illustrative and medication
              notices are scripted.
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
    tag: 'Platform',
    title: 'What the prototype includes',
    copy: 'Patient, doctor and administrator workspaces built on fictional records, with each limitation shown where it applies.',
  },
  patients: {
    tag: 'For patients',
    title: 'Follow sample cases, appointments\nand documents',
    copy: 'The patient workspace shows case progress, fictional appointment requests and built-in document previews.',
  },
  professionals: {
    tag: 'For professionals',
    title: 'Review sample cases\nwith their context',
    copy: 'The doctor workspace keeps submitted sample information, document references and a separate demonstration review side by side.',
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
          <p className="eyebrow">What you can do</p>
          <h2>
            {kind === 'professionals'
              ? 'Review without automated conclusions'
              : kind === 'patients'
                ? 'See what happens next'
                : 'Three demonstration perspectives'}
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
                  title: 'Sample schedule',
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
            records, and, with the API connected, sign-in to a private Health Profile for fictional
            accounts. Production-grade authentication, wider patient record storage, real
            scheduling, private file storage and AI inference still require further work.
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
        <p className="eyebrow">How it works</p>
        <h1>How a sample case moves through the prototype</h1>
        <p>
          Follow the intended patient-to-professional workflow. Each step uses fictional records and
          shows what is and is not implemented.
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
        <p className="eyebrow">Security and privacy</p>
        <h1>Prototype boundaries and privacy</h1>
        <p>
          MedAssist is an academic prototype. Good intentions are a starting point; implemented
          controls and verified evidence must come before real healthcare use.
        </p>
      </section>
      <section className="container security-content">
        <Notice kind="safe">
          <strong>Use fictional data only.</strong> This demonstration does not provide medical
          advice, emergency handling or production-grade authentication and storage. The Health
          Profile sign-in is a prototype for fictional accounts. Do not enter personal health
          information.
        </Notice>
        <div className="grid-2 mt-6">
          <Panel title="Built into this frontend" action={<Badge tone="teal">Implemented</Badge>}>
            <ul className="security-list">
              {[
                'Fictional records and fixed sample assessments',
                'No clinical assessment inputs or real report uploads',
                'In-memory demo changes, cleared on page reload',
                'Health Profile: Argon2id passwords, server-side sessions, owner-only access',
                'Health Profile entries are stored, never analysed or checked',
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
                'Production authentication: rate limits, account recovery, review',
                'Server-enforced roles for doctors and administrators',
                'Persistent storage for cases, appointments and reviews',
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
        <p className="eyebrow">About</p>
        <h1>About MedAssist</h1>
        <p>
          MedAssist is a B.Tech academic project. The original proposal described an AI-assisted
          healthcare triage and patient management platform; the revised design goals are
          consultation discovery and medication-information awareness.
        </p>
      </section>
      <section className="container section about-section">
        <div>
          <p className="eyebrow">The project</p>
          <h2>An academic project with a stated scope</h2>
          <p className="lead-copy">
            Created by Saloni Pandey, B.Tech Computer Science and Engineering, SOEIT, Sanskriti
            University. The project synopsis proposes a connected platform for patients, healthcare
            professionals and administrators.
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
                title: 'A working frontend demonstration',
                copy: 'React, TypeScript, accessible components and role-specific experiences.',
              },
              {
                icon: Database,
                title: 'Future work',
                copy: 'Production-grade authentication, wider authorized persistence and validated research integration.',
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
