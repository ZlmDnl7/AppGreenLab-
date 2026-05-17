import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, API_URL, getApiErrorMessage } from "../../lib/api";
import { useAuth } from "../../state/auth";
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, Textarea, cx } from "../../components/ui";

type Seed = {
  id: string;
  seedNumber: number;
  germinated: boolean;
  rootLength: number | null;
  hypocotylLength: number | null;
  notes: string | null;
};

type Replica = { id: string; code: string; seeds: Seed[] };
type Factor = { id: string; name: string; type: "CONTROL" | "EXPERIMENTAL"; replicas: Replica[] };
type ImageRec = { id: string; status: "PENDING" | "ACCEPTED" | "REJECTED"; storagePath: string; originalName: string; createdAt: string };

type SummaryPayload = {
  overall?: { totalSeeds?: number; germinated?: number; germinationRate?: number };
  byFactor?: Array<{
    factorName: string;
    seeds: number;
    germinated: number;
    germinationRate: number;
    meanRootLength: number | null;
    meanHypocotylLength: number | null;
    minRootLength: number | null;
    maxRootLength: number | null;
    minHypocotylLength: number | null;
    maxHypocotylLength: number | null;
  }>;
};

type Experiment = {
  id: string;
  name: string;
  seedType: string;
  date: string;
  description?: string | null;
  scaleUnit: "CM" | "MM";
  factors: Factor[];
  images: ImageRec[];
  user?: { id: string; name: string; email: string; role: string };
  project?: { id: string; name: string } | null;
  computedSummary?: SummaryPayload | null;
};

type Permissions = { canEdit: boolean };

type HistoryItem = {
  id: string;
  action: string;
  detail: string | null;
  createdAt: string;
  user: { name: string; email: string };
};

type ExportRow = {
  factor: string;
  replica: string;
  seed: number;
  germinated: string;
  rootLength: number | null;
  hypocotylLength: number | null;
  notes: string;
};

function fmtStat(value: unknown): string {
  if (value == null || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

export function ExperimentDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [permissions, setPermissions] = useState<Permissions>({ canEdit: false });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeFactorId, setActiveFactorId] = useState<string | null>(null);
  const [activeReplicaId, setActiveReplicaId] = useState<string | null>(null);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<{ experiment: Experiment; permissions?: Permissions }>(`/experiments/${id}`);
      setExperiment(data.experiment);
      setPermissions(data.permissions ?? { canEdit: false });
      const firstFactor = data.experiment?.factors?.[0]?.id ?? null;
      const firstReplica = data.experiment?.factors?.[0]?.replicas?.[0]?.id ?? null;
      setActiveFactorId((prev) => prev ?? firstFactor);
      setActiveReplicaId((prev) => prev ?? firstReplica);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? "No se pudo cargar el experimento");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!uploadFile) {
      setUploadPreview(null);
      return;
    }
    const url = URL.createObjectURL(uploadFile);
    setUploadPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [uploadFile]);

  const canSeeHistory = Boolean(user && (user.role === "RESEARCHER" || user.role === "ADMIN"));

  useEffect(() => {
    if (!id || !canSeeHistory) {
      setHistory([]);
      setHistoryError(null);
      return;
    }
    (async () => {
      setHistoryError(null);
      try {
        const { data } = await api.get<{ items: HistoryItem[] }>(`/experiments/${id}/history`);
        setHistory(data.items ?? []);
      } catch (e: unknown) {
        setHistoryError(getApiErrorMessage(e));
      }
    })();
  }, [id, canSeeHistory]);

  const activeFactor = useMemo(() => experiment?.factors.find((f) => f.id === activeFactorId) ?? null, [experiment, activeFactorId]);
  const activeReplica = useMemo(() => activeFactor?.replicas.find((r) => r.id === activeReplicaId) ?? null, [activeFactor, activeReplicaId]);

  if (loading) return <div className="text-sm text-slate-500">Cargando...</div>;
  if (error) return <Alert kind="error">{error}</Alert>;
  if (!experiment) return <Alert kind="error">Experimento no encontrado</Alert>;

  const canEdit = Boolean(user) && Boolean(permissions?.canEdit);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-2xl font-semibold">{experiment.name}</div>
          <div className="text-slate-500">
            {experiment.seedType} · {new Date(experiment.date).toLocaleDateString()} · Escala: {experiment.scaleUnit}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/app/experiments">
            <Button variant="ghost">Volver</Button>
          </Link>
          {canEdit ? (
            <Link to={`/app/experiments/${experiment.id}/edit`}>
              <Button variant="ghost">Editar datos generales</Button>
            </Link>
          ) : null}
          <Button
            variant="ghost"
            onClick={async () => {
              const { data } = await api.get(`/experiments/${experiment.id}/export`);
              const cols = data.columns as string[];
              const rows = data.rows as ExportRow[];
              const csv = buildCsvForExcelEs(cols, rows);
              downloadText(`greenlab_${experiment.id}.csv`, csv, "text/csv;charset=utf-8");
            }}
          >
            Descargar CSV
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              try {
                const res = await api.get(`/experiments/${experiment.id}/report.xlsx`, { responseType: "blob" });
                const blob = new Blob([res.data], {
                  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `greenlab_${experiment.id}_reporte.xlsx`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (e: unknown) {
                alert("No se pudo descargar el Excel");
              }
            }}
          >
            Descargar Excel
          </Button>
        </div>
      </div>

      {experiment.description ? (
        <Alert kind="info">
          <div className="font-medium">Descripción</div>
          <div className="mt-1 whitespace-pre-wrap">{experiment.description}</div>
        </Alert>
      ) : null}

      {experiment.user ? (
        <div className="text-sm text-slate-600">
          Autor: <span className="font-medium">{experiment.user.name}</span>
          {experiment.project ? (
            <>
              {" "}
              · Proyecto:{" "}
              <Link className="text-brand-700 hover:underline" to={`/app/projects/${experiment.project.id}`}>
                {experiment.project.name}
              </Link>
            </>
          ) : null}
          {!canEdit ? <span className="ml-2 text-amber-800">(solo lectura)</span> : null}
        </div>
      ) : null}

      {experiment.computedSummary?.overall ? (
        <Card>
          <CardHeader title="Resultados básicos" subtitle="Calculados al guardar datos; se actualizan al modificar semillas (HU-17)" />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
              <div>
                <div className="text-xs text-slate-500">Total semillas</div>
                <div className="font-semibold">{experiment.computedSummary.overall.totalSeeds ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Germinadas</div>
                <div className="font-semibold">{experiment.computedSummary.overall.germinated ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Tasa de germinación global</div>
                <div className="font-semibold">
                  {experiment.computedSummary.overall.germinationRate != null
                    ? `${(Number(experiment.computedSummary.overall.germinationRate) * 100).toFixed(1)} %`
                    : "—"}
                </div>
              </div>
            </div>
            {experiment.computedSummary.byFactor && experiment.computedSummary.byFactor.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Factor</th>
                      <th className="px-3 py-2">Semillas</th>
                      <th className="px-3 py-2">Germinadas</th>
                      <th className="px-3 py-2">% germ.</th>
                      <th className="px-3 py-2">Media raíz</th>
                      <th className="px-3 py-2">Min raíz</th>
                      <th className="px-3 py-2">Max raíz</th>
                      <th className="px-3 py-2">Media hipocótilo</th>
                      <th className="px-3 py-2">Min hipocótilo</th>
                      <th className="px-3 py-2">Max hipocótilo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {experiment.computedSummary.byFactor.map((row, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-medium">{row.factorName}</td>
                        <td className="px-3 py-2">{row.seeds}</td>
                        <td className="px-3 py-2">{row.germinated}</td>
                        <td className="px-3 py-2">
                          {row.germinationRate != null ? `${(Number(row.germinationRate) * 100).toFixed(1)} %` : "—"}
                        </td>
                        <td className="px-3 py-2 font-mono tabular-nums">{fmtStat(row.meanRootLength)}</td>
                        <td className="px-3 py-2 font-mono tabular-nums">{fmtStat(row.minRootLength)}</td>
                        <td className="px-3 py-2 font-mono tabular-nums">{fmtStat(row.maxRootLength)}</td>
                        <td className="px-3 py-2 font-mono tabular-nums">{fmtStat(row.meanHypocotylLength)}</td>
                        <td className="px-3 py-2 font-mono tabular-nums">{fmtStat(row.minHypocotylLength)}</td>
                        <td className="px-3 py-2 font-mono tabular-nums">{fmtStat(row.maxHypocotylLength)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {canSeeHistory ? (
        <Card>
          <CardHeader title="Historial de modificaciones" subtitle="Auditoría por experimento (HU-31)" />
          <CardBody>
            {historyError ? <Alert kind="error">{historyError}</Alert> : null}
            {history.length === 0 ? (
              <div className="text-sm text-slate-500">Sin cambios registrados.</div>
            ) : (
              <ul className="space-y-2 text-sm">
                {history.map((h) => (
                  <li key={h.id} className="rounded-xl border border-slate-100 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{h.action}</span>
                      <span className="text-xs text-slate-500">{new Date(h.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {h.user.name} <span className="text-slate-400">({h.user.email})</span>
                    </div>
                    {h.detail ? <div className="mt-1 text-slate-600">{h.detail}</div> : null}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader title="Registro de datos" subtitle="Selecciona un factor y una réplica, luego captura por semilla." />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Factor">
                <select
                  className="w-full max-w-full truncate rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-300"
                  title={experiment.factors.find((f) => f.id === activeFactorId)?.name}
                  value={activeFactorId ?? ""}
                  onChange={(e) => {
                    const nextFactorId = e.target.value;
                    setActiveFactorId(nextFactorId);
                    const nextFactor = experiment.factors.find((f) => f.id === nextFactorId);
                    setActiveReplicaId(nextFactor?.replicas?.[0]?.id ?? null);
                  }}
                >
                  {experiment.factors.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.type === "CONTROL" ? "Control" : "Experimental"})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Réplica">
                <select
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-300"
                  value={activeReplicaId ?? ""}
                  onChange={(e) => setActiveReplicaId(e.target.value)}
                >
                  {activeFactor?.replicas.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="-mx-1 overflow-x-auto rounded-xl border border-slate-200 sm:mx-0">
              <table className="w-full min-w-[56rem] table-fixed border-collapse text-sm">
                <colgroup>
                  <col className="w-[4.5rem]" />
                  <col className="w-[5rem]" />
                  <col className="w-[9rem]" />
                  <col className="w-[9rem]" />
                  <col />
                  <col className="w-[7rem]" />
                </colgroup>
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Semilla</th>
                    <th className="px-3 py-2">Germinó</th>
                    <th className="px-3 py-2">Raíz ({experiment.scaleUnit})</th>
                    <th className="px-3 py-2">Hipocótilo ({experiment.scaleUnit})</th>
                    <th className="px-3 py-2">Observaciones</th>
                    <th className="px-3 py-2 text-right"> </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeReplica?.seeds.map((s) => (
                    <SeedRow
                      key={s.id}
                      seed={s}
                      unit={experiment.scaleUnit}
                      readOnly={!canEdit}
                      saving={!!busy[s.id]}
                      onSave={async (patch) => {
                        setBusy((m) => ({ ...m, [s.id]: true }));
                        try {
                          await api.patch(`/seeds/${s.id}`, patch);
                          await load();
                        } catch (e: unknown) {
                          throw new Error(getApiErrorMessage(e));
                        } finally {
                          setBusy((m) => ({ ...m, [s.id]: false }));
                        }
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Factores" subtitle="Puedes corregir el nombre de cada grupo" />
            <CardBody className="space-y-3">
              {experiment.factors.map((f) => (
                <FactorNameEditor
                  key={f.id}
                  factor={f}
                  readOnly={!canEdit}
                  busy={!!busy[`factor_${f.id}`]}
                  onSave={async (name) => {
                    setBusy((m) => ({ ...m, [`factor_${f.id}`]: true }));
                    try {
                      await api.patch(`/factors/${f.id}`, { name });
                      await load();
                    } catch (e: unknown) {
                      throw new Error(getApiErrorMessage(e));
                    } finally {
                      setBusy((m) => ({ ...m, [`factor_${f.id}`]: false }));
                    }
                  }}
                />
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Imagen del experimento" subtitle="Subida básica + vista previa + Aceptar/Rechazar" />
            <CardBody className="space-y-3">
              {uploadErr ? <Alert kind="error">{uploadErr}</Alert> : null}
              {canEdit ? (
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    setUploadErr(null);
                    const file = e.target.files?.[0] ?? null;
                    setUploadFile(file);
                  }}
                />
              ) : (
                <div className="text-sm text-slate-500">No puedes subir imágenes en modo lectura.</div>
              )}

              {canEdit && uploadPreview ? (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <img src={uploadPreview} className="h-56 w-full object-cover" />
                </div>
              ) : canEdit ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                  Selecciona una imagen para ver vista previa.
                </div>
              ) : null}

              {canEdit ? (
              <div className="flex gap-2">
                <Button
                  disabled={!uploadFile || !!busy["upload"]}
                  onClick={async () => {
                    if (!uploadFile) return;
                    setBusy((m) => ({ ...m, upload: true }));
                    setUploadErr(null);
                    try {
                      const fd = new FormData();
                      fd.append("image", uploadFile);
                      await api.post(`/experiments/${experiment.id}/image`, fd, {
                        headers: { "Content-Type": "multipart/form-data" }
                      });
                      setUploadFile(null);
                      await load();
                    } catch (e: any) {
                      setUploadErr(e?.response?.data?.error ?? "No se pudo subir la imagen");
                    } finally {
                      setBusy((m) => ({ ...m, upload: false }));
                    }
                  }}
                >
                  {busy["upload"] ? "Subiendo..." : "Subir imagen"}
                </Button>
                <Button
                  variant="ghost"
                  disabled={!uploadFile}
                  onClick={() => {
                    setUploadFile(null);
                    setUploadErr(null);
                  }}
                >
                  Rechazar selección
                </Button>
              </div>
              ) : null}

              <div className="space-y-2">
                {experiment.images.length === 0 ? (
                  <div className="text-sm text-slate-500">Aún no hay imágenes.</div>
                ) : (
                  experiment.images.slice(0, 6).map((img) => (
                    <div key={img.id} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">{img.originalName}</div>
                          <div className="text-xs text-slate-500">{new Date(img.createdAt).toLocaleString()}</div>
                        </div>
                        <StatusPill status={img.status} />
                      </div>
                      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
                        <img src={`${API_URL}/uploads/${img.storagePath}`} className="h-36 w-full object-cover" />
                      </div>
                      {img.status === "PENDING" && canEdit ? (
                        <div className="mt-3 flex gap-2">
                          <Button
                            variant="primary"
                            disabled={!!busy[`img_${img.id}`]}
                            onClick={async () => {
                              setBusy((m) => ({ ...m, [`img_${img.id}`]: true }));
                              try {
                                await api.patch(`/images/${img.id}/status`, { status: "ACCEPTED" });
                                await load();
                              } finally {
                                setBusy((m) => ({ ...m, [`img_${img.id}`]: false }));
                              }
                            }}
                          >
                            Aceptar
                          </Button>
                          <Button
                            variant="danger"
                            disabled={!!busy[`img_${img.id}`]}
                            onClick={async () => {
                              setBusy((m) => ({ ...m, [`img_${img.id}`]: true }));
                              try {
                                await api.patch(`/images/${img.id}/status`, { status: "REJECTED" });
                                await load();
                              } finally {
                                setBusy((m) => ({ ...m, [`img_${img.id}`]: false }));
                              }
                            }}
                          >
                            Rechazar
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SeedRow({
  seed,
  saving,
  unit,
  readOnly,
  onSave
}: {
  seed: Seed;
  saving: boolean;
  unit: "CM" | "MM";
  readOnly?: boolean;
  onSave: (patch: { germinated: boolean; rootLength: number | null; hypocotylLength: number | null; notes: string | null }) => Promise<void>;
}) {
  const [germinated, setGerminated] = useState(seed.germinated);
  const [root, setRoot] = useState<string>(seed.rootLength == null ? "" : String(seed.rootLength));
  const [hyp, setHyp] = useState<string>(seed.hypocotylLength == null ? "" : String(seed.hypocotylLength));
  const [notes, setNotes] = useState<string>(seed.notes ?? "");
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const autoSaveTimer = useRef<number | null>(null);

  // Si el backend recarga datos (ej. después de guardar), sincronizamos la fila.
  useEffect(() => {
    setGerminated(seed.germinated);
    setRoot(seed.rootLength == null ? "" : String(seed.rootLength));
    setHyp(seed.hypocotylLength == null ? "" : String(seed.hypocotylLength));
    setNotes(seed.notes ?? "");
    setStatus("idle");
    setErrMsg(null);
  }, [seed.id, seed.germinated, seed.rootLength, seed.hypocotylLength, seed.notes]);

  const dirty =
    germinated !== seed.germinated ||
    root !== (seed.rootLength == null ? "" : String(seed.rootLength)) ||
    hyp !== (seed.hypocotylLength == null ? "" : String(seed.hypocotylLength)) ||
    notes !== (seed.notes ?? "");

  const canAutoSave = !readOnly && !saving && dirty;
  const parsedRoot = germinated ? (root.trim() === "" ? null : Number(root)) : null;
  const parsedHyp = germinated ? (hyp.trim() === "" ? null : Number(hyp)) : null;
  const hasInvalidNumber =
    (parsedRoot != null && Number.isNaN(parsedRoot)) || (parsedHyp != null && Number.isNaN(parsedHyp));

  useEffect(() => {
    if (!canAutoSave || hasInvalidNumber) return;
    if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = window.setTimeout(async () => {
      try {
        await onSave({
          germinated,
          rootLength: parsedRoot,
          hypocotylLength: parsedHyp,
          notes: notes.trim() === "" ? null : notes
        });
        setStatus("saved");
        window.setTimeout(() => setStatus("idle"), 1200);
      } catch (e) {
        setErrMsg(e instanceof Error ? e.message : "No se pudo guardar");
        setStatus("error");
      }
    }, 2500);
    return () => {
      if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAutoSave, germinated, root, hyp, notes, hasInvalidNumber]);

  return (
    <tr className={cx(dirty ? "bg-brand-50/30" : "")}>
      <td className="px-3 py-2 font-medium">#{seed.seedNumber}</td>
      <td className="px-3 py-2 align-middle">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300"
          disabled={readOnly}
          checked={germinated}
          onChange={(e) => setGerminated(e.target.checked)}
        />
      </td>
      <td className="px-3 py-2 align-middle">
        <Input
          className="w-full font-mono text-base tabular-nums sm:text-sm"
          disabled={readOnly || !germinated}
          inputMode="decimal"
          placeholder={unit === "CM" ? "0.0" : "0"}
          value={root}
          onChange={(e) => setRoot(e.target.value)}
        />
      </td>
      <td className="px-3 py-2 align-middle">
        <Input
          className="w-full font-mono text-base tabular-nums sm:text-sm"
          disabled={readOnly || !germinated}
          inputMode="decimal"
          placeholder={unit === "CM" ? "0.0" : "0"}
          value={hyp}
          onChange={(e) => setHyp(e.target.value)}
        />
      </td>
      <td className="px-3 py-2 align-middle">
        <Textarea
          rows={2}
          className="min-h-[2.75rem] resize-y text-sm"
          disabled={readOnly}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Opcional"
        />
      </td>
      <td className="px-3 py-2 text-right align-middle">
        <div className="flex items-center justify-end gap-2">
          {status === "saved" ? <span className="text-xs font-medium text-emerald-700">Guardado</span> : null}
          {status === "error" ? <span className="text-xs font-medium text-rose-700">{errMsg ?? "Error"}</span> : null}
          <Button
            variant="ghost"
            disabled={readOnly || saving || !dirty}
            onClick={async () => {
              setStatus("idle");
              setErrMsg(null);
              try {
                await onSave({
                  germinated,
                  rootLength: parsedRoot,
                  hypocotylLength: parsedHyp,
                  notes: notes.trim() === "" ? null : notes
                });
                setStatus("saved");
                window.setTimeout(() => setStatus("idle"), 1500);
              } catch (e) {
                setErrMsg(e instanceof Error ? e.message : "No se pudo guardar");
                setStatus("error");
              }
            }}
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </td>
    </tr>
  );
}

function FactorNameEditor({
  factor,
  busy,
  readOnly,
  onSave
}: {
  factor: Factor;
  busy: boolean;
  readOnly?: boolean;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(factor.name);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const dirty = name.trim() !== factor.name;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-xs text-slate-500">{factor.type === "CONTROL" ? "Control" : "Experimental"}</div>
        <div className="text-xs text-slate-500">{factor.replicas.length} réplicas</div>
      </div>
      <div className="flex gap-2">
        <Input value={name} disabled={readOnly} onChange={(e) => setName(e.target.value)} />
        {!readOnly ? (
          <div className="flex items-center gap-2">
            {status === "saved" ? <span className="text-xs font-medium text-emerald-700">Guardado</span> : null}
            {status === "error" ? <span className="text-xs font-medium text-rose-700">{errMsg ?? "Error"}</span> : null}
            <Button
              variant="ghost"
              disabled={!dirty || busy}
              onClick={async () => {
                setStatus("idle");
                setErrMsg(null);
                try {
                  await onSave(name.trim());
                  setStatus("saved");
                  window.setTimeout(() => setStatus("idle"), 1500);
                } catch (e) {
                  setErrMsg(e instanceof Error ? e.message : "No se pudo actualizar");
                  setStatus("error");
                }
              }}
            >
              {busy ? "..." : "Actualizar"}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: ImageRec["status"] }) {
  const cls =
    status === "ACCEPTED"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : status === "REJECTED"
        ? "bg-rose-50 text-rose-800 border-rose-200"
        : "bg-slate-50 text-slate-700 border-slate-200";
  const label = status === "ACCEPTED" ? "Aceptada" : status === "REJECTED" ? "Rechazada" : "Pendiente";
  return <span className={cx("inline-flex rounded-full border px-2 py-1 text-xs font-medium", cls)}>{label}</span>;
}

/** Separador ; + UTF-8 con BOM: Excel (configuración regional española) abre columnas y tildes bien. */
const CSV_SEP = ";";

function escapeCsvField(value: unknown, sep: string): string {
  const s = String(value ?? "");
  if (s.includes(sep) || /["\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsvForExcelEs(headers: string[], rows: ExportRow[]): string {
  const keys: (keyof ExportRow)[] = ["factor", "replica", "seed", "germinated", "rootLength", "hypocotylLength", "notes"];
  const lines: string[] = [headers.map((h) => escapeCsvField(h, CSV_SEP)).join(CSV_SEP)];
  for (const r of rows) {
    const cells = keys.map((k) => {
      let v: string | number | null = r[k] as string | number | null;
      if (k === "notes" && typeof v === "string") {
        v = v.replace(/\r\n/g, "\n").replace(/\n/g, " ").trim();
      }
      if (v === null || v === undefined) return "";
      return escapeCsvField(v, CSV_SEP);
    });
    lines.push(cells.join(CSV_SEP));
  }
  const body = lines.join("\r\n");
  return "\uFEFF" + body;
}

function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

