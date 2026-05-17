import dns from "node:dns";
import express from "express";

/** Render no tiene ruta IPv6; Gmail por AAAA → ENETUNREACH al enviar correo. */
dns.setDefaultResultOrder("ipv4first");
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { env } from "./lib/env.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { experimentsRouter } from "./routes/experiments.js";
import { meRouter } from "./routes/me.js";
import { projectsRouter } from "./routes/projects.js";
import { adminRouter } from "./routes/admin.js";
import { invitationsPublicRouter, invitationsRouter } from "./routes/invitations.js";
import { requireAuth } from "./middlewares/requireAuth.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();

app.use(
  cors({
    origin: env.APP_ORIGIN,
    credentials: false
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

// Archivos subidos (Sprint 1)
app.use("/uploads", express.static(path.resolve(process.cwd(), env.UPLOAD_DIR)));

app.use(healthRouter);
app.use(authRouter);
app.use(invitationsPublicRouter);

app.use(requireAuth);
app.use(meRouter);
app.use(invitationsRouter);
app.use(projectsRouter);
app.use(adminRouter);
app.use(experimentsRouter);

app.use(errorHandler);

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API GreenLab lista en http://localhost:${env.PORT}`);
});

