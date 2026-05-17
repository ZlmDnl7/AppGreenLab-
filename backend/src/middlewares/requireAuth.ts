import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) {
    return res.status(401).json({ error: "No autenticado" });
  }
  const token = header.slice("bearer ".length).trim();
  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true }
    });
    if (!user) return res.status(401).json({ error: "Usuario no encontrado" });
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}
