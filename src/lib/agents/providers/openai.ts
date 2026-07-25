/**
 * OpenAI provider — hosted GPT models via Chat Completions.
 */
import {
  completeViaChatCompletions,
  modelInfo,
} from "./openai-compatible";
import type {
  CompletionRequest,
  CompletionResponse,
  LLMProvider,
  ModelInfo,
  ProviderId,
} from "../types";

const MODELS: ModelInfo[] = [
  modelInfo("gpt-5.2", "GPT-5.2", 400_000),
  modelInfo("gpt-5.1", "GPT-5.1", 400_000),
  modelInfo("gpt-5", "GPT-5", 400_000),
  modelInfo("gpt-5-mini", "GPT-5 mini", 400_000),
  modelInfo("gpt-4.1", "GPT-4.1", 1_047_576),
];

const DEFAULT_MODEL = "gpt-5.2";

export class OpenAIProvider implements LLMProvider {
  readonly id: ProviderId = "openai";
  readonly label = "OpenAI";

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  configurationHint(): string {
    return "Set OPENAI_API_KEY to enable GPT models.";
  }

  listModels(): ModelInfo[] {
    return MODELS;
  }

  defaultModel(): string {
    return process.env.OPENAI_MODEL || DEFAULT_MODEL;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error(this.configurationHint());

    return completeViaChatCompletions(
      { apiKey, baseURL: process.env.OPENAI_BASE_URL || undefined },
      { ...request, model: request.model || this.defaultModel() },
    );
  }
}
