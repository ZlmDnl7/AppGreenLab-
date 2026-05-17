import type { Prisma } from "../generated/prisma/index.js";
import { prisma } from "./prisma.js";

export type SummaryPayload = {
  updatedAt: string;
  overall: {
    totalSeeds: number;
    germinated: number;
    germinationRate: number;
  };
  byFactor: {
    factorName: string;
    seeds: number;
    germinated: number;
    germinationRate: number;
    meanRootLength: number | null;
    meanHypocotylLength: number | null;
    minRootLength: number | null;
    maxRootLength: number | null;
    minHypocotylLength: number | null;
    maxHypocotylLength: number | null;
  }[];
};

export async function recomputeAndSaveSummary(experimentId: string): Promise<SummaryPayload | null> {
  const exp = await prisma.experiment.findUnique({
    where: { id: experimentId },
    include: { factors: { include: { replicas: { include: { seeds: true } } } } }
  });
  if (!exp) return null;

  let totalSeeds = 0;
  let germinated = 0;
  const byFactor = exp.factors.map((f) => {
    let tf = 0;
    let tg = 0;
    let sumRoot = 0;
    let countRoot = 0;
    let sumHyp = 0;
    let countHyp = 0;
    let minRoot: number | null = null;
    let maxRoot: number | null = null;
    let minHyp: number | null = null;
    let maxHyp: number | null = null;
    for (const r of f.replicas) {
      for (const s of r.seeds) {
        tf++;
        if (s.germinated) {
          tg++;
          if (s.rootLength != null) {
            sumRoot += s.rootLength;
            countRoot++;
            minRoot = minRoot == null ? s.rootLength : Math.min(minRoot, s.rootLength);
            maxRoot = maxRoot == null ? s.rootLength : Math.max(maxRoot, s.rootLength);
          }
          if (s.hypocotylLength != null) {
            sumHyp += s.hypocotylLength;
            countHyp++;
            minHyp = minHyp == null ? s.hypocotylLength : Math.min(minHyp, s.hypocotylLength);
            maxHyp = maxHyp == null ? s.hypocotylLength : Math.max(maxHyp, s.hypocotylLength);
          }
        }
      }
    }
    totalSeeds += tf;
    germinated += tg;
    return {
      factorName: f.name,
      seeds: tf,
      germinated: tg,
      germinationRate: tf ? tg / tf : 0,
      meanRootLength: countRoot ? sumRoot / countRoot : null,
      meanHypocotylLength: countHyp ? sumHyp / countHyp : null,
      minRootLength: minRoot,
      maxRootLength: maxRoot,
      minHypocotylLength: minHyp,
      maxHypocotylLength: maxHyp
    };
  });

  const overall = {
    totalSeeds,
    germinated,
    germinationRate: totalSeeds ? germinated / totalSeeds : 0
  };

  const payload: SummaryPayload = {
    updatedAt: new Date().toISOString(),
    overall,
    byFactor
  };

  await prisma.experiment.update({
    where: { id: experimentId },
    data: { computedSummary: payload as unknown as Prisma.InputJsonValue }
  });

  return payload;
}
