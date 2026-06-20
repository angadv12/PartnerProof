import { NextResponse } from "next/server";
import { askAssistant } from "@/lib/services";
import { errorMessage } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { query?: string };
    if (!body?.query?.trim()) {
      return NextResponse.json({ error: "Ask a question to get started." }, { status: 400 });
    }
    return NextResponse.json(await askAssistant(body.query));
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
