import { afterEach, expect, it, vi } from 'vitest';
import { getSystemHealth } from './system';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it('does not make a request until an API origin is configured', async () => {
  vi.stubEnv('VITE_API_BASE_URL', '');
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  await expect(getSystemHealth()).rejects.toThrow('not configured');
  expect(fetch).not.toHaveBeenCalled();
});
it('rejects origins with credentials, unsupported protocols or paths', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  for (const origin of [
    'ftp://localhost',
    'https://user:pass@localhost',
    'https://localhost/patients',
    'bad-url',
  ]) {
    vi.stubEnv('VITE_API_BASE_URL', origin);
    await expect(getSystemHealth()).rejects.toThrow();
  }
  expect(fetch).not.toHaveBeenCalled();
});
it('uses only the real no-store GET liveness endpoint without credentials', async () => {
  vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:8000');
  const fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ status: 'ok', service: 'medassist-api', version: '0.1.0' }), {
      headers: { 'X-Request-ID': 'sample-request-id' },
    }),
  );
  vi.stubGlobal('fetch', fetch);
  const result = await getSystemHealth();
  expect(fetch).toHaveBeenCalledWith(
    'http://127.0.0.1:8000/health',
    expect.objectContaining({ method: 'GET', cache: 'no-store', credentials: 'omit' }),
  );
  expect(result.requestId).toBe('sample-request-id');
});
it('rejects invalid response contracts and non-success statuses', async () => {
  vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:8000');
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response('{}'))
    .mockResolvedValueOnce(new Response('', { status: 500 }));
  vi.stubGlobal('fetch', fetch);
  await expect(getSystemHealth()).rejects.toThrow('unexpected liveness response');
  await expect(getSystemHealth()).rejects.toThrow('(500)');
});
