import { NextResponse } from "next/server";
import { listDeliverables } from "@/lib/services";
import type {
  Category,
  DeliverableFilters,
  DeliverableStatus,
  Priority,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const filters: DeliverableFilters = {
    status: (searchParams.get("status") as DeliverableStatus) || undefined,
    category: (searchParams.get("category") as Category) || undefined,
    sponsorId: searchParams.get("sponsorId") || undefined,
    contractId: searchParams.get("contractId") || undefined,
    priority: (searchParams.get("priority") as Priority) || undefined,
    search: searchParams.get("search") || undefined,
  };
  return NextResponse.json(await listDeliverables(filters));
}
