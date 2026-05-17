import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 90_000,
  headers: {
    "Content-Type": "application/json"
  }
});

export function setApiToken(token: string | null) {
  if (!token) {
    delete api.defaults.headers.common.Authorization;
    return;
  }
  api.defaults.headers.common.Authorization = `Bearer ${token}`;
}

/** Mensaje útil cuando falla la petición (CORS, red, 4xx/5xx). */
export function getApiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string") {
      return (data as { error: string }).error;
    }
    if (err.code === "ERR_NETWORK" || err.message === "Network Error") {
      return "No se pudo conectar al servidor. Revisa: 1) backend en marcha, 2) frontend/.env VITE_API_URL apunta al puerto del API, 3) backend/.env APP_ORIGIN debe ser exactamente la URL del front (ej. http://localhost:5175). Reinicia ambos tras cambiar .env.";
    }
    if (err.response?.status) {
      return `Error del servidor (${err.response.status})`;
    }
    return err.message || "Error de red";
  }
  if (err instanceof Error) return err.message;
  return "Error desconocido";
}

