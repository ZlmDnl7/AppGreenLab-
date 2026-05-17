import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getApiErrorMessage } from "../../lib/api";
import { Alert, Button, Card, CardBody, CardHeader } from "../../components/ui";

type Item = {
  id: string;
  name: string;
  seedType: string;
  date: string;
  user: { id: string; name: string; email: string };
  project: { id: string; name: string } | null;
};

export function TeacherExperimentsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<{ items: Item[] }>("/experiments", { params: { scope: "teacher" } });
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
          <div className="text-2xl font-semibold">Experimentos de estudiantes</div>
          <div className="text-slate-500">Vista docente (solo lectura en el detalle).</div>
        </div>
        <Button variant="ghost" onClick={load} disabled={loading}>
          {loading ? "…" : "Actualizar"}
        </Button>
      </div>

      {error ? <Alert kind="error">{error}</Alert> : null}

      <Card>
        <CardHeader title="Registros" subtitle="Autores con rol estudiante" />
        <CardBody>
          {loading ? (
            <div className="text-sm text-slate-500">Cargando…</div>
          ) : items.length === 0 ? (
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
                  {items.map((it) => (
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
    </div>
  );
}
