import { NextResponse } from "next/server";
import { updateDeliverable } from "@/lib/services";
import type { UpdateDeliverableInput } from "@/lib/types";
import { errorMessage } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as UpdateDeliverableInput;
    const updated = updateDeliverable(id, body);
    if (!updated) {
      return NextResponse.json({ error: "Deliverable not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
