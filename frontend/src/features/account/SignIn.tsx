import { LockKeyhole, LogOut } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge, Button, Notice } from '../../components/ui';
import { AccountApiError } from '../../services/api/account';
import { useAccount } from './AccountProvider';

export const HEALTH_PROFILE_ROUTE = '/app/patient/health-profile';

/** Only same-app paths are followed after sign-in, never another site. */
export function safeNextPath(value: string | null): string {
  return value && value.startsWith('/app/') && !value.startsWith('//') && !value.includes('\\')
    ? value
    : HEALTH_PROFILE_ROUTE;
}

function SignInForm({ next }: { next: string }) {
  const { signIn } = useAccount();
  const navigate = useNavigate();
  const id = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: typeof errors = {};
    if (!/^[^\s@]+@[^\s@]+$/.test(email.trim())) found.email = 'Enter the account’s email address.';
    if (!password) found.password = 'Enter the password.';
    setErrors(found);
    if (found.email || found.password) return;
    setSubmitting(true);
    try {
      const session = await signIn(email.trim(), password);
      setPassword('');
      toast.success(`Signed in as ${session.account.display_name}.`);
      navigate(next, { replace: true });
    } catch (error) {
      setPassword('');
      setErrors({
        form:
          error instanceof AccountApiError
            ? error.message
            : 'Sign-in failed. Please try again in a moment.',
      });
      setSubmitting(false);
    }
  }

  return (
    <form className="sign-in-form" noValidate onSubmit={submit} aria-describedby={`${id}-note`}>
      {errors.form && (
        <div className="form-alert" role="alert">
          {errors.form}
        </div>
      )}
      <label className="field" htmlFor={`${id}-email`}>
        <span>Email</span>
        <input
          id={`${id}-email`}
          type="email"
          name="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? `${id}-email-error` : undefined}
          maxLength={254}
        />
        {errors.email && (
          <span className="field-error" id={`${id}-email-error`}>
            {errors.email}
          </span>
        )}
      </label>
      <label className="field" htmlFor={`${id}-password`}>
        <span>Password</span>
        <input
          id={`${id}-password`}
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? `${id}-password-error` : undefined}
          maxLength={256}
        />
        {errors.password && (
          <span className="field-error" id={`${id}-password-error`}>
            {errors.password}
          </span>
        )}
      </label>
      <Button type="submit" className="full-width" disabled={submitting}>
        <LockKeyhole size={15} />
        {submitting ? 'Signing in…' : 'Sign in'}
      </Button>
      <p className="muted text-small" id={`${id}-note`}>
        Use one of the fictional demo accounts created by the development seed. Never enter a real
        password or real health details in this prototype.
      </p>
    </form>
  );
}

export function SignIn() {
  const { state, ensureChecked, recheck, signOut } = useAccount();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get('next'));
  useEffect(ensureChecked, [ensureChecked]);

  let body;
  if (state.status === 'not-configured')
    body = (
      <Notice>
        <strong>Sign-in is not available in this build.</strong> It needs the MedAssist API, set
        with <code>VITE_API_BASE_URL</code>. The fictional role demos still work without it.
      </Notice>
    );
  else if (state.status === 'unchecked' || state.status === 'checking')
    body = (
      <p className="muted" role="status">
        Checking whether you are signed in…
      </p>
    );
  else if (state.status === 'unavailable')
    body = (
      <div className="stack">
        <div className="form-alert" role="alert">
          {state.error.message}
        </div>
        <Button variant="secondary" onClick={recheck}>
          Try again
        </Button>
      </div>
    );
  else if (state.status === 'signed-in')
    body = (
      <div className="stack">
        <p>
          You are signed in as <strong>{state.session.account.display_name}</strong>.
        </p>
        <Button asChild>
          <Link to={next}>Open health profile</Link>
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            signOut().then(
              () => toast.success('Signed out.'),
              () =>
                toast.warning(
                  'Signed out on this page, but the server could not be reached to end the session.',
                ),
            )
          }
        >
          <LogOut size={15} />
          Sign out
        </Button>
      </div>
    );
  else
    body = (
      <>
        {state.reason === 'expired' && (
          <div className="form-alert form-alert-info" role="status">
            Your session has ended. Sign in again to continue.
          </div>
        )}
        <SignInForm next={next} />
      </>
    );

  return (
    <section className="container sign-in-page">
      <div className="sign-in-card">
        <Badge tone="teal">Fictional accounts only</Badge>
        <h1>Sign in</h1>
        <p className="muted">
          Signing in opens your private health profile. The role demos at{' '}
          <Link className="text-link-inline" to="/demo">
            Explore Demo
          </Link>{' '}
          need no account.
        </p>
        {body}
      </div>
    </section>
  );
}
