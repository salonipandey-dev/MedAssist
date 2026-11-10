// Shared validation of VITE_API_BASE_URL. Every API client reads the origin here so a
// misconfigured build never sends a request.
export type ApiOrigin = { ok: true; origin: string } | { ok: false; reason: 'missing' | 'invalid' };

export function readApiOrigin(): ApiOrigin {
  const base = import.meta.env.VITE_API_BASE_URL;
  if (!base) return { ok: false, reason: 'missing' };
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    return { ok: false, reason: 'invalid' };
  return { ok: true, origin: url.origin };
}
