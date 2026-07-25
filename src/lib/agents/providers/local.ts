/**
 * Local provider — a self-hosted model behind an OpenAI-compatible endpoint.
 *
 * Works with Ollama (`http://localhost:11434/v1`), LM Studio
 * (`http://localhost:1234/v1`), vLLM, and llama.cpp's server. Configure with:
 *
 *   LOCAL_MODEL_BASE_URL=http://localhost:11434/v1
 *   LOCAL_MODEL=qwen3:8b
 *   LOCAL_MODELS=qwen3:8b,llama3.3:70b        # optional, for the model picker
 *   LOCAL_MODEL_API_KEY=...                    # optional; most servers ignore it
 *
 * Tool calling quality varies a lot by model. The runtime's argument validation
 * and error-returning tool results exist largely for this provider.
 */
import { completeViaChatCompletions } from "./openai-compatible";
import type {
  CompletionRequest,
  CompletionResponse,
  LLMProvider,
  ModelInfo,
  ProviderId,
} from "../types";

const DEFAULT_MODEL = "qwen3:8b";

/** Local servers hold the connection open while loading a model into memory. */
const LOCAL_TIMEOUT_MS = 300_000;

function configuredModels(): string[] {
  const raw = process.env.LOCAL_MODELS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
}

export class LocalProvider implements LLMProvider {
  readonly id: ProviderId = "local";
  readonly label = "Local model";

  isConfigured(): boolean {
    return Boolean(process.env.LOCAL_MODEL_BASE_URL);
  }

  configurationHint(): string {
    return "Set LOCAL_MODEL_BASE_URL (e.g. http://localhost:11434/v1) and LOCAL_MODEL.";
  }

  listModels(): ModelInfo[] {
    const models = configuredModels();
    const fallback = this.defaultModel();
    const ids = models.length > 0 ? models : [fallback];
    // The operator names these; there is no display name to look up.
    return ids.map((id) => ({ id, label: id }));
  }

  defaultModel(): string {
    return process.env.LOCAL_MODEL || DEFAULT_MODEL;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const baseURL = process.env.LOCAL_MODEL_BASE_URL;
    if (!baseURL) throw new Error(this.configurationHint());

    return completeViaChatCompletions(
      {
        // Most local servers ignore the key but the SDK requires a non-empty one.
        apiKey: process.env.LOCAL_MODEL_API_KEY || "local",
        baseURL,
        timeoutMs: LOCAL_TIMEOUT_MS,
        // Ollama and friends document `max_tokens`, not the newer name. Sending
        // the wrong one gets it ignored, which silently drops the output cap.
        tokenLimitField: "max_tokens",
      },
      { ...request, model: request.model || this.defaultModel() },
    );
  }
}
