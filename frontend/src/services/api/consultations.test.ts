import { afterEach, describe, expect, it, vi } from 'vitest';
import page from '../../../tests/e2e/fixtures/consultations.json';
import { ConsultationApiError, listConsultations } from './consultations';

const ORIGIN = 'http://127.0.0.1:8000';
const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
const clone = () => structuredClone(page);

function stubFetch(...responses: (Response | Error)[]) {
  const fetch = vi.fn();
  for (const response of responses)
    if (response instanceof Error) fetch.mockRejectedValueOnce(response);
    else fetch.mockResolvedValueOnce(response);
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

async function failure(promise: Promise<unknown>): Promise<ConsultationApiError> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(ConsultationApiError);
  return error as ConsultationApiError;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('consultation directory client', () => {
  it('makes no request without a valid API origin', async () => {
    const fetch = stubFetch();
    for (const origin of ['', 'bad-url', 'ftp://localhost', 'https://user:pass@localhost']) {
      vi.stubEnv('VITE_API_BASE_URL', origin);
      expect((await failure(listConsultations())).kind).toBe('not-configured');
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends a credential-free, uncached GET with the documented parameters', async () => {
    vi.stubEnv('VITE_API_BASE_URL', ORIGIN);
    const fetch = stubFetch(json(page, { headers: { 'X-Request-ID': 'sample-id' } }));

    const result = await listConsultations({
      q: '  riverside clinic ',
      specialty: 'General practice',
      mode: 'in_person',
      feeState: 'known',
      maxFeeMinor: 30000,
    });

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(
      `${ORIGIN}/api/v1/consultations?q=riverside+clinic&specialty=General+practice` +
        '&mode=in_person&fee_state=known&max_fee_minor=30000&limit=50',
    );
    expect(init).toMatchObject({ method: 'GET', cache: 'no-store', credentials: 'omit' });
    expect(init.body).toBeUndefined();
    expect(result.total).toBe(9);
    expect(result.items.map((item) => item.id)).toEqual(page.items.map((item) => item.id));
    expect(result.requestId).toBe('sample-id');
  });

  it('omits filters that are not set', async () => {
    vi.stubEnv('VITE_API_BASE_URL', ORIGIN);
    const fetch = stubFetch(json(page), json(page));

    await listConsultations();
    await listConsultations({ q: '   ', maxFeeMinor: 0 });

    expect(fetch.mock.calls[0][0]).toBe(`${ORIGIN}/api/v1/consultations?limit=50`);
    expect(fetch.mock.calls[1][0]).toBe(`${ORIGIN}/api/v1/consultations?max_fee_minor=0&limit=50`);
  });

  it('accepts an empty page', async () => {
    vi.stubEnv('VITE_API_BASE_URL', ORIGIN);
    stubFetch(json({ items: [], total: 0, limit: 50, offset: 0 }));

    await expect(listConsultations({ q: 'nothing' })).resolves.toMatchObject({
      items: [],
      total: 0,
    });
  });

  it('rejects responses that break the fee or provenance rules', async () => {
    vi.stubEnv('VITE_API_BASE_URL', ORIGIN);
    const broken: ((body: ReturnType<typeof clone>) => void)[] = [
      (body) => delete (body as { total?: number }).total,
      (body) => (body.items[0].fee.amount_minor = null), // known fee without an amount
      (body) => (body.items[0].fee.amount_minor = 0), // known fee of zero
      (body) => (body.items[2].fee.basis = null), // free without a basis
      (body) => (body.items[2].fee.amount_minor = 100), // free with an amount
      (body) => (body.items[5].fee.amount_minor = 0), // unknown shown as zero
      (body) => (body.items[5].fee.basis = 'Guess'), // unknown with a basis
      (body) => (body.items[0].fee.state = 'donation'),
      (body) => (body.items[0].modes = []),
      (body) => (body.items[0].modes = ['fax']),
      (body) => (body.items[0].provider_type = 'pharmacy'),
      (body) => (body.items[0].source.last_checked_on = '2026-01-01' as never), // fictional yet "checked"
      (body) => (body.items[0].source.url = 'https://example.invalid' as never),
      (body) => (body.items[0].is_fictional = false), // flag disagrees with the source kind
    ];
    for (const [index, change] of broken.entries()) {
      const body = clone();
      change(body);
      stubFetch(json(body, { headers: { 'X-Request-ID': `id-${index}` } }));

      const error = await failure(listConsultations());
      expect(error.kind, `case ${index}`).toBe('unexpected');
      expect(error.requestId).toBe(`id-${index}`);
    }
  });

  it('reports a 503 with the request ID from the header or the body', async () => {
    vi.stubEnv('VITE_API_BASE_URL', ORIGIN);
    const body = { detail: 'Server wording is not shown.', request_id: 'body-id' };
    stubFetch(
      json(body, { status: 503, headers: { 'X-Request-ID': 'header-id' } }),
      json(body, { status: 503 }),
    );

    const first = await failure(listConsultations());
    expect(first.kind).toBe('unavailable');
    expect(first.requestId).toBe('header-id');
    expect(first.message).toBe('The consultation directory is temporarily unavailable.');
    expect((await failure(listConsultations())).requestId).toBe('body-id');
  });

  it('separates rejected filters, other statuses and unreadable bodies', async () => {
    vi.stubEnv('VITE_API_BASE_URL', ORIGIN);
    stubFetch(
      json({ detail: [] }, { status: 422 }),
      new Response('Internal Server Error', { status: 500 }),
      new Response('<html>', { status: 200 }),
    );

    expect((await failure(listConsultations())).kind).toBe('rejected');
    const server = await failure(listConsultations());
    expect(server.kind).toBe('http');
    expect(server.message).toContain('(500)');
    expect((await failure(listConsultations())).kind).toBe('unexpected');
  });

  it('reports an unreachable server as a network failure', async () => {
    vi.stubEnv('VITE_API_BASE_URL', ORIGIN);
    stubFetch(new TypeError('Failed to fetch'));

    expect((await failure(listConsultations())).kind).toBe('network');
  });

  it('passes a caller cancellation through as an AbortError', async () => {
    vi.stubEnv('VITE_API_BASE_URL', ORIGIN);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) =>
            init.signal!.addEventListener('abort', () => reject(new Error('aborted'))),
          ),
      ),
    );
    const controller = new AbortController();

    const pending = listConsultations({}, { signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('gives up after eight seconds', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_API_BASE_URL', ORIGIN);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) =>
            init.signal!.addEventListener('abort', () => reject(new Error('aborted'))),
          ),
      ),
    );

    const pending = failure(listConsultations());
    await vi.advanceTimersByTimeAsync(8000);

    expect((await pending).kind).toBe('timeout');
  });
});
