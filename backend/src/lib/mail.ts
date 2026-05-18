import dns from "node:dns/promises";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";
import { env } from "./env.js";

export function isSmtpConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_FROM);
}

/** Render sin IPv6: conectar a Gmail por IPv4 explícita (evita ENETUNREACH en AAAA). */
async function createSmtpTransporter() {
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

  return nodemailer.createTransport(options);
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new Error("SMTP no configurado");
  }

  const transporter = await createSmtpTransporter();

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: "Recuperar contraseña — GreenLab Data",
    text: `Hola,\n\nPara restablecer tu contraseña abre este enlace (válido 30 minutos):\n\n${resetLink}\n\nSi no solicitaste este cambio, ignora este mensaje.\n`,
    html: `<p>Hola,</p>
<p>Para restablecer tu contraseña haz clic en el siguiente enlace (válido <strong>30 minutos</strong>):</p>
<p><a href="${resetLink}">${resetLink}</a></p>
<p>Si no solicitaste este cambio, ignora este mensaje.</p>`
  });
}

export async function sendProjectInvitationEmail(
  to: string,
  projectName: string,
  inviterName: string,
  acceptLink: string
): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new Error("SMTP no configurado");
  }

  const transporter = await createSmtpTransporter();

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: `Invitación al proyecto «${projectName}» — GreenLab Data`,
    text: `Hola,\n\n${inviterName} te invitó a colaborar en el proyecto «${projectName}» en GreenLab Data.\n\nPara aceptar, abre este enlace (válido 7 días):\n\n${acceptLink}\n\nSi no tienes cuenta, regístrate con este mismo correo y luego abre el enlace.\n\nSi no esperabas esta invitación, ignora este mensaje.\n`,
    html: `<p>Hola,</p>
<p><strong>${inviterName}</strong> te invitó a colaborar en el proyecto <strong>«${projectName}»</strong> en GreenLab Data.</p>
<p><a href="${acceptLink}">Aceptar invitación</a> (válido 7 días)</p>
<p>Si aún no tienes cuenta, <a href="${acceptLink}">regístrate con este correo</a> y vuelve a abrir el enlace.</p>
<p>Si no esperabas esta invitación, ignora este mensaje.</p>`
  });
}
