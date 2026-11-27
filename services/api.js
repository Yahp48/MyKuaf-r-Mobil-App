import * as SecureStore from "expo-secure-store";
import { API_URL, REQUEST_TIMEOUT_MS } from "../config";

// Yenileme token'ı cihazın güvenli deposunda (iOS Keychain / Android Keystore) tutulur.
// Erişim token'ı yalnızca bellekte yaşar ve 15 dakikada bir yenilenir.
const REFRESH_KEY = "mykuafor.refreshToken";

let accessToken = null;
let refreshPromise = null;
let onSessionExpired = () => {};

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const isNetworkError = (e) => e instanceof ApiError && e.code === "NETWORK_ERROR";

/** Oturum geri alınamaz şekilde düştüğünde (ör. başka cihazda şifre değişti) çağrılır. */
export function setSessionExpiredHandler(fn) {
  onSessionExpired = fn;
}

export async function saveSession({ accessToken: at, refreshToken }) {
  accessToken = at;
  await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
}

export async function clearSession() {
  accessToken = null;
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export const getStoredRefreshToken = () => SecureStore.getItemAsync(REFRESH_KEY);
export const getAccessToken = () => accessToken;

async function rawRequest(path, { method = "GET", body, query, token, form } = {}) {
  // React Native'in URL uygulaması searchParams.set desteklemez; sorgu elle oluşturulur.
  const qs = query
    ? Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(Array.isArray(v) ? v.join(",") : String(v))}`)
        .join("&")
    : "";
  const url = API_URL + path + (qs ? `?${qs}` : "");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(body !== undefined && !form ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch (e) {
    const timeout = e?.name === "AbortError";
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      timeout ? "Sunucu yanıt vermedi, lütfen tekrar deneyin." : "İnternet bağlantınızı kontrol edin.",
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error;
    throw new ApiError(
      res.status,
      err?.code ?? "HTTP_ERROR",
      err?.message ?? "Beklenmeyen bir hata oluştu, lütfen tekrar deneyin.",
      err?.details,
    );
  }
  return data;
}

/** Aynı anda birden çok istek 401 alırsa yalnızca bir yenileme yapılır. */
async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = await getStoredRefreshToken();
      if (!refreshToken) throw new ApiError(401, "UNAUTHORIZED", "Oturum açmanız gerekiyor");
      const data = await rawRequest("/auth/refresh", { method: "POST", body: { refreshToken } });
      await saveSession(data);
      return data.accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/** Yetkili istek: erişim token'ı yoksa/süresi dolduysa otomatik yenilenir. */
export async function request(path, options = {}) {
  if (options.auth === false) return rawRequest(path, options);
  if (!accessToken && (await getStoredRefreshToken())) {
    try {
      await refreshAccessToken();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await clearSession();
        onSessionExpired();
      }
      throw e;
    }
  }
  try {
    return await rawRequest(path, { ...options, token: accessToken });
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401 || !accessToken) throw e;
    try {
      await refreshAccessToken();
    } catch (refreshError) {
      if (refreshError instanceof ApiError && refreshError.status === 401) {
        await clearSession();
        onSessionExpired();
      }
      throw e;
    }
    return rawRequest(path, { ...options, token: accessToken });
  }
}

const get = (path, query) => request(path, { query });
const post = (path, body) => request(path, { method: "POST", body: body ?? {} });
const put = (path, body) => request(path, { method: "PUT", body: body ?? {} });
const patch = (path, body) => request(path, { method: "PATCH", body });
const del = (path, body) => request(path, { method: "DELETE", ...(body ? { body } : {}) });

// ───────────── Uç noktalar ─────────────

export const authApi = {
  login: (email, password) => rawRequest("/auth/login", { method: "POST", body: { email, password } }),
  register: (data) => rawRequest("/auth/register", { method: "POST", body: data }),
  logout: (refreshToken) => rawRequest("/auth/logout", { method: "POST", body: { refreshToken } }),
  forgotPassword: (email) => rawRequest("/auth/forgot-password", { method: "POST", body: { email } }),
  resetPassword: (email, code, newPassword) =>
    rawRequest("/auth/reset-password", { method: "POST", body: { email, code, newPassword } }),
};

export const userApi = {
  me: () => get("/users/me"),
  update: (data) => patch("/users/me", data),
  changePassword: async (currentPassword, newPassword) =>
    post("/users/me/change-password", {
      currentPassword,
      newPassword,
      refreshToken: (await getStoredRefreshToken()) ?? undefined,
    }),
  deleteAccount: (password) => del("/users/me", { password }),
  addresses: () => get("/users/me/addresses"),
  addAddress: (data) => post("/users/me/addresses", data),
  updateAddress: (id, data) => patch(`/users/me/addresses/${id}`, data),
  deleteAddress: (id) => del(`/users/me/addresses/${id}`),
};

export const salonApi = {
  list: (query) => get("/salons", query),
  detail: (id) => get(`/salons/${id}`),
  availability: (id, { date, serviceIds, staffId }) => get(`/salons/${id}/availability`, { date, serviceIds, staffId }),
  reviews: (id, page = 1) => get(`/salons/${id}/reviews`, { page }),
  addReview: (id, data) => post(`/salons/${id}/reviews`, data),
  cities: () => get("/salons/cities"),
  featured: (city, period) => get("/salons/featured", { city, period }),
  deals: (city) => get("/salons/deals", { city }),
};

export const appointmentApi = {
  create: (data) => post("/appointments", data),
  list: (scope = "all", page = 1) => get("/appointments", { scope, page }),
  detail: (id) => get(`/appointments/${id}`),
  cancel: (id, reason) => post(`/appointments/${id}/cancel`, { reason }),
};

export const productApi = {
  list: (query) => get("/products", query),
  categories: () => get("/products/categories"),
  detail: (id) => get(`/products/${id}`),
  related: (id) => get(`/products/${id}/related`),
  reviews: (id, page = 1) => get(`/products/${id}/reviews`, { page }),
  addReview: (id, data) => post(`/products/${id}/reviews`, data),
};

export const cartApi = {
  get: () => get("/cart"),
  add: (productId, quantity = 1) => post("/cart/items", { productId, quantity }),
  setQuantity: (productId, quantity) => put(`/cart/items/${productId}`, { quantity }),
  remove: (productId) => del(`/cart/items/${productId}`),
  clear: () => del("/cart"),
};

export const orderApi = {
  create: (addressId, paymentMethod, returnUrl) => post("/orders", { addressId, paymentMethod, returnUrl }),
  list: (page = 1) => get("/orders", { page }),
  detail: (id) => get(`/orders/${id}`),
  cancel: (id) => post(`/orders/${id}/cancel`),
};

export const walletApi = {
  get: (page = 1, type) => get("/wallet", { page, type }),
  topup: (amount, returnUrl) => post("/wallet/topups", { amount, returnUrl }),
};

export const paymentApi = {
  status: (id) => get(`/payments/${id}`),
};

export const favoriteApi = {
  list: () => get("/favorites"),
  addProduct: (id) => put(`/favorites/products/${id}`),
  removeProduct: (id) => del(`/favorites/products/${id}`),
  addSalon: (id) => put(`/favorites/salons/${id}`),
  removeSalon: (id) => del(`/favorites/salons/${id}`),
};

export const notificationApi = {
  list: (page = 1) => get("/notifications", { page }),
  markRead: (id) => post(`/notifications/${id}/read`),
  markAllRead: () => post("/notifications/read-all"),
  remove: (id) => del(`/notifications/${id}`),
  registerPushToken: (token, platform) => put("/notifications/push-token", { token, platform }),
  unregisterPushToken: (token) => del("/notifications/push-token", { token }),
};

export const supportApi = {
  createTicket: (data) => post("/support/tickets", data),
  tickets: (page = 1) => get("/support/tickets", { page }),
};

export const mapsApi = {
  directions: (salonId, originLat, originLng) => get("/maps/directions", { salonId, originLat, originLng }),
};
