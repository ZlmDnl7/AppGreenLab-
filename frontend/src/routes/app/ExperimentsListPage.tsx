import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, getApiErrorMessage } from "../../lib/api";
import { Alert, Button, Card, CardBody, CardHeader } from "../../components/ui";

type ExperimentListItem = {
  id: string;
  name: string;
  seedType: string;
  date: string;
  scaleUnit: "CM" | "MM";
  createdAt: string;
  project?: { id: string; name: string } | null;
};

type ProjectOption = { id: string; name: string };

export function ExperimentsListPage() {
  const [items, setItems] = useState<ExperimentListItem[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [projectId, setProjectId] = useState<string>("");

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    const query = q.trim();
    if (query) p.q = query;
    if (projectId) p.projectId = projectId;
    return p;
  }, [q, projectId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/experiments", { params });
      setItems(data.items ?? []);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<{ items: ProjectOption[] }>("/projects");
        setProjects(data.items ?? []);
      } catch {
        setProjects([]);
      }
    })();
  }, []);

  useEffect(() => {
    void load();
  }, [params]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-2xl font-semibold">Experimentos</div>
          <div className="text-slate-500">Crea, revisa y captura datos experimentales.</div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={load} disabled={loading}>
            {loading ? "Actualizando..." : "Actualizar"}
          </Button>
          <Link to="/app/experiments/new">
            <Button>Nuevo experimento</Button>
          </Link>
        </div>
      </div>

      {error ? <Alert kind="error">{error}</Alert> : null}

      <Card>
        <CardHeader title="Buscar y filtrar" subtitle="HU-27 búsqueda por nombre · HU-28 filtro por proyecto" />
        <CardBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_260px_auto] sm:items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700">Buscar por nombre</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400"
                value={q}
                placeholder="Ej. Germinación de maíz"
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Proyecto</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">Todos los proyectos</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setQ("");
                  setProjectId("");
                }}
                disabled={!q.trim() && !projectId}
              >
                Limpiar
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Listado" subtitle="Últimos experimentos creados" />
        <CardBody>
          {loading ? (
            <div className="text-sm text-slate-500">Cargando...</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-slate-500">
              {q.trim() || projectId ? "No se encontraron experimentos con esos criterios." : "Aún no tienes experimentos. Crea el primero."}
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Nombre</th>
                    <th className="py-2 pr-4">Proyecto</th>
                    <th className="py-2 pr-4">Semilla</th>
                    <th className="py-2 pr-4">Fecha</th>
                    <th className="py-2 pr-4">Escala</th>
                    <th className="py-2 pr-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-3 pr-4 font-medium">{it.name}</td>
                      <td className="py-3 pr-4 text-slate-600">{it.project?.name ?? "—"}</td>
                      <td className="py-3 pr-4 text-slate-600">{it.seedType}</td>
                      <td className="py-3 pr-4 text-slate-600">{new Date(it.date).toLocaleDateString()}</td>
                      <td className="py-3 pr-4 text-slate-600">{it.scaleUnit}</td>
                      <td className="py-3 pr-2 text-right">
                        <Link className="text-brand-700 hover:underline" to={`/app/experiments/${it.id}`}>
                          Abrir
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
    </div>
  );
}

