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
  seedType: z.string().min(2, "Requerido"),
  date: z.string().min(1, "Fecha requerida"),
  description: z.string().optional(),
  scaleUnit: z.enum(["CM", "MM"])
});

type Form = z.infer<typeof schema>;

type Permissions = { canEdit: boolean };

export function ExperimentEditPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<Permissions>({ canEdit: false });

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
        const { data } = await api.get<{ experiment: any; permissions?: Permissions }>(`/experiments/${id}`);
        const e = data.experiment;
        setPermissions(data.permissions ?? { canEdit: false });
        reset({
          name: e.name,
          seedType: e.seedType,
          date: e.date.slice(0, 10),
          description: e.description ?? "",
          scaleUnit: e.scaleUnit
        });
      } catch (e: unknown) {
        setError(getApiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, reset]);

  if (loading) return <div className="text-sm text-slate-500">Cargando…</div>;

  const canEdit = Boolean(user) && Boolean(permissions?.canEdit);
  if (!loading && !canEdit) {
    return <Navigate to={id ? `/app/experiments/${id}` : "/app/experiments"} replace />;
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="text-2xl font-semibold">Editar experimento</div>
        <div className="text-slate-500">Metadatos del ensayo (HU-16).</div>
      </div>

      <Card>
        <CardHeader title="Formulario" right={id ? <Link to={`/app/experiments/${id}`}>Cancelar</Link> : null} />
        <CardBody>
          <form
            className="space-y-4"
            onSubmit={handleSubmit(async (values) => {
              if (!id) return;
              setError(null);
              try {
                await api.patch(`/experiments/${id}`, {
                  name: values.name,
                  seedType: values.seedType,
                  date: new Date(values.date),
                  description: values.description?.trim() || null,
                  scaleUnit: values.scaleUnit
                });
                nav(`/app/experiments/${id}`);
              } catch (e: unknown) {
                setError(getApiErrorMessage(e));
              }
            })}
          >
            {error ? <Alert kind="error">{error}</Alert> : null}
            <Field label="Nombre" error={errors.name?.message}>
              <Input {...register("name")} />
            </Field>
            <Field label="Tipo de semilla" error={errors.seedType?.message}>
              <Input {...register("seedType")} />
            </Field>
            <Field label="Fecha" error={errors.date?.message}>
              <Input type="date" {...register("date")} />
            </Field>
            <Field label="Unidad de longitud" error={errors.scaleUnit?.message}>
              <select className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" {...register("scaleUnit")}>
                <option value="CM">cm</option>
                <option value="MM">mm</option>
              </select>
            </Field>
            <Field label="Descripción" error={errors.description?.message}>
              <Textarea rows={3} {...register("description")} />
            </Field>
            <div className="flex justify-end gap-2">
              <Link to={id ? `/app/experiments/${id}` : "/app/experiments"}>
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
