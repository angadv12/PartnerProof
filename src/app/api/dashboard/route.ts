import { NextResponse } from "next/server";
import { getDashboard } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getDashboard());
}
