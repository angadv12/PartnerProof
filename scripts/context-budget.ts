/**
 * Report the fixed context cost of an agent turn per workflow.
 *
 * Useful when picking a context length for a local model: the system prompt and
 * tool schemas are paid on every request, and each tool result adds up to
 * MAX_TOOL_RESULT_CHARS on top.
 *
 *   npm run context:budget
 */
import { buildSystemPrompt } from "../src/lib/agents/system-prompt";
import { resolveTools } from "../src/lib/agents/tools";
import { WORKFLOWS } from "../src/lib/agents/workflows";

/** Rough char/4 estimate — enough to choose between 8k and 32k. */
const estimateTokens = (text: string) => Math.ceil(text.length / 4);

function main() {
  console.log("Fixed per-request context cost (estimated tokens)\n");
  console.log(`${"workflow".padEnd(22)} ${"system".padStart(7)} ${"tools".padStart(7)} ${"fixed".padStart(7)}  steps`);

  for (const workflow of WORKFLOWS) {
    const system = buildSystemPrompt(workflow.instructions);
    const tools = resolveTools(workflow.toolNames);
    const schema = JSON.stringify(
      tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    );

    const systemTokens = estimateTokens(system);
    const toolTokens = estimateTokens(schema);

    console.log(
      `${workflow.id.padEnd(22)} ${String(systemTokens).padStart(7)} ${String(
        toolTokens,
      ).padStart(7)} ${String(systemTokens + toolTokens).padStart(7)}  ${workflow.maxSteps}`,
    );
  }

  console.log(
    "\nEach tool result adds up to ~6000 tokens (MAX_TOOL_RESULT_CHARS = 24000).",
  );
  console.log("Size a local model's context for: fixed + (results kept in history) + output.");
}

main();
