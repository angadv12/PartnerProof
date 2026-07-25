/**
 * Serve an uploaded file by storage key.
 *
 * Keys are nested (`evidence/ev-abc.png`), so this is a catch-all — which also
 * keeps working for the flat `/api/files/<name>.png` URLs already persisted in
 * existing evidence records.
 *
 * On S3 we redirect to a short-lived presigned URL rather than proxying bytes:
 * the bucket stays private and large files don't tie up a serverless invocation.
 */
import { NextResponse } from "next/server";

import { getStorage } from "@/lib/storage";
import { errorMessage } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;

  // Next already percent-decodes dynamic segments. Decoding again would corrupt
  // a key containing a literal `%25` and would throw on a malformed sequence;
  // `sanitizeKey` in the storage layer is what rejects traversal.
  const key = segments.join("/");

  try {
    const storage = getStorage();

    const redirectUrl = await storage.signedReadUrl(key);
    if (redirectUrl) {
      return NextResponse.redirect(redirectUrl, 302);
    }

    const file = await storage.get(key);
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(file.body), {
      headers: {
        "Content-Type": file.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 400 });
  }
}
