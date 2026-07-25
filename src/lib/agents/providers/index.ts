/**
 * Provider registry.
 *
 * Two shapes live here. Anthropic has its own adapter because the Messages API
 * is a different protocol. Everything else — OpenAI, Gemini, self-hosted, and
 * any other gateway — speaks Chat Completions, so they share one implementation
 * and differ only by a catalog entry.
 *
 * Providers are constructed once and read their credentials lazily, so adding a
 * key to the environment takes effect without changing this module. Nothing
 * outside this directory imports a vendor SDK.
 */
import { AnthropicProvider } from "./anthropic";
import { OPENAI_COMPATIBLE_SPECS } from "./catalog";
import { OpenAICompatibleProvider } from "./openai-compatible";
import type { LLMProvider, ProviderId, ProviderInfo } from "../types";
import { PROVIDER_IDS, isProviderId } from "../types";

function buildRegistry(): Record<ProviderId, LLMProvider> {
  const registry: Partial<Record<ProviderId, LLMProvider>> = {
    anthropic: new AnthropicProvider(),
  };
  for (const spec of OPENAI_COMPATIBLE_SPECS) {
    registry[spec.id] = new OpenAICompatibleProvider(spec);
  }

  // Adding an id to ProviderId without a catalog entry would otherwise surface
  // as an undefined lookup deep in a run. Fail at import instead.
  const missing = PROVIDER_IDS.filter((id) => !registry[id]);
  if (missing.length > 0) {
    throw new Error(`Provider(s) declared but not registered: ${missing.join(", ")}`);
  }

  return registry as Record<ProviderId, LLMProvider>;
}

const REGISTRY = buildRegistry();

export function getProvider(id: ProviderId): LLMProvider {
  return REGISTRY[id];
}

export function listProviders(): LLMProvider[] {
  return PROVIDER_IDS.map((id) => REGISTRY[id]);
}

/** Provider metadata for the UI, including why an unconfigured one is unusable. */
export function describeProviders(): ProviderInfo[] {
  return listProviders().map((provider) => {
    const configured = provider.isConfigured();
    return {
      id: provider.id,
      label: provider.label,
      configured,
      reason: configured ? undefined : provider.configurationHint(),
      models: provider.listModels(),
      defaultModel: provider.defaultModel(),
    };
  });
}

/**
 * Pick the provider to run with.
 *
 * An explicit request wins and fails loudly if unusable — silently running on a
 * different model than the caller asked for would make results impossible to
 * interpret. With no request, fall back to AGENT_PROVIDER, then to whichever
 * provider is actually configured.
 */
export function resolveProvider(requested?: ProviderId): LLMProvider {
  if (requested) {
    const provider = REGISTRY[requested];
    if (!provider.isConfigured()) {
      throw new Error(`Provider "${requested}" is not configured. ${provider.configurationHint()}`);
    }
    return provider;
  }

  const preferred = process.env.AGENT_PROVIDER;
  if (isProviderId(preferred) && REGISTRY[preferred].isConfigured()) {
    return REGISTRY[preferred];
  }

  const available = listProviders().find((p) => p.isConfigured());
  if (!available) {
    throw new Error(
      "No LLM provider is configured. Set one of ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, LOCAL_MODEL_BASE_URL, or CUSTOM_BASE_URL.",
    );
  }
  return available;
}

/** True when the requested model is one the provider advertises. */
export function isKnownModel(provider: LLMProvider, model: string): boolean {
  return provider.listModels().some((m) => m.id === model);
}
