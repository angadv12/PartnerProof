/**
 * Start an agent run (POST) and list recent runs (GET).
 *
 * POST blocks until the run finishes and returns the whole record. For live
 * progress use /api/agents/runs/stream instead.
 */
import { NextResponse } from "next/server";

import { BadRequestError, parseStartRunInput } from "@/lib/agents/request";
import { runAgent } from "@/lib/agents/runtime";
import { listRuns, saveRun } from "@/lib/agents/store";
import { errorMessage } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 25;
  return NextResponse.json(listRuns(limit));
}

export async function POST(req: Request) {
  let input;
  try {
    input = parseStartRunInput(await req.json());
  } catch (err) {
    // A malformed JSON body lands here too, and is equally the caller's fault.
    return NextResponse.json({ error: errorMessage(err) }, { status: 400 });
  }

  try {
    const run = await runAgent(input, { signal: req.signal });
    saveRun(run);
    return NextResponse.json(run, { status: 201 });
  } catch (err) {
    // runAgent only throws for an unusable request (bad workflow, unconfigured
    // provider); in-run failures come back on the run record itself.
    return NextResponse.json({ error: errorMessage(err) }, { status: 400 });
  }
}
