import {
  Check,
  CheckCheck,
  Code2,
  ExternalLink,
  LockKeyhole,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useDemo } from '../../app/Provider';
import { Badge, Button, DialogPanel, Notice, PageHeading, Panel } from '../../components/ui';
import { getSystemHealth, type SystemHealth } from '../../services/api/system';
import type { Role } from '../../types';
export function Settings({ role }: { role: Role }) {
  const { state, dispatch, theme, toggleTheme } = useDemo();
  const [reset, setReset] = useState(false);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  async function check() {
    setChecking(true);
    setError('');
    setHealth(null);
    try {
      setHealth(await getSystemHealth());
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not reach the system API. Check the local server and CORS configuration.',
      );
    } finally {
      setChecking(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="MAKE YOURSELF AT HOME"
        title={role === 'admin' ? 'System settings' : 'Workspace settings'}
        description="A considered workspace, with preferences that stay in this demo session."
      />
      <div className="settings-layout">
        <div className="stack">
          <Panel title="Appearance" description="Both themes are designed for this workspace">
            <div className="theme-choices">
              <button
                aria-pressed={theme === 'light'}
                className={theme === 'light' ? 'selected' : ''}
                onClick={() => theme !== 'light' && toggleTheme()}
              >
                <div className="theme-swatch swatch-light">
                  <span />
                  <span />
                  <span />
                </div>
                <span>
                  <Sun size={15} />
                  Light{theme === 'light' && <Check size={14} />}
                </span>
              </button>
              <button
                aria-pressed={theme === 'dark'}
                className={theme === 'dark' ? 'selected' : ''}
                onClick={() => theme !== 'dark' && toggleTheme()}
              >
                <div className="theme-swatch swatch-dark">
                  <span />
                  <span />
                  <span />
                </div>
                <span>
                  <Moon size={15} />
                  Dark{theme === 'dark' && <Check size={14} />}
                </span>
              </button>
            </div>
            <div className="padded" style={{ paddingTop: 0 }}>
              <p className="muted text-small">
                Theme preference stays in memory. The initial theme follows your device’s color
                preference. Reduced-motion settings are respected.
              </p>
            </div>
          </Panel>
          <Panel title="Demonstration preferences">
            <div className="padded" style={{ paddingTop: 0 }}>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={state.profile.reminders}
                  onChange={(e) => {
                    dispatch({ type: 'reminders', value: e.target.checked });
                    toast.success('Demo preference updated. No messages will be sent.');
                  }}
                />
                Sample reminder preference
              </label>
              <p className="muted text-small mt-4">
                This is a shared demonstration setting. It does not send email, SMS or real
                reminders.
              </p>
            </div>
          </Panel>
          {role === 'admin' && (
            <Panel
              title="Existing system API"
              description="Optional manual liveness check · No patient services"
            >
              <div className="padded" style={{ paddingTop: 0 }}>
                <div className="integration-row">
                  <Code2 size={20} />
                  <div>
                    <strong>FastAPI system endpoints</strong>
                    <p>GET /health · Read-only · No credentials</p>
                  </div>
                  <Badge>{health ? 'Responding' : 'Not checked'}</Badge>
                </div>
                <Button variant="secondary" onClick={check} disabled={checking}>
                  <RefreshCw size={14} className={checking ? 'spin' : ''} />
                  {checking ? 'Checking liveness…' : 'Check API liveness'}
                </Button>
                {error && (
                  <p className="api-error mt-4" role="alert">
                    {error}
                  </p>
                )}
                {health && (
                  <div className="api-result mt-4" role="status">
                    <CheckCheck size={18} />
                    <div>
                      <strong>
                        {health.service} · {health.version}
                      </strong>
                      <p>
                        Liveness only. Patient workflows and database readiness are not checked.
                      </p>
                      <p>
                        Request ID:{' '}
                        {health.requestId ?? 'Not exposed — check backend CORS configuration'}
                      </p>
                    </div>
                  </div>
                )}
                <p className="muted text-small mt-4">
                  Set VITE_API_BASE_URL to your local API origin and allow this frontend’s exact
                  origin in MEDASSIST_CORS_ORIGINS. Mock workflows never call this API.
                </p>
              </div>
            </Panel>
          )}
        </div>
        <div className="stack">
          <Panel title="Prototype boundaries" action={<ShieldCheck size={17} className="muted" />}>
            <div className="padded" style={{ paddingTop: 0 }}>
              <ul className="settings-boundaries">
                {[
                  'No real authentication or patient accounts',
                  'No persistent health information',
                  'No trained or integrated clinical model',
                  'No real report upload or storage',
                  'No regulatory or clinical certification claimed',
                ].map((item) => (
                  <li key={item}>
                    <LockKeyhole size={13} />
                    {item}
                  </li>
                ))}
              </ul>
              <Button asChild variant="secondary" size="sm">
                <Link to="/security">
                  Read security & privacy <ExternalLink size={12} />
                </Link>
              </Button>
            </div>
          </Panel>
          <Panel title="Start fresh" description="Restore the original fictional records">
            <div className="padded" style={{ paddingTop: 0 }}>
              <p className="muted text-small">
                Reset sample profile preferences, review records, appointments, account labels and
                notification states.
              </p>
              <Button variant="secondary" className="mt-4" onClick={() => setReset(true)}>
                <RefreshCw size={14} />
                Reset demo data
              </Button>
            </div>
          </Panel>
          <Notice>
            Role switching is a frontend demonstration. It does not authenticate a user or establish
            a secure access boundary.
          </Notice>
        </div>
      </div>
      <DialogPanel
        open={reset}
        onOpenChange={setReset}
        title="Restore the fictional dataset?"
        description="This clears changes made in the current demonstration session."
      >
        <Notice>
          Sample cases, appointment requests, review records and preferences return to their initial
          state. The current theme is kept.
        </Notice>
        <div className="form-actions">
          <Button variant="secondary" onClick={() => setReset(false)}>
            Keep exploring
          </Button>
          <Button
            onClick={() => {
              dispatch({ type: 'reset' });
              setReset(false);
              toast.success('Original fictional dataset restored.');
            }}
          >
            Reset demo data
          </Button>
        </div>
      </DialogPanel>
    </>
  );
}
