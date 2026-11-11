import { z } from 'zod';
import { readApiOrigin } from './origin';
const healthSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('medassist-api'),
  version: z.string(),
});
export type SystemHealth = z.infer<typeof healthSchema> & { requestId: string | null };
// Liveness only. The consultation directory has its own read-only client; no mock
// mutation uses either.
export async function getSystemHealth(): Promise<SystemHealth> {
  const api = readApiOrigin();
  if (!api.ok)
    throw new Error(
      api.reason === 'missing'
        ? 'API is not configured. Set VITE_API_BASE_URL and the backend CORS origin to check liveness. The demo works independently.'
        : 'VITE_API_BASE_URL must be an HTTP(S) origin without credentials or a path.',
    );
  const response = await fetch(`${api.origin}/health`, {
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
