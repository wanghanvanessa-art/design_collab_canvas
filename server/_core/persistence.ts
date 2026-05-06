import fs from "node:fs";
import path from "node:path";
import { demoStore } from "./inMemoryStore";

const DATA_DIR = path.resolve(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "demo-store.json");
const STORE_BACKUP = path.join(DATA_DIR, "demo-store.backup.json");

/** 自动快照间隔（毫秒），默认 5 秒 */
const AUTOSAVE_INTERVAL_MS = 5_000;

let lastSnapshot = "";
let autosaveTimer: NodeJS.Timeout | null = null;
let isShuttingDown = false;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/** 同步落盘：先写临时文件，再原子替换，避免写一半崩溃损坏文件 */
function writeAtomic(filePath: string, content: string) {
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, content, "utf-8");
  fs.renameSync(tmp, filePath);
}

/** 从磁盘加载快照到 demoStore；首次启动或文件损坏时自动跳过 */
export function loadStoreFromDisk(): { ok: boolean; size: number; error?: string } {
  try {
    if (!fs.existsSync(STORE_FILE)) {
      return { ok: false, size: 0 };
    }
    const raw = fs.readFileSync(STORE_FILE, "utf-8");
    if (!raw.trim()) return { ok: false, size: 0 };
    const data = JSON.parse(raw);
    demoStore.fromJSON(data);
    lastSnapshot = raw;
    return { ok: true, size: demoStore.totalItems() };
  } catch (err: any) {
    // 损坏文件 → 尝试备份
    try {
      if (fs.existsSync(STORE_BACKUP)) {
        const backup = fs.readFileSync(STORE_BACKUP, "utf-8");
        const data = JSON.parse(backup);
        demoStore.fromJSON(data);
        lastSnapshot = backup;
        return { ok: true, size: demoStore.totalItems(), error: "Restored from backup" };
      }
    } catch {/* ignore */}
    return { ok: false, size: 0, error: err?.message || String(err) };
  }
}

/** 立即同步保存（仅在数据变化时写盘） */
export function saveStoreToDisk(force = false): boolean {
  try {
    ensureDir();
    const snapshot = JSON.stringify(demoStore.toJSON(), null, 2);
    if (!force && snapshot === lastSnapshot) return false;
    // 在覆盖前先把当前文件复制到 backup（保留上一份完好版本）
    if (fs.existsSync(STORE_FILE)) {
      try { fs.copyFileSync(STORE_FILE, STORE_BACKUP); } catch {/* ignore */}
    }
    writeAtomic(STORE_FILE, snapshot);
    lastSnapshot = snapshot;
    return true;
  } catch (err) {
    console.error("[persistence] save failed:", err);
    return false;
  }
}

/** 启动周期快照 */
export function startAutoSave() {
  if (autosaveTimer) return;
  autosaveTimer = setInterval(() => {
    if (isShuttingDown) return;
    saveStoreToDisk(false);
  }, AUTOSAVE_INTERVAL_MS);
  // unref 让定时器不阻塞进程退出
  autosaveTimer.unref?.();

  // 进程退出钩子：尽力同步落盘
  const flush = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    saveStoreToDisk(true);
  };
  process.on("beforeExit", flush);
  process.on("SIGINT", () => { flush(); process.exit(0); });
  process.on("SIGTERM", () => { flush(); process.exit(0); });
  process.on("SIGHUP", () => { flush(); process.exit(0); });
}