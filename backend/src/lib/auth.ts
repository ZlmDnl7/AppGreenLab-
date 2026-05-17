import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "./env.js";

export type JwtPayload = {
  sub: string;
  email: string;
  name: string;
};

export function signAccessToken(payload: JwtPayload): string {
  const expiresIn = env.JWT_EXPIRES_IN as SignOptions["expiresIn"];
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn });
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded !== "object" || decoded === null) throw new Error("Token inválido");
  const { sub, email, name } = decoded as Record<string, unknown>;
  if (typeof sub !== "string" || typeof email !== "string" || typeof name !== "string") {
    throw new Error("Token inválido");
  }
  return { sub, email, name };
}

