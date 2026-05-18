import dns from "node:dns/promises";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";
import { env } from "./env.js";

export function isSmtpConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_FROM);
}

export function isResendConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY && env.RESEND_FROM);
}

/** Sin DNS: verifica un solo correo en brevo.com y envía a cualquier usuario (HTTPS, Render Free). */
export function isBrevoConfigured(): boolean {
  return Boolean(env.BREVO_API_KEY && env.BREVO_SENDER_EMAIL);
}

export function isEmailConfigured(): boolean {
  return isBrevoConfigured() || isResendConfigured() || isSmtpConfigured();
}

async function sendViaBrevo(to: string, subject: string, text: string, html: string): Promise<void> {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": env.BREVO_API_KEY,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      sender: { name: env.BREVO_SENDER_NAME, email: env.BREVO_SENDER_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text
    })
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) detail = body.message;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
}

async function sendViaResend(to: string, subject: string, text: string, html: string): Promise<void> {
  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: env.RESEND_FROM,
    to: [to],
    subject,
    text,
    html
  });
  if (error) {
    throw new Error(error.message);
  }
}

async function sendViaSmtp(to: string, subject: string, text: string, html: string): Promise<void> {
  const hostname = env.SMTP_HOST;
  const { address } = await dns.lookup(hostname, { family: 4 });

  const options: SMTPTransport.Options = {
    host: address,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    auth:
      env.SMTP_USER !== undefined && env.SMTP_USER !== ""
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? "" }
        : undefined,
    tls: {
      servername: hostname
    }
  };

  const transporter = nodemailer.createTransport(options);
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    text,
    html
  });
}

async function sendEmail(to: string, subject: string, text: string, html: string): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error("Correo no configurado");
  }
  if (isBrevoConfigured()) {
    await sendViaBrevo(to, subject, text, html);
    return;
  }
  if (isResendConfigured()) {
    await sendViaResend(to, subject, text, html);
    return;
  }
  await sendViaSmtp(to, subject, text, html);
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  const subject = "Recuperar contraseña — GreenLab Data";
  const text = `Hola,\n\nPara restablecer tu contraseña abre este enlace (válido 30 minutos):\n\n${resetLink}\n\nSi no solicitaste este cambio, ignora este mensaje.\n`;
  const html = `<p>Hola,</p>
<p>Para restablecer tu contraseña haz clic en el siguiente enlace (válido <strong>30 minutos</strong>):</p>
<p><a href="${resetLink}">${resetLink}</a></p>
<p>Si no solicitaste este cambio, ignora este mensaje.</p>`;
  await sendEmail(to, subject, text, html);
}

export async function sendProjectInvitationEmail(
  to: string,
  projectName: string,
  inviterName: string,
  acceptLink: string
): Promise<void> {
  const subject = `Invitación al proyecto «${projectName}» — GreenLab Data`;
  const text = `Hola,\n\n${inviterName} te invitó a colaborar en el proyecto «${projectName}» en GreenLab Data.\n\nPara aceptar, abre este enlace (válido 7 días):\n\n${acceptLink}\n\nInicia sesión con el mismo correo de la invitación.\n\nSi no esperabas esta invitación, ignora este mensaje.\n`;
  const html = `<p>Hola,</p>
<p><strong>${inviterName}</strong> te invitó a colaborar en el proyecto <strong>«${projectName}»</strong> en GreenLab Data.</p>
<p><a href="${acceptLink}">Aceptar invitación</a> (válido 7 días)</p>
<p>Inicia sesión con el mismo correo de esta invitación para aceptar.</p>
<p>Si no esperabas esta invitación, ignora este mensaje.</p>`;
  await sendEmail(to, subject, text, html);
}
