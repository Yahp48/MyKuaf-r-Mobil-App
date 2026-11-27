// Panel API istemcisi. Erişim token'ı yalnızca bellekte; yenileme token'ı httpOnly çerezde (JS okuyamaz).

export class ApiError extends Error {
  status: number;
  code: string;
  details?: { field: string; message: string }[];
  constructor(status: number, code: string, message: string, details?: { field: string; message: string }[]) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let accessToken: string | null = null;
let refreshing: Promise<string | null> | null = null;
let onExpired: () => void = () => {};

export const setAccessToken = (t: string | null) => {
  accessToken = t;
};
export const getAccessToken = () => accessToken;
export const setSessionExpiredHandler = (fn: () => void) => {
  onExpired = fn;
};

type Query = Record<string, string | number | boolean | undefined | null | string[]>;

function buildUrl(path: string, query?: Query) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, Array.isArray(v) ? v.join(",") : String(v));
  }
  const s = qs.toString();
  return `/api${path}${s ? `?${s}` : ""}`;
}

async function raw<T>(
  method: string,
  path: string,
  opts: { body?: unknown; query?: Query; form?: FormData } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error;
    throw new ApiError(res.status, e?.code ?? "HTTP_ERROR", e?.message ?? "Beklenmeyen bir hata oluştu.", e?.details);
  }
  return data as T;
}

/** Çerezdeki yenileme token'ıyla yeni erişim token'ı alır. Eşzamanlı çağrılar tek isteğe indirgenir. */
export function refreshSession(): Promise<string | null> {
  refreshing ??= raw<{ accessToken: string }>("POST", "/business/auth/refresh")
    .then((r) => {
      accessToken = r.accessToken;
      return r.accessToken;
    })
    .catch(() => {
      accessToken = null;
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function request<T>(
  method: string,
  path: string,
  opts: { body?: unknown; query?: Query; form?: FormData } = {},
) {
  try {
    return await raw<T>(method, path, opts);
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401 || path.startsWith("/business/auth/")) throw e;
    const token = await refreshSession();
    if (!token) {
      onExpired();
      throw e;
    }
    return raw<T>(method, path, opts);
  }
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body: body ?? {} }),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
  del: <T>(path: string) => request<T>("DELETE", path),
  /** Doğrulama belgesi (PDF/görsel): gizli klasöre yazılır, anahtar döner. */
  uploadDocument: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ key: string }>("POST", "/business/documents", { form });
  },
  /** Yetkili dosya indirme (ör. yöneticinin vergi levhasını açması). */
  blob: async (path: string) => {
    const go = () => fetch(buildUrl(path), { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
    let res = await go();
    if (res.status === 401 && (await refreshSession())) res = await go();
    if (!res.ok) throw new ApiError(res.status, "HTTP_ERROR", "Dosya açılamadı");
    return res.blob();
  },
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ url: string }>("POST", "/business/uploads", { form });
  },
};

/** Alan bazlı doğrulama hatalarını { alan: mesaj } biçimine çevirir. */
export function fieldErrors(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError) || !e.details) return {};
  return Object.fromEntries(e.details.map((d) => [d.field, d.message]));
}
