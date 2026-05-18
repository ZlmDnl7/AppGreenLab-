import { Router } from "express";
import { z } from "zod";
import ExcelJS from "exceljs";
import { prisma } from "../lib/prisma.js";
import { userProjectIds } from "../lib/experimentAccess.js";
import { recomputeAndSaveSummary } from "../lib/summary.js";
import { env } from "../lib/env.js";
import { isEmailConfigured, sendProjectInvitationEmail } from "../lib/mail.js";
import {
  createInviteToken,
  hashInviteToken,
  inviteExpiresAt
} from "../lib/projectInvitations.js";

export const projectsRouter = Router();

const createSchema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  description: z.string().optional()
});

const updateSchema = z.object({
  name: z.string().min(2, "Nombre requerido").optional(),
  description: z.string().nullable().optional()
});

const projectListSelect = {
  id: true,
  name: true,
  description: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { name: true, email: true } },
  _count: { select: { experiments: true, members: true } }
} as const;

projectsRouter.get("/projects", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const scope = z.enum(["supervision"]).optional().parse(req.query.scope);

    if (scope === "supervision") {
      if (req.user!.role !== "TEACHER" && req.user!.role !== "ADMIN") {
        return res.status(403).json({ error: "Permiso denegado" });
      }
      if (req.user!.role === "ADMIN") {
        const list = await prisma.project.findMany({
          orderBy: { updatedAt: "desc" },
          select: projectListSelect
        });
        return res.json({ items: list });
      }
      const linked = await prisma.experiment.findMany({
        where: { user: { role: "STUDENT" }, projectId: { not: null } },
        select: { projectId: true },
        distinct: ["projectId"]
      });
      const ids = linked.map((e) => e.projectId).filter((id): id is string => id != null);
      if (ids.length === 0) return res.json({ items: [] });
      const list = await prisma.project.findMany({
        where: { id: { in: ids } },
        orderBy: { updatedAt: "desc" },
        select: projectListSelect
      });
      return res.json({ items: list });
    }

    const ids = await userProjectIds(userId);
    if (ids.length === 0) return res.json({ items: [] });
    const list = await prisma.project.findMany({
      where: { id: { in: ids } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { experiments: true, members: true } }
      }
    });
    return res.json({ items: list });
  } catch (err) {
    return next(err);
  }
});

projectsRouter.post("/projects", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const input = createSchema.parse(req.body);

    const project = await prisma.$transaction(async (tx) => {
      const p = await tx.project.create({
        data: {
          name: input.name,
          description: input.description,
          ownerId: userId
        }
      });
      await tx.projectMember.create({
        data: { projectId: p.id, userId }
      });
      await tx.activityLog.create({
        data: {
          projectId: p.id,
          userId,
          action: "PROJECT_CREATED",
          detail: p.name
        }
      });
      return p;
    });

    return res.status(201).json({ project });
  } catch (err) {
    return next(err);
  }
});

projectsRouter.patch("/projects/:id", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const id = z.string().min(1).parse(req.params.id);
    const input = updateSchema.parse(req.body);

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ error: "Proyecto no encontrado" });
    if (project.ownerId !== userId && req.user!.role !== "ADMIN") {
      return res.status(403).json({ error: "Permiso denegado" });
    }

    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description })
      }
    });

    await prisma.activityLog.create({
      data: {
        projectId: id,
        userId,
        action: "PROJECT_UPDATED",
        detail: updated.name
      }
    });

    return res.json({ project: updated });
  } catch (err) {
    return next(err);
  }
});

projectsRouter.delete("/projects/:id", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const id = z.string().min(1).parse(req.params.id);

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ error: "Proyecto no encontrado" });
    if (project.ownerId !== userId && req.user!.role !== "ADMIN") {
      return res.status(403).json({ error: "Permiso denegado" });
    }

    await prisma.activityLog.create({
      data: {
        projectId: id,
        userId,
        action: "PROJECT_DELETED",
        detail: project.name
      }
    });

    await prisma.project.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

projectsRouter.get("/projects/:id", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const id = z.string().min(1).parse(req.params.id);
    const allowed = await userProjectIds(userId);
    const canSupervise = req.user!.role === "ADMIN" || req.user!.role === "TEACHER";
    if (!allowed.includes(id) && !canSupervise) {
      return res.status(404).json({ error: "Proyecto no encontrado" });
    }
    const project = await prisma.project.findFirst({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true, role: true } } }
        },
        experiments: {
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, seedType: true, date: true, userId: true }
        }
      }
    });
    if (!project) return res.status(404).json({ error: "Proyecto no encontrado" });
    if (!allowed.includes(id) && canSupervise) {
      const hasStudentWork = await prisma.experiment.findFirst({
        where: { projectId: id, user: { role: "STUDENT" } },
        select: { id: true }
      });
      if (!hasStudentWork && req.user!.role !== "ADMIN") {
        return res.status(404).json({ error: "Proyecto no encontrado" });
      }
    }
    return res.json({ project });
  } catch (err) {
    return next(err);
  }
});

const memberSchema = z.object({
  email: z.string().email().toLowerCase()
});

projectsRouter.get("/projects/:id/invitations", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const projectId = z.string().min(1).parse(req.params.id);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ error: "Proyecto no encontrado" });
    if (project.ownerId !== userId && req.user!.role !== "ADMIN") {
      return res.status(403).json({ error: "Permiso denegado" });
    }

    const items = await prisma.projectInvitation.findMany({
      where: { projectId, status: "PENDING", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, createdAt: true, expiresAt: true }
    });
    return res.json({ items });
  } catch (err) {
    return next(err);
  }
});

projectsRouter.delete("/projects/:id/invitations/:invitationId", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const projectId = z.string().min(1).parse(req.params.id);
    const invitationId = z.string().min(1).parse(req.params.invitationId);

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ error: "Proyecto no encontrado" });
    if (project.ownerId !== userId && req.user!.role !== "ADMIN") {
      return res.status(403).json({ error: "Permiso denegado" });
    }

    const inv = await prisma.projectInvitation.findFirst({
      where: { id: invitationId, projectId, status: "PENDING" }
    });
    if (!inv) return res.status(404).json({ error: "Invitación no encontrada" });

    await prisma.projectInvitation.update({
      where: { id: invitationId },
      data: { status: "CANCELLED" }
    });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

/** Envía invitación por correo; el usuario debe aceptar el enlace para unirse al proyecto. */
projectsRouter.post("/projects/:id/members", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const inviterName = req.user!.name;
    const projectId = z.string().min(1).parse(req.params.id);
    const { email } = memberSchema.parse(req.body);

    if (!isEmailConfigured()) {
      return res.status(503).json({
        error:
          "El envío de correo no está configurado. En producción define RESEND_API_KEY y RESEND_FROM. En local puedes usar SMTP."
      });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ error: "Proyecto no encontrado" });
    if (project.ownerId !== userId && req.user!.role !== "ADMIN") {
      return res.status(403).json({ error: "Solo el dueño del proyecto puede invitar miembros" });
    }

    const target = await prisma.user.findUnique({ where: { email } });
    if (!target) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const already = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: target.id } }
    });
    if (already) return res.status(409).json({ error: "El usuario ya es miembro del proyecto" });

    const plain = createInviteToken();
    const tokenHash = hashInviteToken(plain);
    const expiresAt = inviteExpiresAt();

    const existingPending = await prisma.projectInvitation.findFirst({
      where: { projectId, email, status: "PENDING" }
    });

    if (existingPending) {
      await prisma.projectInvitation.update({
        where: { id: existingPending.id },
        data: { tokenHash, expiresAt, invitedById: userId, status: "PENDING" }
      });
    } else {
      await prisma.projectInvitation.create({
        data: {
          projectId,
          email,
          tokenHash,
          expiresAt,
          invitedById: userId
        }
      });
    }

    const acceptLink = `${env.APP_PUBLIC_URL}/invitations/accept?token=${encodeURIComponent(plain)}`;
    try {
      await sendProjectInvitationEmail(email, project.name, inviterName, acceptLink);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Error enviando invitación:", e);
      return res.status(500).json({
        error: "No se pudo enviar el correo de invitación. Revisa la configuración SMTP."
      });
    }

    await prisma.activityLog.create({
      data: {
        projectId,
        userId,
        action: "MEMBER_INVITED",
        detail: email
      }
    });

    return res.status(201).json({
      ok: true,
      emailSent: true,
      message: "Invitación enviada"
    });
  } catch (err) {
    return next(err);
  }
});

projectsRouter.delete("/projects/:id/members/:memberUserId", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const projectId = z.string().min(1).parse(req.params.id);
    const memberUserId = z.string().min(1).parse(req.params.memberUserId);

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ error: "Proyecto no encontrado" });
    if (project.ownerId !== userId && req.user!.role !== "ADMIN") {
      return res.status(403).json({ error: "Permiso denegado" });
    }
    if (memberUserId === project.ownerId) {
      return res.status(400).json({ error: "No puedes quitar al dueño del proyecto" });
    }

    await prisma.projectMember.deleteMany({ where: { projectId, userId: memberUserId } });
    await prisma.activityLog.create({
      data: {
        projectId,
        userId,
        action: "MEMBER_REMOVED",
        detail: memberUserId
      }
    });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

projectsRouter.get("/projects/:id/activity", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const projectId = z.string().min(1).parse(req.params.id);
    const allowed = await userProjectIds(userId);
    const canSupervise = req.user!.role === "ADMIN" || req.user!.role === "TEACHER";
    if (!allowed.includes(projectId) && !canSupervise) {
      return res.status(404).json({ error: "Proyecto no encontrado" });
    }
    if (!allowed.includes(projectId) && canSupervise && req.user!.role === "TEACHER") {
      const hasStudentWork = await prisma.experiment.findFirst({
        where: { projectId, user: { role: "STUDENT" } },
        select: { id: true }
      });
      if (!hasStudentWork) return res.status(404).json({ error: "Proyecto no encontrado" });
    }

    const logs = await prisma.activityLog.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { name: true, email: true } } }
    });
    return res.json({ items: logs });
  } catch (err) {
    return next(err);
  }
});

function safeSheetName(name: string): string {
  // Excel: max 31 chars, no []:*?/\
  return name.replace(/[\[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Hoja";
}

projectsRouter.get("/projects/:id/export.xlsx", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const projectId = z.string().min(1).parse(req.params.id);
    const allowed = await userProjectIds(userId);
    const canSupervise = req.user!.role === "ADMIN" || req.user!.role === "TEACHER";
    if (!allowed.includes(projectId) && !canSupervise) {
      return res.status(404).json({ error: "Proyecto no encontrado" });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true }
    });
    if (!project) return res.status(404).json({ error: "Proyecto no encontrado" });

    if (!allowed.includes(projectId) && req.user!.role === "TEACHER") {
      const hasStudentWork = await prisma.experiment.findFirst({
        where: { projectId, user: { role: "STUDENT" } },
        select: { id: true }
      });
      if (!hasStudentWork) return res.status(404).json({ error: "Proyecto no encontrado" });
    }

    const experiments = await prisma.experiment.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { name: true, email: true } },
        factors: { include: { replicas: { include: { seeds: true } } } }
      }
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = "GreenLab Data";

    const meta = wb.addWorksheet("Proyecto");
    meta.addRow(["Proyecto", project.name]);
    meta.addRow(["Fecha exportación", new Date().toISOString()]);
    meta.addRow(["Experimentos", experiments.length]);

    const used = new Set<string>(["Proyecto"]);
    for (let i = 0; i < experiments.length; i++) {
      const exp = experiments[i]!;
      await recomputeAndSaveSummary(exp.id);
      const withSummary = await prisma.experiment.findUnique({ where: { id: exp.id } });
      const summary = withSummary?.computedSummary as Record<string, unknown> | null | undefined;

      const base = safeSheetName(`${i + 1}. ${exp.name}`);
      let sheetName = base;
      let k = 2;
      while (used.has(sheetName)) {
        sheetName = safeSheetName(`${base.slice(0, 28)} ${k}`);
        k++;
      }
      used.add(sheetName);

      const ws = wb.addWorksheet(sheetName);
      ws.addRow(["Nombre", exp.name]);
      ws.addRow(["Autor", exp.user ? `${exp.user.name} (${exp.user.email})` : ""]);
      ws.addRow(["Tipo de semilla", exp.seedType]);
      ws.addRow(["Fecha", exp.date.toISOString()]);
      ws.addRow(["Escala", exp.scaleUnit]);
      ws.addRow([]);

      ws.addRow(["Factor", "Réplica", "Semilla", "Germinó", "Raíz", "Hipocótilo", "Observaciones"]);
      for (const factor of exp.factors) {
        for (const replica of factor.replicas) {
          for (const seed of replica.seeds) {
            ws.addRow([
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

      if (summary && typeof summary === "object" && "overall" in summary) {
        ws.addRow([]);
        ws.addRow(["Resumen"]);
        const o = summary.overall as { totalSeeds?: number; germinated?: number; germinationRate?: number } | undefined;
        if (o) {
          ws.addRow(["Total semillas", o.totalSeeds ?? ""]);
          ws.addRow(["Germinadas", o.germinated ?? ""]);
          ws.addRow(["Tasa germinación", o.germinationRate != null ? `${(Number(o.germinationRate) * 100).toFixed(1)}%` : ""]);
        }
        const byFactor = summary.byFactor as Array<Record<string, unknown>> | undefined;
        if (byFactor?.length) {
          ws.addRow([]);
          ws.addRow([
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
            ws.addRow([
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
      }
    }

    const safeName = project.name.replace(/[^\w\d\-_.\s]/g, "_").slice(0, 60);
    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}_proyecto.xlsx"`);
    return res.send(Buffer.from(buffer));
  } catch (err) {
    return next(err);
  }
});
