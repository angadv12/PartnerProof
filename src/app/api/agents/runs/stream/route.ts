/**
 * Start a run and stream its events as they happen (SSE).
 *
 * The agent loop is long — several model round trips plus tool calls — so the
 * UI needs to show tool activity as it lands rather than a spinner. Events are
 * pushed straight from the runtime's `onEvent` hook; the run is persisted once
 * at the end.
 */
import { BadRequestError, parseStartRunInput } from "@/lib/agents/request";
import { runAgent } from "@/lib/agents/runtime";
import { saveRun } from "@/lib/agents/store";
import type { RunEvent } from "@/lib/agents/types";
import { errorMessage } from "@/lib/utils";

export const dynamic = "force-dynamic";

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request) {
  let input;
  try {
    input = parseStartRunInput(await req.json());
  } catch (err) {
    // Validation and malformed-JSON failures are both the caller's fault.
    return Response.json({ error: errorMessage(err) }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(sse(event, data)));
        } catch {
          // Client hung up mid-run; stop trying to write.
          closed = true;
        }
      };

      try {
        const run = await runAgent(input, {
          signal: req.signal,
          onEvent: (event: RunEvent) => send("event", event),
        });
        saveRun(run);
        send("run", run);
      } catch (err) {
        send("error", { message: errorMessage(err) });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          // Already closed by the client disconnecting.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Stops nginx and similar proxies from buffering the whole response.
      "X-Accel-Buffering": "no",
    },
  });
}
