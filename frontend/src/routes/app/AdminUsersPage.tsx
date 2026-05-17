import React, { useEffect, useState } from "react";
import { api, getApiErrorMessage } from "../../lib/api";
import { useAuth, type UserRole } from "../../state/auth";
import { Alert, Button, Card, CardBody, CardHeader } from "../../components/ui";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
};

type AuditRow = {
  id: string;
  action: string;
  createdAt: string;
  actorEmailSnapshot: string;
  targetEmailSnapshot: string;
  targetNameSnapshot: string | null;
  detail: string | null;
};

const ROLES: { value: UserRole; label: string }[] = [
  { value: "STUDENT", label: "Estudiante" },
  { value: "TEACHER", label: "Docente" },
  { value: "RESEARCHER", label: "Investigador" },
  { value: "ADMIN", label: "Administrador" }
];

export function AdminUsersPage() {
  const { user, refreshUser } = useAuth();
  const [items, setItems] = useState<UserRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingRole, setPendingRole] = useState<Record<string, UserRole>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [{ data: usersData }, { data: auditData }] = await Promise.all([
        api.get<{ items: UserRow[] }>("/admin/users"),
        api.get<{ items: AuditRow[] }>("/admin/audit")
      ]);
      const list = usersData.items ?? [];
      setItems(list);
      const next: Record<string, UserRole> = {};
      for (const u of list) next[u.id] = u.role;
      setPendingRole(next);
      setAudit(auditData.items ?? []);
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
          <div className="text-2xl font-semibold">Usuarios</div>
          <div className="text-slate-500">
            Cambia roles, elimina cuentas (se borran de la base de datos y todo lo asociado en cascada) y actualiza permisos en menú al
            volver a enfocar la ventana o abrir otra sección.
          </div>
        </div>
        <Button variant="ghost" onClick={load} disabled={loading}>
          {loading ? "…" : "Actualizar"}
        </Button>
      </div>

      {error ? <Alert kind="error">{error}</Alert> : null}

      <Card>
        <CardHeader title="Listado" subtitle="Rol y eliminación solo para administradores" />
        <CardBody>
          {loading ? (
            <div className="text-sm text-slate-500">Cargando…</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Nombre</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Rol</th>
                    <th className="py-2 pr-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((u) => {
                    const selected = pendingRole[u.id] ?? u.role;
                    const dirty = selected !== u.role;
                    return (
                      <tr key={u.id}>
                        <td className="py-3 pr-4 font-medium">{u.name}</td>
                        <td className="py-3 pr-4 text-slate-600">{u.email}</td>
                        <td className="py-3 pr-4">
                          <select
                            className="w-full min-w-[10rem] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                            value={selected}
                            disabled={u.id === user?.id}
                            onChange={(e) =>
                              setPendingRole((m) => ({ ...m, [u.id]: e.target.value as UserRole }))
                            }
                          >
                            {ROLES.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                          {u.id === user?.id ? (
                            <div className="mt-1 text-[11px] text-slate-500">No puedes quitarte el rol admin aquí</div>
                          ) : null}
                        </td>
                        <td className="py-3 pr-2 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              disabled={!dirty || savingId === u.id || u.id === user?.id}
                              onClick={async () => {
                                setSavingId(u.id);
                                try {
                                  await api.patch(`/admin/users/${u.id}`, { role: selected });
                                  await load();
                                  if (u.id === user?.id) await refreshUser();
                                } catch (e: unknown) {
                                  alert(getApiErrorMessage(e));
                                } finally {
                                  setSavingId(null);
                                }
                              }}
                            >
                              {savingId === u.id ? "Guardando…" : "Guardar rol"}
                            </Button>
                            {u.id !== user?.id ? (
                              <Button
                                variant="danger"
                                disabled={!!savingId}
                                onClick={async () => {
                                  if (
                                    !confirm(
                                      `¿Eliminar permanentemente la cuenta de ${u.email}? Se borrarán sus datos en la base de datos (experimentos, proyectos como dueño, etc.).`
                                    )
                                  )
                                    return;
                                  try {
                                    await api.delete(`/admin/users/${u.id}`);
                                    await load();
                                  } catch (e: unknown) {
                                    alert(getApiErrorMessage(e));
                                  }
                                }}
                              >
                                Eliminar
                              </Button>
                            ) : (
                              <span className="text-xs text-slate-400">Tú</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Auditoría" subtitle="Últimas acciones administrativas (no se borra al eliminar usuarios)" />
        <CardBody>
          {loading ? (
            <div className="text-sm text-slate-500">Cargando…</div>
          ) : audit.length === 0 ? (
            <div className="text-sm text-slate-500">Sin acciones registradas.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Fecha</th>
                    <th className="py-2 pr-4">Acción</th>
                    <th className="py-2 pr-4">Admin</th>
                    <th className="py-2 pr-4">Objetivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {audit.map((a) => (
                    <tr key={a.id}>
                      <td className="py-3 pr-4 text-slate-600">{new Date(a.createdAt).toLocaleString()}</td>
                      <td className="py-3 pr-4 font-medium">{a.action}</td>
                      <td className="py-3 pr-4 text-slate-600">{a.actorEmailSnapshot}</td>
                      <td className="py-3 pr-4 text-slate-600">
                        {a.targetNameSnapshot ? `${a.targetNameSnapshot} — ` : ""}
                        {a.targetEmailSnapshot}
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
