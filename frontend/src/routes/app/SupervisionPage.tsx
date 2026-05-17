import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getApiErrorMessage } from "../../lib/api";
import { useAuth } from "../../state/auth";
import { Alert, Button, Card, CardBody, CardHeader } from "../../components/ui";

type ExperimentItem = {
  id: string;
  name: string;
  seedType: string;
  date: string;
  user: { id: string; name: string; email: string };
  project: { id: string; name: string } | null;
};

type ProjectItem = {
  id: string;
  name: string;
  owner?: { name: string; email: string };
  _count: { experiments: number; members: number };
};

export function SupervisionPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [experiments, setExperiments] = useState<ExperimentItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [{ data: expData }, { data: projData }] = await Promise.all([
        api.get<{ items: ExperimentItem[] }>("/experiments", { params: { scope: "teacher" } }),
        api.get<{ items: ProjectItem[] }>("/projects", { params: { scope: "supervision" } })
      ]);
      setExperiments(expData.items ?? []);
      setProjects(projData.items ?? []);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-2xl font-semibold">Supervisión</div>
          <div className="text-slate-500">
            Consulta trabajo de estudiantes en solo lectura. En el detalle no puedes editar salvo que seas autor o miembro del
            proyecto.
          </div>
        </div>
        <Button variant="ghost" onClick={load} disabled={loading}>
          {loading ? "…" : "Actualizar"}
        </Button>
      </div>

      {error ? <Alert kind="error">{error}</Alert> : null}

      <Card>
        <CardHeader title="Experimentos de estudiantes" subtitle="Ver datos, estadísticas e historial (según tu rol)" />
        <CardBody>
          {loading ? (
            <div className="text-sm text-slate-500">Cargando…</div>
          ) : experiments.length === 0 ? (
            <div className="text-sm text-slate-500">No hay experimentos de estudiantes.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Nombre</th>
                    <th className="py-2 pr-4">Estudiante</th>
                    <th className="py-2 pr-4">Proyecto</th>
                    <th className="py-2 pr-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {experiments.map((it) => (
                    <tr key={it.id}>
                      <td className="py-3 pr-4 font-medium">{it.name}</td>
                      <td className="py-3 pr-4 text-slate-600">{it.user.name}</td>
                      <td className="py-3 pr-4 text-slate-600">{it.project?.name ?? "—"}</td>
                      <td className="py-3 pr-2 text-right">
                        <Link className="text-brand-700 hover:underline" to={`/app/experiments/${it.id}`}>
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Proyectos"
          subtitle={
            isAdmin
              ? "Todos los proyectos (solo lectura si no participas)"
              : "Proyectos con experimentos de estudiantes"
          }
        />
        <CardBody>
          {loading ? (
            <div className="text-sm text-slate-500">Cargando…</div>
          ) : projects.length === 0 ? (
            <div className="text-sm text-slate-500">No hay proyectos para mostrar.</div>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {projects.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <Link className="font-medium text-brand-800 hover:underline" to={`/app/projects/${p.id}`}>
                      {p.name}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {p._count.experiments} experimento(s) · {p._count.members} miembro(s)
                      {p.owner ? ` · Dueño: ${p.owner.name}` : ""}
                    </div>
                  </div>
                  <Link to={`/app/projects/${p.id}`}>
                    <Button variant="ghost">Abrir</Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
