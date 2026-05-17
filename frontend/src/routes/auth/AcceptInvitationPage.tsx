import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, getApiErrorMessage } from "../../lib/api";
import { useAuth } from "../../state/auth";
import { Alert, Button, Card, CardBody, CardHeader } from "../../components/ui";
import { AuthShell } from "./AuthShell";

type Preview = {
  status: "pending" | "already_accepted";
  projectName: string;
  projectId: string;
  email: string;
  inviterName: string;
};

function emailsMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function AcceptInvitationPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const { token: sessionToken, user, logout } = useAuth();
  const nav = useNavigate();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);

  const loginState = {
    inviteToken: token,
    from: `/invitations/accept?token=${encodeURIComponent(token)}`
  };

  const alreadyAccepted = preview?.status === "already_accepted";
  const wrongAccount =
    Boolean(
      sessionToken && user && preview && preview.status === "pending" && !emailsMatch(user.email, preview.email)
    );

  useEffect(() => {
    if (!token) {
      setError("Falta el enlace de invitación.");
      setLoading(false);
      return;
    }
    if (!sessionToken) {
      nav(`/login?invite=${encodeURIComponent(token)}`, { state: loginState, replace: true });
      return;
    }
    (async () => {
      try {
        const { data } = await api.get<Preview>("/invitations/preview", { params: { token } });
        setPreview(data);
      } catch (e: unknown) {
        setError(getApiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, sessionToken]);

  useEffect(() => {
    if (!loading && preview?.status === "already_accepted" && sessionToken && user) {
      nav(`/app/projects/${preview.projectId}`, { replace: true });
    }
  }, [loading, preview, sessionToken, user, nav]);

  async function accept() {
    if (!token || wrongAccount || alreadyAccepted) return;
    setAccepting(true);
    setError(null);
    try {
      const { data } = await api.post<{ projectId: string }>("/invitations/accept", { token });
      nav(`/app/projects/${data.projectId}`, { replace: true });
    } catch (e: unknown) {
      setError(getApiErrorMessage(e));
    } finally {
      setAccepting(false);
    }
  }

  async function decline() {
    if (!token || wrongAccount || alreadyAccepted) return;
    setDeclining(true);
    setError(null);
    try {
      await api.post("/invitations/decline", { token });
      nav("/app/dashboard", { replace: true });
    } catch (e: unknown) {
      setError(getApiErrorMessage(e));
    } finally {
      setDeclining(false);
    }
  }

  function switchToInvitedAccount() {
    logout();
    nav(`/login?invite=${encodeURIComponent(token)}`, { state: loginState, replace: true });
  }

  if (!sessionToken) {
    return (
      <AuthShell title="Invitación al proyecto" subtitle="Redirigiendo al inicio de sesión…" showRegisterLink={false}>
        <div className="text-sm text-slate-500">Redirigiendo…</div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Invitación al proyecto"
      subtitle="GreenLab Data — colaboración en investigación"
      showRegisterLink={false}
    >
      {loading ? <div className="text-sm text-slate-500">Cargando invitación…</div> : null}
      {error ? <Alert kind="error">{error}</Alert> : null}
      {preview ? (
        <Card>
          <CardHeader title={preview.projectName} subtitle={`Te invitó ${preview.inviterName}`} />
          <CardBody className="space-y-4 text-sm">
            {alreadyAccepted ? (
              <Alert kind="success">Ya aceptaste esta invitación. Te llevamos al proyecto…</Alert>
            ) : (
              <>
                <p>
                  Te invitaron al proyecto <span className="font-medium">{preview.projectName}</span> con el correo{" "}
                  <span className="font-medium">{preview.email}</span>. ¿Quieres unirte y colaborar en los experimentos?
                </p>
                <p className="text-slate-600">
                  Sesión actual: <span className="font-medium">{user?.email}</span>
                </p>
                {wrongAccount ? (
                  <>
                    <Alert kind="warning">
                      Esta invitación es para <span className="font-medium">{preview.email}</span>. Cierra sesión e
                      inicia con esa cuenta para responder.
                    </Alert>
                    <Button variant="primary" onClick={switchToInvitedAccount}>
                      Cambiar a la cuenta invitada
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button variant="primary" disabled={accepting || declining} onClick={() => void accept()}>
                      {accepting ? "Uniéndote…" : "Aceptar y unirme al proyecto"}
                    </Button>
                    <Button variant="ghost" disabled={accepting || declining} onClick={() => void decline()}>
                      {declining ? "Procesando…" : "No, gracias"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardBody>
        </Card>
      ) : null}
    </AuthShell>
  );
}
