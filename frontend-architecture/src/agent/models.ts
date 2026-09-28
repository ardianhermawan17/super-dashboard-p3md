import 'server-only';
import { anthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const hermes = createOpenAICompatible({
  name: 'hermes',
  baseURL: process.env.HERMES_BASE_URL ?? 'https://api.nousresearch.com/v1',
  apiKey: process.env.HERMES_API_KEY,
});

/**
 * Resolve an AI SDK LanguageModel from a provider spec (PSI-098).
 * Spec format: "anthropic:<model_id>" | "hermes:<model_id>"
 *
 * Spec reference: docs/backend-architecture/agent-layer-mcp.md § "LLM providers: Claude and Hermes"
 *
 * Defaults:
 * - CHAT_MODEL: "anthropic:claude-sonnet-5"
 * - DIGEST_MODEL: "anthropic:claude-haiku-4-5-20251001"
 * - CV_MODEL: "anthropic:claude-haiku-4-5-20251001"
 */
export function model(spec = process.env.CHAT_MODEL ?? 'anthropic:claude-sonnet-5') {
  const [provider, ...rest] = spec.split(':');
  const id = rest.join(':');

  if (!id) {
    throw new Error(`Invalid model spec "${spec}": missing model identifier`);
  }

  switch (provider) {
    case 'anthropic':
      return anthropic(id);
    case 'hermes':
      return hermes(id);
    default:
      throw new Error(`Unknown model provider "${provider}" in "${spec}"`);
  }
}

