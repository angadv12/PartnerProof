/**
 * S3 storage driver.
 *
 * Assumes a private bucket: reads go out as short-lived presigned GET URLs and
 * uploads can be presigned so large files never transit the app server.
 *
 * Config:
 *   S3_BUCKET=partnerproof-uploads
 *   AWS_REGION=us-east-1
 *   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY   # optional; falls back to the
 *                                               # default AWS credential chain
 *   S3_ENDPOINT=https://...                     # optional, for MinIO / R2
 *   S3_FORCE_PATH_STYLE=true                    # optional, required by MinIO
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { sanitizeKey } from "./types";
import type { PresignedUpload, Storage, StoredFile } from "./types";

const READ_URL_TTL_SECONDS = 300;
const UPLOAD_URL_TTL_SECONDS = 900;

export function s3Bucket(): string | undefined {
  return process.env.S3_BUCKET;
}

export class S3Storage implements Storage {
  readonly kind = "s3" as const;

  private readonly bucket: string;
  private client: S3Client | null = null;

  constructor(bucket: string) {
    this.bucket = bucket;
  }

  private getClient(): S3Client {
    if (!this.client) {
      const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
      const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
      this.client = new S3Client({
        region: process.env.AWS_REGION || "us-east-1",
        endpoint: process.env.S3_ENDPOINT || undefined,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
        // Omit `credentials` entirely when unset so the SDK's default chain
        // (instance role, SSO, shared config) takes over.
        ...(accessKeyId && secretAccessKey
          ? { credentials: { accessKeyId, secretAccessKey } }
          : {}),
      });
    }
    return this.client;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: sanitizeKey(key),
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async get(key: string): Promise<StoredFile | null> {
    try {
      const result = await this.getClient().send(
        new GetObjectCommand({ Bucket: this.bucket, Key: sanitizeKey(key) }),
      );
      if (!result.Body) return null;
      const bytes = await result.Body.transformToByteArray();
      return {
        body: Buffer.from(bytes),
        contentType: result.ContentType ?? "application/octet-stream",
      };
    } catch (err) {
      if (err instanceof NoSuchKey) return null;
      // A HEAD-style 404 surfaces as a bare metadata status rather than NoSuchKey.
      const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404) return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    await this.getClient().send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: sanitizeKey(key) }),
    );
  }

  async signedReadUrl(key: string): Promise<string | null> {
    return getSignedUrl(
      this.getClient(),
      new GetObjectCommand({ Bucket: this.bucket, Key: sanitizeKey(key) }),
      { expiresIn: READ_URL_TTL_SECONDS },
    );
  }

  async presignUpload(
    key: string,
    contentType: string,
    contentLength: number,
  ): Promise<PresignedUpload> {
    const safeKey = sanitizeKey(key);
    const url = await getSignedUrl(
      this.getClient(),
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: safeKey,
        ContentType: contentType,
        // Signed, so S3 itself enforces the exact byte count. This is what keeps
        // the direct-upload path inside the same size limit as the proxied one.
        ContentLength: contentLength,
      }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS, signableHeaders: new Set(["content-length", "content-type"]) },
    );
    return {
      url,
      // Both headers are part of the signature; a mismatched PUT is rejected.
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(contentLength),
      },
      key: safeKey,
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    };
  }
}
