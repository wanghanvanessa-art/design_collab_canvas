/**
 * Email Authentication Module
 * 使用邮箱 + 密码登录，账号数据存储在本地 JSON 文件中。
 * 无需外部数据库即可运行；如已配置 DATABASE_URL 则同步写入 DB。
 */

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
const USERS_FILE = join(DATA_DIR, "email-users.json");

interface StoredUser {
  id: string;         // uuid-like
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function hashPassword(password: string, salt: string): string {
  return createHash("sha256").update(salt + password).digest("hex");
}

function verifyPassword(password: string, salt: string, hash: string): boolean {
  const computed = hashPassword(password, salt);
  // constant-time compare
  try {
    return timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

function loadUsers(): StoredUser[] {
  if (!existsSync(USERS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(USERS_FILE, "utf-8")) as StoredUser[];
  } catch {
    return [];
  }
}

function saveUsers(users: StoredUser[]) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

// ── public API ────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

/**
 * 注册新账号。邮箱已存在时抛出错误。
 */
export function registerUser(email: string, password: string, name: string): AuthUser {
  const emailLower = email.trim().toLowerCase();

  if (!emailLower || !password || !name.trim()) {
    throw new Error("邮箱、密码和姓名不能为空");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
    throw new Error("邮箱格式不正确");
  }
  if (password.length < 6) {
    throw new Error("密码至少 6 位");
  }

  const users = loadUsers();
  if (users.find(u => u.email === emailLower)) {
    throw new Error("该邮箱已注册");
  }

  const salt = randomBytes(16).toString("hex");
  const newUser: StoredUser = {
    id: randomBytes(12).toString("hex"),
    email: emailLower,
    name: name.trim(),
    passwordHash: hashPassword(password, salt),
    salt,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveUsers(users);

  return { id: newUser.id, email: newUser.email, name: newUser.name };
}

/**
 * 用邮箱 + 密码登录。验证失败时抛出错误。
 */
export function loginUser(email: string, password: string): AuthUser {
  const emailLower = email.trim().toLowerCase();

  if (!emailLower || !password) {
    throw new Error("邮箱和密码不能为空");
  }

  const users = loadUsers();
  const user = users.find(u => u.email === emailLower);

  if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
    throw new Error("邮箱或密码错误");
  }

  return { id: user.id, email: user.email, name: user.name };
}