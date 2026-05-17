import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, getApiErrorMessage } from "../../lib/api";
import { useAuth } from "../../state/auth";
import { Alert, Button, Card, CardBody, CardHeader, Field, Input } from "../../components/ui";

type Project = {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  owner: { id: string; name: string; email: string };
  members: { user: { id: string; name: string; email: string; role: string } }[];
  experiments: { id: string; name: string; seedType: string; date: string; userId: string }[];
};

const memberSchema = z.object({ email: z.string().email("Email inválido") });

export function ProjectDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [project, setProject] = useState<Project | null>(null);
  const [activity, setActivity] = useState<
    { id: string; action: string; detail: string | null; createdAt: string; user: { name: string; email: string } }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [memberSuccess, setMemberSuccess] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<
    { id: string; email: string; createdAt: string; expiresAt: string }[]
  >([]);
  const [exporting, setExporting] = useState(false);

  const isOwner = project && user && project.ownerId === user.id;
  const canManage = Boolean(isOwner);
  const isSupervisor =
    Boolean(user && (user.role === "TEACHER" || user.role === "ADMIN") && project && !isOwner);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [{ data: p }, { data: a }] = await Promise.all([
        api.get<{ project: Project }>(`/projects/${id}`),
        api.get<{
          items: { id: string; action: string; detail: string | null; createdAt: string; user: { name: string; email: string } }[];
        }>(`/projects/${id}/activity`)
      ]);
      setProject(p.project);
      setActivity(a.items ?? []);
      if (p.project.ownerId === user?.id || user?.role === "ADMIN") {
        try {
          const { data: inv } = await api.get<{
            items: { id: string; email: string; createdAt: string; expiresAt: string }[];
          }>(`/projects/${id}/invitations`);
          setPendingInvites(inv.items ?? []);
        } catch {
          setPendingInvites([]);
        }
      } else {
        setPendingInvites([]);
      }
    } catch (e: unknown) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  useEffect(() => {
    const updated = Boolean((location.state as { projectUpdated?: boolean } | null)?.projectUpdated);
    if (updated) {
      setMsg("Proyecto actualizado correctamente.");
      nav(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<{ email: string }>({ resolver: zodResolver(memberSchema) });

  if (loading) return <div className="text-sm text-slate-500">Cargando…</div>;
  if (error) return <Alert kind="error">{error}</Alert>;
  if (!project) return <Alert kind="error">Proyecto no encontrado</Alert>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-2xl font-semibold">{project.name}</div>
          <div className="text-slate-500">Dueño: {project.owner?.name ?? "—"}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <Link to={`/app/projects/${project.id}/edit`}>
              <Button variant="ghost">Editar</Button>
            </Link>
          ) : null}
          {canManage ? (
            <Button
              variant="danger"
              onClick={async () => {
                if (!confirm(`¿Eliminar el proyecto "${project.name}"? Se borrarán también sus experimentos y registros asociados.`)) return;
                try {
                  await api.delete(`/projects/${project.id}`);
                  nav("/app/projects", { replace: true });
                } catch (e: unknown) {
                  alert(getApiErrorMessage(e));
                }
              }}
            >
              Eliminar
            </Button>
          ) : null}
          <Link to="/app/projects">
            <Button variant="ghost">Volver a proyectos</Button>
          </Link>
        </div>
      </div>

      {msg ? <Alert kind="success">{msg}</Alert> : null}

      {isSupervisor ? (
        <Alert kind="info">Vista de supervisión: puedes consultar este proyecto y sus experimentos en solo lectura.</Alert>
      ) : null}

      {project.description ? (
        <Alert kind="info">
          <div className="whitespace-pre-wrap">{project.description}</div>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Miembros"
            subtitle={isOwner ? "Invita por correo electrónico" : "Colaboradores con acceso al proyecto"}
          />
          <CardBody className="space-y-3">
            {isOwner ? (
              <>
                <Alert kind="info">
                  Se enviará un correo con un enlace de invitación (válido 7 días). La persona debe aceptar para unirse al proyecto.
                </Alert>
              <form
                className="flex flex-col gap-2 sm:flex-row sm:items-end"
                onSubmit={handleSubmit(async (values) => {
                  setMemberSuccess(null);
                  setMemberError(null);
                  try {
                    const { data } = await api.post<{ message?: string }>(`/projects/${project.id}/members`, values);
                    reset();
                    setMemberSuccess(data.message ?? "Invitación enviada");
                    await load();
                  } catch (e: unknown) {
                    setMemberError(getApiErrorMessage(e));
                  }
                })}
              >
                <div className="min-w-0 flex-1">
                  <Field label="Usuario a invitar" error={errors.email?.message}>
                    <Input type="email" placeholder="correo@institución.edu" {...register("email")} />
                  </Field>
                </div>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Enviando…" : "Enviar invitación"}
                </Button>
              </form>
              </>
            ) : null}
            {memberSuccess ? <Alert kind="success">{memberSuccess}</Alert> : null}
            {memberError ? <Alert kind="error">{memberError}</Alert> : null}
            {isOwner && pendingInvites.length > 0 ? (
              <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 text-sm">
                <div className="mb-2 font-medium text-amber-900">Invitaciones pendientes</div>
                <ul className="space-y-2">
                  {pendingInvites.map((inv) => (
                    <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {inv.email}{" "}
                        <span className="text-xs text-slate-500">
                          (expira {new Date(inv.expiresAt).toLocaleDateString()})
                        </span>
                      </span>
                      <Button
                        variant="ghost"
                        className="text-rose-700"
                        onClick={async () => {
                          if (!confirm("¿Cancelar esta invitación?")) return;
                          await api.delete(`/projects/${project.id}/invitations/${inv.id}`);
                          await load();
                        }}
                      >
                        Cancelar
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <ul className="divide-y divide-slate-100 text-sm">
              {(project.members ?? []).map((m) => (
                <li key={m.user.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {m.user.name} <span className="text-slate-500">({m.user.email})</span>
                  </span>
                  {isOwner && m.user.id !== project.ownerId ? (
                    <Button
                      variant="ghost"
                      className="text-rose-700"
                      onClick={async () => {
                        if (!confirm("¿Quitar a este usuario del proyecto?")) return;
                        try {
                          await api.delete(`/projects/${project.id}/members/${m.user.id}`);
                          await load();
                        } catch (e: unknown) {
                          alert(getApiErrorMessage(e));
                        }
                      }}
                    >
                      Quitar
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Experimentos en este proyecto" />
          <CardBody>
            {project.experiments.length === 0 ? (
              <div className="text-sm text-slate-500">Aún no hay experimentos vinculados.</div>
            ) : (
              <ul className="space-y-2 text-sm">
                {project.experiments.map((e) => (
                  <li key={e.id}>
                    <Link className="font-medium text-brand-800 hover:underline" to={`/app/experiments/${e.id}`}>
                      {e.name}
                    </Link>
                    <div className="text-xs text-slate-500">{e.seedType}</div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4">
              <div className="flex flex-wrap gap-2">
                <Link to="/app/experiments/new">
                  <Button variant="ghost">Nuevo experimento</Button>
                </Link>
                <Button
                  variant="ghost"
                  disabled={exporting || project.experiments.length === 0}
                  onClick={async () => {
                    setExporting(true);
                    try {
                      const resp = await api.get(`/projects/${project.id}/export.xlsx`, { responseType: "blob" });
                      const blob = new Blob([resp.data], {
                        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `greenlab_proyecto_${project.id}.xlsx`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch (e: unknown) {
                      alert(getApiErrorMessage(e));
                    } finally {
                      setExporting(false);
                    }
                  }}
                >
                  {exporting ? "Generando..." : "Descargar Excel del proyecto"}
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Actividad reciente" subtitle="Registro colaborativo (HU-20)" />
        <CardBody>
          {activity.length === 0 ? (
            <div className="text-sm text-slate-500">Sin actividad registrada.</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {activity.map((log) => (
                <li key={log.id} className="border-b border-slate-50 pb-2">
                  <span className="font-medium">{log.action}</span> · {log.user.name}
                  <div className="text-xs text-slate-500">{new Date(log.createdAt).toLocaleString()}</div>
                  {log.detail ? <div className="text-slate-600">{log.detail}</div> : null}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
