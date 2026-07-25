/**
 * Catalog of OpenAI-compatible vendors.
 *
 * OpenAI, Google Gemini, self-hosted servers, and the long tail of gateways
 * (Groq, Together, OpenRouter, Fireworks, DeepSeek, …) all speak the same Chat
 * Completions protocol. They differ only in credentials, endpoint, and model
 * catalog — which is data, so they live here as entries rather than as classes.
 *
 * Each entry still surfaces as its own provider in the UI, with its own key,
 * models, and configuration hint. Adding a vendor is one entry plus its id in
 * `ProviderId`.
 */
import type { OpenAICompatibleSpec } from "./openai-compatible";
import { modelInfo } from "./openai-compatible";

/** Self-hosted servers hold the connection open while loading a model. */
const LOCAL_TIMEOUT_MS = 300_000;

export const OPENAI_COMPATIBLE_SPECS: OpenAICompatibleSpec[] = [
  {
    id: "openai",
    label: "OpenAI",
    apiKeyEnv: "OPENAI_API_KEY",
    // No defaultBaseUrl: the SDK already points at OpenAI. The env var is for
    // an OpenAI-compatible gateway — not Azure, which needs its own client.
    baseUrlEnv: "OPENAI_BASE_URL",
    modelEnv: "OPENAI_MODEL",
    defaultModel: "gpt-5.2",
    models: [
      modelInfo("gpt-5.2", "GPT-5.2", 400_000),
      modelInfo("gpt-5.1", "GPT-5.1", 400_000),
      modelInfo("gpt-5", "GPT-5", 400_000),
      modelInfo("gpt-5-mini", "GPT-5 mini", 400_000),
      modelInfo("gpt-4.1", "GPT-4.1", 1_047_576),
    ],
    tokenLimitField: "max_completion_tokens",
    hint: "Set OPENAI_API_KEY to enable GPT models.",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    apiKeyEnv: "GEMINI_API_KEY",
    baseUrlEnv: "GEMINI_BASE_URL",
    // Trailing slash is load-bearing — dropping it turns every call into a 404.
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    modelEnv: "GEMINI_MODEL",
    defaultModel: "gemini-3.6-flash",
    models: [
      modelInfo("gemini-3.6-flash", "Gemini 3.6 Flash"),
      modelInfo("gemini-3.5-flash", "Gemini 3.5 Flash"),
      modelInfo("gemini-3.5-flash-lite", "Gemini 3.5 Flash-Lite"),
      modelInfo("gemini-2.5-pro", "Gemini 2.5 Pro"),
    ],
    tokenLimitField: "max_completion_tokens",
    hint: "Set GEMINI_API_KEY (from Google AI Studio) to enable Gemini models. The API has a free daily quota that needs no subscription.",
  },
  {
    id: "local",
    label: "Local model",
    // Most local servers ignore the key, but the SDK demands a non-empty one.
    apiKeyEnv: "LOCAL_MODEL_API_KEY",
    placeholderApiKey: "local",
    baseUrlEnv: "LOCAL_MODEL_BASE_URL",
    requiresBaseUrl: true,
    modelEnv: "LOCAL_MODEL",
    modelsEnv: "LOCAL_MODELS",
    defaultModel: "qwen3.5-9b",
    models: [],
    // Ollama and similar document `max_tokens`; sending the newer name gets it
    // ignored, which silently drops the output cap.
    tokenLimitField: "max_tokens",
    timeoutMs: LOCAL_TIMEOUT_MS,
    hint: "Set LOCAL_MODEL_BASE_URL (e.g. http://localhost:1234/v1 for LM Studio, http://localhost:11434/v1 for Ollama) and LOCAL_MODEL.",
  },
  {
    id: "custom",
    label: "Custom endpoint",
    apiKeyEnv: "CUSTOM_API_KEY",
    placeholderApiKey: "custom",
    baseUrlEnv: "CUSTOM_BASE_URL",
    requiresBaseUrl: true,
    modelEnv: "CUSTOM_MODEL",
    modelsEnv: "CUSTOM_MODELS",
    defaultModel: "default",
    models: [],
    tokenLimitField: "max_completion_tokens",
    hint: "Set CUSTOM_BASE_URL and CUSTOM_MODEL to use any other OpenAI-compatible endpoint (Groq, Together, OpenRouter, Fireworks, DeepSeek, …).",
  },
];
