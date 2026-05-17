import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

export const adminRouter = Router();

const roleSchema = z.object({
  role: z.enum(["STUDENT", "TEACHER", "ADMIN", "RESEARCHER"])
});

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ error: "Permiso denegado" });
  }
  return next();
}

/** Importante: no usar adminRouter.use(requireAdmin) global — bloquearía rutas posteriores (p. ej. GET /experiments). */

adminRouter.get("/admin/users", requireAdmin, async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
    return res.json({ items: users });
  } catch (err) {
    return next(err);
  }
});

adminRouter.patch("/admin/users/:id", requireAdmin, async (req, res, next) => {
  try {
    const adminId = req.user!.id;
    const id = z.string().min(1).parse(req.params.id);
    const { role } = roleSchema.parse(req.body);

    if (id === adminId && role !== "ADMIN") {
      return res.status(400).json({ error: "No puedes quitarte el rol de administrador" });
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return res.status(404).json({ error: "Usuario no encontrado" });

    const updated = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });
    return res.json({ user: updated });
  } catch (err) {
    return next(err);
  }
});

adminRouter.delete("/admin/users/:id", requireAdmin, async (req, res, next) => {
  try {
    const adminId = req.user!.id;
    const id = z.string().min(1).parse(req.params.id);
    if (id === adminId) return res.status(400).json({ error: "No puedes eliminar tu propia cuenta" });

    const u = await prisma.user.findUnique({ where: { id } });
    if (!u) return res.status(404).json({ error: "Usuario no encontrado" });

    await prisma.$transaction([
      prisma.adminAuditLog.create({
        data: {
          action: "USER_DELETED",
          actorAdminId: adminId,
          actorEmailSnapshot: req.user!.email,
          targetUserId: u.id,
          targetEmailSnapshot: u.email,
          targetNameSnapshot: u.name,
          detail: `deleted user ${u.id}`
        }
      }),
      prisma.user.delete({ where: { id } })
    ]);
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

adminRouter.get("/admin/audit", requireAdmin, async (req, res, next) => {
  try {
    const items = await prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        action: true,
        createdAt: true,
        actorEmailSnapshot: true,
        targetEmailSnapshot: true,
        targetNameSnapshot: true,
        detail: true
      }
    });
    return res.json({ items });
  } catch (err) {
    return next(err);
  }
});
