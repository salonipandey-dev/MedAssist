import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AccountApiError,
  getHealthProfile,
  getSession,
  saveHealthProfile,
  signIn,
  signOut,
  type HealthProfile,
  type HealthProfileUpdate,
} from './account';

const ORIGIN = 'http://127.0.0.1:8000';
const CSRF = 'c'.repeat(43);
const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
const session = {
  account: {
    display_name: 'Patient A (fictional)',
    email: 'patient.a@example.test',
    role: 'patient',
  },
  csrf_token: CSRF,
  expires_at: '2026-11-12T20:00:00Z',
  idle_expires_at: '2026-11-12T12:30:00Z',
};
const profile: HealthProfile = {
  version: 2,
  updated_at: '2026-11-12T12:00:00Z',
  medicines: { state: 'recorded', entries: [{ name: 'Tarvexol (fictional)', note: null }] },
  allergies: { state: 'none', entries: [] },
  conditions: { state: 'not_recorded', entries: [] },
};

const update: HealthProfileUpdate = {
  version: profile.version,
  medicines: profile.medicines,
  allergies: profile.allergies,
  conditions: profile.conditions,
};

function stubFetch(...responses: (Response | Error)[]) {
  const fetch = vi.fn();
  for (const response of responses)
    if (response instanceof Error) fetch.mockRejectedValueOnce(response);
    else fetch.mockResolvedValueOnce(response);
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

async function failure(promise: Promise<unknown>): Promise<AccountApiError> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(AccountApiError);
  return error as AccountApiError;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('account client', () => {
  it('makes no request without a valid API origin', async () => {
    const fetch = stubFetch();
    for (const origin of ['', 'bad-url', 'https://user:pass@localhost']) {
      vi.stubEnv('VITE_API_BASE_URL', origin);
      expect((await failure(getSession())).kind).toBe('not-configured');
      expect((await failure(signIn('a@example.test', 'x'))).kind).toBe('not-configured');
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reads with the session cookie, uncached and without a CSRF header', async () => {
    vi.stubEnv('VITE_API_BASE_URL', ORIGIN);
    const fetch = stubFetch(json(session), json(profile));

    expect(await getSession()).toEqual(session);
    expect(await getHealthProfile()).toEqual(profile);

    const [[sessionUrl, sessionInit], [profileUrl, profileInit]] = fetch.mock.calls;
    expect(sessionUrl).toBe(`${ORIGIN}/api/v1/auth/session`);
    expect(profileUrl).toBe(`${ORIGIN}/api/v1/me/health-profile`);
    for (const init of [sessionInit, profileInit]) {
      expect(init).toMatchObject({ method: 'GET', cache: 'no-store', credentials: 'include' });
      expect(init.body).toBeUndefined();
      expect(init.headers['X-CSRF-Token']).toBeUndefined();
    }
  });

  it('signs in with a JSON body and no CSRF token', async () => {
    vi.stubEnv('VITE_API_BASE_URL', ORIGIN);
    const fetch = stubFetch(json(session));

    await signIn('patient.a@example.test', 'fictional-password');

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`${ORIGIN}/api/v1/auth/sign-in`);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['X-CSRF-Token']).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual({
      email: 'patient.a@example.test',
      password: 'fictional-password',
    });
  });

  it('saves the whole profile with its version and the CSRF token', async () => {
    vi.stubEnv('VITE_API_BASE_URL', ORIGIN);
    const fetch = stubFetch(json({ ...profile, version: 3 }));

    const saved = await saveHealthProfile(update, CSRF);

    expect(saved.version).toBe(3);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`${ORIGIN}/api/v1/me/health-profile`);
    expect(init).toMatchObject({ method: 'PUT', cache: 'no-store', credentials: 'include' });
    expect(init.headers['X-CSRF-Token']).toBe(CSRF);
    expect(JSON.parse(init.body)).toEqual(update);
    expect(JSON.parse(init.body)).not.toHaveProperty('account_id');
  });

  it('signs out with the CSRF token and accepts an empty 204', async () => {
    vi.stubEnv('VITE_API_BASE_URL', ORIGIN);
    const fetch = stubFetch(new Response(null, { status: 204 }));

    await expect(signOut(CSRF)).resolves.toBeUndefined();

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`${ORIGIN}/api/v1/auth/sign-out`);
    expect(init.method).toBe('POST');
    expect(init.headers['X-CSRF-Token']).toBe(CSRF);
    expect(init.body).toBeUndefined();
  });

  it('turns refusals into distinct kinds', async () => {
    vi.stubEnv('VITE_API_BASE_URL', ORIGIN);
    const cases: [Response, string][] = [
      [json({ code: 'not_signed_in', detail: 'x' }, { status: 401 }), 'not-signed-in'],
      [json({ code: 'session_expired', detail: 'x' }, { status: 401 }), 'session-expired'],
      [json({ code: 'invalid_credentials', detail: 'x' }, { status: 401 }), 'invalid-credentials'],
      [json({ code: 'csrf_failed', detail: 'x' }, { status: 403 }), 'forbidden'],
      [json({ detail: 'x', request_id: 'r-1' }, { status: 503 }), 'unavailable'],
      [json({ detail: 'x' }, { status: 500 }), 'http'],
    ];
    for (const [response, kind] of cases) {
      stubFetch(response);
      expect((await failure(getHealthProfile())).kind).toBe(kind);
    }
  });

  it('reports a version conflict with the stored version', async () => {
    vi.stubEnv('VITE_API_BASE_URL', ORIGIN);
    stubFetch(
      json(
        { code: 'version_conflict', detail: 'changed', current_version: 5 },
        { status: 409, headers: { 'X-Request-ID': 'r-9' } },
      ),
    );

    const error = await failure(saveHealthProfile(update, CSRF));

    expect(error.kind).toBe('conflict');
    expect(error.currentVersion).toBe(5);
    expect(error.requestId).toBe('r-9');
  });

  it('maps validation errors to paths inside the request body', async () => {
    vi.stubEnv('VITE_API_BASE_URL', ORIGIN);
    stubFetch(
      json(
        {
          code: 'invalid_input',
          detail: [
            { loc: ['body', 'medicines', 'entries', 0, 'name'], msg: 'Enter a name.', type: 'x' },
          ],
        },
        { status: 422 },
      ),
    );

    const error = await failure(saveHealthProfile(update, CSRF));

    expect(error.kind).toBe('invalid');
    expect(error.fieldErrors).toEqual([
      { path: ['medicines', 'entries', 0, 'name'], message: 'Enter a name.' },
    ]);
  });

  it('rejects a profile whose section state and entries disagree', async () => {
    vi.stubEnv('VITE_API_BASE_URL', ORIGIN);
    stubFetch(json({ ...profile, allergies: { state: 'recorded', entries: [] } }));

    expect((await failure(getHealthProfile())).kind).toBe('unexpected');
  });

  it('reports an unreachable server as a network failure', async () => {
    vi.stubEnv('VITE_API_BASE_URL', ORIGIN);
    stubFetch(new TypeError('Failed to fetch'));

    expect((await failure(getSession())).kind).toBe('network');
  });
});
