import crypto from "crypto";
import { prisma } from "./prisma.js";

export function hashInviteToken(plain: string): string {
  return crypto.createHash("sha256").update(plain).digest("hex");
}

export function createInviteToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

const INVITE_DAYS = 7;

export function inviteExpiresAt(): Date {
  return new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);
}

/** Acepta invitaciones pendientes para ese correo (p. ej. tras registrarse). */
export async function acceptPendingInvitationsForUser(userId: string, email: string): Promise<number> {
  const normalized = email.toLowerCase();
  const pending = await prisma.projectInvitation.findMany({
    where: {
      email: normalized,
      status: "PENDING",
      expiresAt: { gt: new Date() }
    }
  });

  let count = 0;
  for (const inv of pending) {
    await acceptInvitationRecord(inv.id, userId);
    count++;
  }
  return count;
}

export async function acceptInvitationByToken(
  userId: string,
  userEmail: string,
  plainToken: string
): Promise<{ projectId: string; projectName: string }> {
  const tokenHash = hashInviteToken(plainToken);
  const inv = await prisma.projectInvitation.findFirst({
    where: { tokenHash },
    include: { project: { select: { id: true, name: true } } }
  });

  if (!inv) {
    throw new InviteError("INVITE_INVALID", "La invitación no es válida o ya expiró");
  }
  if (inv.status === "ACCEPTED") {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: inv.projectId, userId } }
    });
    if (member && inv.email.toLowerCase() === userEmail.toLowerCase()) {
      return { projectId: inv.project.id, projectName: inv.project.name };
    }
    throw new InviteError("INVITE_ALREADY_USED", "Esta invitación ya fue aceptada.");
  }
  if (inv.status === "CANCELLED") {
    throw new InviteError("INVITE_CANCELLED", "Esta invitación fue cancelada.");
  }
  if (inv.expiresAt <= new Date()) {
    throw new InviteError("INVITE_EXPIRED", "Esta invitación expiró.");
  }
  if (inv.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw new InviteError(
      "INVITE_EMAIL_MISMATCH",
      "Esta invitación fue enviada a otro correo. Inicia sesión con la cuenta invitada."
    );
  }

  await acceptInvitationRecord(inv.id, userId);
  return { projectId: inv.project.id, projectName: inv.project.name };
}

export async function declineInvitationByToken(
  userId: string,
  userEmail: string,
  plainToken: string
): Promise<void> {
  const tokenHash = hashInviteToken(plainToken);
  const inv = await prisma.projectInvitation.findFirst({
    where: { tokenHash },
    include: { project: { select: { id: true } } }
  });

  if (!inv) {
    throw new InviteError("INVITE_INVALID", "La invitación no es válida o ya expiró");
  }
  if (inv.status === "ACCEPTED") {
    throw new InviteError("INVITE_ALREADY_USED", "Esta invitación ya fue aceptada.");
  }
  if (inv.status === "CANCELLED") {
    return;
  }
  if (inv.expiresAt <= new Date()) {
    throw new InviteError("INVITE_EXPIRED", "Esta invitación expiró.");
  }
  if (inv.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw new InviteError(
      "INVITE_EMAIL_MISMATCH",
      "Esta invitación fue enviada a otro correo. Inicia sesión con la cuenta invitada."
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.projectInvitation.update({
      where: { id: inv.id },
      data: { status: "CANCELLED" }
    });
    await tx.activityLog.create({
      data: {
        projectId: inv.projectId,
        userId,
        action: "MEMBER_INVITE_DECLINED",
        detail: inv.email
      }
    });
  });
}

async function acceptInvitationRecord(invitationId: string, userId: string): Promise<void> {
  const inv = await prisma.projectInvitation.findUnique({ where: { id: invitationId } });
  if (!inv || inv.status !== "PENDING") return;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.projectMember.findUnique({
      where: { projectId_userId: { projectId: inv.projectId, userId } }
    });
    if (!existing) {
      await tx.projectMember.create({
        data: { projectId: inv.projectId, userId }
      });
    }
    await tx.projectInvitation.update({
      where: { id: invitationId },
      data: { status: "ACCEPTED", acceptedAt: new Date() }
    });
    await tx.activityLog.create({
      data: {
        projectId: inv.projectId,
        userId,
        action: "MEMBER_ADDED",
        detail: `invitation accepted (${inv.email})`
      }
    });
  });
}

export class InviteError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "InviteError";
  }
}
