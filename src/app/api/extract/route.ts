import { NextResponse } from "next/server";
import { extractDeliverables } from "@/lib/services";
import { errorMessage } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      text?: string;
      sponsorName?: string;
      season?: string;
    };
    if (!body?.text?.trim()) {
      return NextResponse.json(
        { error: "Provide contract text to extract from." },
        { status: 400 }
      );
    }
    const deliverables = await extractDeliverables(body.text, {
      sponsorName: body.sponsorName,
      season: body.season,
    });
    return NextResponse.json(deliverables);
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
