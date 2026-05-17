import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, getApiErrorMessage } from "../../lib/api";
import { useAuth } from "../../state/auth";
import { Alert, Button, Field, Input } from "../../components/ui";
import { AuthShell } from "./AuthShell";

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Contraseña requerida")
});

type Form = z.infer<typeof schema>;

type InviteLoginState = {
  inviteToken?: string;
  from?: string;
  inviteEmail?: string;
  inviteProjectName?: string;
};

export function LoginPage() {
  const { setAuth, token: sessionToken } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const state = (location.state as InviteLoginState | null) ?? {};
  const sessionExpired = Boolean((location.state as { sessionExpired?: boolean } | null)?.sessionExpired);
  const authRequired = Boolean((location.state as { authRequired?: boolean } | null)?.authRequired);
  const inviteToken = state.inviteToken ?? searchParams.get("invite") ?? undefined;
  const [inviteHint, setInviteHint] = useState<{ email: string; projectName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<Form>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (sessionToken && inviteToken) {
      nav(`/invitations/accept?token=${encodeURIComponent(inviteToken)}`, { replace: true });
    }
  }, [sessionToken, inviteToken, nav]);

  useEffect(() => {
    if (!inviteToken) return;
    if (state.inviteEmail && state.inviteProjectName) {
      setInviteHint({ email: state.inviteEmail, projectName: state.inviteProjectName });
      reset({ email: state.inviteEmail, password: "" });
      return;
    }
    (async () => {
      try {
        const { data } = await api.get<{
          email: string;
          projectName: string;
          status: string;
        }>("/invitations/preview", { params: { token: inviteToken } });
        setInviteHint({ email: data.email, projectName: data.projectName });
        reset({ email: data.email, password: "" });
      } catch {
        /* preview opcional en login */
      }
    })();
  }, [inviteToken, state.inviteEmail, state.inviteProjectName, reset]);

  return (
    <AuthShell
      title={inviteToken ? "Iniciar sesión" : "Iniciar sesión"}
      subtitle={
        inviteToken
          ? inviteHint
            ? `Invitación al proyecto «${inviteHint.projectName}»`
            : "Tienes una invitación pendiente"
          : "Accede a tus experimentos y registros."
      }
    >
      <form
        className="space-y-4"
        onSubmit={handleSubmit(async (values) => {
          setError(null);
          try {
            const { data } = await api.post("/auth/login", values);
            setAuth({ token: data.token, user: data.user });
            if (inviteToken) {
              nav(`/invitations/accept?token=${encodeURIComponent(inviteToken)}`, { replace: true });
              return;
            }
            const from = state.from;
            nav(from && from.startsWith("/app") ? from : "/app/dashboard");
          } catch (e: unknown) {
            setError(getApiErrorMessage(e));
          }
        })}
      >
        {inviteToken && inviteHint ? (
          <Alert kind="info">
            Inicia sesión con <span className="font-medium">{inviteHint.email}</span>. Después podrás aceptar o rechazar
            la invitación al proyecto.
          </Alert>
        ) : null}
        {sessionExpired ? (
          <Alert kind="info">Tu sesión se cerró por inactividad. Vuelve a iniciar sesión.</Alert>
        ) : null}
        {authRequired ? <Alert kind="info">Debes iniciar sesión para acceder a esa sección.</Alert> : null}
        {error ? <Alert kind="error">{error}</Alert> : null}

        <Field label="Email" error={errors.email?.message}>
          <Input placeholder="tu@email.com" type="email" autoComplete="email" {...register("email")} />
        </Field>

        <Field label="Contraseña" error={errors.password?.message}>
          <Input placeholder="••••••••" type="password" autoComplete="current-password" {...register("password")} />
        </Field>

        <div className="flex items-center justify-between gap-3">
          <Link className="text-sm text-brand-700 hover:underline" to="/forgot">
            ¿Olvidaste tu contraseña?
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Ingresando..." : "Ingresar"}
          </Button>
        </div>

        {!inviteToken ? (
          <div className="text-sm text-slate-600">
            ¿No tienes cuenta?{" "}
            <Link className="text-brand-700 hover:underline" to="/register">
              Regístrate
            </Link>
          </div>
        ) : null}
      </form>
    </AuthShell>
  );
}
