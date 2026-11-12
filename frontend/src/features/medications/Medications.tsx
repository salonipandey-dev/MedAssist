import { useState } from 'react';
import { Badge, Notice, PageHeading, Panel } from '../../components/ui';
import {
  DEMO_MEDICINES,
  FOLLOW_UP_TEXT,
  MEDICATION_SCENARIOS,
  scenarioCoverage,
  type NoticeState,
} from '../../data/mock/medications';
import { ProfileCheck } from './ProfileCheck';

const STATE_LABEL: Record<NoticeState, string> = {
  'possible-issue': 'Possible issue (scripted)',
  'insufficient-data': 'Not enough information',
  'no-scripted-notice': 'No scripted notice',
};

function listOrState(value: string[] | 'not-recorded') {
  if (value === 'not-recorded') return 'Not recorded in this example';
  if (!value.length) return 'None recorded in this example';
  return value.join(', ');
}

export function Medications() {
  const [selectedId, setSelectedId] = useState(MEDICATION_SCENARIOS[0].id);
  const scenario = MEDICATION_SCENARIOS.find((s) => s.id === selectedId) ?? MEDICATION_SCENARIOS[0];
  const coverage = scenarioCoverage(scenario);
  const medicines = scenario.medicineIds
    .map((id) => DEMO_MEDICINES.find((m) => m.id === id))
    .filter((m) => m !== undefined);
  return (
    <>
      <PageHeading
        eyebrow="Patient · Medication information"
        title="Medication information demonstration"
        description="Check the medicines, allergies and conditions in your saved Health Profile against fictional demo rules, or step through scripted examples. All names are invented."
      />
      <ProfileCheck />
      <h2 className="med-section-title">Scripted examples</h2>
      <Notice kind="safe">
        <strong>Scripted demonstration only.</strong> You cannot enter medicines here. Each notice
        is written in advance for an invented example. Nothing is checked, and the absence of a
        notice does not mean a combination is safe.
      </Notice>
      <div className="med-layout mt-6">
        <nav className="med-scenarios" aria-label="Scripted examples">
          {MEDICATION_SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === scenario.id}
              className={s.id === scenario.id ? 'active' : undefined}
              onClick={() => setSelectedId(s.id)}
            >
              <strong>{s.title}</strong>
              <small>{s.summary}</small>
            </button>
          ))}
        </nav>
        <div className="stack">
          <Panel
            title="Example profile"
            description="Invented context used by this scripted example"
            action={
              <Badge tone={coverage.complete ? 'neutral' : 'amber'}>
                {coverage.complete ? 'Information complete' : 'Information incomplete'}
              </Badge>
            }
          >
            <dl className="med-profile">
              <div>
                <dt>Medicines</dt>
                <dd>
                  <ul>
                    {medicines.map((m) => (
                      <li key={m.id}>
                        <strong>{m.name}</strong>
                        <span>
                          {m.ingredients
                            ? `Ingredients: ${m.ingredients.join(', ')}`
                            : 'Ingredients: not in the sample reference'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div>
                <dt>Allergies</dt>
                <dd>{listOrState(scenario.allergies)}</dd>
              </div>
              <div>
                <dt>Conditions</dt>
                <dd>{listOrState(scenario.conditions)}</dd>
              </div>
            </dl>
          </Panel>
          <Panel
            title="Scripted notices"
            description="Written in advance for this invented example"
            className="med-notices"
          >
            <ul aria-label="Scripted notices">
              {scenario.notices.map((n) => (
                <li key={n.id} className={`med-notice med-${n.state}`}>
                  <div className="flex-between">
                    <h3>{n.category}</h3>
                    <Badge tone={n.state === 'possible-issue' ? 'amber' : 'neutral'}>
                      {STATE_LABEL[n.state]}
                    </Badge>
                  </div>
                  <p>{n.explanation}</p>
                  <dl>
                    <div>
                      <dt>Refers to</dt>
                      <dd>{n.refersTo.join(' · ')}</dd>
                    </div>
                    <div>
                      <dt>Basis</dt>
                      <dd>{n.basis}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
            <p className="med-follow-up">{FOLLOW_UP_TEXT}</p>
          </Panel>
        </div>
      </div>
    </>
  );
}
