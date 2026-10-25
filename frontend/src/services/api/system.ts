import { z } from 'zod';
const healthSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('medassist-api'),
  version: z.string(),
});
export type SystemHealth = z.infer<typeof healthSchema> & { requestId: string | null };
// Only implemented GET /health is exposed. No mock mutation uses this client.
export async function getSystemHealth(): Promise<SystemHealth> {
  const base = import.meta.env.VITE_API_BASE_URL;
  if (!base)
    throw new Error(
      'API is not configured. Set VITE_API_BASE_URL and the backend CORS origin to check liveness. The demo works independently.',
    );
  let origin: URL;
  try {
    origin = new URL(base);
  } catch {
    throw new Error('VITE_API_BASE_URL must be a valid HTTP(S) origin.');
  }
  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  )
    throw new Error('VITE_API_BASE_URL must be an HTTP(S) origin without credentials or a path.');
  const response = await fetch(`${origin.origin}/health`, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'omit',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok)
    throw new Error(
      `Liveness request failed (${response.status}). No patient workflows are connected.`,
    );
  const result = healthSchema.safeParse(await response.json());
  if (!result.success) throw new Error('The backend returned an unexpected liveness response.');
  return { ...result.data, requestId: response.headers.get('X-Request-ID') };
}
