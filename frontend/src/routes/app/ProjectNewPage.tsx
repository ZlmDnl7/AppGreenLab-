import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, getApiErrorMessage } from "../../lib/api";
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, Textarea } from "../../components/ui";

const schema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  description: z.string().optional()
});

type Form = z.infer<typeof schema>;

export function ProjectNewPage() {
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<Form>({ resolver: zodResolver(schema) });

  return (
    <div className="space-y-5">
      <div>
        <div className="text-2xl font-semibold">Nuevo proyecto</div>
        <div className="text-slate-500">Luego podrás asociar experimentos y añadir colaboradores.</div>
      </div>

      <Card>
        <CardHeader title="Datos" right={<Link to="/app/projects">Volver</Link>} />
        <CardBody>
          <form
            className="space-y-4"
            onSubmit={handleSubmit(async (values) => {
              setError(null);
              try {
                const { data } = await api.post("/projects", values);
                nav(`/app/projects/${data.project.id}`);
              } catch (e: unknown) {
                setError(getApiErrorMessage(e));
              }
            })}
          >
            {error ? <Alert kind="error">{error}</Alert> : null}
            <Field label="Nombre" error={errors.name?.message}>
              <Input placeholder="Ej. Fitotoxicidad 2026" {...register("name")} />
            </Field>
            <Field label="Descripción" hint="Opcional" error={errors.description?.message}>
              <Textarea rows={3} placeholder="Objetivo del proyecto" {...register("description")} />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creando…" : "Crear proyecto"}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
