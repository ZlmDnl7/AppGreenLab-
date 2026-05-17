import React, { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from "react";
import { api, setApiToken } from "../lib/api";

export type UserRole = "STUDENT" | "TEACHER" | "ADMIN" | "RESEARCHER";

type User = { id: string; name: string; email: string; role?: UserRole; createdAt?: string };

type AuthState = {
  token: string | null;
  user: User | null;
  setAuth: (next: { token: string; user: User }) => void;
  logout: () => void;
  /** Actualiza nombre/rol desde el servidor (útil si un admin cambió tu rol). */
  refreshUser: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

const LS_TOKEN = "greenlab_token";
const LS_USER = "greenlab_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(LS_TOKEN));
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem(LS_USER);
    return raw ? (JSON.parse(raw) as User) : null;
  });

  const setAuth = useCallback((next: { token: string; user: User }) => {
    setToken(next.token);
    setUser(next.user);
    localStorage.setItem(LS_TOKEN, next.token);
    localStorage.setItem(LS_USER, JSON.stringify(next.user));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_USER);
  }, []);

  /** Antes de cualquier useEffect hijo (p. ej. fetch en Admin): asegura Authorization en axios al recargar la página. */
  useLayoutEffect(() => {
    setApiToken(token);
  }, [token]);

  const refreshUser = useCallback(async () => {
    const t = localStorage.getItem(LS_TOKEN);
    if (!t) return;
    try {
      api.defaults.headers.common.Authorization = `Bearer ${t}`;
      const { data } = await api.get<{ user: User }>("/auth/me");
      setUser(data.user);
      localStorage.setItem(LS_USER, JSON.stringify(data.user));
    } catch {
      /* token inválido: no forzar logout aquí */
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      token,
      user,
      setAuth,
      logout,
      refreshUser
    }),
    [token, user, setAuth, logout, refreshUser]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}

