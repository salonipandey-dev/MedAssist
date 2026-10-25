import { ArrowLeft, ArrowRight, Check, ClipboardList, LockKeyhole } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useDemo } from '../../app/Provider';
import { Badge, Button, Notice, PageHeading, Panel } from '../../components/ui';
import { SAMPLE_ASSESSMENT } from '../../data/mock/seed';
const steps = [
  'Introduction',
  'Sample information',
  'Duration & severity',
  'Patient context',
  'Review sample',
  'Submission status',
];
export function Assessment() {
  const { state, dispatch } = useDemo();
  const [step, setStep] = useState(0);
  const [caseId, setCaseId] = useState('');
  function submit() {
    const id = `MA-${state.cases.length + 1001}`;
    dispatch({ type: 'submitSample' });
    setCaseId(id);
    setStep(5);
    toast.success('Predefined fictional case added to the demo. No assessment was performed.');
  }
  return (
    <>
      <PageHeading
        eyebrow="A CONSIDERED FIRST STEP"
        title="Explore an assessment"
        description="A guided walkthrough of the intended experience, using predefined fictional information."
      />
      <Notice kind="safe">
        <strong>Sample walkthrough only.</strong> No health information can be entered. This demo
        does not evaluate symptoms, assign urgency or provide medical advice.
      </Notice>
      <div className="assessment-layout mt-6">
        <nav className="assessment-steps" aria-label="Assessment progress">
          {steps.map((title, i) => (
            <button
              key={title}
              disabled={i > step || step === 5}
              onClick={() => setStep(i)}
              aria-current={step === i ? 'step' : undefined}
              className={i === step ? 'current' : i < step ? 'complete' : ''}
            >
              <span>{i < step ? <Check size={13} /> : i + 1}</span>
              <div>
                <small>STEP {i + 1}</small>
                <strong>{title}</strong>
              </div>
            </button>
          ))}
        </nav>
        <Panel>
          <div className="assessment-content">
            <div className="flex-between mb-4">
              <Badge tone="teal">{SAMPLE_ASSESSMENT.label}</Badge>
              <span className="muted text-small">Step {step + 1} of 6</span>
            </div>
            <div className="assessment-progress">
              <span style={{ width: `${((step + 1) / 6) * 100}%` }} />
            </div>
            <div className="assessment-step-body" aria-live="polite" key={step}>
              {step === 0 ? (
                <>
                  <span className="assessment-symbol">
                    <ClipboardList size={30} />
                  </span>
                  <h2>Start with a clear picture.</h2>
                  <p>
                    Follow a fictional sample through the structure proposed in the MedAssist
                    synopsis. Every detail is predefined. Nothing is collected from you.
                  </p>
                  <div className="walkthrough-items">
                    <span>
                      <Check size={16} />
                      See how information could be organized
                    </span>
                    <span>
                      <Check size={16} />
                      Understand each workflow step
                    </span>
                    <span>
                      <LockKeyhole size={16} />
                      Clinical input and scoring remain disabled
                    </span>
                  </div>
                </>
              ) : step === 1 ? (
                <>
                  <h2>Structured sample information</h2>
                  <p>
                    The intended workflow would collect structured symptoms after secure backend
                    implementation. Here, only this fixed example is available.
                  </p>
                  <div className="sample-value">
                    <span>Predefined symptom example</span>
                    <strong>{SAMPLE_ASSESSMENT.symptom}</strong>
                    <small>Read-only fictional content</small>
                  </div>
                </>
              ) : step === 2 ? (
                <>
                  <h2>A little more context.</h2>
                  <p>
                    Duration and self-described severity belong to the sample record. They do not
                    create a medical urgency classification.
                  </p>
                  <div className="sample-value">
                    <span>Duration</span>
                    <strong>{SAMPLE_ASSESSMENT.duration}</strong>
                  </div>
                  <div className="sample-value">
                    <span>Self-described severity</span>
                    <strong>{SAMPLE_ASSESSMENT.severity}</strong>
                  </div>
                </>
              ) : step === 3 ? (
                <>
                  <h2>Relevant patient context</h2>
                  <p>
                    Real medical history input requires authorized, secure storage. This fixed
                    example demonstrates the layout only.
                  </p>
                  <div className="sample-value">
                    <span>Fictional patient context</span>
                    <strong>{SAMPLE_ASSESSMENT.context}</strong>
                  </div>
                  <Notice>No additional personal, contact or health details are requested.</Notice>
                </>
              ) : step === 4 ? (
                <>
                  <h2>Review the predefined sample.</h2>
                  <p>
                    Confirm this fictional walkthrough to create a sample case in page memory. No
                    symptom analysis or urgency assessment will run.
                  </p>
                  <dl className="assessment-review">
                    {[
                      ['Sample', SAMPLE_ASSESSMENT.label],
                      ['Information', SAMPLE_ASSESSMENT.symptom],
                      ['Duration', SAMPLE_ASSESSMENT.duration],
                      ['Severity', SAMPLE_ASSESSMENT.severity],
                      ['Context', SAMPLE_ASSESSMENT.context],
                      ['AI assistance', 'Not yet available'],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              ) : (
                <div className="assessment-success">
                  <span className="assessment-symbol">
                    <Check size={32} />
                  </span>
                  <Badge tone="teal">Sample submitted</Badge>
                  <h2>A new sample case, ready to follow.</h2>
                  <p>
                    {caseId} was added to the demonstration with workflow status Submitted. No
                    clinical evaluation took place.
                  </p>
                  <Notice>Nothing was sent to an API. Reloading resets this sample record.</Notice>
                  <Button asChild>
                    <Link to={`/app/patient/cases/${caseId}`}>
                      View sample case <ArrowRight size={15} />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setStep(0);
                      setCaseId('');
                    }}
                  >
                    Restart walkthrough
                  </Button>
                </div>
              )}
            </div>
            {step < 5 && (
              <div className="assessment-actions">
                <Button
                  variant="secondary"
                  disabled={step === 0}
                  onClick={() => setStep((s) => s - 1)}
                >
                  <ArrowLeft size={14} />
                  Back
                </Button>
                {step === 4 ? (
                  <Button onClick={submit}>
                    Submit predefined sample <Check size={14} />
                  </Button>
                ) : (
                  <Button onClick={() => setStep((s) => s + 1)}>
                    {step === 0 ? 'Begin sample walkthrough' : 'Continue'}
                    <ArrowRight size={14} />
                  </Button>
                )}
              </div>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
