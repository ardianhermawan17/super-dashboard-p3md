import { describe, expect, test } from 'bun:test';
import { buildDigestPrompt, generateDailyDigestSummary } from './digest';
import { assertInternal } from '../_shared/internal';

describe('Daily Digest Edge Function (PSI-077)', () => {
  const sampleData = {
    activities: [
      {
        occurred_at: '2026-09-28T14:00:00Z',
        actor_name: 'Ardian',
        action: 'moved',
        entity_type: 'task',
        entity_name: 'Security Audit',
        board_name: 'Operations',
        summary: 'Ardian moved task "Security Audit" to In Progress',
      },
    ],
    events: [
      {
        title: 'Executive Meeting',
        starts_at: '2026-09-28T10:00:00+07:00',
        ends_at: '2026-09-28T11:00:00+07:00',
        all_day: false,
        location: 'HQ Room 402',
      },
    ],
    tasks: [
      {
        title: 'Review M11 Migration',
        due_date: '2026-09-28',
        column_title: 'In Progress',
        is_done: false,
      },
    ],
  };

  test('builds comprehensive prompt from context data', () => {
    const prompt = buildDigestPrompt(sampleData);
    expect(prompt).toContain('Recent Activity');
    expect(prompt).toContain('Ardian moved task "Security Audit" to In Progress on board "Operations"');
    expect(prompt).toContain('Today\'s Calendar Agenda');
    expect(prompt).toContain('Executive Meeting (HQ Room 402)');
    expect(prompt).toContain('Pending & Overdue Tasks');
    expect(prompt).toContain('Review M11 Migration [In Progress] (Due: 2026-09-28)');
  });

  test('handles empty dataset gracefully without errors', () => {
    const emptyPrompt = buildDigestPrompt({ activities: [], events: [], tasks: [] });
    expect(emptyPrompt).toContain('No recorded activity');
    expect(emptyPrompt).toContain('No scheduled events');
    expect(emptyPrompt).toContain('No pending or overdue tasks');
  });

  test('generates summary using configured model adapter', async () => {
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

    globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({
          content: [
            {
              type: 'text',
              text: '## Morning Briefing\n- **Blockers**: None\n- **Agenda**: Executive Meeting at 10:00\n- **Tasks**: 1 in progress',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };

    try {
      const summary = await generateDailyDigestSummary(
        sampleData,
        'anthropic:claude-haiku-4-5-20251001',
      );

      expect(summary).toContain('Morning Briefing');
      expect(capturedBody.model).toBe('claude-haiku-4-5-20251001');
      expect(capturedBody.system).toContain('P3MD executive assistant');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('assertInternal guards endpoint against unauthorized calls', () => {
    process.env.INTERNAL_FN_SECRET = 'test-secret-123';
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

    // Valid secret
    const validReq = new Request('http://localhost', {
      headers: { Authorization: 'Bearer test-secret-123' },
    });
    expect(() => assertInternal(validReq)).not.toThrow();

    // Invalid secret
    const invalidReq = new Request('http://localhost', {
      headers: { Authorization: 'Bearer wrong-secret' },
    });
    expect(() => assertInternal(invalidReq)).toThrow();
  });
});
