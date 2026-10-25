import { BrainCircuit, ChevronDown, LockKeyhole } from 'lucide-react';
import { Badge, Notice, Panel } from './index';
export function AIConcept({ compact = false }: { compact?: boolean }) {
  return (
    <Panel className="ai-concept">
      <div className="padded">
        <div className="flex-between mb-4">
          <span className="flex-center">
            <span className="ai-icon">
              <BrainCircuit size={20} />
            </span>
            <h2 style={{ fontSize: 14 }}>Future AI assistance</h2>
          </span>
          <Badge tone="indigo">Not integrated</Badge>
        </div>
        <h3>Human judgment stays at the center.</h3>
        <p className="muted text-small mt-4">
          AI assistance not yet available. No model is trained, evaluated or integrated in this
          prototype.
        </p>
        {!compact && (
          <>
            <div className="concept-labels">
              {['Routine', 'Needs Medical Review', 'Urgent Review'].map((label) => (
                <span key={label}>
                  <LockKeyhole size={11} />
                  {label}
                </span>
              ))}
            </div>
            <p className="text-small muted">
              Proposed labels only · Nonfunctional conceptual preview · No classification has been
              assigned
            </p>
            <details className="accordion mt-6">
              <summary>
                Explainability & model provenance <ChevronDown size={16} />
              </summary>
              <dl className="detail-grid mt-4">
                <div>
                  <dt>Model version</dt>
                  <dd>Not available</dd>
                </div>
                <div>
                  <dt>Prediction timestamp</dt>
                  <dd>Not available</dd>
                </div>
                <div>
                  <dt>SHAP explanation</dt>
                  <dd>Pending model evaluation</dd>
                </div>
                <div>
                  <dt>Professional review</dt>
                  <dd>Stored independently</dd>
                </div>
              </dl>
            </details>
          </>
        )}
        <div className="mt-6">
          <Notice>
            Training, dataset permission, evaluation and appropriate validation are required before
            any urgency classification can be enabled.
          </Notice>
        </div>
      </div>
    </Panel>
  );
}
