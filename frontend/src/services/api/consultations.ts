import { z } from 'zod';
import { readApiOrigin } from './origin';

// Read-only client for GET /api/v1/consultations. The contract is described in
// docs/CONSULTATION_DIRECTORY_API.md; responses are validated here before any screen
// sees them.

const modeSchema = z.enum(['in_person', 'video', 'phone']);
const feeStateSchema = z.enum(['known', 'free', 'unknown']);
const text = z.string().trim().min(1);

// A fee is a known amount, explicitly free with a stated basis, or unknown. Anything
// else is rejected so "free" and "not listed" can never be confused.
const feeSchema = z.discriminatedUnion('state', [
  z.object({
    state: z.literal('known'),
    amount_minor: z.number().int().positive(),
    currency: z.literal('INR'),
    basis: text,
  }),
  z.object({
    state: z.literal('free'),
    amount_minor: z.literal(0),
    currency: z.literal('INR'),
    basis: text,
  }),
  z.object({
    state: z.literal('unknown'),
    amount_minor: z.null(),
    currency: z.null(),
    basis: z.null(),
  }),
]);

const sourceSchema = z.object({
  kind: z.enum(['fictional_seed', 'reviewed_external']),
  id: text,
  name: text,
  version: text,
  url: z.string().nullable(),
  last_checked_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});

const listingSchema = z
  .object({
    id: text,
    provider_name: text,
    provider_type: z.enum(['clinic', 'hospital_outpatient', 'teleconsultation', 'community_camp']),
    specialty: text,
    modes: z.array(modeSchema).min(1),
    area: text,
    fee: feeSchema,
    access_conditions: z.string().nullable(),
    languages: z.array(z.string()),
    hours: z.string().nullable(),
    notes: z.string().nullable(),
    is_fictional: z.boolean(),
    source: sourceSchema,
  })
  // A fictional record must never look externally verified.
  .refine(
    (listing) =>
      listing.is_fictional === (listing.source.kind === 'fictional_seed') &&
      (!listing.is_fictional ||
        (listing.source.url === null && listing.source.last_checked_on === null)),
    { message: 'fictional flag and source verification fields disagree' },
  );

const pageSchema = z.object({
  items: z.array(listingSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export type ConsultationMode = z.infer<typeof modeSchema>;
export type ConsultationFeeState = z.infer<typeof feeStateSchema>;
export type ConsultationListing = z.infer<typeof listingSchema>;
export type ConsultationPage = z.infer<typeof pageSchema> & { requestId: string | null };

export interface ConsultationQuery {
  q?: string;
  specialty?: string;
  mode?: ConsultationMode;
  feeState?: ConsultationFeeState;
  /** Inclusive maximum in paise; matches free and known fees, never unknown ones. */
  maxFeeMinor?: number;
}

export type ConsultationApiErrorKind =
  'not-configured' | 'unavailable' | 'rejected' | 'http' | 'network' | 'timeout' | 'unexpected';

const MESSAGES: Record<ConsultationApiErrorKind, string> = {
  'not-configured': 'The directory API is not configured for this build.',
  unavailable: 'The consultation directory is temporarily unavailable.',
  rejected: 'The directory did not accept these filters.',
  http: 'The directory request failed.',
  network:
    'Could not reach the directory API. Check that the server is running and allows this page’s origin.',
  timeout: 'The directory API took too long to respond.',
  unexpected: 'The directory returned a response this page does not recognise.',
};

export class ConsultationApiError extends Error {
  readonly kind: ConsultationApiErrorKind;
  readonly status: number | null;
  readonly requestId: string | null;
  constructor(
    kind: ConsultationApiErrorKind,
    detail: { status?: number; requestId?: string | null } = {},
  ) {
    super(
      kind === 'http' && detail.status
        ? `The directory request failed (${detail.status}).`
        : MESSAGES[kind],
    );
    this.name = 'ConsultationApiError';
    this.kind = kind;
    this.status = detail.status ?? null;
    this.requestId = detail.requestId ?? null;
  }
}

/** Largest page the API allows; the seeded directory fits in one page. */
export const CONSULTATION_PAGE_LIMIT = 50;
const TIMEOUT_MS = 8000;

function buildUrl(origin: string, query: ConsultationQuery): string {
  const params = new URLSearchParams();
  const q = query.q?.trim();
  if (q) params.set('q', q);
  if (query.specialty) params.set('specialty', query.specialty);
  if (query.mode) params.set('mode', query.mode);
  if (query.feeState) params.set('fee_state', query.feeState);
  if (query.maxFeeMinor !== undefined) params.set('max_fee_minor', String(query.maxFeeMinor));
  params.set('limit', String(CONSULTATION_PAGE_LIMIT));
  return `${origin}/api/v1/consultations?${params}`;
}

function requestIdFrom(payload: unknown): string | null {
  const id = (payload as { request_id?: unknown } | null)?.request_id;
  return typeof id === 'string' ? id : null;
}

/**
 * Fetch one page of listings. Aborting `signal` rejects with an AbortError, which
 * callers should ignore; every other failure is a ConsultationApiError.
 */
export async function listConsultations(
  query: ConsultationQuery = {},
  options: { signal?: AbortSignal } = {},
): Promise<ConsultationPage> {
  const api = readApiOrigin();
  if (!api.ok) throw new ConsultationApiError('not-configured');

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

  try {
    const response = await fetch(buildUrl(api.origin, query), {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const headerId = response.headers.get('X-Request-ID');
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const requestId = headerId ?? requestIdFrom(payload);
      if (response.status === 503) throw new ConsultationApiError('unavailable', { requestId });
      if (response.status === 422)
        throw new ConsultationApiError('rejected', { status: 422, requestId });
      throw new ConsultationApiError('http', { status: response.status, requestId });
    }
    const page = pageSchema.safeParse(payload);
    if (!page.success) throw new ConsultationApiError('unexpected', { requestId: headerId });
    return { ...page.data, requestId: headerId };
  } catch (error) {
    if (caller?.aborted) throw new DOMException('The request was cancelled.', 'AbortError');
    if (timedOut) throw new ConsultationApiError('timeout');
    if (error instanceof ConsultationApiError) throw error;
    throw new ConsultationApiError('network');
  } finally {
    clearTimeout(timer);
    caller?.removeEventListener('abort', forwardAbort);
  }
}
