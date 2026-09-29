import express from "express";
import type { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rateLimit } from "express-rate-limit";
import verifyRoute from "./routes/verify.routes.js";
import demoRoute from "./routes/demo.routes.js";
import { isDemoModeEnabled } from "./demo/offlineTransport.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, "..", "public");

const app: Express = express();

// Behind the preview proxy / a reverse proxy, so client IPs are forwarded.
app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 1));

app.use(express.json({ limit: "100kb" }));
app.use(cors());

// Upstream calls are slow (multiple bank round trips), so the limiter is generous.
const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED !== "false";
if (rateLimitEnabled) {
  app.use(
    "/api/",
    rateLimit({
      windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
      limit: Number(process.env.RATE_LIMIT_MAX ?? 300),
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: "Too many verification requests. Please slow down." },
    }),
  );
}

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    demoMode: isDemoModeEnabled(),
    rateLimitEnabled,
    uptimeSeconds: Math.round(process.uptime()),
  });
});

app.use("/api/verify", verifyRoute);
app.use("/api/demo", demoRoute);

// Dashboard (static). Serves public/index.html at "/".
app.use(express.static(publicDir));

app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// Final error handler: never leak a stack trace to the client.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({ error: message });
});

const PORT = Number(process.env.PORT ?? 5000);

app.listen(PORT, "0.0.0.0", () => {
  const demo = isDemoModeEnabled();
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Dashboard:  http://localhost:${PORT}/`);
  console.log(`Health:     http://localhost:${PORT}/health`);
  console.log(
    `Rate limit: ${rateLimitEnabled ? `enabled (${process.env.RATE_LIMIT_MAX ?? 300} / 15 min)` : "disabled"}`,
  );
  if (demo) {
    console.log("");
    console.log("  ******************************************************");
    console.log("  * DEMO MODE ON — receipts resolve to SYNTHETIC data. *");
    console.log("  * No bank is queried and no receipt is verified.     *");
    console.log("  * Unset DEMO_MODE to verify for real.                *");
    console.log("  ******************************************************");
  }
});
