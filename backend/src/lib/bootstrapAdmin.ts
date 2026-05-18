import { prisma } from "./prisma.js";
import { env } from "./env.js";

/** Promueve a ADMIN el correo en BOOTSTRAP_ADMIN_EMAIL (solo si ya está registrado). */
export async function bootstrapAdminFromEnv(): Promise<void> {
  const email = env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) return;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role === "ADMIN") return;

  await prisma.user.update({
    where: { id: user.id },
    data: { role: "ADMIN" }
  });
  // eslint-disable-next-line no-console
  console.log(`[bootstrap] Usuario ${email} promovido a ADMIN`);
}
