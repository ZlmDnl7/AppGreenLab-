import fs from "node:fs";
import path from "node:path";
import { env } from "./env.js";

/** Crea carpetas de SQLite y uploads (necesario con disco persistente en Render). */
export function ensureStorageDirs(): void {
  const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
  fs.mkdirSync(uploadDir, { recursive: true });

  if (!env.DATABASE_URL.startsWith("file:")) return;

  let dbPath = env.DATABASE_URL.replace(/^file:/, "");
  if (!path.isAbsolute(dbPath)) {
    dbPath = path.resolve(process.cwd(), dbPath);
  }
  const dir = path.dirname(dbPath);
  if (dir !== "." && dir !== process.cwd()) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
