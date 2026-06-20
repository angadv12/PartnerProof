import { NextResponse } from "next/server";
import { createContract, listContracts } from "@/lib/services";
import type { CreateContractInput } from "@/lib/types";
import { errorMessage } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(listContracts());
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateContractInput;

    if (!body?.sponsorName?.trim() || !body?.name?.trim() || !body?.season?.trim()) {
      return NextResponse.json(
        { error: "sponsorName, name, and season are required." },
        { status: 400 }
      );
    }
    if (!Array.isArray(body.deliverables) || body.deliverables.length === 0) {
      return NextResponse.json(
        { error: "At least one deliverable is required." },
        { status: 400 }
      );
    }

    return NextResponse.json(createContract(body), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
