import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, getApiErrorMessage } from "../../lib/api";
import { Alert, Button, Field, Input, Card, CardBody, CardHeader } from "../../components/ui";

const schema = z.object({
  email: z.string().email("Email inválido")
});
type Form = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const nav = useNavigate();
  const [msg, setMsg] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<Form>({ resolver: zodResolver(schema) });

  return (
    <div className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-lg">
        <Card>
          <CardHeader
            title="Recuperar contraseña"
            subtitle="Te enviaremos un enlace al correo si hay una cuenta registrada (revisa también spam). En el servidor gratuito la primera petición puede tardar hasta 1 minuto."
            right={<Link className="text-sm text-brand-700 hover:underline" to="/login">Login</Link>}
          />
          <CardBody>
            <form
              className="space-y-4"
              onSubmit={handleSubmit(async (values) => {
                setMsg(null);
                try {
                  const { data } = await api.post("/auth/forgot-password", values);
                  if (data?.ok || data?.emailSent) {
                    nav("/reset", {
                      replace: true,
                      state: {
                        fromForgot: true as const,
                        hint:
                          "Si el correo existe en el sistema, recibirás un enlace. Ábrelo o copia el token al campo de abajo. El enlace caduca en 30 minutos."
                      }
                    });
                    return;
                  }
                } catch (e: unknown) {
                  setMsg({
                    kind: "error",
                    text: getApiErrorMessage(e)
                  });
                }
              })}
            >
              {msg ? <Alert kind={msg.kind}>{msg.text}</Alert> : null}

              <Field label="Email" error={errors.email?.message}>
                <Input placeholder="tu@email.com" type="email" autoComplete="email" {...register("email")} />
              </Field>

              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Enviando…" : "Enviar"}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
