import { describe, expect, test } from 'bun:test';
import { complete } from './llm';

describe('Edge Function LLM Completion Adapter (PSI-098)', () => {
  test('completes anthropic request format', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    if (typeof globalThis.Deno === 'undefined') {
      (globalThis as any).Deno = {
        env: {
          get: (key: string) => process.env[key] ?? null,
        },
      };
    } else {
      (globalThis as any).Deno.env = {
        get: (key: string) => process.env[key] ?? null,
      };
    }

    const originalFetch = globalThis.fetch;
    let capturedBody: any = null;
    let capturedHeaders: any = null;

    globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      capturedHeaders = init?.headers;
      return new Response(
        JSON.stringify({
          content: [{ type: 'text', text: 'Anthropic summary completion' }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };

    try {
      const result = await complete(
        'anthropic:claude-haiku-4-5-20251001',
        'You are a summarizer.',
        [{ role: 'user', content: 'Summarize the board activity.' }],
      );

      expect(result).toBe('Anthropic summary completion');
      expect(capturedBody.model).toBe('claude-haiku-4-5-20251001');
      expect(capturedBody.system).toBe('You are a summarizer.');
      expect(capturedBody.messages[0].content).toBe('Summarize the board activity.');
      expect(capturedHeaders['x-api-key']).toBe('sk-ant-test');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('completes hermes request format', async () => {
    if (typeof globalThis.Deno === 'undefined') {
      (globalThis as any).Deno = {
        env: {
          get: (key: string) => {
            if (key === 'HERMES_BASE_URL') return 'https://api.nousresearch.com/v1';
            if (key === 'HERMES_API_KEY') return 'hermes-key-123';
            return null;
          },
        },
      };
    }

    const originalFetch = globalThis.fetch;
    let capturedBody: any = null;
    let capturedUrl: string | null = null;

    globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedBody = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Hermes summary response' } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };

    try {
      const result = await complete(
        'hermes:hermes-3-llama-3.1-8b',
        'You are a summarizer.',
        [{ role: 'user', content: 'Extract skills from CV.' }],
      );

      expect(result).toBe('Hermes summary response');
      expect(capturedUrl).toBe('https://api.nousresearch.com/v1/chat/completions');
      expect(capturedBody.model).toBe('hermes-3-llama-3.1-8b');
      expect(capturedBody.messages[0].role).toBe('system');
      expect(capturedBody.messages[1].content).toBe('Extract skills from CV.');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('rejects unknown provider spec', async () => {
    await expect(
      complete('openai:gpt-4o' as any, 'system', [{ role: 'user', content: 'test' }]),
    ).rejects.toThrow('Unknown model provider');
  });
});
