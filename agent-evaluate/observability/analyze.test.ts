import { describe, expect, test } from 'bun:test';
import {
  account,
  branchSwitch,
  buckets,
  buildSteps,
  classifyToolResult,
  costOf,
  estimateFailedAttempts,
  flagSteps,
  flagTools,
  joinCalls,
  normalizeTokens,
  parseBillingCsv,
  parseTaskStatus,
  parseToolCalls,
  passAtK,
  priceFor,
  reconcile,
  retryCount,
  tally,
  taskOfBranch,
  taskResult,
  verdict,
  zero,
  type Attempt,
  type Call,
  type Mark,
  type Msg,
  type Outcome,
  type Run,
  type RunKind,
  type Session,
  type Step,
  type ToolUse
} from './analyze';

const call = (over: Partial<Call> = {}): Call => ({
  id: 'c',
  corr: null,
  apiKey: 'k',
  provider: 'p',
  model: 'm',
  status: 200,
  errorType: null,
  end: 100,
  durationS: 1,
  prompt: 0,
  cached: 0,
  completion: 0,
  estimated: false,
  ...over
});
const step = (over: Partial<Step> = {}): Step => ({
  session: 's',
  runId: 'r',
  taskId: 'PSI-001',
  kind: 'task',
  index: 1,
  ts: 100,
  finishReason: 'tool_calls',
  failedTurn: false,
  tools: [],
  calls: [],
  flags: [],
  ...over
});
const tool = (over: Partial<ToolUse> = {}): ToolUse => ({
  id: 't',
  callId: null,
  name: 'terminal',
  argsHash: 'a',
  valid: true,
  branch: null,
  status: 'ok',
  errorClass: null,
  outputHash: 'o',
  flags: [],
  ...over
});
const perMillion = { p: { input: 1, cached: 0, output: 0 } };

describe('cost calculator', () => {
  const pricing = {
    cheap: { input: 0.2, cached: 0.04, output: 0.4 },
    'cheap/special': { input: 1, cached: 1, output: 1 }
  };

  test('cached tokens are split out of the prompt, never counted twice', () => {
    const t = normalizeTokens(1_000_000, 800_000, 100_000);
    expect(t).toEqual({ prompt: 200_000, cached: 800_000, completion: 100_000 });
    expect(costOf(t, pricing.cheap)).toBeCloseTo(0.2 * 0.2 + 0.8 * 0.04 + 0.1 * 0.4, 10);
  });

  test('a model price overrides the provider price; unknown providers stay unpriced', () => {
    expect(priceFor(pricing, 'cheap', 'special')).toBe(pricing['cheap/special']);
    const t = tally(
      [call({ provider: 'cheap', prompt: 1e6 }), call({ provider: 'other', prompt: 5 })],
      pricing
    );
    expect(t.usd).toBeCloseTo(0.2, 10);
    expect(t.unpriced).toBe(5);
  });
});

describe('parsing', () => {
  test('branch switches and task ids', () => {
    expect(branchSwitch('cd repo && git checkout -b task/PSI-041')).toBe('task/PSI-041');
    expect(branchSwitch('git switch task/PSI-044 && git pull')).toBe('task/PSI-044');
    expect(branchSwitch('git checkout task/PSI-040 && git checkout master')).toBe('master');
    expect(branchSwitch('git checkout -- src/a.ts')).toBeNull();
    expect(branchSwitch('git status')).toBeNull();
    expect(taskOfBranch('agent/PSI-012-rbac')).toBe('PSI-012');
  });

  test('tool args hash ignores key order; malformed args are invalid', () => {
    const [a, b, c] = parseToolCalls(
      JSON.stringify([
        { id: '1', function: { name: 'terminal', arguments: '{"command":"ls","timeout":5}' } },
        { id: '2', function: { name: 'terminal', arguments: '{"timeout":5,"command":"ls"}' } },
        {
          id: '3',
          function: { name: 'terminal', arguments: '{"command": "git checkout task/PSI-007' }
        }
      ])
    );
    expect(a.argsHash).toBe(b.argsHash);
    expect(a.valid).toBe(true);
    expect(c.valid).toBe(false);
    expect(c.branch).toBe('task/PSI-007');
  });

  test('tool results become a status, an error class and a hash', () => {
    expect(classifyToolResult('{"exit_code":0,"output":"ok","error":null}').status).toBe('ok');
    expect(classifyToolResult('{"exit_code":1,"error":"ENOENT: no such file"}')).toMatchObject({
      status: 'error',
      errorClass: 'not_found'
    });
    expect(classifyToolResult('{"exit_code":2,"output":"x"}')).toMatchObject({
      status: 'error',
      errorClass: 'exit_code'
    });
    expect(classifyToolResult('{"success":false}')).toMatchObject({
      status: 'error',
      errorClass: 'success_false'
    });
    expect(classifyToolResult('{"error":"Unknown tool: foo"}').status).toBe('invalid');
    expect(classifyToolResult('Traceback (most recent call last):\n  x').status).toBe('error');
    expect(classifyToolResult('{"content":"file text"}').status).toBe('ok');
    expect(classifyToolResult('same').outputHash).toBe(classifyToolResult('same').outputHash);
  });

  test('task list parser ignores fenced examples', () => {
    const md =
      '# x\n```\n### PSI-999 · Example\n- status: todo\n```\n### PSI-001 · A\n- status: done\n\n### PSI-002 · B\n- status: doing\n';
    expect([...parseTaskStatus(md)]).toEqual([
      ['PSI-001', 'done'],
      ['PSI-002', 'doing']
    ]);
  });

  const csv = [
    'Date,Requests,Prompt tokens,Prompt tokens served from cache,Share of prompt tokens served from cache,Completion tokens,Tokens saved,List cost (USD),Billed (USD),Saved (USD),Savings %,Models (most used first)',
    '2026-09-24,10,1000000,600000,60,10000,0,1.0,0.5,0.5,50,deepseek-v4-flash (8); glm-5.2 (2)',
    'Total,10,1000000,600000,60,10000,0,1.0,0.5,0.5,50,deepseek-v4-flash (8); glm-5.2 (2)'
  ].join('\n');

  test('billing CSV parser skips the Total row', () => {
    const [day, ...rest] = parseBillingCsv(csv);
    expect(rest).toEqual([]);
    expect(day).toMatchObject({
      date: '2026-09-24',
      requests: 10,
      promptTotal: 1_000_000,
      cached: 600_000,
      completion: 10_000,
      billedUsd: 0.5,
      models: { 'deepseek-v4-flash': 8, 'glm-5.2': 2 }
    });
  });

  test('reconcile flags tokens paid for but not delivered, and actual cost above expected', () => {
    const at = Date.parse('2026-09-24T12:00:00Z') / 1000;
    const billed = { provider: 'ci', model: 'deepseek-v4-flash', end: at };
    const delivered = Array.from({ length: 8 }, (_, i) =>
      call({ ...billed, id: `ok${i}`, prompt: 40_000, cached: 60_000, completion: 1_000 })
    );
    const timeouts = [call({ ...billed, status: 504 }), call({ ...billed, status: 504 })];
    const notOnTheBill = call({ ...billed, model: 'free-trial', prompt: 999_999 });
    const [day, total] = reconcile(
      'ci',
      parseBillingCsv(csv),
      [...delivered, ...timeouts, notOnTheBill],
      { input: 0.2, cached: 0.04, output: 0.4 },
      10
    );
    expect(day.delivered).toMatchObject({ requests: 8, likelyBilledFailed: 2 });
    expect(day.undeliveredPct).toBeCloseTo((1_010_000 / 808_000 - 1) * 100, 6);
    expect(day.expectedUsd).toBeCloseTo(0.4 * 0.2 + 0.6 * 0.04 + 0.01 * 0.4, 10);
    expect(day.flags).toEqual(['actual_over_expected', 'paid_for_undelivered']);
    expect(total.period).toBe('total');
  });
});

describe('reconcile edge cases', () => {
  test('a billing day with no tokens and no calls yields n/a, not NaN or Infinity', () => {
    const empty = {
      date: '2026-09-01',
      requests: 0,
      promptTotal: 0,
      cached: 0,
      completion: 0,
      listUsd: 0,
      billedUsd: 0,
      models: {}
    };
    const [day] = reconcile('ci', [empty], [], { input: 1, cached: 1, output: 1 }, 10);
    expect(day).toMatchObject({
      actualPer1M: null,
      expectedPer1M: null,
      actualVsExpectedPct: null,
      undeliveredPct: null,
      flags: []
    });
  });
});

describe('runs and joins', () => {
  test('runs split on task branch switches; results pair by call id; other cwd is outside the repo', () => {
    const sessions: Session[] = [
      { id: 's1', source: 'cli', cwd: 'D:\\repo', endReason: null },
      { id: 's2', source: 'cli', cwd: 'D:\\elsewhere', endReason: null }
    ];
    const calls = (id: string, command: string) =>
      parseToolCalls(
        JSON.stringify([
          { id, function: { name: 'terminal', arguments: JSON.stringify({ command }) } }
        ])
      );
    const msg = (session: string, ts: number, role: string, extra: Partial<Msg> = {}): Msg => ({
      session,
      ts,
      role,
      finishReason: null,
      failedTurn: false,
      toolCalls: [],
      toolCallId: null,
      result: null,
      ...extra
    });
    const { steps } = buildSteps(
      sessions,
      [
        msg('s1', 1, 'user'),
        msg('s1', 2, 'assistant', { toolCalls: calls('a', 'git status') }),
        msg('s1', 3, 'tool', { toolCallId: 'a', result: classifyToolResult('{"exit_code":0}') }),
        msg('s1', 4, 'assistant', { toolCalls: calls('b', 'git checkout -b task/PSI-041') }),
        msg('s1', 5, 'assistant', { toolCalls: calls('c', 'bun run build') }),
        msg('s1', 6, 'tool', { toolCallId: 'c', result: classifyToolResult('{"exit_code":1}') }),
        msg('s1', 7, 'assistant', { toolCalls: calls('d', 'git checkout master') }),
        msg('s2', 1, 'assistant')
      ],
      ['d:/repo/']
    );
    expect(steps.map((s) => [s.kind, s.taskId, s.index])).toEqual([
      ['overhead', null, 1],
      ['task', 'PSI-041', 1],
      ['task', 'PSI-041', 2],
      ['overhead', null, 1],
      ['outside_repo', null, 1]
    ]);
    expect(steps[0].tools[0].status).toBe('ok');
    expect(steps[1].tools[0].status).toBe('missing');
    expect(steps[2].tools[0]).toMatchObject({ status: 'error', errorClass: 'exit_code' });
    expect(new Set(steps.map((s) => s.runId)).size).toBe(4);
  });

  test('join: the turn right after a call owns it, failed attempts before it too; else run-level or unattributed', () => {
    const s = step({ session: 's1', runId: 'run1', ts: 1000 });
    const marks: Mark[] = [
      { session: 's1', ts: 900, runId: 'run1', taskId: 'PSI-001', kind: 'task' },
      { session: 's1', ts: 1000, runId: 'run1', taskId: 'PSI-001', kind: 'task' }
    ];
    const { aux, unattributed } = joinCalls([s], marks, [
      call({ id: 'ok', end: 999.8 }),
      call({ id: 'failed', status: 504, end: 970 }),
      call({ id: 'aux', end: 950 }),
      call({ id: 'lost', end: 5000 })
    ]);
    expect(s.calls.map((c) => c.id).toSorted()).toEqual(['failed', 'ok']);
    expect(aux.get('run1')?.map((c) => c.id)).toEqual(['aux']);
    expect(unattributed.map((c) => c.id)).toEqual(['lost']);
  });

  test('timeouts inherit the tokens of the successful retry; rejections do not', () => {
    const s = step({
      calls: [
        call({ id: 't', status: 504, corr: 'r1' }),
        call({ id: 'r', status: 429, corr: 'r1' }),
        call({ id: 'ok', corr: 'r1', prompt: 10, cached: 90, completion: 5 })
      ]
    });
    expect(estimateFailedAttempts([s])).toBe(1);
    expect(s.calls[0]).toMatchObject({ prompt: 10, cached: 90, completion: 5, estimated: true });
    expect(s.calls[1]).toMatchObject({ prompt: 0, estimated: false });
  });
});

describe('waste detection', () => {
  test('loop detector: same tool and args in the same run; identical output means no new info', () => {
    const s1 = step({ tools: [tool({ argsHash: 'a', outputHash: 'o1' })] });
    const s2 = step({ tools: [tool({ argsHash: 'a', outputHash: 'o1' })] });
    const s3 = step({ tools: [tool({ argsHash: 'a', outputHash: 'o2' })] });
    const s4 = step({ tools: [tool({ argsHash: 'b' })] });
    const s5 = step({ runId: 'other', tools: [tool({ argsHash: 'a', outputHash: 'o1' })] });
    flagTools([s1, s2, s3, s4, s5]);
    expect(s1.tools[0].flags).toEqual([]);
    expect(s2.tools[0].flags).toEqual(['repeat_call', 'no_new_info']);
    expect(s3.tools[0].flags).toEqual(['repeat_call']);
    expect(s4.tools[0].flags).toEqual([]);
    expect(s5.tools[0].flags).toEqual([]);
  });

  test('a failing call repeated verbatim is an unrecoverable pattern', () => {
    const e1 = step({ tools: [tool({ status: 'error', outputHash: 'x' })] });
    const e2 = step({ tools: [tool({ status: 'error', outputHash: 'y' })] });
    flagTools([e1, e2]);
    expect(e2.tools[0].flags).toEqual(['tool_error', 'repeat_call', 'repeated_error']);
  });

  test('retry monitor (> N failed attempts) and budget monitor', () => {
    const failing = Array.from({ length: 4 }, (_, i) => call({ id: `f${i}`, status: 504 }));
    const s1 = step({ calls: [...failing, call({ prompt: 1e6 })] });
    const s2 = step({ calls: [call({ prompt: 1e6 })], finishReason: 'length' });
    const s3 = step({ calls: [call({ prompt: 1 })] });
    flagSteps([s1, s2, s3], perMillion, { retryThreshold: 3, budgetUsd: 1.5 });
    expect(s1.flags).toEqual(['failed_attempt', 'retry_storm']);
    expect(retryCount(s1)).toBe(4);
    expect(s2.flags).toEqual(['truncated_output']);
    expect(s3.flags).toEqual(['budget_exceeded']);
  });

  test('waste = failed attempts + the flagged share of the turn', () => {
    const s = step({
      tools: [tool({ flags: ['repeat_call', 'no_new_info'] }), tool()],
      calls: [call({ status: 504, prompt: 1e6, estimated: true }), call({ prompt: 1e6 })]
    });
    const { total, waste } = account(s, perMillion);
    expect(total.usd).toBeCloseTo(2, 10);
    expect(waste.usd).toBeCloseTo(1.5, 10);
  });
});

describe('outcomes and classification', () => {
  const pass: Attempt = {
    id: '2026-01-01T00-00-00Z__PSI-001__hermes',
    outcome: 'done',
    checks: { typecheck: 'pass', lint: 'pass', build: 'n/a', db_reset: 'n/a', db_tests: 'n/a' },
    claimedStart: null,
    claimedEnd: null
  };

  test('verdicts and task outcomes', () => {
    const skipped = { ...pass, checks: { ...pass.checks, typecheck: 'skipped' } };
    const failing = { ...pass, checks: { ...pass.checks, lint: 'fail' } };
    expect(verdict(pass)).toBe('pass');
    expect(verdict(skipped)).toBe('unverified');
    expect(verdict(failing)).toBe('fail');
    expect(taskResult('PSI-001', 'done', [pass]).outcome).toBe('success');
    expect(taskResult('PSI-001', 'done', [skipped]).outcome).toBe('unverified');
    expect(taskResult('PSI-001', 'review', [pass]).outcome).toBe('pending');
    expect(taskResult('PSI-001', 'done', [failing]).outcome).toBe('failed');
  });

  test('pass@1 and pass@k', () => {
    const partial = { ...pass, id: '2026-01-01T00-00-00Z__PSI-002__hermes', outcome: 'partial' };
    const retry = { ...pass, id: '2026-01-02T00-00-00Z__PSI-002__hermes' };
    const results = [
      taskResult('PSI-001', 'done', [pass]),
      taskResult('PSI-002', 'done', [retry, partial])
    ];
    expect(passAtK(results)).toEqual({ n: 2, maxK: 2, pass1: 0.5, passK: 1 });
  });

  test('failed runs are all waste; successful runs split into clean and wasted', () => {
    const usd = (v: number) => ({ ...zero(), usd: v });
    const run = (outcome: Outcome, kind: RunKind, total: number, waste: number): Run => ({
      id: outcome,
      session: 's',
      taskId: null,
      kind,
      steps: [],
      aux: [],
      start: 0,
      end: 0,
      outcome,
      total: usd(total),
      waste: usd(waste)
    });
    const b = buckets(
      [run('success', 'task', 10, 2), run('failed', 'task', 5, 1), run('n/a', 'overhead', 3, 0)],
      [call({ status: 504, prompt: 1e6 }), call({ prompt: 2e6 })],
      perMillion
    );
    expect(b.successful.usd).toBeCloseTo(8);
    expect(b.wasted.usd).toBeCloseTo(2 + 5 + 1);
    expect(b.overhead.usd).toBeCloseTo(3);
    expect(b.unattributed.usd).toBeCloseTo(2);
  });
});
