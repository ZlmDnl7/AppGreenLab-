import React, { useEffect } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "../../lib/api";
import { Alert, Button, Card, CardBody, CardHeader, Field, Input } from "../../components/ui";

const schema = z.object({
  token: z.string().min(10, "Token requerido"),
  newPassword: z.string().min(8, "Mínimo 8 caracteres")
});
type Form = z.infer<typeof schema>;

type ResetLocationState = { fromForgot?: boolean; hint?: string };

export function ResetPasswordPage() {
  const nav = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const tokenFromUrl = params.get("token") ?? "";
  const fromForgot = (location.state as ResetLocationState | null)?.fromForgot;
  const forgotHint = (location.state as ResetLocationState | null)?.hint;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { token: tokenFromUrl, newPassword: "" }
  });

  useEffect(() => {
    if (tokenFromUrl) setValue("token", tokenFromUrl);
  }, [tokenFromUrl, setValue]);

  const [msg, setMsg] = React.useState<{ kind: "success" | "error"; text: string } | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-lg">
        <Card>
          <CardHeader
            title="Restablecer contraseña"
            subtitle="Abre el enlace del correo (rellena el token automáticamente) o pega el token y elige una contraseña nueva."
            right={<Link className="text-sm text-brand-700 hover:underline" to="/login">Login</Link>}
          />
          <CardBody>
            <form
              className="space-y-4"
              onSubmit={handleSubmit(async (values) => {
                setMsg(null);
                try {
                  await api.post("/auth/reset-password", values);
                  setMsg({ kind: "success", text: "Contraseña actualizada. Ya puedes iniciar sesión." });
                  setTimeout(() => nav("/login"), 900);
                } catch (e: unknown) {
                  const err = e as { response?: { data?: { error?: string } } };
                  setMsg({ kind: "error", text: err?.response?.data?.error ?? "No se pudo resetear" });
                }
              })}
            >
              {msg ? <Alert kind={msg.kind}>{msg.text}</Alert> : null}

              {fromForgot && forgotHint ? <Alert kind="info">{forgotHint}</Alert> : null}

              <Field label="Token" error={errors.token?.message}>
                <Input placeholder="Pega el token o ábrelo desde el correo" {...register("token")} />
              </Field>

              <Field label="Nueva contraseña" error={errors.newPassword?.message}>
                <Input type="password" placeholder="••••••••" autoComplete="new-password" {...register("newPassword")} />
              </Field>

              <div className="flex items-center justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Actualizando..." : "Actualizar"}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
