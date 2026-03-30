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
import { loginUser, registerUser } from "./emailAuth";
import { sdk } from "./sdk";
import * as db from "../db";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";

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
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback (kept for legacy, not used in ERP mode)
  registerOAuthRoutes(app);

  // ── Email Register ────────────────────────────────────────────────────────
  app.post("/api/auth/email-register", async (req: any, res: any) => {
    const { email, password, name } = req.body ?? {};
    try {
      const user = registerUser(String(email ?? ""), String(password ?? ""), String(name ?? ""));

      await db.upsertUser({
        openId: `email_${user.id}`,
        name: user.name,
        email: user.email,
        loginMethod: "email",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(`email_${user.id}`, {
        name: user.name,
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return res.json({ success: true, user: { email: user.email, name: user.name } });
    } catch (err: any) {
      return res.status(400).json({ error: err.message ?? "注册失败" });
    }
  });

  // ── Email Login ───────────────────────────────────────────────────────────
  app.post("/api/auth/email-login", async (req: any, res: any) => {
    const { email, password } = req.body ?? {};
    try {
      const user = loginUser(String(email ?? ""), String(password ?? ""));

      await db.upsertUser({
        openId: `email_${user.id}`,
        name: user.name,
        email: user.email,
        loginMethod: "email",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(`email_${user.id}`, {
        name: user.name,
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return res.json({ success: true, user: { email: user.email, name: user.name } });
    } catch (err: any) {
      return res.status(401).json({ error: err.message ?? "登录失败" });
    }
  });

  // ── Logout ────────────────────────────────────────────────────────────────
  app.post("/api/auth/logout", (req: any, res: any) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return res.json({ success: true });
  });

  // File upload endpoint
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });
  app.post("/api/upload/image", upload.single("image"), async (req: any, res: any) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file" });
      const ext = req.file.originalname.split(".").pop() || "png";
      const key = `design-reviews/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { url } = await storagePut(key, req.file.buffer, req.file.mimetype);
      res.json({ url });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Audio upload endpoint
  const audioUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });
  app.post("/api/upload/audio", audioUpload.single("audio"), async (req: any, res: any) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file" });
      const ext = req.file.originalname.split(".").pop() || "mp3";
      const key = `meeting-audio/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { url } = await storagePut(key, req.file.buffer, req.file.mimetype);
      res.json({ url });
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
