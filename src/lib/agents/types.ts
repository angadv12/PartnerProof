/**
 * Provider-agnostic agent types.
 *
 * Everything above the provider layer speaks these shapes. Each provider adapter
 * translates them to and from its vendor wire format, so the runtime, the tool
 * registry, and the workflow definitions never import a vendor SDK.
 */

// ---------------------------------------------------------------------------
// Providers & models
// ---------------------------------------------------------------------------

export type ProviderId = "anthropic" | "openai" | "gemini" | "local" | "custom";

/** Display order in the UI's provider picker. */
export const PROVIDER_IDS: ProviderId[] = ["anthropic", "openai", "gemini", "local", "custom"];

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && (PROVIDER_IDS as string[]).includes(value);
}

export interface ModelInfo {
  id: string;
  label: string;
  /** Rough context window in tokens, for display only. */
  contextWindow?: number;
}

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  configured: boolean;
  /** Why the provider is unusable, when `configured` is false. */
  reason?: string;
  models: ModelInfo[];
  defaultModel: string;
}

// ---------------------------------------------------------------------------
// Conversation
// ---------------------------------------------------------------------------

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface UserMessage {
  role: "user";
  content: string;
}

export interface AssistantMessage {
  role: "assistant";
  content: string;
  toolCalls?: ToolCall[];
  /**
   * Opaque vendor payload for this turn, set and consumed by the provider that
   * produced it. Anthropic requires thinking blocks to be echoed back verbatim
   * on the next request, and normalizing them to text would corrupt them — so
   * the provider stashes its raw content blocks here and replays them. Layers
   * above the provider carry this through without inspecting it, and a run
   * never switches providers mid-flight, so it is only ever read by its author.
   */
  providerRaw?: unknown;
}

export interface ToolMessage {
  role: "tool";
  toolCallId: string;
  toolName: string;
  content: string;
  isError?: boolean;
}

export type AgentMessage = UserMessage | AssistantMessage | ToolMessage;

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

/**
 * A JSON Schema object describing a tool's arguments. Kept loose on purpose:
 * every provider accepts standard JSON Schema for tool parameters, and pinning a
 * stricter type here would fight all three of them.
 */
export interface JsonSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: JsonSchema;
}

/** Context handed to every tool handler when the runtime invokes it. */
export interface ToolContext {
  runId: string;
  /** Storage keys of files attached to this run. */
  attachments: RunAttachment[];
  /**
   * Aborted when the run is cancelled. Handlers doing slow I/O should pass it
   * through and bail before committing any side effect.
   */
  signal?: AbortSignal;
}

export interface AgentTool extends ToolDefinition {
  /**
   * Tools that only read data can run concurrently when the model requests
   * several at once. Anything that writes is serialized.
   */
  readOnly: boolean;
  handler(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Provider contract
// ---------------------------------------------------------------------------

export type StopReason =
  | "end"
  | "tool_use"
  | "max_tokens"
  /**
   * The turn was paused server-side and should be continued by replaying it,
   * not treated as finished. Distinct from `max_tokens`: no output was lost.
   */
  | "pause"
  | "refusal";

export interface CompletionRequest {
  model: string;
  /** The fully assembled system prompt, platform preamble included. */
  system: string;
  messages: AgentMessage[];
  tools: ToolDefinition[];
  maxTokens: number;
  signal?: AbortSignal;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface CompletionResponse {
  text: string;
  toolCalls: ToolCall[];
  stopReason: StopReason;
  usage: TokenUsage;
  /** Present when `stopReason` is "refusal". */
  refusalReason?: string;
  /** Vendor payload to echo back next turn. See `AssistantMessage.providerRaw`. */
  providerRaw?: unknown;
}

export interface LLMProvider {
  readonly id: ProviderId;
  readonly label: string;
  /** False when the required credentials or base URL are missing. */
  isConfigured(): boolean;
  /** Human-readable explanation for `isConfigured() === false`. */
  configurationHint(): string;
  listModels(): ModelInfo[];
  defaultModel(): string;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

export type RunStatus =
  | "running"
  | "succeeded"
  /** Hit the step limit; there is a partial answer but the task was not finished. */
  | "incomplete"
  | "failed"
  | "cancelled";

export interface RunAttachment {
  /** Storage key, resolved through the storage driver (S3 or local disk). */
  key: string;
  fileName: string;
  contentType: string;
  size: number;
}

export type RunEvent =
  | { type: "run.started"; at: string; workflow: string; provider: ProviderId; model: string }
  | { type: "step.started"; at: string; step: number }
  | { type: "assistant.message"; at: string; step: number; text: string }
  | { type: "tool.called"; at: string; step: number; toolCallId: string; name: string; arguments: Record<string, unknown> }
  | { type: "tool.result"; at: string; step: number; toolCallId: string; name: string; result: string; isError: boolean }
  | { type: "run.finished"; at: string; status: RunStatus; output: string }
  | { type: "run.error"; at: string; message: string };

export interface AgentRun {
  id: string;
  workflowId: string;
  provider: ProviderId;
  model: string;
  status: RunStatus;
  input: string;
  output: string;
  error?: string;
  attachments: RunAttachment[];
  events: RunEvent[];
  usage: TokenUsage;
  steps: number;
  createdAt: string;
  updatedAt: string;
}

export interface StartRunInput {
  workflowId: string;
  input: string;
  provider?: ProviderId;
  model?: string;
  attachments?: RunAttachment[];
}
