import { NextResponse } from "next/server";
import { generateRecap } from "@/lib/services";
import { errorMessage } from "@/lib/utils";

export const dynamic = "force-dynamic";

function handle(id: string) {
  const recap = generateRecap(id);
  if (!recap) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }
  return NextResponse.json(recap);
}

// POST generates (and persists) a fresh recap; GET returns one too for convenience.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    return handle(params.id);
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(params.id);
}
