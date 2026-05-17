import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, getApiErrorMessage } from "../../lib/api";
import { useAuth } from "../../state/auth";
import { Alert, Button, Field, Input, Card, CardBody, CardHeader } from "../../components/ui";

const schema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres")
});

type Form = z.infer<typeof schema>;

export function RegisterPage() {
  const { setAuth } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const inviteToken = (location.state as { inviteToken?: string } | null)?.inviteToken;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<Form>({ resolver: zodResolver(schema) });

  return (
    <div className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-lg">
        <Card>
          <CardHeader title="Crear cuenta" subtitle="Empieza a registrar tus experimentos en GreenLab Data." right={<Link className="text-sm text-brand-700 hover:underline" to="/login">Login</Link>} />
          <CardBody>
            <form
              className="space-y-4"
              onSubmit={handleSubmit(async (values) => {
                setError(null);
                try {
                  const { data } = await api.post("/auth/register", values);
                  setAuth({ token: data.token, user: data.user });
                  if (inviteToken) {
                    try {
                      const { data: accepted } = await api.post<{ projectId: string }>("/invitations/accept", {
                        token: inviteToken
                      });
                      nav(`/app/projects/${accepted.projectId}`, { replace: true });
                      return;
                    } catch {
                      /* invitaciones pendientes ya se aplican al registrarse */
                    }
                  }
                  if ((data.invitationsAccepted ?? 0) > 0) {
                    nav("/app/projects", { state: { justRegistered: true } });
                    return;
                  }
                  nav("/app/dashboard", { state: { justRegistered: true } });
                } catch (e: unknown) {
                  setError(getApiErrorMessage(e));
                }
              })}
            >
              {error ? <Alert kind="error">{error}</Alert> : null}

              <Field label="Nombre" error={errors.name?.message}>
                <Input placeholder="Tu nombre" autoComplete="name" {...register("name")} />
              </Field>

              <Field label="Email" error={errors.email?.message}>
                <Input placeholder="tu@email.com" type="email" autoComplete="email" {...register("email")} />
              </Field>

              <Field label="Contraseña" hint="Mínimo 8 caracteres" error={errors.password?.message}>
                <Input placeholder="••••••••" type="password" autoComplete="new-password" {...register("password")} />
              </Field>

              <div className="flex items-center justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creando..." : "Crear cuenta"}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

