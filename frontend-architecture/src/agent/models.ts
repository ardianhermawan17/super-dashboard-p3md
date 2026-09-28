import 'server-only';
import { anthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const hermes = createOpenAICompatible({
  name: 'hermes',
  baseURL: process.env.HERMES_BASE_URL ?? 'https://api.nousresearch.com/v1',
  apiKey: process.env.HERMES_API_KEY,
});

const deepseek = createOpenAICompatible({
  name: 'deepseek',
  baseURL: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

const openrouter = createOpenAICompatible({
  name: 'openrouter',
  baseURL: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

const openaiCompatible = createOpenAICompatible({
  name: 'openai-compatible',
  baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL ?? process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
  apiKey: process.env.OPENAI_COMPATIBLE_API_KEY ?? process.env.OPENAI_API_KEY,
});

/**
 * Resolve an AI SDK LanguageModel from a provider spec (PSI-098 / PSI-076).
 * Supported provider prefixes:
 * - anthropic: e.g. "anthropic:claude-sonnet-5", "anthropic:claude-haiku-4-5-20251001"
 * - hermes: e.g. "hermes:hermes-3-llama-3.1-405b", "hermes:nousresearch/hermes-3-llama-3.1-8b"
 * - deepseek: e.g. "deepseek:deepseek-chat", "deepseek:deepseek-reasoner"
 * - openrouter: e.g. "openrouter:deepseek/deepseek-chat", "openrouter:anthropic/claude-3.5-haiku"
 * - openai-compatible: custom endpoint via OPENAI_BASE_URL
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
    case 'deepseek':
      return deepseek(id);
    case 'openrouter':
      return openrouter(id);
    case 'openai-compatible':
    case 'openai':
      return openaiCompatible(id);
    default:
      throw new Error(`Unknown model provider "${provider}" in "${spec}"`);
  }
}

