/**
 * Local-disk storage driver.
 *
 * The zero-config default so the app runs with no cloud credentials. Files land
 * under `.data/uploads`, keyed exactly as they would be in S3, and are served
 * back through /api/files/[...path].
 */
import fs from "node:fs";
import path from "node:path";

import { UPLOADS_DIR } from "../db";
import { sanitizeKey } from "./types";
import type { PresignedUpload, Storage, StoredFile } from "./types";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".json": "application/json",
};

export function contentTypeForName(name: string): string {
  return CONTENT_TYPES[path.extname(name).toLowerCase()] ?? "application/octet-stream";
}

export class LocalStorage implements Storage {
  readonly kind = "local" as const;

  /**
   * Resolve a key to an absolute path, then verify the result is still inside
   * the uploads root. `sanitizeKey` already blocks `..`, but re-checking after
   * resolution also catches a symlinked root.
   */
  private resolve(key: string): string {
    const safeKey = sanitizeKey(key);
    const root = path.resolve(UPLOADS_DIR);
    const full = path.resolve(root, safeKey);
    if (full !== root && !full.startsWith(root + path.sep)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return full;
  }

  async put(key: string, body: Buffer, _contentType: string): Promise<void> {
    const full = this.resolve(key);
    await fs.promises.mkdir(path.dirname(full), { recursive: true });
    await fs.promises.writeFile(full, body);
  }

  async get(key: string): Promise<StoredFile | null> {
    const full = this.resolve(key);
    try {
      const body = await fs.promises.readFile(full);
      return { body, contentType: contentTypeForName(full) };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    const full = this.resolve(key);
    await fs.promises.rm(full, { force: true });
  }

  /** Nothing to sign — the app streams these itself. */
  async signedReadUrl(): Promise<string | null> {
    return null;
  }

  /** Local disk has no direct-upload path; callers POST to the app. */
  async presignUpload(): Promise<PresignedUpload | null> {
    return null;
  }
}
