/**
 * Asigna un proyecto por defecto a experimentos sin projectId (BD previa a Sprint 2).
 * Ejecutar: npx tsx scripts/backfill-projects.ts (desde /backend)
 */
import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  const orphans = await prisma.experiment.findMany({ where: { projectId: null }, select: { id: true, userId: true } });
  if (orphans.length === 0) {
    // eslint-disable-next-line no-console
    console.log("Nada que migrar.");
    return;
  }

  const byUser = new Map<string, string[]>();
  for (const o of orphans) {
    const arr = byUser.get(o.userId) ?? [];
    arr.push(o.id);
    byUser.set(o.userId, arr);
  }

  for (const [userId, expIds] of byUser) {
    const project = await prisma.project.create({
      data: {
        name: "Mi proyecto (migrado)",
        description: "Creado automáticamente al migrar datos sin proyecto.",
        ownerId: userId
      }
    });
    await prisma.projectMember.create({ data: { projectId: project.id, userId } });
    await prisma.experiment.updateMany({
      where: { id: { in: expIds } },
      data: { projectId: project.id }
    });
    // eslint-disable-next-line no-console
    console.log(`Usuario ${userId}: proyecto ${project.id} para ${expIds.length} experimento(s).`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
