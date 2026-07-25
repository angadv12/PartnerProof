/**
 * Anthropic provider — Claude via the Messages API.
 *
 * Uses the official @anthropic-ai/sdk. Notes that bite if you change this file:
 * - Claude Opus 5 thinks by default; thinking blocks must be echoed back
 *   verbatim on the next turn, so raw content blocks ride along on the
 *   assistant message as `providerRaw`.
 * - `temperature` / `top_p` / `top_k` are rejected (400) on current models.
 *   Steer with the prompt instead.
 * - Every `tool_result` for one assistant turn goes back in a single user
 *   message; splitting them trains Claude out of parallel tool calls.
 */
import Anthropic from "@anthropic-ai/sdk";

import type {
  AgentMessage,
  CompletionRequest,
  CompletionResponse,
  LLMProvider,
  ModelInfo,
  ProviderId,
  StopReason,
  ToolCall,
} from "../types";

const MODELS: ModelInfo[] = [
  { id: "claude-opus-5", label: "Claude Opus 5", contextWindow: 1_000_000 },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", contextWindow: 1_000_000 },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", contextWindow: 200_000 },
];

const DEFAULT_MODEL = "claude-opus-5";

/** Cap thinking + visible output together; Claude counts both against max_tokens. */
const MAX_OUTPUT_TOKENS = 16_000;

type ContentBlockParam = Anthropic.Messages.ContentBlockParam;
type MessageParam = Anthropic.Messages.MessageParam;

function mapStopReason(reason: string | null): StopReason {
  switch (reason) {
    case "tool_use":
      return "tool_use";
    case "max_tokens":
    // The response is truncated, not finished. Mapping either of these to "end"
    // would report a cut-off answer as a successful one.
    case "model_context_window_exceeded":
    case "pause_turn":
      return "max_tokens";
    case "refusal":
      return "refusal";
    default:
      return "end";
  }
}

/**
 * Rebuild the wire-format message list.
 *
 * Assistant turns replay their original blocks when we still have them, so
 * thinking blocks survive the round trip. Runs of tool results are merged into
 * one user message.
 */
function toAnthropicMessages(messages: AgentMessage[]): MessageParam[] {
  const out: MessageParam[] = [];
  let pendingToolResults: ContentBlockParam[] = [];

  const flushToolResults = () => {
    if (pendingToolResults.length === 0) return;
    out.push({ role: "user", content: pendingToolResults });
    pendingToolResults = [];
  };

  for (const message of messages) {
    if (message.role === "tool") {
      pendingToolResults.push({
        type: "tool_result",
        tool_use_id: message.toolCallId,
        content: message.content,
        is_error: message.isError ?? false,
      });
      continue;
    }

    flushToolResults();

    if (message.role === "user") {
      out.push({ role: "user", content: message.content });
      continue;
    }

    // Assistant. Replay the original blocks when this provider produced them.
    if (Array.isArray(message.providerRaw) && message.providerRaw.length > 0) {
      out.push({ role: "assistant", content: message.providerRaw as ContentBlockParam[] });
      continue;
    }

    const blocks: ContentBlockParam[] = [];
    if (message.content.trim()) {
      blocks.push({ type: "text", text: message.content });
    }
    for (const call of message.toolCalls ?? []) {
      blocks.push({ type: "tool_use", id: call.id, name: call.name, input: call.arguments });
    }
    if (blocks.length > 0) out.push({ role: "assistant", content: blocks });
  }

  flushToolResults();
  return out;
}

export class AnthropicProvider implements LLMProvider {
  readonly id: ProviderId = "anthropic";
  readonly label = "Anthropic";

  private client: Anthropic | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  configurationHint(): string {
    return "Set ANTHROPIC_API_KEY to enable Claude models.";
  }

  listModels(): ModelInfo[] {
    return MODELS;
  }

  defaultModel(): string {
    return process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  }

  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error(this.configurationHint());
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const client = this.getClient();

    const response = await client.messages.create(
      {
        model: request.model || this.defaultModel(),
        max_tokens: Math.min(request.maxTokens, MAX_OUTPUT_TOKENS),
        // Cache the platform preamble; it is byte-identical across every run.
        system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
        messages: toAnthropicMessages(request.messages),
        tools: request.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters as Anthropic.Messages.Tool.InputSchema,
        })),
      },
      { signal: request.signal },
    );

    let text = "";
    const toolCalls: ToolCall[] = [];
    for (const block of response.content) {
      if (block.type === "text") {
        text += block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: (block.input ?? {}) as Record<string, unknown>,
        });
      }
    }

    return {
      text,
      toolCalls,
      stopReason: mapStopReason(response.stop_reason),
      usage: {
        // Total input is input + cache writes + cache reads. We enable prompt
        // caching above, so counting only `input_tokens` would under-report the
        // prompt by most of its size once the cache is warm.
        inputTokens:
          response.usage.input_tokens +
          (response.usage.cache_creation_input_tokens ?? 0) +
          (response.usage.cache_read_input_tokens ?? 0),
        outputTokens: response.usage.output_tokens,
      },
      refusalReason: response.stop_reason === "refusal" ? "Declined by safety classifier" : undefined,
      // Replayed verbatim next turn so thinking blocks survive.
      providerRaw: response.content,
    };
  }
}
