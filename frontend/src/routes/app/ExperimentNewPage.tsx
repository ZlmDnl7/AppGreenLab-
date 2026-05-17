import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, getApiErrorMessage } from "../../lib/api";
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, Textarea, cx } from "../../components/ui";

const OTHER_KEY = "__otro__";

/** Opciones comunes en aula/lab; el valor guardado es el texto descriptivo. */
const SEED_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "Tomate (Solanum lycopersicum)", label: "Tomate — Solanum lycopersicum" },
  { value: "Frijol común (Phaseolus vulgaris)", label: "Frijol — Phaseolus vulgaris" },
  { value: "Maíz (Zea mays)", label: "Maíz — Zea mays" },
  { value: "Arroz (Oryza sativa)", label: "Arroz — Oryza sativa" },
  { value: "Café (Coffea arabica)", label: "Café — Coffea arabica" },
  { value: "Lenteja (Lens culinaris)", label: "Lenteja — Lens culinaris" },
  { value: "Cebolla (Allium cepa)", label: "Cebolla — Allium cepa" },
  { value: "Lechuga (Lactuca sativa)", label: "Lechuga — Lactuca sativa" },
  { value: "Girasol (Helianthus annuus)", label: "Girasol — Helianthus annuus" },
  { value: OTHER_KEY, label: "Otra especie (escribir abajo)" }
];

const factorSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  type: z.enum(["CONTROL", "EXPERIMENTAL"])
});

const schema = z
  .object({
    projectId: z.string().min(1, "Selecciona un proyecto"),
    name: z.string().min(2, "Nombre requerido"),
    seedPreset: z.string().min(1, "Elige un tipo de semilla"),
    seedCustom: z.string().optional(),
    date: z.string().min(1, "Fecha requerida"),
    description: z.string().optional(),
    scaleUnit: z.enum(["CM", "MM"]),
    replicasPerFactor: z.coerce.number().int().min(1).max(50),
    seedsPerReplica: z.coerce.number().int().min(1).max(200)
  })
  .superRefine((data, ctx) => {
    if (data.seedPreset === OTHER_KEY) {
      const t = (data.seedCustom ?? "").trim();
      if (t.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Especifica la especie o variedad",
          path: ["seedCustom"]
        });
      }
    }
  });

type Form = z.infer<typeof schema>;
type Factor = z.infer<typeof factorSchema>;

const selectClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400";

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const items: { n: 1 | 2 | 3; label: string }[] = [
    { n: 1, label: "Experimento" },
    { n: 2, label: "Factores" },
    { n: 3, label: "Diseño" }
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map(({ n, label }) => (
        <div
          key={n}
          className={cx(
            "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
            step === n
              ? "border-brand-300 bg-brand-50 text-brand-900"
              : step > n
                ? "border-slate-200 bg-white text-slate-600"
                : "border-slate-100 bg-slate-50 text-slate-400"
          )}
        >
          <span
            className={cx(
              "grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold",
              step === n ? "bg-brand-600 text-white" : step > n ? "bg-slate-200 text-slate-700" : "bg-slate-200/60 text-slate-500"
            )}
          >
            {n}
          </span>
          {label}
        </div>
      ))}
    </div>
  );
}

type ProjectOption = { id: string; name: string };

export function ExperimentNewPage() {
  const nav = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [factors, setFactors] = useState<Factor[]>([
    { name: "", type: "CONTROL" },
    { name: "", type: "CONTROL" },
    { name: "", type: "EXPERIMENTAL" }
  ]);

  const minFactorsOk = factors.filter((f) => f.name.trim().length > 0).length >= 3;

  const defaults = useMemo<Form>(
    () => ({
      projectId: "",
      name: "",
      seedPreset: SEED_TYPE_OPTIONS[0].value,
      seedCustom: "",
      date: new Date().toISOString().slice(0, 10),
      description: "",
      scaleUnit: "CM",
      replicasPerFactor: 5,
      seedsPerReplica: 20
    }),
    []
  );

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<{ items: ProjectOption[] }>("/projects");
        setProjects(data.items ?? []);
      } catch {
        setProjects([]);
      } finally {
        setProjectsLoaded(true);
      }
    })();
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: defaults });

  const seedPreset = watch("seedPreset");
  const seedCustomWatch = watch("seedCustom");
  const nameWatch = watch("name");
  const scaleWatch = watch("scaleUnit");
  const replicasWatch = watch("replicasPerFactor");
  const seedsPerRepWatch = watch("seedsPerReplica");
  const showSeedCustom = seedPreset === OTHER_KEY;

  const resolvedSeedLabel = useMemo(() => {
    if (seedPreset === OTHER_KEY) {
      const c = seedCustomWatch?.trim();
      return c && c.length > 0 ? c : "Otra (pendiente de especificar)";
    }
    return SEED_TYPE_OPTIONS.find((o) => o.value === seedPreset)?.label ?? seedPreset;
  }, [seedPreset, seedCustomWatch]);

  async function postExperiment(values: Form) {
    const seedType = values.seedPreset === OTHER_KEY ? (values.seedCustom ?? "").trim() : values.seedPreset;
    const payload = {
      projectId: values.projectId,
      name: values.name,
      seedType,
      date: new Date(values.date),
      description: values.description || undefined,
      scaleUnit: values.scaleUnit,
      replicasPerFactor: values.replicasPerFactor,
      seedsPerReplica: values.seedsPerReplica,
      factors: factors.map((f) => ({ name: f.name.trim(), type: f.type }))
    };
    const { data } = await api.post("/experiments", payload);
    nav(`/app/experiments/${data.experimentId}`);
  }

  const stepSubtitle =
    step === 1
      ? "Datos generales del ensayo"
      : step === 2
        ? "Cada factor es un grupo que vas a comparar (nombre libre · mínimo 3)"
        : "Réplicas y semillas por grupo";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Nuevo experimento</h1>
      </div>

      {error ? <Alert kind="error">{error}</Alert> : null}

      {projectsLoaded && projects.length === 0 ? (
        <Alert kind="info">
          Necesitas un proyecto para asociar el experimento.{" "}
          <Link className="font-medium text-brand-800 underline" to="/app/projects/new">
            Crear proyecto
          </Link>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden border-slate-200/80 shadow-sm">
          <CardHeader
            title={
              step === 1 ? "Experimento" : step === 2 ? "Factores" : "Diseño muestral"
            }
            subtitle={stepSubtitle}
            right={<StepIndicator step={step} />}
          />
          <CardBody>
            <form
              className="space-y-4"
              onSubmit={handleSubmit(async (values) => {
                setError(null);
                if (step === 1) {
                  setStep(2);
                  return;
                }
                if (step === 2) {
                  if (!minFactorsOk) {
                    setError("Cada factor necesita un nombre. Debes tener al menos 3 factores.");
                    return;
                  }
                  setStep(3);
                  return;
                }
                try {
                  if (projects.length === 0) {
                    setError("Crea un proyecto antes de registrar un experimento.");
                    return;
                  }
                  await postExperiment(values);
                } catch (e: unknown) {
                  setError(getApiErrorMessage(e));
                }
              })}
            >
              {step === 1 ? (
                <div className="space-y-4">
                  <Field label="Proyecto" error={errors.projectId?.message}>
                    <select className={selectClass} {...register("projectId")} disabled={projects.length === 0}>
                      <option value="">— Selecciona un proyecto —</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Nombre del experimento" error={errors.name?.message}>
                      <Input placeholder="Ej. Germinación bajo estrés salino" {...register("name")} />
                    </Field>

                    <Field label="Tipo de semilla" error={errors.seedPreset?.message}>
                      <select className={selectClass} {...register("seedPreset")}>
                        {SEED_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </Field>

                    {showSeedCustom ? (
                      <div className="sm:col-span-2">
                        <Field label="Especifica la especie o variedad" error={errors.seedCustom?.message}>
                          <Input placeholder="Ej. Quinua — Chenopodium quinoa" {...register("seedCustom")} />
                        </Field>
                      </div>
                    ) : null}

                    <Field label="Fecha" error={errors.date?.message}>
                      <Input type="date" {...register("date")} />
                    </Field>

                    <Field label="Unidad para longitudes" error={errors.scaleUnit?.message}>
                      <select className={selectClass} {...register("scaleUnit")}>
                        <option value="CM">Centímetros (cm)</option>
                        <option value="MM">Milímetros (mm)</option>
                      </select>
                    </Field>

                    <div className="sm:col-span-2">
                      <Field label="Descripción" hint="Opcional" error={errors.description?.message}>
                        <Textarea rows={3} placeholder="Notas del ensayo" {...register("description")} />
                      </Field>
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-4">
                  <div className="hidden gap-2 px-3 text-xs font-medium text-slate-500 sm:grid sm:grid-cols-[1fr_170px_100px]">
                    <span>Nombre del grupo (factor)</span>
                    <span>Tipo</span>
                    <span className="text-center sm:text-right"> </span>
                  </div>
                  <div className="space-y-2">
                    {factors.map((f, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-gradient-to-r from-white to-slate-50/80 p-3 sm:grid-cols-[1fr_170px_100px]"
                      >
                        <div className="sm:hidden">
                          <label className="mb-1 block text-xs font-medium text-slate-600">Nombre del grupo (factor)</label>
                        </div>
                        <Input
                          value={f.name}
                          onChange={(e) =>
                            setFactors((prev) => prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))
                          }
                          placeholder={
                            idx === 0
                              ? "Ej. Control — agua destilada"
                              : idx === 1
                                ? "Ej. Control — sustrato estándar"
                                : "Ej. Suelo contaminado — dosis alta"
                          }
                          aria-label={`Nombre del factor ${idx + 1}`}
                        />
                        <div className="sm:hidden">
                          <label className="mb-1 block text-xs font-medium text-slate-600">Tipo</label>
                        </div>
                        <select
                          className={selectClass}
                          value={f.type}
                          onChange={(e) =>
                            setFactors((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, type: e.target.value as Factor["type"] } : x))
                            )
                          }
                          aria-label={`Tipo del factor ${idx + 1}`}
                        >
                          <option value="CONTROL">Control</option>
                          <option value="EXPERIMENTAL">Experimental</option>
                        </select>
                        <Button
                          variant="ghost"
                          type="button"
                          className="text-rose-700 hover:bg-rose-50"
                          onClick={() => setFactors((prev) => prev.filter((_, i) => i !== idx))}
                          disabled={factors.length <= 3}
                          title={factors.length <= 3 ? "Mínimo 3 factores" : "Eliminar"}
                        >
                          Quitar
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={cx("text-xs text-slate-500", !minFactorsOk && "text-amber-700")}>
                      {minFactorsOk ? `${factors.length} factores` : "Mínimo 3 factores con nombre"}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setFactors((prev) => [...prev, { name: `Tratamiento ${prev.length}`, type: "EXPERIMENTAL" }])}
                    >
                      + Agregar factor
                    </Button>
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Réplicas por factor" error={errors.replicasPerFactor?.message}>
                    <Input type="number" min={1} max={50} {...register("replicasPerFactor")} />
                  </Field>
                  <Field label="Semillas por réplica" error={errors.seedsPerReplica?.message}>
                    <Input type="number" min={1} max={200} {...register("seedsPerReplica")} />
                  </Field>
                </div>
              ) : null}

              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <Button type="button" variant="ghost" onClick={() => setStep((s) => (s === 1 ? 1 : ((s - 1) as 1 | 2 | 3)))} disabled={step === 1 || isSubmitting}>
                  Atrás
                </Button>
                <Button type="submit" disabled={isSubmitting || (step === 3 && projects.length === 0)}>
                  {step === 3 ? (isSubmitting ? "Creando…" : "Crear experimento") : "Continuar"}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card className="h-fit border-slate-200/80 shadow-sm">
          <CardHeader title="Resumen" subtitle="Vista previa" />
          <CardBody className="space-y-4">
            <div className="rounded-xl border border-slate-100 bg-white p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Experimento</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{nameWatch?.trim() || "—"}</div>
              <div className="mt-2 text-xs text-slate-600">
                <span className="text-slate-400">Semilla:</span> {resolvedSeedLabel}
              </div>
              <div className="text-xs text-slate-600">
                <span className="text-slate-400">Escala:</span> {scaleWatch === "MM" ? "mm" : "cm"}
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-brand-50/40 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-brand-800/70">Factores</div>
              <div className="mt-1 text-2xl font-semibold text-brand-900">{factors.length}</div>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-slate-700">
                {factors.map((f, i) => (
                  <li key={i} className="flex justify-between gap-2 border-b border-brand-100/80 py-1 last:border-0">
                    <span className="truncate">{f.name || `Sin nombre (${i + 1})`}</span>
                    <span className="shrink-0 text-slate-500">{f.type === "CONTROL" ? "Control" : "Exp."}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Muestreo</div>
              <div className="mt-1 text-sm text-slate-800">
                {Number(replicasWatch) || 0} réplicas × factor · {Number(seedsPerRepWatch) || 0} semillas × réplica
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Total de mediciones (semillas):{" "}
                <span className="font-semibold text-slate-800">
                  {factors.length * (Number(replicasWatch) || 0) * (Number(seedsPerRepWatch) || 0)}
                </span>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
