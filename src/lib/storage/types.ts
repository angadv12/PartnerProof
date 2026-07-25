/**
 * Storage abstraction for uploaded files.
 *
 * Two drivers: S3 for real deployments, local disk so the app still runs with no
 * cloud credentials. Callers deal only in opaque keys — never a filesystem path
 * and never a bucket URL — so swapping drivers touches nothing above this layer.
 */

export type StorageKind = "s3" | "local";

export interface StoredFile {
  body: Buffer;
  contentType: string;
}

export interface PresignedUpload {
  /** Pre-authorized PUT target. Expires. */
  url: string;
  /** Headers the client must replay on the PUT for the signature to validate. */
  headers: Record<string, string>;
  key: string;
  expiresInSeconds: number;
}

export interface Storage {
  readonly kind: StorageKind;

  put(key: string, body: Buffer, contentType: string): Promise<void>;

  /** Returns null when the object does not exist. */
  get(key: string): Promise<StoredFile | null>;

  delete(key: string): Promise<void>;

  /**
   * A URL the browser can fetch the object from, or null when the object must
   * be streamed through the app instead. S3 returns a short-lived presigned GET
   * so the bucket can stay private.
   */
  signedReadUrl(key: string): Promise<string | null>;

  /**
   * Pre-authorize a direct browser upload, bypassing the app server. Null when
   * the driver cannot do this (local disk), in which case callers POST the bytes
   * to the app instead.
   */
  presignUpload(key: string, contentType: string): Promise<PresignedUpload | null>;
}

/**
 * Normalize a caller-supplied key.
 *
 * Rejects absolute paths and any `..` segment so a key can never escape its
 * prefix — this is the guard for both the S3 key space and the local disk root.
 */
export function sanitizeKey(key: string): string {
  const trimmed = key.replace(/^\/+/, "");
  const segments = trimmed.split("/").filter((s) => s.length > 0 && s !== ".");
  if (segments.length === 0) {
    throw new Error("Storage key is empty");
  }
  if (segments.some((s) => s === "..")) {
    throw new Error(`Invalid storage key: ${key}`);
  }
  return segments.join("/");
}
