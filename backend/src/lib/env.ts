import dotenv from "dotenv";

dotenv.config();

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Falta variable de entorno: ${key}`);
  return v;
}

export const env = {
  PORT: Number(process.env.PORT ?? "4000"),
  DATABASE_URL: requireEnv("DATABASE_URL"),
  JWT_SECRET: requireEnv("JWT_SECRET"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "7d",
  APP_ORIGIN: process.env.APP_ORIGIN ?? "http://localhost:5175",
  /** URL pública del frontend (enlaces en correos). Por defecto igual que APP_ORIGIN. */
  APP_PUBLIC_URL: (process.env.APP_PUBLIC_URL ?? process.env.APP_ORIGIN ?? "http://localhost:5175").replace(/\/$/, ""),
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? "uploads",

  /** Producción gratis: imágenes en la nube (https://cloudinary.com). En local, sin esto se usa carpeta uploads/. */
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ?? "",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ?? "",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ?? "",

  /** Opcional: si SMTP_HOST y SMTP_FROM están definidos, se envían correos reales (recuperación de contraseña). */
  SMTP_HOST: process.env.SMTP_HOST ?? "",
  SMTP_PORT: Number(process.env.SMTP_PORT ?? "587"),
  SMTP_SECURE: process.env.SMTP_SECURE === "true",
  SMTP_USER: process.env.SMTP_USER ?? "",
  SMTP_PASS: process.env.SMTP_PASS ?? "",
  SMTP_FROM: process.env.SMTP_FROM ?? "",

  /** Producción en Render Free: correo por API HTTPS (puerto 443). https://resend.com */
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
  RESEND_FROM: process.env.RESEND_FROM ?? "",

  /** Opcional: al arrancar, promueve este correo a ADMIN si ya existe como usuario. */
  BOOTSTRAP_ADMIN_EMAIL: process.env.BOOTSTRAP_ADMIN_EMAIL ?? ""
};

