/**
 * Tiny file-backed JSON data store.
 *
 * This is intentionally minimal: it persists the whole database to `.data/db.json`
 * so the demo survives restarts without any native dependencies or a running
 * database server. The access pattern (getDb / saveDb / withDb) mirrors a
 * repository, so swapping in Prisma + Postgres later is a localized change.
 *
 * Server-only: never import this from a client component.
 */
import fs from "node:fs";
import path from "node:path";
import { createSeedData } from "./seed-data";
import type { Database } from "./types";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "db.json");

/** Where uploaded evidence files are written (served via /api/files/[name]). */
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/** Overwrite the store with a fresh copy of the seed data. */
export function resetDb(): Database {
  ensureDirs();
  const data = createSeedData();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
  return data;
}

/** Read the current database, seeding on first run or after corruption. */
export function getDb(): Database {
  ensureDirs();
  if (!fs.existsSync(DB_PATH)) {
    return resetDb();
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as Database;
  } catch {
    // Never hard-fail the app on a corrupt file — rebuild from seed.
    return resetDb();
  }
}

export function saveDb(db: Database): void {
  ensureDirs();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

/** Read, mutate, and persist in a single call. Returns whatever `fn` returns. */
export function withDb<T>(fn: (db: Database) => T): T {
  const db = getDb();
  const result = fn(db);
  saveDb(db);
  return result;
}
