/**
 * Storage driver selection.
 *
 * S3 when a bucket is configured (or STORAGE_DRIVER=s3), local disk otherwise.
 * Selecting s3 explicitly without a bucket is a hard error rather than a silent
 * downgrade — quietly writing production uploads to a container's local disk is
 * how files get lost.
 */
import { LocalStorage, contentTypeForName } from "./local";
import { S3Storage, s3Bucket } from "./s3";
import type { Storage } from "./types";

export type { PresignedUpload, Storage, StorageKind, StoredFile } from "./types";
export { sanitizeKey } from "./types";
export { contentTypeForName };

/** Key prefixes. Grouping by purpose keeps bucket lifecycle rules simple. */
export const EVIDENCE_PREFIX = "evidence";
export const AGENT_UPLOAD_PREFIX = "agent-uploads";

let cached: Storage | null = null;

export function getStorage(): Storage {
  if (cached) return cached;

  const driver = process.env.STORAGE_DRIVER;
  const bucket = s3Bucket();

  if (driver === "local") {
    cached = new LocalStorage();
  } else if (driver === "s3") {
    if (!bucket) {
      throw new Error("STORAGE_DRIVER=s3 requires S3_BUCKET to be set.");
    }
    cached = new S3Storage(bucket);
  } else {
    cached = bucket ? new S3Storage(bucket) : new LocalStorage();
  }

  return cached;
}

/** Test seam — drops the memoized driver so env changes take effect. */
export function resetStorage(): void {
  cached = null;
}

/** The stable app URL for a stored object. Safe to persist; never expires. */
export function storageUrl(key: string): string {
  return `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;
}
