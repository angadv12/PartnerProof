/**
 * Upload a file for an agent run.
 *
 * Two paths:
 *  - POST with a multipart body → the app writes the bytes to storage. Works on
 *    every driver, and is the only option on local disk.
 *  - POST with `?presign=1` and a JSON body → returns a presigned S3 PUT so the
 *    browser uploads directly and large files never transit the app server.
 *    Returns 501 on the local driver, which cannot presign.
 */
import { NextResponse } from "next/server";

import {
  AGENT_UPLOAD_PREFIX,
  contentTypeForName,
  getStorage,
} from "@/lib/storage";
import type { RunAttachment } from "@/lib/agents/types";
import { errorMessage, generateId } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Ceiling for the proxied path; the presigned path is bounded by the bucket policy. */
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/**
 * Build a collision-proof key that still ends in the original extension, so the
 * content type stays inferable and the name stays recognizable in the UI.
 */
function buildKey(fileName: string): string {
  const cleaned = fileName.replace(/[^A-Za-z0-9._-]/g, "_").slice(-80);
  return `${AGENT_UPLOAD_PREFIX}/${generateId("up")}-${cleaned || "file"}`;
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const wantsPresign = searchParams.get("presign") === "1";

  try {
    const storage = getStorage();

    if (wantsPresign) {
      const body = (await req.json()) as {
        fileName?: unknown;
        contentType?: unknown;
        size?: unknown;
      };
      const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
      if (!fileName) {
        return NextResponse.json({ error: '"fileName" is required.' }, { status: 400 });
      }

      // The size is required and gets signed into the URL, so the direct-upload
      // path cannot exceed the limit the proxied path enforces.
      const size = typeof body.size === "number" ? body.size : Number(body.size);
      if (!Number.isInteger(size) || size <= 0) {
        return NextResponse.json(
          { error: '"size" is required and must be the exact byte length of the file.' },
          { status: 400 },
        );
      }
      if (size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: `File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB limit.` },
          { status: 413 },
        );
      }

      const contentType =
        typeof body.contentType === "string" && body.contentType.trim()
          ? body.contentType.trim()
          : contentTypeForName(fileName);

      const presigned = await storage.presignUpload(buildKey(fileName), contentType, size);
      if (!presigned) {
        return NextResponse.json(
          {
            error:
              "Direct uploads require S3. Configure S3_BUCKET, or POST the file to this endpoint instead.",
          },
          { status: 501 },
        );
      }
      return NextResponse.json({ ...presigned, fileName, contentType, size });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: 'A "file" part is required.' }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "File is empty." }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB limit.` },
        { status: 413 },
      );
    }

    const contentType = file.type || contentTypeForName(file.name);
    const key = buildKey(file.name);
    await storage.put(key, Buffer.from(await file.arrayBuffer()), contentType);

    const attachment: RunAttachment = {
      key,
      fileName: file.name,
      contentType,
      size: file.size,
    };
    return NextResponse.json(attachment, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
