import { NextResponse } from "next/server";
import { resetData } from "@/lib/services";

export const dynamic = "force-dynamic";

// Restore the seed dataset — convenient when running a live demo.
export async function POST() {
  resetData();
  return NextResponse.json({ ok: true });
}
