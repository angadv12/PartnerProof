/**
 * End-to-end smoke test for the agent runtime.
 *
 * Stands up a fake OpenAI-compatible server, points the `local` provider at it,
 * and drives a real run: parallel tool calls -> tool results -> final answer.
 * Exercises the loop, the OpenAI-compatible adapter, the tool registry, and
 * system-prompt injection without touching a paid API.
 *
 *   npm run smoke:agent
 */
import assert from "node:assert";
import http from "node:http";

import { runAgent } from "../src/lib/agents/runtime";
import { PLATFORM_SYSTEM_PROMPT } from "../src/lib/agents/system-prompt";
import { findUnknownToolNames } from "../src/lib/agents/workflows";

interface ChatBody {
  messages: { role: string; content: unknown; tool_calls?: unknown[] }[];
}

async function main() {
  const seenRequests: ChatBody[] = [];
  let turn = 0;

  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      seenRequests.push(JSON.parse(raw) as ChatBody);
      turn += 1;

      // Turn 1 requests two tools at once — one real, one invented, to prove a
      // hallucinated tool name is recoverable. Turn 2 answers.
      const message =
        turn === 1
          ? {
              role: "assistant",
              content: "Looking that up.",
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: {
                    name: "search_deliverables",
                    // Lowercase enum on purpose: the coercion layer must fix it.
                    arguments: JSON.stringify({ status: "at risk" }),
                  },
                },
                {
                  id: "call_2",
                  type: "function",
                  function: { name: "no_such_tool", arguments: "{}" },
                },
              ],
            }
          : { role: "assistant", content: "3 obligations are at risk." };

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id: "chatcmpl-smoke",
          choices: [
            { index: 0, message, finish_reason: turn === 1 ? "tool_calls" : "stop" },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 20 },
        }),
      );
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };

  process.env.LOCAL_MODEL_BASE_URL = `http://127.0.0.1:${port}/v1`;
  process.env.LOCAL_MODEL = "stub-model";
  process.env.STORAGE_DRIVER = "local";

  try {
    // Every workflow must reference tools that actually exist.
    assert.deepStrictEqual(
      findUnknownToolNames(),
      [],
      "a workflow references an unknown tool",
    );

    const events: string[] = [];
    const run = await runAgent(
      { workflowId: "partnership-analyst", input: "What is at risk?", provider: "local" },
      { onEvent: (event) => events.push(event.type) },
    );

    assert.strictEqual(run.status, "succeeded", `status=${run.status} error=${run.error}`);
    assert.strictEqual(run.output, "3 obligations are at risk.");
    assert.strictEqual(run.steps, 2, "expected two model round trips");
    assert.strictEqual(run.provider, "local");
    assert.strictEqual(run.model, "stub-model");
    assert.strictEqual(run.usage.inputTokens, 200, "usage must accumulate across steps");
    assert.strictEqual(run.usage.outputTokens, 40);

    // The platform prompt is injected on every request, unconditionally.
    for (const request of seenRequests) {
      const system = request.messages[0];
      assert.strictEqual(system.role, "system");
      assert.ok(
        String(system.content).startsWith(PLATFORM_SYSTEM_PROMPT),
        "platform system prompt missing or not first",
      );
    }

    // Round two must replay the assistant tool_calls turn plus both results.
    const second = seenRequests[1];
    const assistantTurn = second.messages.find((m) => m.role === "assistant");
    assert.strictEqual(assistantTurn?.tool_calls?.length, 2, "tool_calls not replayed");

    const toolTurns = second.messages.filter((m) => m.role === "tool");
    assert.strictEqual(toolTurns.length, 2, "every tool call needs a result");

    assert.ok(
      toolTurns.some((m) => String(m.content).includes("no tool named")),
      "an invented tool name should come back as a recoverable error",
    );
    assert.ok(
      toolTurns.some((m) => String(m.content).includes('"rows"')),
      "search_deliverables should have queried the store",
    );

    for (const expected of ["run.started", "tool.called", "tool.result", "run.finished"]) {
      assert.ok(events.includes(expected), `missing event ${expected}`);
    }

    console.log("PASS  agent runtime, provider adapter, tool registry, prompt injection");
    console.log(`      steps=${run.steps} toolResults=${toolTurns.length} events=${events.length}`);
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error("FAIL ", err);
  process.exit(1);
});
