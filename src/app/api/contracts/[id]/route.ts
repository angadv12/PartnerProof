import { NextResponse } from "next/server";
import { getContractDetail } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const contract = getContractDetail(params.id);
  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }
  return NextResponse.json(contract);
}
