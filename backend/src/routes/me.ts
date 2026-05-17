import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const meRouter = Router();

meRouter.get("/auth/me", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    return res.json({ user });
  } catch (err) {
    return next(err);
  }
});
