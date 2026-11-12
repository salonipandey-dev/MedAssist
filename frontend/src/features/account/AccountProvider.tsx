import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { readApiOrigin } from '../../services/api/origin';
import {
  AccountApiError,
  getSession,
  signIn as requestSignIn,
  signOut as requestSignOut,
  type AccountSession,
} from '../../services/api/account';

// Who is signed in, held in memory only. The session itself lives in an HttpOnly
// cookie the page cannot read; after a reload `ensureChecked` asks the API again.
// Nothing here touches browser storage.

export type AccountState =
  | { status: 'unchecked' }
  | { status: 'checking' }
  | { status: 'not-configured' }
  | { status: 'signed-out'; reason: 'none' | 'expired' | 'signed-out' }
  | { status: 'signed-in'; session: AccountSession }
  | { status: 'unavailable'; error: AccountApiError };

interface AccountContextValue {
  state: AccountState;
  /** Ask the API once whether this browser has a session. Safe to call repeatedly. */
  ensureChecked: () => void;
  /** Ask the API again, for example after a failed check. */
  recheck: () => void;
  signIn: (email: string, password: string) => Promise<AccountSession>;
  signOut: () => Promise<void>;
  /** Record that the server refused the session; every screen then drops its data. */
  sessionEnded: () => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccountState>(() =>
    readApiOrigin().ok ? { status: 'unchecked' } : { status: 'not-configured' },
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const generation = useRef(0);

  const check = useCallback(() => {
    if (!readApiOrigin().ok) {
      setState({ status: 'not-configured' });
      return;
    }
    const run = ++generation.current;
    setState({ status: 'checking' });
    getSession().then(
      (session) => {
        if (run === generation.current) setState({ status: 'signed-in', session });
      },
      (error: unknown) => {
        if (run !== generation.current) return;
        if (error instanceof AccountApiError && error.kind === 'session-expired')
          setState({ status: 'signed-out', reason: 'expired' });
        else if (error instanceof AccountApiError && error.kind === 'not-signed-in')
          setState({ status: 'signed-out', reason: 'none' });
        else
          setState({
            status: 'unavailable',
            error: error instanceof AccountApiError ? error : new AccountApiError('unexpected'),
          });
      },
    );
  }, []);

  const ensureChecked = useCallback(() => {
    if (stateRef.current.status === 'unchecked') check();
  }, [check]);

  const signIn = useCallback(async (email: string, password: string) => {
    const run = ++generation.current;
    const session = await requestSignIn(email, password);
    if (run === generation.current) setState({ status: 'signed-in', session });
    return session;
  }, []);

  const signOut = useCallback(async () => {
    const current = stateRef.current;
    if (current.status !== 'signed-in') return;
    ++generation.current;
    let failure: unknown = null;
    try {
      await requestSignOut(current.session.csrf_token);
    } catch (error) {
      // An already-ended session needs no sign-out; anything else is reported.
      if (
        !(error instanceof AccountApiError) ||
        !['session-expired', 'not-signed-in'].includes(error.kind)
      )
        failure = error;
    }
    // Profile data leaves the page even when the server could not be reached; the
    // caller tells the person the server session may still be active.
    setState({ status: 'signed-out', reason: 'signed-out' });
    if (failure) throw failure;
  }, []);

  const sessionEnded = useCallback(() => {
    ++generation.current;
    setState({ status: 'signed-out', reason: 'expired' });
  }, []);

  const value = useMemo(
    () => ({ state, ensureChecked, recheck: check, signIn, signOut, sessionEnded }),
    [state, ensureChecked, check, signIn, signOut, sessionEnded],
  );
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) throw new Error('Account provider is missing');
  return context;
}
