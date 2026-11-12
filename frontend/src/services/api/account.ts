import { z } from 'zod';
import { readApiOrigin } from './origin';

// Client for sign-in and the signed-in patient's own health profile. Unlike the
// read-only clients, it sends the HttpOnly session cookie (credentials: 'include').
// The cookie is never readable here; the CSRF token from the session response is held
// in memory by the caller and sent on every write. Nothing is kept in browser storage.
// Contract: docs/HEALTH_PROFILE_API.md.

const PATHS = {
  signIn: '/api/v1/auth/sign-in',
  signOut: '/api/v1/auth/sign-out',
  session: '/api/v1/auth/session',
  healthProfile: '/api/v1/me/health-profile',
} as const;
type AccountPath = (typeof PATHS)[keyof typeof PATHS];

export const ENTRY_NAME_MAX = 120;
export const ENTRY_NOTE_MAX = 300;
export const ENTRIES_PER_SECTION_MAX = 30;
export const PROFILE_SECTIONS = ['medicines', 'allergies', 'conditions'] as const;
export type ProfileSectionKey = (typeof PROFILE_SECTIONS)[number];

const text = z.string().trim().min(1);

const sessionSchema = z.object({
  account: z.object({ display_name: text, email: text, role: z.literal('patient') }),
  csrf_token: z.string().min(32),
  expires_at: text,
  idle_expires_at: text,
});

const sectionStateSchema = z.enum(['not_recorded', 'none', 'recorded']);
const entrySchema = z.object({
  name: z.string().min(1).max(ENTRY_NAME_MAX),
  note: z.string().max(ENTRY_NOTE_MAX).nullable(),
});
// "Not recorded" and "none" both carry no entries; only "recorded" has entries.
const sectionSchema = z
  .object({
    state: sectionStateSchema,
    entries: z.array(entrySchema).max(ENTRIES_PER_SECTION_MAX),
  })
  .refine((s) => (s.state === 'recorded') === s.entries.length > 0, {
    message: 'section state and entries disagree',
  });

const profileSchema = z.object({
  version: z.number().int().nonnegative(),
  updated_at: z.string().nullable(),
  medicines: sectionSchema,
  allergies: sectionSchema,
  conditions: sectionSchema,
});

export type AccountSession = z.infer<typeof sessionSchema>;
export type SectionState = z.infer<typeof sectionStateSchema>;
export type ProfileEntry = z.infer<typeof entrySchema>;
export type ProfileSection = z.infer<typeof sectionSchema>;
export type HealthProfile = z.infer<typeof profileSchema>;
export type HealthProfileUpdate = Omit<HealthProfile, 'updated_at'>;

export type AccountApiErrorKind =
  | 'not-configured'
  | 'not-signed-in'
  | 'session-expired'
  | 'invalid-credentials'
  | 'forbidden'
  | 'conflict'
  | 'invalid'
  | 'unavailable'
  | 'http'
  | 'network'
  | 'timeout'
  | 'unexpected';

const MESSAGES: Record<AccountApiErrorKind, string> = {
  'not-configured': 'Sign-in needs the MedAssist API, and this build is not connected to it.',
  'not-signed-in': 'Sign in to continue.',
  'session-expired': 'Your session has ended. Sign in again to continue.',
  'invalid-credentials': 'The email or password is incorrect.',
  forbidden: 'This request could not be verified. Reload the page and try again.',
  conflict: 'This profile was changed somewhere else after you started editing.',
  invalid: 'Some entries need attention before they can be saved.',
  unavailable: 'Your account service is temporarily unavailable. Please try again later.',
  http: 'The request failed.',
  network:
    'Could not reach the MedAssist API. Check that the server is running and allows this page’s origin.',
  timeout: 'The MedAssist API took too long to respond.',
  unexpected: 'The API returned a response this page does not recognise.',
};

export interface FieldError {
  /** Path inside the request body, e.g. ['medicines', 'entries', 0, 'name']. */
  path: (string | number)[];
  message: string;
}

export class AccountApiError extends Error {
  readonly kind: AccountApiErrorKind;
  readonly status: number | null;
  readonly requestId: string | null;
  readonly fieldErrors: FieldError[];
  readonly currentVersion: number | null;
  constructor(
    kind: AccountApiErrorKind,
    detail: {
      status?: number;
      requestId?: string | null;
      fieldErrors?: FieldError[];
      currentVersion?: number | null;
    } = {},
  ) {
    super(MESSAGES[kind]);
    this.name = 'AccountApiError';
    this.kind = kind;
    this.status = detail.status ?? null;
    this.requestId = detail.requestId ?? null;
    this.fieldErrors = detail.fieldErrors ?? [];
    this.currentVersion = detail.currentVersion ?? null;
  }
}

const TIMEOUT_MS = 10000;
const errorBodySchema = z.object({
  code: z.string().optional(),
  request_id: z.string().optional(),
  current_version: z.number().int().nonnegative().optional(),
  detail: z
    .union([
      z.string(),
      z.array(z.object({ loc: z.array(z.union([z.string(), z.number()])), msg: z.string() })),
    ])
    .optional(),
});

function errorFrom(status: number, payload: unknown, headerId: string | null): AccountApiError {
  const body = errorBodySchema.safeParse(payload);
  const data: z.infer<typeof errorBodySchema> = body.success ? body.data : {};
  const requestId = headerId ?? data.request_id ?? null;
  const code = data.code;
  if (status === 401) {
    const kind =
      code === 'invalid_credentials'
        ? 'invalid-credentials'
        : code === 'session_expired'
          ? 'session-expired'
          : 'not-signed-in';
    return new AccountApiError(kind, { status, requestId });
  }
  if (status === 403) return new AccountApiError('forbidden', { status, requestId });
  if (status === 409)
    return new AccountApiError('conflict', {
      status,
      requestId,
      currentVersion: data.current_version ?? null,
    });
  if (status === 422) {
    const fieldErrors = Array.isArray(data.detail)
      ? data.detail.map((item) => ({
          // Drop the leading "body" FastAPI adds to every location.
          path: item.loc[0] === 'body' ? item.loc.slice(1) : item.loc,
          message: item.msg,
        }))
      : [];
    return new AccountApiError('invalid', { status, requestId, fieldErrors });
  }
  if (status === 503) return new AccountApiError('unavailable', { status, requestId });
  return new AccountApiError('http', { status, requestId });
}

/**
 * The single place this client calls fetch. Every request includes the session cookie
 * and is never cached; writes carry JSON and, when a session exists, the CSRF token.
 */
async function request<T>(
  method: 'GET' | 'POST' | 'PUT',
  path: AccountPath,
  parse: ((payload: unknown) => T) | null,
  options: { body?: unknown; csrfToken?: string; signal?: AbortSignal } = {},
): Promise<T> {
  const api = readApiOrigin();
  if (!api.ok) throw new AccountApiError('not-configured');

  const caller = options.signal;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);
  const forwardAbort = () => controller.abort();
  if (caller?.aborted) controller.abort();
  else caller?.addEventListener('abort', forwardAbort, { once: true });

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.csrfToken) headers['X-CSRF-Token'] = options.csrfToken;

  try {
    const response = await fetch(`${api.origin}${path}`, {
      method,
      cache: 'no-store',
      credentials: 'include',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    const headerId = response.headers.get('X-Request-ID');
    const payload: unknown =
      response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw errorFrom(response.status, payload, headerId);
    if (!parse) return undefined as T;
    try {
      return parse(payload);
    } catch {
      throw new AccountApiError('unexpected', { requestId: headerId });
    }
  } catch (error) {
    if (caller?.aborted) throw new DOMException('The request was cancelled.', 'AbortError');
    if (timedOut) throw new AccountApiError('timeout');
    if (error instanceof AccountApiError) throw error;
    throw new AccountApiError('network');
  } finally {
    clearTimeout(timer);
    caller?.removeEventListener('abort', forwardAbort);
  }
}

const parseSession = (payload: unknown) => sessionSchema.parse(payload);
const parseProfile = (payload: unknown) => profileSchema.parse(payload);

/** The current session, or an AccountApiError of kind not-signed-in / session-expired. */
export function getSession(options: { signal?: AbortSignal } = {}) {
  return request('GET', PATHS.session, parseSession, options);
}

export function signIn(email: string, password: string) {
  return request('POST', PATHS.signIn, parseSession, { body: { email, password } });
}

export function signOut(csrfToken: string) {
  return request<void>('POST', PATHS.signOut, null, { csrfToken });
}

export function getHealthProfile(options: { signal?: AbortSignal } = {}) {
  return request('GET', PATHS.healthProfile, parseProfile, options);
}

/** Replace the whole profile. Rejects with kind 'conflict' when `version` is stale. */
export function saveHealthProfile(update: HealthProfileUpdate, csrfToken: string) {
  return request('PUT', PATHS.healthProfile, parseProfile, { body: update, csrfToken });
}
