import React, { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, getApiErrorMessage } from "../../lib/api";
import { useAuth } from "../../state/auth";
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, Textarea } from "../../components/ui";

const schema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  description: z.string().optional()
});
type Form = z.infer<typeof schema>;

type Project = {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
};

export function ProjectEditPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<Form>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get<{ project: Project }>(`/projects/${id}`);
        setProject(data.project);
        reset({ name: data.project.name, description: data.project.description ?? "" });
      } catch (e: unknown) {
        setError(getApiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, reset]);

  if (loading) return <div className="text-sm text-slate-500">Cargando…</div>;
  if (error) return <Alert kind="error">{error}</Alert>;
  if (!project) return <Alert kind="error">Proyecto no encontrado</Alert>;

  const canEdit = Boolean(user) && (project.ownerId === user!.id || user!.role === "ADMIN");
  if (!canEdit) return <Navigate to={id ? `/app/projects/${id}` : "/app/projects"} replace />;

  return (
    <div className="space-y-5">
      <div>
        <div className="text-2xl font-semibold">Editar proyecto</div>
        <div className="text-slate-500">Actualiza nombre y descripción (HU-23).</div>
      </div>

      <Card>
        <CardHeader title="Formulario" right={id ? <Link to={`/app/projects/${id}`}>Cancelar</Link> : null} />
        <CardBody>
          <form
            className="space-y-4"
            onSubmit={handleSubmit(async (values) => {
              if (!id) return;
              setError(null);
              try {
                await api.patch(`/projects/${id}`, {
                  name: values.name,
                  description: values.description?.trim() || null
                });
                nav(`/app/projects/${id}`, { state: { projectUpdated: true } });
              } catch (e: unknown) {
                setError(getApiErrorMessage(e));
              }
            })}
          >
            {error ? <Alert kind="error">{error}</Alert> : null}
            <Field label="Nombre" error={errors.name?.message}>
              <Input placeholder="Ej. Proyecto maíz 2026" {...register("name")} />
            </Field>
            <Field label="Descripción" hint="Opcional" error={errors.description?.message}>
              <Textarea rows={3} placeholder="Objetivo del proyecto" {...register("description")} />
            </Field>
            <div className="flex justify-end gap-2">
              <Link to={id ? `/app/projects/${id}` : "/app/projects"}>
                <Button variant="ghost" type="button">
                  Volver
                </Button>
              </Link>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Guardando…" : "Guardar cambios"}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

