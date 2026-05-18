import { Router } from "express";
import { z } from "zod";
import path from "path";
import fs from "fs";
import multer from "multer";
import ExcelJS from "exceljs";
import { prisma } from "../lib/prisma.js";
import { env } from "../lib/env.js";
import {
  imagePublicUrl,
  isCloudStorageConfigured,
  saveExperimentImageToDisk,
  uploadExperimentImage
} from "../lib/imageStorage.js";
import {
  canCreateExperimentInProject,
  canReadExperiment,
  canWriteExperiment,
  getExperimentForAccess,
  userProjectIds
} from "../lib/experimentAccess.js";
import { recomputeAndSaveSummary } from "../lib/summary.js";

export const experimentsRouter = Router();

const lengthUnitSchema = z.enum(["CM", "MM"]);
const factorTypeSchema = z.enum(["CONTROL", "EXPERIMENTAL"]);

const createExperimentSchema = z.object({
  projectId: z.string().min(1, "Selecciona un proyecto"),
  name: z.string().min(2, "Nombre requerido"),
  seedType: z.string().min(2, "Tipo de semilla requerido"),
  date: z.coerce.date(),
  description: z.string().optional(),
  scaleUnit: lengthUnitSchema.default("CM"),
  replicasPerFactor: z.number().int().min(1).max(50).default(5),
  seedsPerReplica: z.number().int().min(1).max(200).default(20),
  factors: z
    .array(
      z.object({
        name: z.string().min(1),
        type: factorTypeSchema
      })
    )
    .min(3, "Mínimo 3 factores")
});

const updateExperimentSchema = z.object({
  name: z.string().min(2).optional(),
  seedType: z.string().min(2).optional(),
  date: z.coerce.date().optional(),
  description: z.string().nullable().optional(),
  scaleUnit: lengthUnitSchema.optional()
});

experimentsRouter.post("/experiments", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const input = createExperimentSchema.parse(req.body);

    const allowed = await canCreateExperimentInProject(userId, input.projectId);
    if (!allowed) return res.status(403).json({ error: "No tienes acceso a ese proyecto" });

    const exp = await prisma.$transaction(async (tx) => {
      const experiment = await tx.experiment.create({
        data: {
          userId,
          projectId: input.projectId,
          name: input.name,
          seedType: input.seedType,
          date: input.date,
          description: input.description,
          scaleUnit: input.scaleUnit
        }
      });

      for (const f of input.factors) {
        const factor = await tx.factor.create({
          data: { experimentId: experiment.id, name: f.name, type: f.type }
        });
        for (let r = 1; r <= input.replicasPerFactor; r++) {
          const replica = await tx.replica.create({
            data: { factorId: factor.id, code: `R${r}` }
          });
          const seedsData = Array.from({ length: input.seedsPerReplica }, (_, i) => ({
            replicaId: replica.id,
            seedNumber: i + 1
          }));
          await tx.seed.createMany({ data: seedsData });
        }
      }

      await tx.activityLog.create({
        data: {
          projectId: input.projectId,
          userId,
          action: "EXPERIMENT_CREATED",
          experimentId: experiment.id,
          detail: experiment.name
        }
      });

      return experiment;
    });

    await recomputeAndSaveSummary(exp.id);
    return res.status(201).json({ experimentId: exp.id });
  } catch (err) {
    return next(err);
  }
});

experimentsRouter.get("/experiments", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const scope = z.enum(["mine", "teacher"]).optional().parse(req.query.scope);
    const q = z.string().optional().parse(req.query.q);
    const projectId = z.string().optional().parse(req.query.projectId);
    const query = (q ?? "").trim();

    if (scope === "teacher") {
      if (req.user!.role !== "TEACHER" && req.user!.role !== "ADMIN") {
        return res.status(403).json({ error: "Solo docentes pueden ver este listado" });
      }
      const list = await prisma.experiment.findMany({
        where: {
          user: { role: "STUDENT" },
          ...(query ? { name: { contains: query } } : {}),
          ...(projectId ? { projectId } : {})
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          seedType: true,
          date: true,
          scaleUnit: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true } }
        }
      });
      return res.json({ items: list });
    }

    const pids = await userProjectIds(userId);
    const list = await prisma.experiment.findMany({
      where: {
        OR: [{ userId }, ...(pids.length ? [{ projectId: { in: pids } }] : [])],
        ...(query ? { name: { contains: query } } : {}),
        ...(projectId ? { projectId } : {})
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        seedType: true,
        date: true,
        scaleUnit: true,
        createdAt: true,
        userId: true,
        project: { select: { id: true, name: true } }
      }
    });
    return res.json({ items: list });
  } catch (err) {
    return next(err);
  }
});

experimentsRouter.patch("/experiments/:id", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const id = z.string().min(1).parse(req.params.id);
    const input = updateExperimentSchema.parse(req.body);

    const exp = await getExperimentForAccess(id);
    if (!exp || !canWriteExperiment(req.user!, exp)) {
      return res.status(exp ? 403 : 404).json({ error: exp ? "No puedes editar este experimento" : "Experimento no encontrado" });
    }

    const updated = await prisma.experiment.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.seedType !== undefined && { seedType: input.seedType }),
        ...(input.date !== undefined && { date: input.date }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.scaleUnit !== undefined && { scaleUnit: input.scaleUnit })
      }
    });

    if (exp.projectId) {
      await prisma.activityLog.create({
        data: {
          projectId: exp.projectId,
          userId,
          action: "EXPERIMENT_UPDATED",
          experimentId: id,
          detail: "metadata"
        }
      });
    }

    await recomputeAndSaveSummary(id);
    return res.json({ experiment: updated });
  } catch (err) {
    return next(err);
  }
});

experimentsRouter.get("/experiments/:id", async (req, res, next) => {
  try {
    const id = z.string().min(1).parse(req.params.id);

    const experiment = await prisma.experiment.findUnique({
      where: { id },
      include: {
        images: { orderBy: { createdAt: "desc" } },
        factors: {
          orderBy: { createdAt: "asc" },
          include: {
            replicas: {
              orderBy: { code: "asc" },
              include: { seeds: { orderBy: { seedNumber: "asc" } } }
            }
          }
        },
        user: { select: { id: true, name: true, email: true, role: true } },
        project: { include: { members: true } }
      }
    });
    if (!experiment) return res.status(404).json({ error: "Experimento no encontrado" });

    const expForAccess = await getExperimentForAccess(id);
    if (!expForAccess || !canReadExperiment(req.user!, expForAccess)) {
      return res.status(404).json({ error: "Experimento no encontrado" });
    }
    const canEdit = canWriteExperiment(req.user!, expForAccess);

    await recomputeAndSaveSummary(id);
    const fresh = await prisma.experiment.findUnique({
      where: { id },
      include: {
        images: { orderBy: { createdAt: "desc" } },
        factors: {
          orderBy: { createdAt: "asc" },
          include: {
            replicas: {
              orderBy: { code: "asc" },
              include: { seeds: { orderBy: { seedNumber: "asc" } } }
            }
          }
        },
        user: { select: { id: true, name: true, email: true, role: true } },
        project: { select: { id: true, name: true } }
      }
    });

    return res.json({ experiment: fresh, permissions: { canEdit } });
  } catch (err) {
    return next(err);
  }
});

experimentsRouter.get("/experiments/:id/history", async (req, res, next) => {
  try {
    const id = z.string().min(1).parse(req.params.id);

    const expForAccess = await getExperimentForAccess(id);
    if (!expForAccess || !canReadExperiment(req.user!, expForAccess)) {
      return res.status(404).json({ error: "Experimento no encontrado" });
    }

    const logs = await prisma.activityLog.findMany({
      where: { experimentId: id },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { name: true, email: true } } }
    });

    return res.json({ items: logs });
  } catch (err) {
    return next(err);
  }
});

const updateFactorSchema = z.object({ name: z.string().min(1) });

experimentsRouter.patch("/factors/:id", async (req, res, next) => {
  try {
    const factorId = z.string().min(1).parse(req.params.id);
    const { name } = updateFactorSchema.parse(req.body);

    const factor = await prisma.factor.findUnique({ where: { id: factorId }, include: { experiment: true } });
    if (!factor) return res.status(404).json({ error: "Factor no encontrado" });

    const exp = await getExperimentForAccess(factor.experimentId);
    if (!exp || !canWriteExperiment(req.user!, exp)) {
      return res.status(404).json({ error: "Factor no encontrado" });
    }

    const updated = await prisma.factor.update({ where: { id: factorId }, data: { name } });
    if (exp.projectId) {
      await prisma.activityLog.create({
        data: {
          projectId: exp.projectId,
          userId: req.user!.id,
          action: "FACTOR_UPDATED",
          experimentId: exp.id,
          detail: `${factor.name} -> ${name}`
        }
      });
    }
    await recomputeAndSaveSummary(factor.experimentId);
    return res.json({ factor: updated });
  } catch (err) {
    return next(err);
  }
});

const updateSeedSchema = z
  .object({
    germinated: z.boolean(),
    rootLength: z.number().nonnegative().nullable().optional(),
    hypocotylLength: z.number().nonnegative().nullable().optional(),
    notes: z.string().max(2000).nullable().optional()
  })
  .superRefine((v, ctx) => {
    if (!v.germinated) {
      if (v.rootLength != null) ctx.addIssue({ code: "custom", message: "Raíz debe estar vacía si no germinó", path: ["rootLength"] });
      if (v.hypocotylLength != null)
        ctx.addIssue({ code: "custom", message: "Hipocótilo debe estar vacío si no germinó", path: ["hypocotylLength"] });
    }
  });

experimentsRouter.patch("/seeds/:id", async (req, res, next) => {
  try {
    const seedId = z.string().min(1).parse(req.params.id);
    const input = updateSeedSchema.parse(req.body);

    const seed = await prisma.seed.findUnique({
      where: { id: seedId },
      include: { replica: { include: { factor: { include: { experiment: true } } } } }
    });
    if (!seed) return res.status(404).json({ error: "Semilla no encontrada" });

    const exp = await getExperimentForAccess(seed.replica.factor.experimentId);
    if (!exp || !canWriteExperiment(req.user!, exp)) {
      return res.status(404).json({ error: "Semilla no encontrada" });
    }

    const updated = await prisma.seed.update({
      where: { id: seedId },
      data: {
        germinated: input.germinated,
        rootLength: input.germinated ? (input.rootLength ?? null) : null,
        hypocotylLength: input.germinated ? (input.hypocotylLength ?? null) : null,
        notes: input.notes ?? null
      }
    });
    if (exp.projectId) {
      await prisma.activityLog.create({
        data: {
          projectId: exp.projectId,
          userId: req.user!.id,
          action: "SEED_UPDATED",
          experimentId: exp.id,
          detail: `seed ${seed.seedNumber} (${seed.replica.code} / ${seed.replica.factor.name})`
        }
      });
    }
    await recomputeAndSaveSummary(seed.replica.factor.experimentId);
    return res.json({ seed: updated });
  } catch (err) {
    return next(err);
  }
});

const uploadDirAbs = path.resolve(process.cwd(), env.UPLOAD_DIR);
if (!isCloudStorageConfigured()) {
  fs.mkdirSync(uploadDirAbs, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
    if (!ok) return cb(new Error("Formato de imagen no permitido"));
    return cb(null, true);
  }
});

experimentsRouter.post("/experiments/:id/image", upload.single("image"), async (req, res, next) => {
  try {
    const experimentId = z.string().min(1).parse(req.params.id);
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Imagen requerida" });

    const exp = await getExperimentForAccess(experimentId);
    if (!exp || !canWriteExperiment(req.user!, exp)) {
      return res.status(404).json({ error: "Experimento no encontrado" });
    }

    const { storagePath } = isCloudStorageConfigured()
      ? await uploadExperimentImage(file.buffer, file.originalname, file.mimetype)
      : saveExperimentImageToDisk(uploadDirAbs, file.buffer, file.originalname);

    const rec = await prisma.experimentImage.create({
      data: {
        experimentId,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storagePath,
        status: "PENDING"
      }
    });
    if (exp.projectId) {
      await prisma.activityLog.create({
        data: {
          projectId: exp.projectId,
          userId: req.user!.id,
          action: "IMAGE_UPLOADED",
          experimentId,
          detail: file.originalname
        }
      });
    }

    const apiBase = `${req.protocol}://${req.get("host")}`;
    return res.status(201).json({ image: rec, url: imagePublicUrl(rec.storagePath, apiBase) });
  } catch (err) {
    return next(err);
  }
});

const setImageStatusSchema = z.object({ status: z.enum(["ACCEPTED", "REJECTED"]) });

experimentsRouter.patch("/images/:id/status", async (req, res, next) => {
  try {
    const imageId = z.string().min(1).parse(req.params.id);
    const { status } = setImageStatusSchema.parse(req.body);

    const img = await prisma.experimentImage.findUnique({
      where: { id: imageId },
      include: { experiment: true }
    });
    if (!img) return res.status(404).json({ error: "Imagen no encontrada" });

    const exp = await getExperimentForAccess(img.experimentId);
    if (!exp || !canWriteExperiment(req.user!, exp)) {
      return res.status(404).json({ error: "Imagen no encontrada" });
    }

    const updated = await prisma.experimentImage.update({ where: { id: imageId }, data: { status } });
    if (exp.projectId) {
      await prisma.activityLog.create({
        data: {
          projectId: exp.projectId,
          userId: req.user!.id,
          action: "IMAGE_STATUS_UPDATED",
          experimentId: img.experimentId,
          detail: status
        }
      });
    }
    return res.json({ image: updated });
  } catch (err) {
    return next(err);
  }
});

experimentsRouter.get("/experiments/:id/export", async (req, res, next) => {
  try {
    const experimentId = z.string().min(1).parse(req.params.id);

    const exp = await getExperimentForAccess(experimentId);
    if (!exp || !canReadExperiment(req.user!, exp)) {
      return res.status(404).json({ error: "Experimento no encontrado" });
    }

    const experiment = await prisma.experiment.findFirst({
      where: { id: experimentId },
      include: {
        factors: { include: { replicas: { include: { seeds: true } } } }
      }
    });
    if (!experiment) return res.status(404).json({ error: "Experimento no encontrado" });

    const rows = experiment.factors.flatMap((factor) =>
      factor.replicas.flatMap((replica) =>
        replica.seeds.map((seed) => ({
          factor: factor.name,
          replica: replica.code,
          seed: seed.seedNumber,
          germinated: seed.germinated ? "Sí" : "No",
          rootLength: seed.rootLength,
          hypocotylLength: seed.hypocotylLength,
          notes: seed.notes ?? ""
        }))
      )
    );

    return res.json({
      experiment: {
        id: experiment.id,
        name: experiment.name,
        seedType: experiment.seedType,
        date: experiment.date,
        scaleUnit: experiment.scaleUnit
      },
      columns: ["Factor", "Réplica", "Semilla", "Germinó", "Raíz", "Hipocótilo", "Observaciones"],
      rows
    });
  } catch (err) {
    return next(err);
  }
});

experimentsRouter.get("/experiments/:id/report.xlsx", async (req, res, next) => {
  try {
    const experimentId = z.string().min(1).parse(req.params.id);

    const exp = await getExperimentForAccess(experimentId);
    if (!exp || !canReadExperiment(req.user!, exp)) {
      return res.status(404).json({ error: "Experimento no encontrado" });
    }

    const experiment = await prisma.experiment.findFirst({
      where: { id: experimentId },
      include: {
        factors: { include: { replicas: { include: { seeds: true } } } }
      }
    });
    if (!experiment) return res.status(404).json({ error: "Experimento no encontrado" });

    await recomputeAndSaveSummary(experimentId);
    const withSummary = await prisma.experiment.findUnique({ where: { id: experimentId } });

    const wb = new ExcelJS.Workbook();
    wb.creator = "GreenLab Data";
    const meta = wb.addWorksheet("Experimento");
    meta.addRow(["Nombre", experiment.name]);
    meta.addRow(["Tipo de semilla", experiment.seedType]);
    meta.addRow(["Fecha", experiment.date.toISOString()]);
    meta.addRow(["Escala", experiment.scaleUnit]);

    const dataWs = wb.addWorksheet("Datos");
    dataWs.addRow(["Factor", "Réplica", "Semilla", "Germinó", "Raíz", "Hipocótilo", "Observaciones"]);
    for (const factor of experiment.factors) {
      for (const replica of factor.replicas) {
        for (const seed of replica.seeds) {
          dataWs.addRow([
            factor.name,
            replica.code,
            seed.seedNumber,
            seed.germinated ? "Sí" : "No",
            seed.rootLength ?? "",
            seed.hypocotylLength ?? "",
            seed.notes ?? ""
          ]);
        }
      }
    }

    const sumWs = wb.addWorksheet("Resumen");
    const summary = withSummary?.computedSummary as Record<string, unknown> | null | undefined;
    if (summary && typeof summary === "object" && "overall" in summary) {
      sumWs.addRow(["Indicador", "Valor"]);
      const o = summary.overall as { totalSeeds?: number; germinated?: number; germinationRate?: number } | undefined;
      if (o) {
        sumWs.addRow(["Total semillas", o.totalSeeds ?? ""]);
        sumWs.addRow(["Germinadas", o.germinated ?? ""]);
        sumWs.addRow(["Tasa germinación", o.germinationRate != null ? `${(Number(o.germinationRate) * 100).toFixed(1)}%` : ""]);
      }
      const byFactor = summary.byFactor as Array<Record<string, unknown>> | undefined;
      if (byFactor?.length) {
        sumWs.addRow([]);
        sumWs.addRow([
          "Factor",
          "Semillas",
          "Germinadas",
          "% germ.",
          "Media raíz",
          "Min raíz",
          "Max raíz",
          "Media hipocótilo",
          "Min hipocótilo",
          "Max hipocótilo"
        ]);
        for (const row of byFactor) {
          sumWs.addRow([
            row.factorName,
            row.seeds,
            row.germinated,
            row.germinationRate != null ? `${(Number(row.germinationRate) * 100).toFixed(1)}%` : "",
            row.meanRootLength ?? "",
            row.minRootLength ?? "",
            row.maxRootLength ?? "",
            row.meanHypocotylLength ?? "",
            row.minHypocotylLength ?? "",
            row.maxHypocotylLength ?? ""
          ]);
        }
      }
    } else {
      sumWs.addRow(["Sin resumen calculado"]);
    }

    const safeName = experiment.name.replace(/[^\w\d\-_.\s]/g, "_").slice(0, 80);
    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}_reporte.xlsx"`);
    return res.send(Buffer.from(buffer));
  } catch (err) {
    return next(err);
  }
});
