export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function api(path, opts = {}) {
  const res = await fetch(path, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.ok === false) {
    throw new ApiError(res.status, body?.error ?? `Error ${res.status}`);
  }
  return body.data;
}
