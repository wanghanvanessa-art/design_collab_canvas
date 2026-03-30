import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: { name: string; options: Record<string, unknown> }[] } {
  const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-designer-001",
    email: "designer@example.com",
    name: "测试设计师",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// ─── Auth Tests ───────────────────────────────────────────────────────────────
describe("auth", () => {
  it("me returns null for unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("me returns user info for authenticated users", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.name).toBe("测试设计师");
    expect(result?.email).toBe("designer@example.com");
  });

  it("logout clears session cookie", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: -1 });
  });
});

// ─── Router Structure Tests ───────────────────────────────────────────────────
describe("router structure", () => {
  it("has all required feature routers", () => {
    const router = appRouter as any;
    // Check that all feature routers are registered
    expect(router._def.procedures).toBeDefined();
    const procedures = Object.keys(router._def.procedures);
    // Auth
    expect(procedures.some(p => p.startsWith("auth."))).toBe(true);
    // Feature routers
    expect(procedures.some(p => p.startsWith("meetings."))).toBe(true);
    expect(procedures.some(p => p.startsWith("todos."))).toBe(true);
    expect(procedures.some(p => p.startsWith("ideas."))).toBe(true);
    expect(procedures.some(p => p.startsWith("interviews."))).toBe(true);
    expect(procedures.some(p => p.startsWith("knowledge."))).toBe(true);
    expect(procedures.some(p => p.startsWith("inspiration."))).toBe(true);
    expect(procedures.some(p => p.startsWith("reviews."))).toBe(true);
    expect(procedures.some(p => p.startsWith("blindbox."))).toBe(true);
  });

  it("has todos.stats procedure", () => {
    const router = appRouter as any;
    const procedures = Object.keys(router._def.procedures);
    expect(procedures).toContain("todos.stats");
  });

  it("has meetings.upload procedure", () => {
    const router = appRouter as any;
    const procedures = Object.keys(router._def.procedures);
    expect(procedures).toContain("meetings.upload");
  });

  it("has interviews.analyze procedure", () => {
    const router = appRouter as any;
    const procedures = Object.keys(router._def.procedures);
    expect(procedures).toContain("interviews.analyze");
  });

  it("has inspiration.generateTags procedure", () => {
    const router = appRouter as any;
    const procedures = Object.keys(router._def.procedures);
    expect(procedures).toContain("inspiration.generateTags");
  });

  it("has reviews.upload procedure", () => {
    const router = appRouter as any;
    const procedures = Object.keys(router._def.procedures);
    expect(procedures).toContain("reviews.upload");
  });

  it("has blindbox.draw procedure", () => {
    const router = appRouter as any;
    const procedures = Object.keys(router._def.procedures);
    expect(procedures).toContain("blindbox.draw");
  });
});

// ─── Protected Procedure Tests ────────────────────────────────────────────────
describe("protected procedures", () => {
  it("todos.list throws UNAUTHORIZED for unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.todos.list({})).rejects.toThrow();
  });

  it("ideas.list throws UNAUTHORIZED for unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.ideas.list()).rejects.toThrow();
  });

  it("interviews.list throws UNAUTHORIZED for unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.interviews.list()).rejects.toThrow();
  });

  it("knowledge.list throws UNAUTHORIZED for unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.knowledge.list({})).rejects.toThrow();
  });

  it("inspiration.list throws UNAUTHORIZED for unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.inspiration.list()).rejects.toThrow();
  });

  it("reviews.list throws UNAUTHORIZED for unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.reviews.list()).rejects.toThrow();
  });

  it("blindbox.draw throws UNAUTHORIZED for unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.blindbox.draw()).rejects.toThrow();
  });
});
