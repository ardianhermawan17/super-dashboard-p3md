import { Database } from 'bun:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  classifyToolResult,
  normalizeTokens,
  parseToolCalls,
  type Attempt,
  type Call,
  type Msg,
  type Session
} from './analyze';

// Read-only. Only non-secret columns are selected (never provider_connections.*, api_keys.key, user or
// assistant message text). Tool results are classified and hashed in memory; their content is not kept.

export type HermesTotals = {
  sessions: number;
  prompt: number;
  cached: number;
  completion: number;
  apiCalls: number;
  orphaned: number;
  estimatedUsd: number;
  unknownCost: number;
};

type MsgRow = {
  session_id: string;
  role: string;
  timestamp: number;
  tool_calls: string | null;
  tool_call_id: string | null;
  finish_reason: string | null;
  display_kind: string | null;
  content: string | null;
};

export function readHermes(path: string) {
  const db = new Database(path, { readonly: true });
  try {
    const sessions: Session[] = (
      db.query('select id, source, cwd, end_reason from sessions').all() as {
        id: string;
        source: string;
        cwd: string | null;
        end_reason: string | null;
      }[]
    ).map((r) => ({ id: r.id, source: r.source, cwd: r.cwd, endReason: r.end_reason }));
    const totals = db
      .query(
        `select count(*) sessions, coalesce(sum(input_tokens), 0) prompt, coalesce(sum(cache_read_tokens), 0) cached,
          coalesce(sum(output_tokens), 0) completion, coalesce(sum(api_call_count), 0) apiCalls,
          coalesce(sum(end_reason = 'startup_orphan_reap'), 0) orphaned,
          coalesce(sum(estimated_cost_usd), 0) estimatedUsd, coalesce(sum(cost_status = 'unknown'), 0) unknownCost
        from sessions`
      )
      .get() as HermesTotals;
    const scope = `role in ('user', 'assistant', 'tool') and coalesce(_compressed_summary, 0) = 0`;
    // Context compaction stores the same turn more than once; keep one row per (session, role, time, call ids).
    const rows = db
      .query(
        `select session_id, role, timestamp, tool_calls, tool_call_id, finish_reason, display_kind,
          case when role = 'tool' then content end as content
        from messages
        where id in (
          select min(id) from messages where ${scope}
          group by session_id, role, timestamp, coalesce(tool_calls, ''), coalesce(tool_call_id, '')
        )
        order by session_id, timestamp, id`
      )
      .all() as MsgRow[];
    const all = (db.query(`select count(*) n from messages where ${scope}`).get() as { n: number })
      .n;
    const msgs: Msg[] = rows.map((r) => ({
      session: r.session_id,
      ts: r.timestamp,
      role: r.role,
      finishReason: r.finish_reason,
      failedTurn: r.display_kind === 'failed_turn',
      toolCalls: r.role === 'assistant' ? parseToolCalls(r.tool_calls) : [],
      toolCallId: r.tool_call_id,
      result: r.role === 'tool' ? classifyToolResult(r.content) : null
    }));
    return { sessions, msgs, totals, duplicates: all - rows.length };
  } finally {
    db.close();
  }
}

type CallRow = {
  id: string;
  correlation_id: string | null;
  api_key_name: string | null;
  provider: string;
  model: string;
  status: number;
  error_type: string | null;
  timestamp: string;
  duration: number | null;
  tokens_in: number | null;
  tokens_cache_read: number | null;
  tokens_out: number | null;
};

// Upstream attempts only: `auto` / `combo-*` rows are routing summaries, `connection-test` / `model-sync` are
// OmniRoute's own probes. `timestamp` is when the call finished.
export function readOmniRoute(path: string, hermesKey: string) {
  const db = new Database(path, { readonly: true });
  try {
    const rows = db
      .query(
        `select id, correlation_id, api_key_name, provider, model, status, error_type, timestamp, duration,
          tokens_in, tokens_cache_read, tokens_out
        from call_logs
        where provider != 'auto' and provider not like 'combo-%' and model not in ('connection-test', 'model-sync')`
      )
      .all() as CallRow[];
    const calls: Call[] = rows.map((r) => ({
      id: r.id,
      corr: r.correlation_id,
      apiKey: r.api_key_name,
      provider: r.provider,
      model: r.model,
      status: r.status,
      errorType: r.error_type,
      end: Date.parse(r.timestamp) / 1000,
      durationS: (r.duration ?? 0) / 1000,
      ...normalizeTokens(r.tokens_in ?? 0, r.tokens_cache_read ?? 0, r.tokens_out ?? 0),
      estimated: false
    }));
    const routingFailures = (
      db
        .query(
          `select count(*) n from call_logs
          where api_key_name = ? and status != 200 and (provider = 'auto' or provider like 'combo-%')`
        )
        .get(hermesKey) as { n: number }
    ).n;
    const gateway = db
      .query(
        `select count(*) n, coalesce(sum(d.cost), 0) usd
        from domain_cost_history d join api_keys k on k.id = d.api_key_id where k.name = ?`
      )
      .get(hermesKey) as { n: number; usd: number };
    return { calls, routingFailures, gateway };
  } finally {
    db.close();
  }
}

export function readAttempts(entriesDir: string, agent: string): Map<string, Attempt[]> {
  const out = new Map<string, Attempt[]>();
  for (const file of readdirSync(entriesDir).filter((f) => f.endsWith('.json'))) {
    const e = JSON.parse(readFileSync(join(entriesDir, file), 'utf8'));
    if (e.agent?.name !== agent) continue;
    for (const taskId of e.task_ids ?? []) {
      const attempt: Attempt = {
        id: e.id,
        outcome: e.outcome,
        checks: e.verification ?? {},
        claimedStart: e.session?.started_at ?? null,
        claimedEnd: e.session?.ended_at ?? null
      };
      out.set(taskId, [...(out.get(taskId) ?? []), attempt]);
    }
  }
  return out;
}
