import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getApiErrorMessage } from "../../lib/api";
import { Alert, Button, Card, CardBody, CardHeader } from "../../components/ui";

type Item = {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: string;
  _count: { experiments: number; members: number };
};

export function ProjectsListPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<{ items: Item[] }>("/projects");
      setItems(data.items ?? []);
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
          <div className="text-2xl font-semibold">Proyectos</div>
          <div className="text-slate-500">Agrupa experimentos y colabora con tu equipo.</div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={load} disabled={loading}>
            {loading ? "…" : "Actualizar"}
          </Button>
          <Link to="/app/projects/new">
            <Button>Nuevo proyecto</Button>
          </Link>
        </div>
      </div>

      {error ? <Alert kind="error">{error}</Alert> : null}

      <Card>
        <CardHeader title="Listado" subtitle="Proyectos donde eres dueño o miembro" />
        <CardBody>
          {loading ? (
            <div className="text-sm text-slate-500">Cargando…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-slate-500">Crea un proyecto para asociar nuevos experimentos.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <Link className="font-medium text-brand-800 hover:underline" to={`/app/projects/${p.id}`}>
                      {p.name}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {p._count.experiments} experimento(s) · {p._count.members} miembro(s)
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
