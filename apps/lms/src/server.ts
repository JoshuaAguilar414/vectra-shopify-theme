import "dotenv/config";
import cors from "cors";
import express from "express";
import { storageHealth } from "@/lib/course-storage";
import { getDb } from "@/db";
import { proxyApiRouter, runRemindersJob } from "@/routes/proxy-api";

const app = express();
const port = Number(process.env.PORT || 3456);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", async (_req, res) => {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    const storage = await storageHealth();
    res.json({
      ok: true,
      service: "vectra-shopify-lms-app",
      mongo: true,
      storage,
      bypass: process.env.LMS_DEV_BYPASS === "true"
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      error: error instanceof Error ? error.message : "Health check failed"
    });
  }
});

app.post("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/jobs/reminders", runRemindersJob);

// App proxy mount — Shopify maps /apps/lms/* → /proxy/*
app.use("/proxy", proxyApiRouter);

// Local convenience alias matching theme client paths (/apps/lms/api/...)
app.use("/apps/lms", proxyApiRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
});

app.listen(port, () => {
  console.log(`VECTRA Academy LMS listening on http://localhost:${port}`);
  console.log(`Health: http://localhost:${port}/health`);
  console.log(`Proxy API: http://localhost:${port}/proxy/api/...`);
  if (process.env.LMS_DEV_BYPASS === "true") {
    console.log("LMS_DEV_BYPASS enabled — send X-LMS-Shop and optional X-LMS-Staff / X-LMS-Customer-Id");
  }
});
