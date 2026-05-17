import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/auth";

const DEFAULT_IDLE_MS = 30 * 60 * 1000;
const ACTIVITY_KEY = "greenlab_last_activity";

/** HU-03: cierra sesión tras inactividad prolongada (solo cliente; el JWT sigue válido hasta su expiración). */
export function IdleSessionWatcher() {
  const { token, logout } = useAuth();
  const nav = useNavigate();
  const idleMs = Number(import.meta.env.VITE_IDLE_LOGOUT_MS ?? DEFAULT_IDLE_MS);

  useEffect(() => {
    if (!token) return;

    const bump = () => {
      try {
        sessionStorage.setItem(ACTIVITY_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
    };
    bump();

    const onActivity = () => bump();
    const events: (keyof WindowEventMap)[] = ["mousedown", "keydown", "scroll", "touchstart", "click"];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const interval = window.setInterval(() => {
      const raw = sessionStorage.getItem(ACTIVITY_KEY);
      const last = raw ? Number(raw) : Date.now();
      if (Date.now() - last > idleMs) {
        logout();
        nav("/login", { replace: true, state: { sessionExpired: true } });
      }
    }, 30_000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      window.clearInterval(interval);
    };
  }, [token, idleMs, logout, nav]);

  return null;
}
