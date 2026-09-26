import { createHash } from 'node:crypto';

// Pure logic: no I/O. Every token count follows one convention:
// prompt = uncached input, cached = cache reads, completion = output (incl. reasoning).

export type Price = { input: number; cached: number; output: number; source?: string };
export type Pricing = Record<string, Price>;
export type Tokens = { prompt: number; cached: number; completion: number };

export type Call = Tokens & {
  id: string;
  corr: string | null;
  apiKey: string | null;
  provider: string;
  model: string;
  status: number;
  errorType: string | null;
  end: number;
  durationS: number;
  estimated: boolean;
};

export type ToolCall = {
  id: string;
  callId: string | null;
  name: string;
  argsHash: string;
  valid: boolean;
  branch: string | null;
};
export type ToolStatus = 'ok' | 'error' | 'invalid' | 'missing';
export type ToolResult = {
  status: ToolStatus;
  errorClass: string | null;
  outputHash: string | null;
};
export type ToolUse = ToolCall & ToolResult & { flags: string[] };

export type Msg = {
  session: string;
  ts: number;
  role: string;
  finishReason: string | null;
  failedTurn: boolean;
  toolCalls: ToolCall[];
  toolCallId: string | null;
  result: ToolResult | null;
};
export type Session = { id: string; source: string; cwd: string | null; endReason: string | null };

export type RunKind = 'task' | 'overhead' | 'outside_repo';
export type Step = {
  session: string;
  runId: string;
  taskId: string | null;
  kind: RunKind;
  index: number;
  ts: number;
  finishReason: string | null;
  failedTurn: boolean;
  tools: ToolUse[];
  calls: Call[];
  flags: string[];
};
export type Mark = {
  session: string;
  ts: number;
  runId: string;
  taskId: string | null;
  kind: RunKind;
};

export const hash = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 16);
const ratio = (a: number, b: number) => (b ? a / b : null);
const sum = <T>(items: T[], f: (item: T) => number) =>
  items.reduce((acc, item) => acc + f(item), 0);

export const groupBy = <T>(items: T[], key: (item: T) => string) => {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
};

const canonical = (value: unknown) =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v
  );

// ---------- parsing ----------

export const normalizeTokens = (
  tokensIn: number,
  cacheRead: number,
  tokensOut: number
): Tokens => ({
  prompt: Math.max(0, tokensIn - cacheRead),
  cached: cacheRead,
  completion: tokensOut
});

const CHECKOUT = /\bgit\s+(?:-C\s+\S+\s+)?(?:checkout|switch)\s+(?:-[bBcC]\s+)?([\w./-]+)/g;

export function branchSwitch(text: string): string | null {
  let last: string | null = null;
  for (const [, target] of text.matchAll(CHECKOUT)) {
    if (/PSI-\d{3}/.test(target) || target === 'master' || target === 'main') last = target;
  }
  return last;
}

export const taskOfBranch = (branch: string) => branch.match(/PSI-\d{3}/)?.[0] ?? null;

export function parseToolCalls(json: string | null): ToolCall[] {
  if (!json) return [];
  let list: unknown;
  try {
    list = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  return list.map((raw: Record<string, any>) => {
    const fn = raw?.function ?? raw ?? {};
    const args =
      typeof fn.arguments === 'string' ? fn.arguments : JSON.stringify(fn.arguments ?? {});
    let normalized = '{}';
    let valid = true;
    if (args.trim()) {
      try {
        normalized = canonical(JSON.parse(args));
      } catch {
        valid = false;
        normalized = args;
      }
    }
    return {
      id: String(raw?.id ?? ''),
      callId: raw?.call_id ? String(raw.call_id) : null,
      name: String(fn.name ?? 'unknown'),
      argsHash: hash(normalized),
      valid,
      branch: branchSwitch(args)
    };
  });
}

const INVALID_CALL =
  /unknown tool|not a valid tool|no such tool|invalid (json|arguments?|parameters?)|missing required|validation error|unexpected (keyword )?argument/i;

export function errorClass(text: string): string {
  if (INVALID_CALL.test(text)) return 'invalid_call';
  if (/timed? ?out|timeout/i.test(text)) return 'timeout';
  if (/not found|no such file|ENOENT|does not exist/i.test(text)) return 'not_found';
  if (/permission|denied|EACCES|EPERM|not allowed|forbidden/i.test(text)) return 'permission';
  if (/Traceback \(most recent call last\)|exception/i.test(text)) return 'exception';
  return 'other';
}

// Only the status, a coarse error class and a hash leave this function; never the content (C-08, C-18).
export function classifyToolResult(content: string | null): ToolResult {
  const text = content ?? '';
  const outputHash = hash(text);
  const result = (status: ToolStatus, cls: string | null): ToolResult => ({
    status: cls === 'invalid_call' ? 'invalid' : status,
    errorClass: cls,
    outputHash
  });
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {}
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const o = parsed as Record<string, unknown>;
    const err = typeof o.error === 'string' ? o.error : o.error ? JSON.stringify(o.error) : '';
    if (typeof o.exit_code === 'number') {
      return o.exit_code === 0
        ? result('ok', null)
        : result('error', err ? errorClass(err) : 'exit_code');
    }
    if (o.success === false) return result('error', err ? errorClass(err) : 'success_false');
    if (err) return result('error', errorClass(err));
    return result('ok', null);
  }
  if (/Traceback \(most recent call last\)/.test(text)) return result('error', 'exception');
  if (/^\s*error\b/i.test(text)) return result('error', errorClass(text.slice(0, 500)));
  return result('ok', null);
}

export function parseTaskStatus(markdown: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const block of markdown
    .replace(/```[\s\S]*?```/g, '')
    .split(/^### /m)
    .slice(1)) {
    const id = block.match(/^(PSI-\d{3})/)?.[1];
    const status = block.match(/^- status: (\S+)/m)?.[1];
    if (id && status) out.set(id, status);
  }
  return out;
}

export type BillingDay = {
  date: string;
  requests: number;
  promptTotal: number;
  cached: number;
  completion: number;
  listUsd: number;
  billedUsd: number;
  models: Record<string, number>;
};

// Cheaper Inference "savings" export: one row per day plus a Total row (skipped).
export function parseBillingCsv(text: string): BillingDay[] {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const cols = header.split(',');
  const at = (name: string) => {
    const i = cols.indexOf(name);
    if (i < 0) throw new Error(`billing CSV: missing column "${name}"`);
    return i;
  };
  const c = {
    date: at('Date'),
    requests: at('Requests'),
    prompt: at('Prompt tokens'),
    cached: at('Prompt tokens served from cache'),
    completion: at('Completion tokens'),
    list: at('List cost (USD)'),
    billed: at('Billed (USD)'),
    models: at('Models (most used first)')
  };
  return lines
    .map((line) => line.split(','))
    .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f[c.date]))
    .map((f) => {
      if (f.length !== cols.length)
        throw new Error(`billing CSV: expected ${cols.length} fields, got ${f.length}`);
      return {
        date: f[c.date],
        requests: Number(f[c.requests]),
        promptTotal: Number(f[c.prompt]),
        cached: Number(f[c.cached]),
        completion: Number(f[c.completion]),
        listUsd: Number(f[c.list]),
        billedUsd: Number(f[c.billed]),
        models: Object.fromEntries(
          [...f[c.models].matchAll(/([^;()]+?)\s*\((\d+)\)/g)].map(([, model, n]) => [
            model.trim(),
            Number(n)
          ])
        )
      };
    });
}

// ---------- runs and steps ----------

const normPath = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
const MISSING: ToolResult = { status: 'missing', errorClass: null, outputHash: null };

// A run is the part of one Hermes session between branch switches; `git checkout task/PSI-xxx`
// starts a task run, `git checkout master|main` starts overhead.
export function buildSteps(sessions: Session[], msgs: Msg[], repoPaths: string[]) {
  const repos = repoPaths.map(normPath);
  const outside = (cwd: string | null) =>
    cwd !== null && !repos.some((r) => normPath(cwd).startsWith(r));
  const bySession = groupBy(msgs, (m) => m.session);
  const steps: Step[] = [];
  const marks: Mark[] = [];
  for (const session of sessions) {
    const list = (bySession.get(session.id) ?? []).toSorted((a, b) => a.ts - b.ts);
    const results = new Map<string, ToolResult>();
    for (const m of list)
      if (m.role === 'tool' && m.toolCallId && m.result) results.set(m.toolCallId, m.result);
    const external = outside(session.cwd);
    let task: string | null = null;
    let segment = 0;
    const counters = new Map<string, number>();
    for (const m of list) {
      const branch = m.toolCalls.findLast((t) => t.branch)?.branch;
      if (branch && taskOfBranch(branch) !== task) {
        task = taskOfBranch(branch);
        segment++;
      }
      const kind: RunKind = external ? 'outside_repo' : task ? 'task' : 'overhead';
      const taskId = external ? null : task;
      const runId = `${session.id}#${taskId ?? kind}#${segment}`;
      marks.push({ session: session.id, ts: m.ts, runId, taskId, kind });
      if (m.role !== 'assistant') continue;
      const index = (counters.get(runId) ?? 0) + 1;
      counters.set(runId, index);
      steps.push({
        session: session.id,
        runId,
        taskId,
        kind,
        index,
        ts: m.ts,
        finishReason: m.finishReason,
        failedTurn: m.failedTurn,
        tools: m.toolCalls.map((t) => ({
          ...t,
          ...(results.get(t.id) ?? (t.callId ? results.get(t.callId) : undefined) ?? MISSING),
          flags: []
        })),
        calls: [],
        flags: []
      });
    }
  }
  return { steps, marks };
}

const firstAtOrAfter = <T>(list: T[], value: number, key: (item: T) => number) => {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (key(list[mid]) < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

export type JoinWindows = {
  okStepS: number;
  failedStepS: number;
  runS: number;
  toleranceS: number;
};
// Hermes stores a turn within ~0.25 s of the successful call that produced it (OmniRoute `timestamp` is the
// call's end). A failed attempt precedes the retry that produces the turn, so it gets a longer window.
export const JOIN_WINDOWS: JoinWindows = {
  okStepS: 3,
  failedStepS: 600,
  runS: 600,
  toleranceS: 0.5
};

// ponytail: time-based join (Hermes never records which API call produced a turn). A call belongs to the
// first assistant turn that follows it; failing that, to the run active when it ended. Exact linkage
// needs the phase-B Hermes plugin.
export function joinCalls(
  steps: Step[],
  marks: Mark[],
  calls: Call[],
  w: JoinWindows = JOIN_WINDOWS
) {
  const stepLists = [...groupBy(steps, (s) => s.session).values()].map((l) =>
    l.toSorted((a, b) => a.ts - b.ts)
  );
  const markLists = [...groupBy(marks, (m) => m.session).values()].map((l) =>
    l.toSorted((a, b) => a.ts - b.ts)
  );
  const aux = new Map<string, Call[]>();
  const unattributed: Call[] = [];
  let contested = 0;
  for (const call of calls) {
    const windowS = call.status === 200 ? w.okStepS : w.failedStepS;
    const candidates = stepLists
      .map((list) => list[firstAtOrAfter(list, call.end - w.toleranceS, (s) => s.ts)])
      .filter((s): s is Step => s !== undefined && s.ts - call.end <= windowS)
      .toSorted((a, b) => a.ts - b.ts);
    if (candidates.length) {
      if (candidates.length > 1) contested++;
      candidates[0].calls.push(call);
      continue;
    }
    const owner = markLists
      .map((list) => list[firstAtOrAfter(list, call.end + w.toleranceS, (m) => m.ts) - 1])
      .filter((m): m is Mark => m !== undefined && call.end - m.ts <= w.runS)
      .toSorted((a, b) => b.ts - a.ts)[0];
    if (!owner) unattributed.push(call);
    else if (aux.has(owner.runId)) aux.get(owner.runId)!.push(call);
    else aux.set(owner.runId, [call]);
  }
  return { aux, unattributed, contested };
}

// Gateway timeouts and disconnects are usually still processed (and billed) upstream; OmniRoute logs
// them with 0 tokens. Estimate them from the successful attempt of the same request.
export const likelyBilled = (status: number) => status === 499 || status >= 500;

export function estimateFailedAttempts(steps: Step[]): number {
  let estimated = 0;
  for (const step of steps) {
    const ok = step.calls.filter((c) => c.status === 200);
    if (!ok.length) continue;
    step.calls = step.calls.map((c) => {
      if (c.status === 200 || !likelyBilled(c.status) || c.prompt + c.cached + c.completion > 0)
        return c;
      const ref = ok.find((o) => c.corr !== null && o.corr === c.corr) ?? ok[0];
      estimated++;
      return {
        ...c,
        prompt: ref.prompt,
        cached: ref.cached,
        completion: ref.completion,
        estimated: true
      };
    });
  }
  return estimated;
}

// ---------- waste detection ----------

export const WASTE_STEP_FLAGS = ['truncated_output', 'failed_turn', 'budget_exceeded'];
export const WASTE_TOOL_FLAGS = ['invalid_tool_call', 'no_new_info', 'repeated_error'];
export type Limits = { retryThreshold: number; budgetUsd: number | null };

// Loop detector: same tool + same args hash earlier in the same run.
export function flagTools(steps: Step[]): void {
  const seen = new Map<string, Map<string, ToolUse>>();
  for (const step of steps) {
    const run = seen.get(step.runId) ?? new Map<string, ToolUse>();
    seen.set(step.runId, run);
    for (const tool of step.tools) {
      const key = `${tool.name}:${tool.argsHash}`;
      const prev = run.get(key);
      if (!tool.valid || tool.status === 'invalid') tool.flags.push('invalid_tool_call');
      if (tool.status === 'error') tool.flags.push('tool_error');
      if (prev) {
        tool.flags.push('repeat_call');
        if (prev.outputHash !== null && prev.outputHash === tool.outputHash)
          tool.flags.push('no_new_info');
        if (prev.status === 'error' && tool.status === 'error') tool.flags.push('repeated_error');
      }
      run.set(key, tool);
    }
  }
}

// Retry monitor (failed attempts > N) and budget monitor (run spend already over budget).
export function flagSteps(steps: Step[], pricing: Pricing, limits: Limits): void {
  const spent = new Map<string, number>();
  for (const step of steps) {
    const failed = step.calls.filter((c) => c.status !== 200).length;
    if (failed > 0) step.flags.push('failed_attempt');
    if (failed > limits.retryThreshold) step.flags.push('retry_storm');
    if (step.finishReason === 'length') step.flags.push('truncated_output');
    if (step.failedTurn) step.flags.push('failed_turn');
    const before = spent.get(step.runId) ?? 0;
    if (limits.budgetUsd !== null && before > limits.budgetUsd) step.flags.push('budget_exceeded');
    spent.set(step.runId, before + tally(step.calls, pricing).usd);
  }
}

export const retryCount = (step: Step) => step.calls.filter((c) => c.status !== 200).length;

export function wasteFraction(step: Step): number {
  if (step.flags.some((f) => WASTE_STEP_FLAGS.includes(f))) return 1;
  if (!step.tools.length) return 0;
  return (
    step.tools.filter((t) => t.flags.some((f) => WASTE_TOOL_FLAGS.includes(f))).length /
    step.tools.length
  );
}

// ---------- cost ----------

export type Tally = Tokens & { calls: number; usd: number; unpriced: number };
export const zero = (): Tally => ({
  calls: 0,
  prompt: 0,
  cached: 0,
  completion: 0,
  usd: 0,
  unpriced: 0
});
export const add = (a: Tally, b: Tally): Tally => ({
  calls: a.calls + b.calls,
  prompt: a.prompt + b.prompt,
  cached: a.cached + b.cached,
  completion: a.completion + b.completion,
  usd: a.usd + b.usd,
  unpriced: a.unpriced + b.unpriced
});
export const scale = (t: Tally, k: number): Tally => ({
  calls: t.calls * k,
  prompt: t.prompt * k,
  cached: t.cached * k,
  completion: t.completion * k,
  usd: t.usd * k,
  unpriced: t.unpriced * k
});
export const tokensOf = (t: Tokens) => t.prompt + t.cached + t.completion;

export const priceFor = (pricing: Pricing, provider: string, model: string): Price | null =>
  pricing[`${provider}/${model}`] ?? pricing[provider] ?? null;

export const costOf = (t: Tokens, p: Price) =>
  (t.prompt * p.input + t.cached * p.cached + t.completion * p.output) / 1e6;

export function tally(calls: Call[], pricing: Pricing, weight = 1): Tally {
  const t = zero();
  for (const c of calls) {
    const price = priceFor(pricing, c.provider, c.model);
    t.calls += weight;
    t.prompt += c.prompt * weight;
    t.cached += c.cached * weight;
    t.completion += c.completion * weight;
    if (price) t.usd += costOf(c, price) * weight;
    else t.unpriced += tokensOf(c) * weight;
  }
  return t;
}

// Failed attempts are always waste; a flagged turn wastes its share of the successful call.
export function account(step: Step, pricing: Pricing) {
  const ok = step.calls.filter((c) => c.status === 200);
  const failed = step.calls.filter((c) => c.status !== 200);
  return {
    total: tally(step.calls, pricing),
    waste: add(tally(failed, pricing), tally(ok, pricing, wasteFraction(step)))
  };
}

// ---------- outcomes ----------

export const CHECKS = ['typecheck', 'lint', 'build', 'db_reset', 'db_tests'] as const;
export type Attempt = {
  id: string;
  outcome: string;
  checks: Partial<Record<(typeof CHECKS)[number], string>>;
  claimedStart: string | null;
  claimedEnd: string | null;
};
export type Verdict = 'pass' | 'fail' | 'unverified';
export type Outcome = 'success' | 'failed' | 'unverified' | 'pending' | 'n/a';
export type TaskResult = {
  taskId: string;
  status: string;
  attempts: Attempt[];
  verdicts: Verdict[];
  outcome: Outcome;
};

// Success = history outcome done, every check pass or n/a (C-12: skipped is not pass), and the human stamp.
export function verdict(a: Attempt): Verdict {
  const values = CHECKS.map((k) => a.checks[k] ?? 'skipped');
  if (a.outcome === 'blocked' || a.outcome === 'abandoned' || values.includes('fail'))
    return 'fail';
  return a.outcome === 'done' && values.every((v) => v === 'pass' || v === 'n/a')
    ? 'pass'
    : 'unverified';
}

export function taskResult(
  taskId: string,
  status: string | undefined,
  attempts: Attempt[]
): TaskResult {
  const sorted = attempts.toSorted((a, b) => a.id.localeCompare(b.id));
  const verdicts = sorted.map(verdict);
  const last = verdicts.at(-1);
  const st = status ?? 'unknown';
  const outcome: Outcome =
    st === 'blocked' || last === 'fail'
      ? 'failed'
      : st !== 'done'
        ? 'pending'
        : last === 'pass'
          ? 'success'
          : 'unverified';
  return { taskId, status: st, attempts: sorted, verdicts, outcome };
}

// pass@k over resolved tasks: did any of the first k recorded attempts pass, and did a human stamp it done?
export function passAtK(results: TaskResult[]) {
  const resolved = results.filter(
    (r) => r.attempts.length && (r.status === 'done' || r.status === 'blocked')
  );
  const passed = (r: TaskResult, k: number) =>
    r.status === 'done' && r.verdicts.slice(0, k).includes('pass');
  const maxK = Math.max(0, ...resolved.map((r) => r.attempts.length));
  return {
    n: resolved.length,
    maxK,
    pass1: ratio(resolved.filter((r) => passed(r, 1)).length, resolved.length),
    passK: ratio(resolved.filter((r) => passed(r, maxK)).length, resolved.length)
  };
}

export type Run = {
  id: string;
  session: string;
  taskId: string | null;
  kind: RunKind;
  steps: Step[];
  aux: Call[];
  start: number;
  end: number;
  outcome: Outcome;
  total: Tally;
  waste: Tally;
};

export function buildRuns(
  steps: Step[],
  marks: Mark[],
  aux: Map<string, Call[]>,
  tasks: Map<string, TaskResult>,
  pricing: Pricing
): Run[] {
  const meta = new Map(marks.map((m) => [m.runId, m]));
  const byRun = groupBy(steps, (s) => s.runId);
  return [...new Set([...byRun.keys(), ...aux.keys()])].map((id) => {
    const m = meta.get(id)!;
    const runSteps = byRun.get(id) ?? [];
    const auxCalls = aux.get(id) ?? [];
    let total = tally(auxCalls, pricing);
    let waste = tally(
      auxCalls.filter((c) => c.status !== 200),
      pricing
    );
    for (const step of runSteps) {
      const a = account(step, pricing);
      total = add(total, a.total);
      waste = add(waste, a.waste);
    }
    const times = [...runSteps.map((s) => s.ts), ...auxCalls.map((c) => c.end)];
    return {
      id,
      session: m.session,
      taskId: m.taskId,
      kind: m.kind,
      steps: runSteps,
      aux: auxCalls,
      start: Math.min(...times),
      end: Math.max(...times),
      outcome: m.kind === 'task' ? (tasks.get(m.taskId!)?.outcome ?? 'unverified') : 'n/a',
      total,
      waste
    };
  });
}

export const BUCKETS = [
  'successful',
  'wasted',
  'unverified',
  'pending',
  'overhead',
  'outside_repo',
  'unattributed'
] as const;
export type Bucket = (typeof BUCKETS)[number];

// wasted = every token of a failed run + flagged waste inside any other run + failed unattributed attempts.
export function buckets(
  runs: Run[],
  unattributed: Call[],
  pricing: Pricing
): Record<Bucket, Tally> {
  const out = Object.fromEntries(BUCKETS.map((b) => [b, zero()])) as Record<Bucket, Tally>;
  const put = (b: Bucket, t: Tally) => {
    out[b] = add(out[b], t);
  };
  for (const r of runs) {
    if (r.outcome === 'failed') {
      put('wasted', r.total);
      continue;
    }
    put('wasted', r.waste);
    const clean = add(r.total, scale(r.waste, -1));
    if (r.outcome === 'success') put('successful', clean);
    else if (r.outcome === 'unverified' || r.outcome === 'pending') put(r.outcome, clean);
    else put(r.kind === 'outside_repo' ? 'outside_repo' : 'overhead', clean);
  }
  put(
    'wasted',
    tally(
      unattributed.filter((c) => c.status !== 200),
      pricing
    )
  );
  put(
    'unattributed',
    tally(
      unattributed.filter((c) => c.status === 200),
      pricing
    )
  );
  return out;
}

export function rates(steps: Step[], calls: Call[]) {
  const tools = steps.flatMap((s) => s.tools);
  const withResult = tools.filter((t) => t.status !== 'missing');
  const joined = steps.filter((s) => s.calls.length);
  const ok = calls.filter((c) => c.status === 200);
  const flagged = (flag: string) => tools.filter((t) => t.flags.includes(flag)).length;
  const stepFlagged = (flag: string) => steps.filter((s) => s.flags.includes(flag)).length;
  return {
    steps: steps.length,
    toolCalls: tools.length,
    repeatCalls: flagged('repeat_call'),
    noNewInfo: flagged('no_new_info'),
    repeatedErrors: flagged('repeated_error'),
    invalidToolCalls: flagged('invalid_tool_call'),
    toolErrors: flagged('tool_error'),
    loopRate: ratio(flagged('repeat_call'), tools.length),
    toolErrorRate: ratio(
      withResult.filter((t) => t.status === 'error' || t.status === 'invalid').length,
      withResult.length
    ),
    retryRate: ratio(
      joined.filter((s) => s.flags.includes('failed_attempt')).length,
      joined.length
    ),
    retryStorms: stepFlagged('retry_storm'),
    truncated: stepFlagged('truncated_output'),
    failedTurns: stepFlagged('failed_turn'),
    overBudget: stepFlagged('budget_exceeded'),
    attempts: calls.length,
    failedAttempts: calls.filter((c) => c.status !== 200).length,
    attemptFailureRate: ratio(calls.filter((c) => c.status !== 200).length, calls.length),
    cacheHitRate: ratio(
      sum(ok, (c) => c.cached),
      sum(ok, (c) => c.prompt + c.cached)
    )
  };
}

// ---------- billing reconciliation ----------

export type Recon = {
  provider: string;
  period: string;
  billed: Tokens & { requests: number; usd: number; listUsd: number };
  delivered: Tokens & { requests: number; failed: number; likelyBilledFailed: number };
  expectedUsd: number | null;
  actualPer1M: number | null;
  expectedPer1M: number | null;
  actualVsExpectedPct: number | null;
  deliveredPer1M: number | null;
  undeliveredPct: number | null;
  flags: string[];
};

const utcDay = (epochS: number) => new Date(epochS * 1000).toISOString().slice(0, 10);

// Actual = what the provider billed. Expected = pricing table x billed tokens. Delivered = tokens OmniRoute
// received back, for the models the bill lists. Flags when actual beats expected, or paid tokens beat
// delivered tokens, by more than N%.
export function reconcile(
  provider: string,
  days: BillingDay[],
  accountCalls: Call[],
  price: Price | null,
  thresholdPct: number
): Recon[] {
  const billedModels = new Set(days.flatMap((d) => Object.keys(d.models)));
  const calls = accountCalls.filter(
    (c) => c.provider === provider && (billedModels.size === 0 || billedModels.has(c.model))
  );
  const row = (period: string, bill: BillingDay[], cs: Call[]): Recon => {
    const billed = {
      requests: sum(bill, (d) => d.requests),
      prompt: sum(bill, (d) => d.promptTotal - d.cached),
      cached: sum(bill, (d) => d.cached),
      completion: sum(bill, (d) => d.completion),
      usd: sum(bill, (d) => d.billedUsd),
      listUsd: sum(bill, (d) => d.listUsd)
    };
    const ok = cs.filter((c) => c.status === 200);
    const delivered = {
      requests: ok.length,
      prompt: sum(ok, (c) => c.prompt),
      cached: sum(ok, (c) => c.cached),
      completion: sum(ok, (c) => c.completion),
      failed: cs.length - ok.length,
      likelyBilledFailed: cs.filter((c) => c.status !== 200 && likelyBilled(c.status)).length
    };
    const billedTokens = tokensOf(billed);
    const deliveredTokens = tokensOf(delivered);
    const expectedUsd = price ? costOf(billed, price) : null;
    const actualPer1M = billedTokens ? (billed.usd / billedTokens) * 1e6 : null;
    const expectedPer1M =
      expectedUsd === null || !billedTokens ? null : (expectedUsd / billedTokens) * 1e6;
    const actualVsExpectedPct =
      actualPer1M !== null && expectedPer1M ? (actualPer1M / expectedPer1M - 1) * 100 : null;
    const deliveredPer1M = deliveredTokens ? (billed.usd / deliveredTokens) * 1e6 : null;
    const undeliveredPct = deliveredTokens ? (billedTokens / deliveredTokens - 1) * 100 : null;
    const flags: string[] = [];
    if (actualVsExpectedPct !== null && actualVsExpectedPct > thresholdPct)
      flags.push('actual_over_expected');
    if (undeliveredPct !== null && undeliveredPct > thresholdPct)
      flags.push('paid_for_undelivered');
    return {
      provider,
      period,
      billed,
      delivered,
      expectedUsd,
      actualPer1M,
      expectedPer1M,
      actualVsExpectedPct,
      deliveredPer1M,
      undeliveredPct,
      flags
    };
  };
  const dates = new Set(days.map((d) => d.date));
  return [
    ...days.map((d) =>
      row(
        d.date,
        [d],
        calls.filter((c) => utcDay(c.end) === d.date)
      )
    ),
    row(
      'total',
      days,
      calls.filter((c) => dates.has(utcDay(c.end)))
    )
  ];
}

export function reconcileModels(provider: string, days: BillingDay[], accountCalls: Call[]) {
  const dates = new Set(days.map((d) => d.date));
  const calls = accountCalls.filter((c) => c.provider === provider && dates.has(utcDay(c.end)));
  const billed = new Map<string, number>();
  for (const d of days)
    for (const [m, n] of Object.entries(d.models)) billed.set(m, (billed.get(m) ?? 0) + n);
  const models = new Set([
    ...billed.keys(),
    ...calls.filter((c) => c.status === 200).map((c) => c.model)
  ]);
  return [...models]
    .map((model) => {
      const mine = calls.filter((c) => c.model === model);
      const ok = mine.filter((c) => c.status === 200).length;
      const billedRequests = billed.get(model) ?? 0;
      return {
        model,
        billedRequests,
        deliveredOk: ok,
        likelyBilledFailed: mine.filter((c) => c.status !== 200 && likelyBilled(c.status)).length,
        excess: billedRequests - ok
      };
    })
    .toSorted((a, b) => b.billedRequests - a.billedRequests || b.deliveredOk - a.deliveredOk);
}
