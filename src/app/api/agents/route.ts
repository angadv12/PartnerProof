/**
 * Agent capability discovery: which providers are usable and which workflows exist.
 *
 * Drives the run form. Unconfigured providers are returned too, with the reason
 * — the UI shows them disabled rather than pretending they do not exist.
 */
import { NextResponse } from "next/server";

import { describeProviders } from "@/lib/agents/providers";
import { DEFAULT_WORKFLOW_ID, WORKFLOWS } from "@/lib/agents/workflows";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    providers: describeProviders(),
    defaultWorkflowId: DEFAULT_WORKFLOW_ID,
    workflows: WORKFLOWS.map((w) => ({
      id: w.id,
      label: w.label,
      description: w.description,
      samplePrompt: w.samplePrompt,
      expectsAttachment: w.expectsAttachment ?? false,
      toolNames: w.toolNames,
      maxSteps: w.maxSteps,
    })),
  });
}
