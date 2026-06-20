import { NextResponse } from "next/server";
import { listSponsors } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(listSponsors());
}
