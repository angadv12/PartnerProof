/**
 * Shared adapter for any OpenAI-compatible Chat Completions endpoint.
 *
 * Backs both the hosted OpenAI provider and the local-model provider, since
 * Ollama, LM Studio, vLLM, and llama.cpp all expose the same `/v1/chat/completions`
 * surface. Only the base URL, key, and model list differ.
 *
 * Sampling parameters are deliberately omitted: current OpenAI reasoning models
 * reject a non-default `temperature`, and leaving it unset is also the most
 * portable choice across local servers.
 */
import OpenAI from "openai";

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

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type ChatTool = OpenAI.Chat.Completions.ChatCompletionTool;

function mapFinishReason(reason: string | null | undefined): StopReason {
  switch (reason) {
    case "tool_calls":
    case "function_call":
      return "tool_use";
    case "length":
      return "max_tokens";
    case "content_filter":
      return "refusal";
    default:
      return "end";
  }
}

/**
 * Parse a tool-call argument blob.
 *
 * Models occasionally emit malformed JSON here, especially smaller local ones.
 * Returning the raw string under `_raw` lets the tool layer produce a real error
 * message the model can recover from, instead of crashing the run.
 */
function parseArguments(raw: string | undefined): Record<string, unknown> {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { _raw: raw };
  } catch {
    return { _raw: raw };
  }
}

function toChatMessages(system: string, messages: AgentMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [{ role: "system", content: system }];

  for (const message of messages) {
    if (message.role === "user") {
      out.push({ role: "user", content: message.content });
      continue;
    }

    if (message.role === "tool") {
      out.push({
        role: "tool",
        tool_call_id: message.toolCallId,
        content: message.content,
      });
      continue;
    }

    const toolCalls = message.toolCalls ?? [];
    if (toolCalls.length > 0) {
      out.push({
        role: "assistant",
        // The API rejects an empty-string content alongside tool calls.
        content: message.content.trim() ? message.content : null,
        tool_calls: toolCalls.map((call) => ({
          id: call.id,
          type: "function" as const,
          function: { name: call.name, arguments: JSON.stringify(call.arguments) },
        })),
      });
    } else {
      out.push({ role: "assistant", content: message.content });
    }
  }

  return out;
}

export interface OpenAICompatibleOptions {
  apiKey: string;
  baseURL?: string;
  /** Local servers can be slow to first token on a cold model load. */
  timeoutMs?: number;
  /**
   * Which output-token field to send. Hosted OpenAI reasoning models require
   * `max_completion_tokens`; Ollama and several other local servers only
   * document `max_tokens` and may ignore or reject the newer name — which would
   * silently remove the output bound.
   */
  tokenLimitField?: "max_completion_tokens" | "max_tokens";
}

export async function completeViaChatCompletions(
  options: OpenAICompatibleOptions,
  request: CompletionRequest,
): Promise<CompletionResponse> {
  const client = new OpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseURL,
    timeout: options.timeoutMs ?? 120_000,
    maxRetries: 2,
  });

  const tools: ChatTool[] = request.tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters as unknown as Record<string, unknown>,
    },
  }));

  const tokenLimitField = options.tokenLimitField ?? "max_completion_tokens";

  const response = await client.chat.completions.create(
    {
      model: request.model,
      [tokenLimitField]: request.maxTokens,
      messages: toChatMessages(request.system, request.messages),
      // Sending `tools: []` makes some local servers reject the request.
      ...(tools.length > 0 ? { tools } : {}),
    },
    { signal: request.signal },
  );

  const choice = response.choices[0];
  const message = choice?.message;

  const toolCalls: ToolCall[] = [];
  for (const call of message?.tool_calls ?? []) {
    // Only function calls carry a name/arguments pair we can dispatch.
    if (call.type !== "function") continue;
    toolCalls.push({
      id: call.id,
      name: call.function.name,
      arguments: parseArguments(call.function.arguments),
    });
  }

  // A refusal arrives as a populated `refusal` field with no content.
  const refusal = message?.refusal ?? undefined;
  const stopReason: StopReason = refusal ? "refusal" : mapFinishReason(choice?.finish_reason);

  return {
    text: message?.content ?? "",
    toolCalls,
    stopReason,
    usage: {
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    },
    refusalReason: refusal,
  };
}

export function modelInfo(id: string, label: string, contextWindow?: number): ModelInfo {
  return { id, label, contextWindow };
}

// ---------------------------------------------------------------------------
// Generic provider
// ---------------------------------------------------------------------------

/**
 * Everything that distinguishes one OpenAI-compatible vendor from another.
 *
 * OpenAI, Gemini, and self-hosted servers all speak the same wire protocol, so
 * they differ only in credentials, base URL, and catalog. Keeping that as data
 * means a new vendor is a table entry, not a class — and each one still appears
 * as its own provider in the UI, because the registry lists specs individually.
 */
export interface OpenAICompatibleSpec {
  id: ProviderId;
  label: string;
  /** Env var holding the API key. */
  apiKeyEnv: string;
  /** Env var overriding the base URL. */
  baseUrlEnv: string;
  /** Fixed endpoint for vendors that have one. Omit to use the SDK default. */
  defaultBaseUrl?: string;
  /** Self-hosted vendors are unusable without a URL; hosted ones need a key. */
  requiresBaseUrl?: boolean;
  /** Sent when the server ignores auth but the SDK still demands a non-empty key. */
  placeholderApiKey?: string;
  modelEnv: string;
  /** Env var with a comma-separated catalog, for operator-defined model lists. */
  modelsEnv?: string;
  defaultModel: string;
  /** Published catalog. Empty for vendors whose models the operator names. */
  models: ModelInfo[];
  tokenLimitField?: "max_completion_tokens" | "max_tokens";
  timeoutMs?: number;
  /** Shown in the UI when the provider is unconfigured. */
  hint: string;
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly id: ProviderId;
  readonly label: string;

  constructor(private readonly spec: OpenAICompatibleSpec) {
    this.id = spec.id;
    this.label = spec.label;
  }

  private baseUrl(): string | undefined {
    return process.env[this.spec.baseUrlEnv] || this.spec.defaultBaseUrl;
  }

  private apiKey(): string | undefined {
    return process.env[this.spec.apiKeyEnv] || this.spec.placeholderApiKey;
  }

  isConfigured(): boolean {
    return this.spec.requiresBaseUrl ? Boolean(this.baseUrl()) : Boolean(this.apiKey());
  }

  configurationHint(): string {
    return this.spec.hint;
  }

  listModels(): ModelInfo[] {
    const configured = (process.env[this.spec.modelsEnv ?? ""] ?? "")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    if (configured.length > 0) {
      // Operator-named models have no display name to look up.
      return configured.map((id) => ({ id, label: id }));
    }
    if (this.spec.models.length > 0) return this.spec.models;
    const fallback = this.defaultModel();
    return [{ id: fallback, label: fallback }];
  }

  defaultModel(): string {
    return process.env[this.spec.modelEnv] || this.spec.defaultModel;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = this.apiKey();
    const baseURL = this.baseUrl();
    if (!this.isConfigured() || !apiKey) {
      throw new Error(this.spec.hint);
    }

    return completeViaChatCompletions(
      {
        apiKey,
        baseURL,
        tokenLimitField: this.spec.tokenLimitField,
        timeoutMs: this.spec.timeoutMs,
      },
      { ...request, model: request.model || this.defaultModel() },
    );
  }
}
