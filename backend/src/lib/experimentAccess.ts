import type { Experiment, Project, ProjectMember, User, UserRole } from "../generated/prisma/index.js";
import { prisma } from "./prisma.js";

export type ExperimentForAccess = Experiment & {
  user: Pick<User, "id" | "role">;
  project:
    | (Project & {
        members: ProjectMember[];
      })
    | null;
};

export async function getExperimentForAccess(experimentId: string): Promise<ExperimentForAccess | null> {
  return prisma.experiment.findUnique({
    where: { id: experimentId },
    include: {
      user: { select: { id: true, role: true } },
      project: { include: { members: true } }
    }
  });
}

export function canReadExperiment(
  viewer: { id: string; role: UserRole },
  exp: ExperimentForAccess
): boolean {
  if (viewer.role === "ADMIN") return true;
  if (exp.userId === viewer.id) return true;
  if (viewer.role === "TEACHER" && exp.user.role === "STUDENT") return true;
  if (!exp.projectId || !exp.project) return false;
  if (exp.project.ownerId === viewer.id) return true;
  return exp.project.members.some((m) => m.userId === viewer.id);
}

export function canWriteExperiment(viewer: { id: string; role: UserRole }, exp: ExperimentForAccess): boolean {
  // Admin: lectura global (vista docente, auditoría), sin editar datos de terceros.
  if (exp.userId === viewer.id) return true;
  if (!exp.projectId || !exp.project) return false;
  if (exp.project.ownerId === viewer.id) return true;
  return exp.project.members.some((m) => m.userId === viewer.id);
}

export async function userProjectIds(userId: string): Promise<string[]> {
  const [owned, member] = await Promise.all([
    prisma.project.findMany({ where: { ownerId: userId }, select: { id: true } }),
    prisma.projectMember.findMany({ where: { userId }, select: { projectId: true } })
  ]);
  const ids = new Set<string>();
  for (const o of owned) ids.add(o.id);
  for (const m of member) ids.add(m.projectId);
  return [...ids];
}

export async function canCreateExperimentInProject(userId: string, projectId: string): Promise<boolean> {
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    include: { members: true }
  });
  if (!p) return false;
  if (p.ownerId === userId) return true;
  return p.members.some((m) => m.userId === userId);
}
