let csrf = '';
export const setCsrf = (t: string) => { csrf = t; };
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function api<T = any>(method: string, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}; let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body; else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  if (csrf && method !== 'GET') headers['x-csrf-token'] = csrf;
  let res: Response;
  try { res = await fetch(`/api${url}`, { method, headers, body: payload, credentials: 'same-origin' }); }
  catch { throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.'); }
  let data: any = null; const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('json')) { try { data = await res.json(); } catch { /* ignore */ } }
  if (!res.ok) throw new ApiError(res.status, data?.error ?? (res.status >= 500 ? 'Something went wrong on our side. Please try again.' : 'Request failed.'));
  return data as T;
}
export const get = <T = any>(u: string) => api<T>('GET', u);
export const post = <T = any>(u: string, b?: unknown) => api<T>('POST', u, b ?? {});
export const put = <T = any>(u: string, b?: unknown) => api<T>('PUT', u, b ?? {});
export const patch = <T = any>(u: string, b?: unknown) => api<T>('PATCH', u, b ?? {});
export const del = <T = any>(u: string) => api<T>('DELETE', u);
export const msg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');
