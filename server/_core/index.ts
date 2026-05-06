import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { storagePut } from "./storage";
import multer from "multer";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { runFollowBuildersIngest } from "./followBuildersIngest";
import { loadStoreFromDisk, startAutoSave, saveStoreToDisk } from "./persistence";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // ── Load persisted store from disk before any router/handler reads ────────
  const loaded = loadStoreFromDisk();
  if (loaded.ok) {
    console.log(`[persistence] Loaded ${loaded.size} items from data/demo-store.json`);
  } else if (loaded.error) {
    console.warn(`[persistence] Could not load store: ${loaded.error}`);
  } else {
    console.log("[persistence] No existing store file, starting fresh");
  }
  startAutoSave();

  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback (optional; app uses anonymous guest by default)
  registerOAuthRoutes(app);

  // ── Logout (clears cookie; next request still gets guest user) ───────────
  app.post("/api/auth/logout", (req: any, res: any) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return res.json({ success: true });
  });

  // 每日将 follow-builders 中央 feed 摘要为 10 条中文知识条目（需配置 KNOWLEDGE_INGEST_SECRET）
  app.post("/api/ingest/follow-builders", async (req: any, res: any) => {
    try {
      const secret = ENV.knowledgeIngestSecret;
      if (!secret) {
        return res.status(503).json({ error: "KNOWLEDGE_INGEST_SECRET 未配置" });
      }
      const auth = req.headers.authorization ?? "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      if (token !== secret) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const result = await runFollowBuildersIngest();
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "ingest failed" });
    }
  });

  // File upload endpoint (image)
  // IMPORTANT: multer may throw BEFORE our handler runs. Wrap it to always return JSON.
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 32 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype?.startsWith("image/")) return cb(new Error("Only image files are allowed"));
      cb(null, true);
    },
  });

  app.post("/api/upload/image", (req: any, res: any) => {
    upload.single("image")(req, res, async (err: any) => {
      try {
        if (err) {
          const msg = err?.message || "Upload failed";
          const status = err?.code === "LIMIT_FILE_SIZE" ? 413 : 400;
          return res.status(status).json({ error: msg });
        }
        if (!req.file) return res.status(400).json({ error: "No file" });

        const ext = req.file.originalname.split(".").pop() || "png";
        const key = `design-reviews/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        try {
          const { url } = await storagePut(key, req.file.buffer, req.file.mimetype);
          return res.json({ url });
        } catch {
          // Local preview fallback: when storage proxy (forge) isn't configured.
          const base64 = req.file.buffer.toString("base64");
          const url = `data:${req.file.mimetype};base64,${base64}`;
          return res.json({ url });
        }
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Upload failed" });
      }
    });
  });

  // Audio upload endpoint
  const audioUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });
  app.post("/api/upload/audio", audioUpload.single("audio"), async (req: any, res: any) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file" });
      const ext = req.file.originalname.split(".").pop() || "mp3";
      const key = `meeting-audio/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      try {
        const { url } = await storagePut(key, req.file.buffer, req.file.mimetype);
        res.json({ url });
      } catch {
        // Local preview fallback: when storage proxy (forge) isn't configured.
        const base64 = req.file.buffer.toString("base64");
        const url = `data:${req.file.mimetype};base64,${base64}`;
        res.json({ url });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
