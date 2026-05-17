import path from "node:path";
import os from "node:os";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Caché fuera de node_modules: en OneDrive/Windows a veces falla EPERM al hacer rmdir
 * sobre `node_modules/.vite/deps`. Usar %TEMP% evita ese bloqueo.
 */
const viteCacheDir = path.join(os.tmpdir(), "vite-cache-greenlab-frontend");

export default defineConfig({
  cacheDir: viteCacheDir,
  plugins: [react()],
  server: {
    port: 5175
  }
});

