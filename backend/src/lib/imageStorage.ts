import fs from "node:fs";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";
import { env } from "./env.js";

export function isCloudStorageConfigured(): boolean {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

function configureCloudinary(): void {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET
  });
}

/** URL para mostrar la imagen (local /uploads/... o URL absoluta de Cloudinary). */
export function imagePublicUrl(storagePath: string, apiBaseUrl?: string): string {
  if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
    return storagePath;
  }
  const base = (apiBaseUrl ?? "").replace(/\/$/, "");
  return `${base}/uploads/${storagePath}`;
}

export async function uploadExperimentImage(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<{ storagePath: string }> {
  if (!isCloudStorageConfigured()) {
    throw new Error("Cloudinary no configurado");
  }
  configureCloudinary();
  const safe = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const result = await cloudinary.uploader.upload(
    `data:${mimeType};base64,${buffer.toString("base64")}`,
    {
      folder: "greenlab",
      public_id: `${Date.now()}_${safe.replace(/\.[^.]+$/, "")}`,
      resource_type: "image"
    }
  );
  return { storagePath: result.secure_url };
}

export function saveExperimentImageToDisk(
  uploadDirAbs: string,
  buffer: Buffer,
  originalName: string
): { storagePath: string } {
  const safe = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}_${safe}`;
  fs.mkdirSync(uploadDirAbs, { recursive: true });
  fs.writeFileSync(path.join(uploadDirAbs, filename), buffer);
  return { storagePath: filename };
}
