import React, { useEffect, useState } from "react";
import { useAuth } from "../../state/auth";
import { api, getApiErrorMessage } from "../../lib/api";
import { Alert, Card, CardBody, CardHeader } from "../../components/ui";

function formatDate(iso?: string) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function ProfilePage() {
  const { user, token, setAuth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      setError(null);
      try {
        const { data } = await api.get<{ user: { id: string; name: string; email: string; createdAt: string } }>("/auth/me");
        if (!cancelled && data.user) {
          setAuth({ token, user: data.user });
        }
      } catch (e: unknown) {
        if (!cancelled) setError(getApiErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, setAuth]); // setAuth estable (useCallback); recarga al cambiar sesión

  return (
    <div className="space-y-5">
      <div>
        <div className="text-2xl font-semibold">Perfil</div>
        <div className="text-slate-500">Información básica de tu cuenta (datos desde el servidor).</div>
      </div>

      {error ? <Alert kind="error">{error}</Alert> : null}

      <Card>
        <CardHeader title="Usuario" subtitle="Datos registrados" />
        <CardBody>
          {loading ? (
            <div className="text-sm text-slate-500">Cargando perfil…</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs text-slate-500">Nombre</div>
                <div className="text-sm font-medium">{user?.name ?? "-"}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Email</div>
                <div className="text-sm font-medium">{user?.email ?? "-"}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-xs text-slate-500">Cuenta creada</div>
                <div className="text-sm font-medium">{formatDate(user?.createdAt)}</div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

