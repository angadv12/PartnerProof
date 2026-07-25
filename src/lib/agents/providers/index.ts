/**
 * Provider registry.
 *
 * Providers are constructed once and read their credentials lazily, so adding a
 * key to the environment takes effect without changing this module. Nothing
 * outside this directory imports a vendor SDK.
 */
import { AnthropicProvider } from "./anthropic";
import { LocalProvider } from "./local";
import { OpenAIProvider } from "./openai";
import type { LLMProvider, ProviderId, ProviderInfo } from "../types";
import { PROVIDER_IDS, isProviderId } from "../types";

const REGISTRY: Record<ProviderId, LLMProvider> = {
  anthropic: new AnthropicProvider(),
  openai: new OpenAIProvider(),
  local: new LocalProvider(),
};

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
      "No LLM provider is configured. Set one of ANTHROPIC_API_KEY, OPENAI_API_KEY, or LOCAL_MODEL_BASE_URL.",
    );
  }
  return available;
}

/** True when the requested model is one the provider advertises. */
export function isKnownModel(provider: LLMProvider, model: string): boolean {
  return provider.listModels().some((m) => m.id === model);
}
