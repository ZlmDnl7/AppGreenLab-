import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  hashInviteToken,
  acceptInvitationByToken,
  declineInvitationByToken,
  InviteError
} from "../lib/projectInvitations.js";

export const invitationsPublicRouter = Router();

invitationsPublicRouter.get("/invitations/preview", async (req, res, next) => {
  try {
    const token = z.string().min(10).parse(req.query.token);
    const tokenHash = hashInviteToken(token);
    const inv = await prisma.projectInvitation.findFirst({
      where: { tokenHash },
      include: {
        project: { select: { id: true, name: true } },
        invitedBy: { select: { name: true } }
      }
    });
    if (!inv) return res.status(404).json({ error: "Invitación no válida" });
    if (inv.status === "CANCELLED") {
      return res.status(410).json({ error: "Esta invitación fue cancelada por el dueño del proyecto." });
    }
    if (inv.status === "ACCEPTED") {
      return res.json({
        status: "already_accepted",
        projectName: inv.project.name,
        projectId: inv.project.id,
        email: inv.email,
        inviterName: inv.invitedBy.name
      });
    }
    if (inv.expiresAt <= new Date()) {
      return res.status(410).json({ error: "Esta invitación expiró. Pide al dueño del proyecto que envíe una nueva." });
    }
    return res.json({
      status: "pending",
      projectName: inv.project.name,
      projectId: inv.project.id,
      email: inv.email,
      inviterName: inv.invitedBy.name
    });
  } catch (err) {
    return next(err);
  }
});

export const invitationsRouter = Router();

invitationsRouter.post("/invitations/accept", async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string().min(10) }).parse(req.body);
    const user = req.user!;
    const result = await acceptInvitationByToken(user.id, user.email, token);
    return res.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof InviteError) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    return next(err);
  }
});

invitationsRouter.post("/invitations/decline", async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string().min(10) }).parse(req.body);
    const user = req.user!;
    await declineInvitationByToken(user.id, user.email, token);
    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof InviteError) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    return next(err);
  }
});
