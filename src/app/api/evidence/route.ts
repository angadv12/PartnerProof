import { NextResponse } from "next/server";
import { listEvidence, uploadEvidence } from "@/lib/services";
import type { EvidenceType, UploadEvidenceInput } from "@/lib/types";
import { errorMessage } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sponsorId = searchParams.get("sponsorId") || undefined;
  return NextResponse.json(listEvidence(sponsorId));
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const input: UploadEvidenceInput = {
      deliverableId: String(form.get("deliverableId") ?? ""),
      title: String(form.get("title") ?? ""),
      type: (String(form.get("type") ?? "Text Note") as EvidenceType),
      url: form.get("url") ? String(form.get("url")) : undefined,
      description: String(form.get("description") ?? ""),
      activationDate: String(form.get("activationDate") ?? ""),
      uploadedBy: String(form.get("uploadedBy") ?? ""),
    };

    if (!input.deliverableId || !input.title.trim()) {
      return NextResponse.json(
        { error: "A linked deliverable and a title are required." },
        { status: 400 }
      );
    }

    const file = form.get("file");
    if (file && typeof file !== "string") {
      const f = file as File;
      if (f.size > 0) {
        input.fileName = f.name;
        input.fileBuffer = Buffer.from(await f.arrayBuffer());
      }
    }

    const evidence = uploadEvidence(input);
    if (!evidence) {
      return NextResponse.json({ error: "Linked deliverable not found" }, { status: 404 });
    }
    return NextResponse.json(evidence, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
