import { describe, expect, it, mock } from 'bun:test';

// Stub 'server-only' for Bun test environment
mock.module('server-only', () => ({}));

const { model } = await import('../models');

describe('AI SDK Model Resolver (PSI-098)', () => {
  it('resolves anthropic model spec correctly', () => {
    const m = model('anthropic:claude-sonnet-5');
    expect(m).toBeDefined();
    expect(m.modelId).toBe('claude-sonnet-5');
    expect(m.provider).toBe('anthropic.messages');
  });

  it('resolves hermes model spec via openai-compatible provider', () => {
    const m = model('hermes:hermes-3-llama-3.1-405b');
    expect(m).toBeDefined();
    expect(m.modelId).toBe('hermes-3-llama-3.1-405b');
    expect(m.provider).toBe('hermes.chat');
  });

  it('handles models with colons in the model identifier', () => {
    const m = model('hermes:nousresearch/hermes-3-llama-3.1-8b:free');
    expect(m).toBeDefined();
    expect(m.modelId).toBe('nousresearch/hermes-3-llama-3.1-8b:free');
  });

  it('throws a helpful error on unknown provider', () => {
    expect(() => model('gemini:gemini-pro')).toThrow(
      'Unknown model provider "gemini" in "gemini:gemini-pro"',
    );
  });

  it('throws an error on missing model identifier', () => {
    expect(() => model('anthropic:')).toThrow('missing model identifier');
  });
});
