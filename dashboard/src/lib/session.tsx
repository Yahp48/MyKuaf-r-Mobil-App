import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, refreshSession, setAccessToken, setSessionExpiredHandler } from "./api";
import type { Session } from "./types";

type Status = "loading" | "guest" | "ready";

interface Ctx {
  status: Status;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<Session>;
  register: (body: unknown) => Promise<Session>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
  setSession: (fn: (s: Session) => Session) => void;
}

const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [session, setSessionState] = useState<Session | null>(null);
  const qc = useQueryClient();

  const clear = useCallback(() => {
    setAccessToken(null);
    setSessionState(null);
    setStatus("guest");
    qc.clear();
  }, [qc]);

  const reload = useCallback(async () => {
    const s = await api.get<Session>("/business/auth/me");
    setSessionState(s);
    setStatus("ready");
  }, []);

  // Sayfa açılışında çerezdeki oturumu geri yükle
  useEffect(() => {
    setSessionExpiredHandler(clear);
    refreshSession().then((token) => {
      if (!token) return setStatus("guest");
      reload().catch(() => setStatus("guest"));
    });
  }, [clear, reload]);

  const signIn = useCallback(async (email: string, password: string) => {
    const r = await api.post<Session & { accessToken: string }>("/business/auth/login", { email, password });
    setAccessToken(r.accessToken);
    const s = { owner: r.owner, business: r.business, salon: r.salon, isAdmin: r.isAdmin };
    setSessionState(s);
    setStatus("ready");
    return s;
  }, []);

  const register = useCallback(async (body: unknown) => {
    const r = await api.post<Session & { accessToken: string }>("/business/auth/register", body);
    setAccessToken(r.accessToken);
    const s = { owner: r.owner, business: r.business, salon: r.salon };
    setSessionState(s);
    setStatus("ready");
    return s;
  }, []);

  const signOut = useCallback(async () => {
    await api.post("/business/auth/logout").catch(() => {});
    clear();
  }, [clear]);

  const setSession = useCallback((fn: (s: Session) => Session) => setSessionState((s) => (s ? fn(s) : s)), []);

  const value = useMemo(
    () => ({ status, session, signIn, register, signOut, reload, setSession }),
    [status, session, signIn, register, signOut, reload, setSession],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const c = useContext(SessionContext);
  if (!c) throw new Error("SessionProvider eksik");
  return c;
}

/** Oturum açılmış sayfalarda: session kesin vardır. */
export function useBusiness() {
  const { session } = useSession();
  if (!session) throw new Error("Oturum yok");
  return session;
}

export const homeFor = (s: Session) => (s.isAdmin ? "/yonetim" : s.business.type === "SALON" ? "/salon" : "/magaza");
