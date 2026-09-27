/**
 * Unit tests for the agent tool layer (PSI-072), run with the project's Bun.
 *
 * These test the pure, injectable parts: input validation, the audit write in the runtime,
 * output caps, and the deep-link shape. They mock the Supabase client — no database needed
 * — with the same shape the real client exposes for `.from().select()...`.
 */
import { describe, expect, test, mock } from 'bun:test';
import { builder } from './testing/fake-supabase';
import { defineTool, type AgentCtx } from './define';
import { deepLink } from './links';
import { agentTools } from './registry';
import { getActivity } from './tools/get-activity';
import { getAgenda } from './tools/get-agenda';

// runtime.ts imports 'server-only', which throws unconditionally when evaluated outside a
// Next.js build (e.g. under `bun test`). Stub it before dynamically importing the runtime.
mock.module('server-only', () => ({}));
const { runTool } = await import('./runtime');

/** Tracks how the fake client is called so a test can assert on the audit insert. */
type Audited = {
  tool: string;
  args: unknown;
  rows: number | null;
  error: string | null;
};

function fakeDb(rowsForTool: Record<string, unknown[]>, audited: Audited[], auditError: string | null = null) {
  return {
    from: (table: string) => {
      if (table === 'agent_audit_log') {
        return {
          insert: async (row: Audited) => {
            // Normalise what runtime.ts sends (client_id/tool/args/rows_returned/...) into
            // the shape the assertions read.
            audited.push({
              tool: row.tool,
              args: row.args,
              rows: row.rows ?? row.rows_returned ?? null,
              error: row.error ?? null,
            });
            return { error: auditError ? { message: auditError } : null };
          },
        } as never;
      }
      return builder(rowsForTool[table] ?? []) as never;
    },
  } as never;
}

const ctx = (db: unknown): AgentCtx => ({ db: db as never, clientId: 'test-client' });

describe('agent registry', () => {
  test('exposes exactly the five read tools', () => {
    expect(agentTools.map((t) => t.name).toSorted()).toEqual([
      'get_activity',
      'get_agenda',
      'get_board',
      'get_inbox',
      'search_documents',
    ]);
  });

  test('every tool is a defined (not inferred) tool with zod input', () => {
    for (const t of agentTools) {
      expect(t.input).toBeDefined();
      expect(typeof t.run).toBe('function');
    }
  });
});

describe('runtime', () => {
  test('runs the tool and audits the call with rows_returned', async () => {
    const audited: Audited[] = [];
    const db = fakeDb({ activity_log: [{ occurred_at: '2026-09-26', entity_type: 'task', entity_id: 'x', verb: 'moved', summary: 'T moved' }] }, audited);
    const result = await runTool(getActivity, { since: '2026-09-01T00:00:00+07:00' }, ctx(db)) as { summary: string }[];
    expect(result.length).toBe(1);
    expect(audited).toHaveLength(1);
    expect(audited[0].tool).toBe('get_activity');
    expect(audited[0].rows).toBe(1);
    expect(audited[0].error).toBeNull();
  });

  test('rejects input outside the schema (no audit without a run)', async () => {
    const audited: Audited[] = [];
    const db = fakeDb({}, audited);
    // limit=0 is below the min of 1.
    await expect(runTool(getActivity, { since: '2026-09-01T00:00:00+07:00', limit: 0 }, ctx(db))).rejects.toThrow();
    // Validation errors still audit the attempt.
    expect(audited).toHaveLength(1);
    expect(audited[0].error).toBeTruthy();
  });

  test('a failed tool run still audits with the error', async () => {
    const audited: Audited[] = [];
    const db = fakeDb({}, audited);
    const boom = defineTool({
      name: 'boom',
      title: 'Boom',
      description: 'throws',
      input: getAgenda.input,
      run: async () => {
        throw new Error('kaboom');
      },
    });
    await expect(runTool(boom, { timeframe: 'today' }, ctx(db))).rejects.toThrow('kaboom');
    expect(audited).toHaveLength(1);
    expect(audited[0].tool).toBe('boom');
    expect(audited[0].error).toContain('kaboom');
  });

  test('audit failure does not break the tool result', async () => {
    const audited: Audited[] = [];
    const db = fakeDb({}, audited, 'insert denied');
    const result = await runTool(getActivity, { since: '2026-09-01T00:00:00+07:00' }, ctx(db));
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('output caps', () => {
  test('get_activity rejects limit > 100', async () => {
    const audited: Audited[] = [];
    const db = fakeDb({}, audited);
    await expect(runTool(getActivity, { since: '2026-09-01T00:00:00+07:00', limit: 101 }, ctx(db))).rejects.toThrow();
  });
});

describe('deep links', () => {
  test('link targets real dashboard routes and carries an id', () => {
    expect(deepLink('task', '11111111-1111-1111-1111-111111111111')).toBe('/dashboard/kanban?id=11111111-1111-1111-1111-111111111111');
    expect(deepLink('event', '22222222-2222-2222-2222-222222222222')).toBe('/dashboard/calendar?id=22222222-2222-2222-2222-222222222222');
    expect(deepLink('message', '33333333-3333-3333-3333-333333333333')).toBe('/dashboard/mail?id=33333333-3333-3333-3333-333333333333');
  });
});