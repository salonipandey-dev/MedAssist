import { ClipboardList, LockKeyhole, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Notice, Panel } from '../../components/ui';
import {
  AccountApiError,
  getMedicationCheck,
  type MedicationCheck,
  type MedicationCheckKind,
} from '../../services/api/account';
import { useAccount } from '../account/AccountProvider';
import { HEALTH_PROFILE_ROUTE } from '../account/SignIn';

// Runs the fictional demo rules against the signed-in patient's saved Health Profile.
// The server loads the profile itself; this screen only asks for the result.

const MEDICATIONS_ROUTE = '/app/patient/medications';
const SIGN_IN_LINK = `/sign-in?next=${encodeURIComponent(MEDICATIONS_ROUTE)}`;

export const CHECK_LABEL: Record<MedicationCheckKind, string> = {
  duplicate_ingredient: 'Duplicate ingredient',
  allergy_ingredient: 'Ingredient and allergy',
  medicine_interaction: 'Medicine pair',
  medicine_condition: 'Medicine and condition',
};
const SECTION_LABEL = { medicines: 'medicine', allergies: 'allergy', conditions: 'condition' };
const SECTION_TITLE = { medicines: 'Medicines', allergies: 'Allergies', conditions: 'Conditions' };
export const REAL_QUESTIONS_TEXT =
  'For questions about real medicines, ask a pharmacist or clinician. This demo does not give advice about taking, changing or stopping any medicine.';

export function outcomeHeading(result: MedicationCheck) {
  if (result.outcome === 'matches_found')
    return `${result.matches.length} demo rule${result.matches.length === 1 ? '' : 's'} matched`;
  return result.outcome === 'no_matching_rules'
    ? 'No matching demo rules'
    : 'More information needed';
}

function Results({ result }: { result: MedicationCheck }) {
  return (
    <section className="med-check-results" aria-labelledby="med-check-outcome">
      <div className="med-check-outcome">
        <h3 id="med-check-outcome">{outcomeHeading(result)}</h3>
        <Badge tone="amber">Fictional demo</Badge>
      </div>
      <p className="muted text-small">
        Demo rules version {result.fixture.version} · Health Profile version{' '}
        {result.profile_version}
      </p>

      {result.matches.length > 0 && (
        <ul className="med-check-list" aria-label="Matched demo rules">
          {result.matches.map((match) => (
            <li
              key={`${match.rule_id}:${match.entries.map((e) => e.matched_id).join('+')}`}
              className="med-notice med-possible-issue"
            >
              <div className="flex-between">
                <h4>{match.title}</h4>
                <Badge tone="amber">{CHECK_LABEL[match.check]}</Badge>
              </div>
              <p>{match.explanation}</p>
              <dl>
                <div>
                  <dt>Your entries</dt>
                  <dd>
                    {match.entries
                      .map((e) => `${e.entry} (${SECTION_LABEL[e.section]})`)
                      .join(' · ')}
                  </dd>
                </div>
                {match.ingredients.length > 0 && (
                  <div>
                    <dt>Invented ingredients</dt>
                    <dd>{match.ingredients.join(', ')}</dd>
                  </div>
                )}
                <div>
                  <dt>Demo rule</dt>
                  <dd>{match.rule_id}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}

      {!result.complete && (
        <div className="med-check-gaps">
          {result.outcome === 'matches_found' && <h4>More information needed</h4>}
          <p>The demo rules could not check everything in your Health Profile:</p>
          <ul aria-label="What the demo rules could not check">
            {result.unresolved.map((item) => (
              <li key={`u:${item.section}:${item.entry}`}>
                <strong>{item.entry}</strong> ({SECTION_LABEL[item.section]}):{' '}
                {item.reason === 'ambiguous'
                  ? `could mean ${item.candidates.join(' or ')}. Use the full name.`
                  : 'not in the demo dataset, so no demo rule can be applied to it.'}
              </li>
            ))}
            {result.missing.map((item) => (
              <li key={`m:${item.section}`}>
                <strong>{SECTION_TITLE[item.section]}</strong>: not recorded, so these checks could
                not run: {item.affected_checks.map((c) => CHECK_LABEL[c]).join(', ')}.
              </li>
            ))}
          </ul>
          <p>
            <Link className="text-link-inline" to={HEALTH_PROFILE_ROUTE}>
              Update your Health Profile
            </Link>
            , then run the check again.
          </p>
        </div>
      )}

      {result.outcome === 'no_matching_rules' && (
        <p className="med-check-none">
          The demo dataset recognised every saved entry and none of its rules matched. It covers
          only a few invented products and rules.
        </p>
      )}

      {result.recognised.length > 0 && (
        <p className="muted text-small">
          Recognised by the demo dataset:{' '}
          {result.recognised.map((e) => `${e.entry} → ${e.matched_name}`).join(' · ')}
        </p>
      )}
    </section>
  );
}

function CheckRunner({ displayName }: { displayName: string }) {
  const { sessionEnded } = useAccount();
  const [result, setResult] = useState<MedicationCheck | null>(null);
  const [error, setError] = useState<AccountApiError | null>(null);
  const [running, setRunning] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const run = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setRunning(true);
    setError(null);
    try {
      const next = await getMedicationCheck({ signal: current.signal });
      setResult(next);
    } catch (reason) {
      if (current.signal.aborted) return;
      if (
        reason instanceof AccountApiError &&
        (reason.kind === 'session-expired' || reason.kind === 'not-signed-in')
      ) {
        sessionEnded();
        return;
      }
      setResult(null);
      setError(reason instanceof AccountApiError ? reason : new AccountApiError('unexpected'));
    } finally {
      if (controller.current === current) setRunning(false);
    }
  }, [sessionEnded]);

  return (
    <div className="padded stack">
      <p>
        Signed in as <strong>{displayName}</strong>. The check uses the medicines, allergies and
        conditions saved in your Health Profile.
      </p>
      <div className="med-check-actions">
        <Button onClick={run} disabled={running}>
          {result ? <RefreshCw size={15} /> : <ClipboardList size={15} />}
          {running ? 'Checking…' : result ? 'Run the check again' : 'Check my saved profile'}
        </Button>
        <Link className="text-link-inline" to={HEALTH_PROFILE_ROUTE}>
          Open Health Profile
        </Link>
      </div>
      <p className="sr-only" role="status">
        {running ? 'Checking your saved profile' : result ? outcomeHeading(result) : ''}
      </p>
      {error && (
        <div className="form-alert" role="alert">
          {error.message}
          {error.requestId && <small> Request ID: {error.requestId}</small>}
        </div>
      )}
      {result && <Results result={result} />}
      <p className="med-check-follow-up">{REAL_QUESTIONS_TEXT}</p>
    </div>
  );
}

export function ProfileCheck() {
  const { state, ensureChecked, recheck } = useAccount();
  useEffect(ensureChecked, [ensureChecked]);

  let body;
  if (state.status === 'not-configured')
    body = (
      <div className="padded">
        <Notice>
          Checking your own saved profile needs the MedAssist API, and this build is not connected
          to it. The scripted examples below still work.
        </Notice>
      </div>
    );
  else if (state.status === 'unchecked' || state.status === 'checking')
    body = (
      <p className="padded muted" role="status">
        Checking whether you are signed in…
      </p>
    );
  else if (state.status === 'unavailable')
    body = (
      <div className="padded stack">
        <div className="form-alert" role="alert">
          {state.error.message}
        </div>
        <div>
          <Button variant="secondary" onClick={recheck}>
            <RefreshCw size={14} />
            Try again
          </Button>
        </div>
      </div>
    );
  else if (state.status === 'signed-out')
    body = (
      <div className="padded stack">
        <p className="muted">
          {state.reason === 'expired'
            ? 'Your session has ended. Sign in again to check your saved profile.'
            : 'Sign in to check the medicines, allergies and conditions saved in your Health Profile against the demo rules.'}
        </p>
        <div>
          <Button asChild variant="secondary">
            <Link to={SIGN_IN_LINK}>
              <LockKeyhole size={15} />
              Sign in
            </Link>
          </Button>
        </div>
      </div>
    );
  else
    body = (
      <CheckRunner
        key={state.session.csrf_token}
        displayName={state.session.account.display_name}
      />
    );

  return (
    <Panel
      className="med-check"
      title="Check my saved profile"
      description="Runs the fictional demo rules against your Health Profile"
      headingId="med-check-title"
      action={<Badge tone="amber">Fictional demo</Badge>}
    >
      {body}
    </Panel>
  );
}
