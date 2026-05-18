import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/auth.js";
import { env } from "../lib/env.js";
import { isEmailConfigured, sendPasswordResetEmail } from "../lib/mail.js";
import { acceptPendingInvitationsForUser } from "../lib/projectInvitations.js";

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  email: z.string().email("Email inválido").toLowerCase(),
  password: z.string().min(8, "Mínimo 8 caracteres")
});

authRouter.post("/auth/register", async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: input.email } });
    if (exists) return res.status(409).json({ error: "El email ya está registrado" });

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: { name: input.name, email: input.email, passwordHash },
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });

    const invitationsAccepted = await acceptPendingInvitationsForUser(user.id, user.email);

    const token = signAccessToken({ sub: user.id, email: user.email, name: user.name });
    return res.status(201).json({ user, token, invitationsAccepted });
  } catch (err) {
    return next(err);
  }
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1)
});

authRouter.post("/auth/login", async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) return res.status(401).json({ error: "Credenciales inválidas" });

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });

    const token = signAccessToken({ sub: user.id, email: user.email, name: user.name });
    return res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt },
      token
    });
  } catch (err) {
    return next(err);
  }
});

const forgotSchema = z.object({ email: z.string().email().toLowerCase() });

/**
 * Recuperación: requiere SMTP en el servidor; envía correo con enlace (válido 30 min).
 */
authRouter.post("/auth/forgot-password", async (req, res, next) => {
  try {
    const { email } = forgotSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.json({ ok: true });

    if (!isEmailConfigured()) {
      return res.status(503).json({
        error:
          "El envío de correo no está configurado. En producción usa BREVO_API_KEY y BREVO_SENDER_EMAIL (brevo.com). En local puedes usar SMTP."
      });
    }

    const tokenPlain = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(tokenPlain).digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

    const record = await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt }
    });

    const resetLink = `${env.APP_PUBLIC_URL}/reset?token=${encodeURIComponent(tokenPlain)}`;
    try {
      await sendPasswordResetEmail(user.email, resetLink);
      return res.json({ ok: true, emailSent: true });
    } catch (e) {
      await prisma.passwordResetToken.delete({ where: { id: record.id } }).catch(() => {});
      // eslint-disable-next-line no-console
      console.error("Error enviando correo de recuperación:", e);
      const errText = e instanceof Error ? e.message : String(e);
      let userMsg = "No se pudo enviar el correo. Revisa BREVO_API_KEY y BREVO_SENDER_EMAIL en Render, o intenta más tarde.";
      if (
        errText.includes("only send testing") ||
        errText.includes("verify a domain") ||
        errText.includes("own email")
      ) {
        userMsg =
          "Resend en modo prueba no envía a todos. Usa Brevo (BREVO_API_KEY) o verifica un dominio en Resend.";
      } else if (errText.toLowerCase().includes("sender") || errText.includes("not verified")) {
        userMsg =
          "El remitente no está verificado en Brevo. En brevo.com confirma BREVO_SENDER_EMAIL (enlace en tu bandeja).";
      } else if (errText.includes("API key") || errText.includes("Invalid") || errText.includes("unauthorised")) {
        userMsg = "La clave de correo no es válida. Revisa BREVO_API_KEY en Render.";
      }
      return res.status(500).json({ error: userMsg });
    }
  } catch (err) {
    return next(err);
  }
});

const resetSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8, "Mínimo 8 caracteres")
});

authRouter.post("/auth/reset-password", async (req, res, next) => {
  try {
    const input = resetSchema.parse(req.body);
    const tokenHash = crypto.createHash("sha256").update(input.token).digest("hex");
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });
    if (!record) return res.status(400).json({ error: "Token inválido" });
    if (record.usedAt) return res.status(400).json({ error: "Token ya utilizado" });
    if (record.expiresAt < new Date()) return res.status(400).json({ error: "Token expirado" });

    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } })
    ]);

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

