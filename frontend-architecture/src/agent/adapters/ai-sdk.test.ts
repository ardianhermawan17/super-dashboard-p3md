import { describe, expect, it, mock } from 'bun:test';

mock.module('server-only', () => ({}));

const { toAiSdkTools } = await import('./ai-sdk');

describe('AI SDK Tools Adapter (PSI-076)', () => {
  const fakeDb: any = {
    from: () => ({
      select: () => ({
        gte: () => ({ lte: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
        order: () => ({ limit: async () => ({ data: [], error: null }) }),
      }),
      insert: async () => ({ data: null, error: null }),
    }),
  };

  it('maps the shared agent registry into AI SDK tools format', () => {
    const tools = toAiSdkTools({ db: fakeDb, clientId: 'in-app' });

    expect(tools).toBeDefined();
    expect(tools.get_activity).toBeDefined();
    expect(tools.get_board).toBeDefined();
    expect(tools.get_agenda).toBeDefined();
    expect(tools.get_inbox).toBeDefined();
    expect(tools.get_finance).toBeDefined();
    expect(tools.search_documents).toBeDefined();
  });

  it('preserves descriptions for LLM tool selection', () => {
    const tools = toAiSdkTools({ db: fakeDb, clientId: 'in-app' });

    expect(tools.get_activity.description).toBeDefined();
    expect(tools.get_activity.description!.length).toBeGreaterThan(10);
    expect(tools.get_finance.description).toContain('per-category breakdown');
  });
});
