import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  BUCKETS,
  add,
  buckets,
  buildRuns,
  buildSteps,
  estimateFailedAttempts,
  flagSteps,
  flagTools,
  groupBy,
  joinCalls,
  likelyBilled,
  parseBillingCsv,
  parseTaskStatus,
  passAtK,
  priceFor,
  rates,
  reconcile,
  reconcileModels,
  retryCount,
  tally,
  taskResult,
  tokensOf,
  zero,
  type Call,
  type Pricing,
  type Recon,
  type Run,
  type Tally
} from './analyze';
import { readAttempts, readHermes, readOmniRoute } from './ingest';

type Config = {
  agent_name: string;
  hermes_api_key_name: string;
  retry_threshold: number;
  budget_usd_per_run: number | null;
  overspend_threshold_pct: number;
  pricing_usd_per_1m: Pricing;
  billing: { provider: string; file: string }[];
};

const ROOT = join(import.meta.dir, '..');
const REPO = join(ROOT, '..');
const config: Config = JSON.parse(readFileSync(join(ROOT, 'config.json'), 'utf8'));
const pricing = config.pricing_usd_per_1m;
const threshold = config.overspend_threshold_pct;
const hermesDb =
  process.env.HERMES_STATE_DB ??
  join(process.env.HERMES_HOME ?? join(homedir(), '.hermes'), 'state.db');
const omniDb = process.env.OMNIROUTE_DB ?? join(homedir(), '.omniroute', 'storage.sqlite');
const worktrees = new TextDecoder()
  .decode(Bun.spawnSync(['git', 'worktree', 'list', '--porcelain'], { cwd: REPO }).stdout)
  .split('\n')
  .filter((line) => line.startsWith('worktree '))
  .map((line) => line.slice('worktree '.length).trim());

// ---------- ingest (read-only) ----------
const hermes = readHermes(hermesDb);
const omni = readOmniRoute(omniDb, config.hermes_api_key_name);
const hermesCalls = omni.calls.filter((c) => c.apiKey === config.hermes_api_key_name);
const attempts = readAttempts(join(REPO, 'agent-history', 'entries'), config.agent_name);
const taskStatus = parseTaskStatus(
  readFileSync(join(REPO, 'docs', 'list-task-project.md'), 'utf8')
);
if (!hermes.msgs.length || !hermesCalls.length) {
  console.error(
    `No Hermes activity to measure: ${hermes.msgs.length} messages in ${hermesDb}, ${hermesCalls.length} calls for key "${config.hermes_api_key_name}" in ${omniDb}.`
  );
  process.exit(1);
}

// ---------- analyze ----------
const { steps, marks } = buildSteps(hermes.sessions, hermes.msgs, worktrees);
flagTools(steps);
const joined = joinCalls(steps, marks, hermesCalls);
const estimatedCount = estimateFailedAttempts(steps);
flagSteps(steps, pricing, {
  retryThreshold: config.retry_threshold,
  budgetUsd: config.budget_usd_per_run
});
const taskIds = new Set([
  ...attempts.keys(),
  ...steps.flatMap((s) => (s.taskId ? [s.taskId] : []))
]);
const tasks = new Map(
  [...taskIds]
    .toSorted()
    .map((id) => [id, taskResult(id, taskStatus.get(id), attempts.get(id) ?? [])] as const)
);
const runs = buildRuns(steps, marks, joined.aux, tasks, pricing).toSorted(
  (a, b) => a.start - b.start
);
const split = buckets(runs, joined.unattributed, pricing);
const auxCalls = [...joined.aux.values()].flat();
const finalCalls = [...steps.flatMap((s) => s.calls), ...auxCalls, ...joined.unattributed];
const stats = rates(steps, hermesCalls);
const pass = passAtK([...tasks.values()]);
const billing = config.billing.map((b) => {
  const days = parseBillingCsv(readFileSync(join(ROOT, b.file), 'utf8'));
  return {
    ...b,
    days,
    recon: reconcile(b.provider, days, omni.calls, priceFor(pricing, b.provider, ''), threshold),
    models: reconcileModels(b.provider, days, omni.calls)
  };
});

// ---------- helpers ----------
const sum = <T>(items: T[], f: (item: T) => number) =>
  items.reduce((acc, item) => acc + f(item), 0);
const sumTally = (items: Tally[]) => items.reduce(add, zero());
const iso = (epochS: number) => new Date(epochS * 1000).toISOString();
const day = (epochS: number) => iso(epochS).slice(0, 10);
const round = (v: number, d = 6) => Math.round(v * 10 ** d) / 10 ** d;
const n0 = (v: number) => Math.round(v).toLocaleString('en-US');
const mTok = (v: number) => `${(v / 1e6).toFixed(2)}M`;
const usd = (v: number | null) =>
  v === null ? 'n/a' : v !== 0 && Math.abs(v) < 1 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`;
const pct = (v: number | null, d = 1) => (v === null ? 'n/a' : `${(v * 100).toFixed(d)}%`);
const signed = (v: number | null) => (v === null ? 'n/a' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`);
const share = (part: number, whole: number) => (whole ? part / whole : null);
const quantile = (xs: number[], q: number) =>
  xs.length
    ? xs.toSorted((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))]
    : null;
const table = (head: string[], rows: (string | number)[][]) =>
  [
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.map((c) => String(c).replace(/\|/g, '\\|')).join(' | ')} |`)
  ].join('\n');
const csv = (rows: Record<string, unknown>[]) => {
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.length
    ? `${[Object.keys(rows[0]).join(','), ...rows.map((r) => Object.values(r).map(cell).join(','))].join('\n')}\n`
    : '';
};
const wasteOf = (r: Run) => (r.outcome === 'failed' ? r.total : r.waste);
const usdOrNull = (t: Tally) => (t.unpriced > 0 && t.usd === 0 ? null : round(t.usd));
const okOnly = (cs: Call[]) => cs.filter((c) => c.status === 200);
const promptOf = (cs: Call[]) => sum(cs, (c) => c.prompt + c.cached);

// ---------- steps.jsonl (one row per tool call; tokens and cost on the step's first row) ----------
type Row = Record<string, unknown>;
const callRow = (c: Call, run: Run | null, join: string): Row => {
  const t = tally([c], pricing);
  return {
    run_id: run?.id ?? 'unattributed',
    task_id: run?.taskId ?? null,
    step: null,
    tool_index: null,
    timestamp: iso(c.end),
    session_id: run?.session ?? null,
    provider: c.provider,
    model: c.model,
    prompt_tokens: t.prompt,
    cached_tokens: t.cached,
    completion_tokens: t.completion,
    cost_estimate: usdOrNull(t),
    tool_name: null,
    tool_args_hash: null,
    tool_status: null,
    error: c.status === 200 ? null : (c.errorType ?? `http_${c.status}`),
    retry_count: 0,
    loop_flag: false,
    waste_flags: c.status === 200 ? [] : ['failed_attempt'],
    outcome: run?.outcome ?? 'n/a',
    join,
    tokens_estimated: c.estimated
  };
};
const rows: Row[] = [];
for (const run of runs) {
  for (const s of run.steps) {
    const t = tally(s.calls, pricing);
    const main = s.calls.find((c) => c.status === 200) ?? s.calls.at(-1);
    const joinedStep = s.calls.length > 0;
    for (const [i, tool] of (s.tools.length ? s.tools : [null]).entries()) {
      const first = i === 0 && joinedStep;
      rows.push({
        run_id: run.id,
        task_id: run.taskId,
        step: s.index,
        tool_index: i,
        timestamp: iso(s.ts),
        session_id: s.session,
        provider: main?.provider ?? null,
        model: main?.model ?? null,
        prompt_tokens: first ? t.prompt : null,
        cached_tokens: first ? t.cached : null,
        completion_tokens: first ? t.completion : null,
        cost_estimate: first ? usdOrNull(t) : null,
        tool_name: tool?.name ?? null,
        tool_args_hash: tool?.argsHash ?? null,
        tool_status: tool?.status ?? null,
        error: tool?.errorClass ?? null,
        retry_count: retryCount(s),
        loop_flag: tool?.flags.includes('repeat_call') ?? false,
        waste_flags: [...s.flags, ...(tool?.flags ?? [])],
        outcome: run.outcome,
        join: joinedStep ? 'step' : 'none',
        tokens_estimated: s.calls.some((c) => c.estimated)
      });
    }
  }
  for (const c of run.aux) rows.push(callRow(c, run, 'run'));
}
for (const c of joined.unattributed) rows.push(callRow(c, null, 'unattributed'));

// ---------- derived tables ----------
const successTasks = [...tasks.values()].filter((t) => t.outcome === 'success');
const runsByTask = groupBy(
  runs.filter((r) => r.taskId),
  (r) => r.taskId!
);
const successRunsCost = sumTally(
  successTasks.flatMap((t) => (runsByTask.get(t.taskId) ?? []).map((r) => r.total))
);
const total = sumTally(BUCKETS.map((b) => split[b]));
const totalTokens = tokensOf(total);

const taskRows = [...tasks.values()].map((t) => {
  const rs = runsByTask.get(t.taskId) ?? [];
  const tot = sumTally(rs.map((r) => r.total));
  const waste = sumTally(rs.map(wasteOf));
  const latest = t.attempts.at(-1);
  const claimed =
    latest?.claimedStart && latest.claimedEnd
      ? [Date.parse(latest.claimedStart) / 1000, Date.parse(latest.claimedEnd) / 1000]
      : null;
  return {
    task_id: t.taskId,
    status: t.status,
    attempts: t.attempts.length,
    verdicts: t.verdicts.join('|'),
    outcome: t.outcome,
    runs: rs.length,
    first_activity_utc: rs.length ? iso(Math.min(...rs.map((r) => r.start))) : '',
    last_activity_utc: rs.length ? iso(Math.max(...rs.map((r) => r.end))) : '',
    claimed_start_utc: latest?.claimedStart ?? '',
    claimed_end_utc: latest?.claimedEnd ?? '',
    claim_matches_activity:
      claimed && rs.length ? rs.some((r) => claimed[0] <= r.end && claimed[1] >= r.start) : '',
    tokens: Math.round(tokensOf(tot)),
    cost_usd: round(tot.usd),
    waste_tokens: Math.round(tokensOf(waste)),
    waste_usd: round(waste.usd)
  };
});

const providerRows = [...groupBy(finalCalls, (c) => `${c.provider}/${c.model}`).values()]
  .map((cs) => {
    const ok = okOnly(cs);
    const failed = cs.filter((c) => c.status !== 200);
    const price = priceFor(pricing, cs[0].provider, cs[0].model);
    return {
      provider: cs[0].provider,
      model: cs[0].model,
      attempts: cs.length,
      ok: ok.length,
      failed: failed.length,
      failure_rate: round(failed.length / cs.length, 4),
      likely_billed_failed: failed.filter((c) => likelyBilled(c.status)).length,
      prompt_tokens: sum(ok, (c) => c.prompt),
      cached_tokens: sum(ok, (c) => c.cached),
      completion_tokens: sum(ok, (c) => c.completion),
      cache_hit_rate: round(
        share(
          sum(ok, (c) => c.cached),
          promptOf(ok)
        ) ?? 0,
        4
      ),
      est_failed_tokens: sum(failed, tokensOf),
      cost_ok_usd: round(tally(ok, pricing).usd),
      cost_failed_est_usd: round(tally(failed, pricing).usd),
      price_source: price ? (price.source ?? 'config') : 'not priced'
    };
  })
  .toSorted((a, b) => b.attempts - a.attempts);

const runRows = runs.map((r) => ({
  run_id: r.id,
  session_id: r.session,
  task_id: r.taskId ?? '',
  kind: r.kind,
  outcome: r.outcome,
  start_utc: iso(r.start),
  end_utc: iso(r.end),
  steps: r.steps.length,
  tool_calls: sum(r.steps, (s) => s.tools.length),
  api_attempts: r.total.calls,
  failed_attempts: sum(r.steps, retryCount) + r.aux.filter((c) => c.status !== 200).length,
  prompt_tokens: Math.round(r.total.prompt),
  cached_tokens: Math.round(r.total.cached),
  completion_tokens: Math.round(r.total.completion),
  cost_usd: round(r.total.usd),
  waste_tokens: Math.round(tokensOf(wasteOf(r))),
  waste_usd: round(wasteOf(r).usd),
  repeat_calls: sum(r.steps, (s) => s.tools.filter((t) => t.flags.includes('repeat_call')).length),
  no_new_info: sum(r.steps, (s) => s.tools.filter((t) => t.flags.includes('no_new_info')).length),
  tool_errors: sum(r.steps, (s) => s.tools.filter((t) => t.flags.includes('tool_error')).length),
  retry_storms: r.steps.filter((s) => s.flags.includes('retry_storm')).length,
  truncated: r.steps.filter((s) => s.flags.includes('truncated_output')).length
}));

const billingRows = billing.flatMap((b) =>
  b.recon.map((r: Recon) => ({
    provider: r.provider,
    period: r.period,
    billed_requests: r.billed.requests,
    billed_tokens: tokensOf(r.billed),
    billed_usd: round(r.billed.usd),
    list_usd: round(r.billed.listUsd),
    expected_usd: r.expectedUsd === null ? '' : round(r.expectedUsd),
    actual_usd_per_1m: r.actualPer1M === null ? '' : round(r.actualPer1M),
    expected_usd_per_1m: r.expectedPer1M === null ? '' : round(r.expectedPer1M),
    actual_vs_expected_pct: r.actualVsExpectedPct === null ? '' : round(r.actualVsExpectedPct, 2),
    delivered_requests: r.delivered.requests,
    delivered_tokens: tokensOf(r.delivered),
    failed_attempts: r.delivered.failed,
    likely_billed_failed: r.delivered.likelyBilledFailed,
    usd_per_1m_delivered: r.deliveredPer1M === null ? '' : round(r.deliveredPer1M),
    paid_for_undelivered_pct: r.undeliveredPct === null ? '' : round(r.undeliveredPct, 2),
    flags: r.flags.join('|')
  }))
);

// ---------- write outputs ----------
const OUT = join(ROOT, 'out');
const REPORTS = join(ROOT, 'reports');
mkdirSync(OUT, { recursive: true });
mkdirSync(REPORTS, { recursive: true });
writeFileSync(join(OUT, 'steps.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
writeFileSync(join(REPORTS, 'runs.csv'), csv(runRows));
writeFileSync(join(REPORTS, 'tasks.csv'), csv(taskRows));
writeFileSync(join(REPORTS, 'providers.csv'), csv(providerRows));
writeFileSync(join(REPORTS, 'billing.csv'), csv(billingRows));
writeFileSync(join(REPORTS, 'hermes_observability_report.md'), renderReport());

console.log(
  [
    `steps.jsonl: ${rows.length} rows · runs: ${runs.length} · tasks: ${tasks.size} · attempts: ${hermesCalls.length}`,
    `tokens: ${BUCKETS.map((b) => `${b} ${pct(share(tokensOf(split[b]), totalTokens))}`).join(', ')}`,
    `cost at config prices: total ${usd(total.usd)}, wasted ${usd(split.wasted.usd)}, successful ${usd(split.successful.usd)}`,
    ...billing.map((b) => {
      const t = b.recon.at(-1)!;
      return `${b.provider}: billed ${usd(t.billed.usd)}, actual vs expected ${signed(t.actualVsExpectedPct)}, paid-for-undelivered ${signed(t.undeliveredPct)} ${t.flags.length ? `FLAGS: ${t.flags.join(', ')}` : ''}`;
    }),
    `wrote agent-evaluate/out/steps.jsonl and agent-evaluate/reports/{hermes_observability_report.md,runs.csv,tasks.csv,providers.csv,billing.csv}`
  ].join('\n')
);

// ---------- report ----------
function renderReport(): string {
  const allTs = [...steps.map((s) => s.ts), ...hermesCalls.map((c) => c.end)];
  const from = iso(Math.min(...allTs));
  const to = iso(Math.max(...allTs));
  const okAll = okOnly(hermesCalls);
  const stepOk = okOnly(steps.flatMap((s) => s.calls));
  const auxOk = okOnly(auxCalls);
  const unOk = okOnly(joined.unattributed);
  const successCount = successTasks.length;
  const bucketLabel: Record<string, string> = {
    successful: 'Successful',
    wasted: 'Wasted',
    unverified: 'Unverified (merged, checks not proven)',
    pending: 'Pending (task not stamped done)',
    overhead: 'Overhead (not on a task branch)',
    outside_repo: 'Outside this repo',
    unattributed: 'Unattributed (no Hermes turn within 10 min)'
  };

  const failedByProvider = [
    ...groupBy(
      finalCalls.filter((c) => c.status !== 200),
      (c) => c.provider
    )
  ]
    .map(([provider, cs]) => {
      const all = finalCalls.filter((c) => c.provider === provider).length;
      const top = [
        ...groupBy(cs, (c) => (c.errorType ? `${c.status} ${c.errorType}` : String(c.status)))
      ]
        .map(([k, v]) => [k, v.length] as const)
        .toSorted((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k, v]) => `${k} ×${v}`)
        .join(', ');
      return { provider, failed: cs.length, all, top };
    })
    .toSorted((a, b) => b.failed - a.failed);

  const toolsWith = (flag: string) =>
    [
      ...groupBy(
        steps.flatMap((s) => s.tools.filter((t) => t.flags.includes(flag))),
        (t) => t.name
      )
    ]
      .map(([name, ts]) => [name, ts.length] as const)
      .toSorted((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, n]) => `${name} ×${n}`)
      .join(', ') || 'none';
  const errorClasses = [
    ...groupBy(
      steps.flatMap((s) => s.tools.filter((t) => t.status === 'error' || t.status === 'invalid')),
      (t) => t.errorClass ?? 'other'
    )
  ]
    .map(([k, v]) => `${k} ×${v.length}`)
    .join(', ');

  const mismatched = taskRows.filter((t) => t.claim_matches_activity === false);
  const withClaims = taskRows.filter((t) => t.claim_matches_activity !== '');
  const taskRunCosts = runs.filter((r) => r.kind === 'task').map((r) => r.total.usd);
  const orphanTokens = sumTally(
    runs
      .filter(
        (r) => hermes.sessions.find((s) => s.id === r.session)?.endReason === 'startup_orphan_reap'
      )
      .map((r) => r.total)
  );

  const recs: string[] = [];
  for (const b of billing) {
    const t = b.recon.at(-1)!;
    if (!t.flags.includes('paid_for_undelivered')) continue;
    const pcalls = omni.calls.filter((c) => c.provider === b.provider);
    const okDur = okOnly(pcalls).map((c) => c.durationS);
    const toDur = pcalls
      .filter((c) => c.status !== 200 && likelyBilled(c.status))
      .map((c) => c.durationS);
    recs.push(
      `**${b.provider}: stop paying for timeouts.** The provider billed ${signed(t.undeliveredPct)} more tokens than OmniRoute received (${n0(t.billed.requests - t.delivered.requests)} extra requests; ${n0(t.delivered.likelyBilledFailed)} attempts ended in 5xx/499). Timed-out attempts gave up after a median ${quantile(toDur, 0.5)?.toFixed(1) ?? 'n/a'} s while successful calls take up to ${quantile(okDur, 0.95)?.toFixed(1) ?? 'n/a'} s (p95) / ${Math.max(0, ...okDur).toFixed(1)} s (max). Raise OmniRoute's upstream timeout for this provider above the p95, or stream responses, so a slow ${'~'}100K-token call is not billed, dropped and re-sent.`
    );
  }
  for (const f of failedByProvider.filter((f) => f.all >= 20 && f.failed / f.all >= 0.5)) {
    recs.push(
      `**Demote \`${f.provider}\` in Hermes' fallback chains:** ${n0(f.failed)} of ${n0(f.all)} attempts failed (${f.top}). Each failure adds latency before the next fallback.`
    );
  }
  if (stats.noNewInfo) {
    recs.push(
      `**Cut no-new-information repeats:** ${n0(stats.noNewInfo)} tool calls repeated an earlier identical call in the same run and got identical output (${toolsWith('no_new_info')}).`
    );
  }
  if (stats.truncated) {
    recs.push(
      `**Truncated turns:** ${n0(stats.truncated)} turns stopped at the max output length (\`finish_reason = length\`); raise the output limit for those models or ask for smaller edits.`
    );
  }
  if (mismatched.length) {
    recs.push(
      `**Make history timestamps machine-recorded:** for ${mismatched.length} of ${withClaims.length} Hermes tasks the \`session.started_at/ended_at\` in the history entry does not overlap any Hermes activity on that task branch (${mismatched
        .slice(0, 4)
        .map((t) => t.task_id)
        .join(
          ', '
        )}${mismatched.length > 4 ? ', …' : ''}). Hermes should copy the times (and its session id) from its own session instead of writing them by hand; it also makes attempt-level pass@k possible.`
    );
  }
  recs.push(
    `**Exact attribution (phase B):** the join is time-based: ${pct(share(promptOf(stepOk), promptOf(okAll)))} of prompt tokens tie to a turn, ${pct(share(promptOf(auxOk), promptOf(okAll)))} only to a run, ${pct(share(promptOf(unOk), promptOf(okAll)))} to nothing, and ${n0(joined.contested)} calls had candidates in two sessions. Give Hermes its own OmniRoute API key and add a Hermes plugin on the \`post_llm_call\` / \`on_session_end\` hooks that writes this JSONL live with exact usage and the current branch.`
  );
  const costedRuns = taskRunCosts.filter((c) => c > 0);
  if (config.budget_usd_per_run === null && costedRuns.length) {
    recs.push(
      `**Set a budget:** \`budget_usd_per_run\` is not set, so the budget monitor is idle. Task runs that cost money at config prices (${costedRuns.length} of ${taskRunCosts.length}): ${usd(quantile(costedRuns, 0.5))} median, ${usd(quantile(costedRuns, 0.9))} p90, ${usd(Math.max(...costedRuns))} max.`
    );
  }
  const unconfirmed = Object.entries(pricing).filter(([, p]) =>
    /unconfirmed|assumed/i.test(p.source ?? '')
  );
  if (unconfirmed.length) {
    const calibration = billing
      .map((b) => b.recon.at(-1)!)
      .filter((t) => t.expectedUsd)
      .map(
        (t) =>
          `${t.provider} billed ${(t.billed.usd / t.expectedUsd!).toFixed(2)}× the config price for the same tokens`
      )
      .join('; ');
    recs.push(
      `**Confirm prices:** ${unconfirmed.map(([k, p]) => `\`${k}\` (${p.source})`).join('; ')}.${calibration ? ` For reference, ${calibration}.` : ''} Edit \`agent-evaluate/config.json\` and re-run; every dollar figure here scales with it.`
    );
  }

  const pie = BUCKETS.filter((b) => tokensOf(split[b]) > 0)
    .map((b) => `  "${bucketLabel[b].split(' (')[0]}" : ${Math.round(tokensOf(split[b]))}`)
    .join('\n');

  return `# Hermes observability report

> Generated by \`bun run agent:evaluate\` (task PSI-099) at ${new Date().toISOString()}. Data window ${from} → ${to} (UTC).
> Everything below is recomputed from read-only sources on each run; change prices, budget or thresholds in \`agent-evaluate/config.json\` and re-run.

## 1. Summary

- **Volume:** Hermes (OmniRoute key \`${config.hermes_api_key_name}\`) made ${n0(stats.attempts)} upstream LLM attempts; ${n0(stats.failedAttempts)} failed (${pct(stats.attemptFailureRate)}). Successful calls moved ${mTok(promptOf(okAll))} prompt tokens (${pct(stats.cacheHitRate)} served from cache) and ${mTok(sum(okAll, (c) => c.completion))} completion tokens.
- **Compute split (tokens):** ${BUCKETS.filter((b) => tokensOf(split[b]) > 0)
    .map((b) => `${b.replace('_', ' ')} ${pct(share(tokensOf(split[b]), totalTokens))}`)
    .join(' · ')}.
- **Cost at config prices:** ${usd(total.usd)} total, ${usd(split.wasted.usd)} wasted, ${usd(split.successful.usd)} successful. Per successful task: ${successCount ? `${usd(successRunsCost.usd / successCount)} direct, ${usd(total.usd / successCount)} fully loaded` : 'n/a (no successful task)'} (${successCount} successful tasks). Only providers with a price in the config carry dollars; see §7 for billed money.
- **Outcomes:** pass@1 = ${pct(pass.pass1)}, pass@${pass.maxK} = ${pct(pass.passK)} over ${pass.n} resolved Hermes tasks.
${billing
  .map((b) => {
    const t = b.recon.at(-1)!;
    return `- **${b.provider} billing:** billed ${usd(t.billed.usd)} for ${mTok(tokensOf(t.billed))} tokens (list ${usd(t.billed.listUsd)}). Actual vs expected cost per token: ${signed(t.actualVsExpectedPct)}. Tokens paid for but never delivered: ${signed(t.undeliveredPct)}${t.flags.length ? ` → **flagged: ${t.flags.join(', ')}**` : ''}.`;
  })
  .join('\n')}
- **Waste signals:** ${n0(stats.retryStorms)} retry storms (> ${config.retry_threshold} failed attempts in one turn), ${n0(stats.repeatCalls)} repeated identical tool calls (${pct(stats.loopRate)}), ${n0(stats.noNewInfo)} with identical output, ${n0(stats.toolErrors)} tool errors (${pct(stats.toolErrorRate)}), ${n0(stats.truncated)} truncated turns, ${n0(stats.failedTurns)} failed turns.

## 2. Sources, joins and coverage

${table(
  ['Source', 'What was read', 'Rows'],
  [
    [
      'Hermes `state.db`',
      'sessions, turns, tool calls (args hashed), tool results (status + hash only)',
      `${hermes.totals.sessions} sessions, ${n0(hermes.msgs.length)} messages (${n0(hermes.duplicates)} compaction duplicates dropped)`
    ],
    [
      'OmniRoute `call_logs`',
      `upstream attempts for \`${config.hermes_api_key_name}\` (routing summary rows and probes excluded)`,
      `${n0(hermesCalls.length)} attempts; ${n0(omni.routingFailures)} routing-level failures not counted`
    ],
    [
      'agent-history',
      `entries by \`${config.agent_name}\` (outcome + checks)`,
      `${sum([...attempts.values()], (a) => a.length)} attempts on ${attempts.size} tasks`
    ],
    ['docs/list-task-project.md', 'task status (human stamp = done)', `${taskStatus.size} tasks`],
    ...billing.map((b) => [`billing: ${b.provider}`, `\`${b.file}\``, `${b.days.length} days`])
  ]
)}

- **Step join:** OmniRoute never records which Hermes turn a call served, so calls are matched by time (a successful call belongs to the Hermes turn stored ≤ 3 s after it; failed attempts to the turn that follows within 10 min). ${pct(share(promptOf(stepOk), promptOf(okAll)))} of successful prompt tokens matched a turn, ${pct(share(promptOf(auxOk), promptOf(okAll)))} matched only a run (auxiliary calls such as titles or compression), ${pct(share(promptOf(unOk), promptOf(okAll)))} matched nothing. ${n0(joined.contested)} calls had candidate turns in more than one session.
- **Cross-check:** Hermes' own session counters hold ${mTok(hermes.totals.prompt + hermes.totals.cached)} prompt tokens (${pct(share(hermes.totals.cached, hermes.totals.prompt + hermes.totals.cached))} cached) over ${n0(hermes.totals.apiCalls)} API calls; OmniRoute recorded ${mTok(promptOf(okAll))} for the key. Hermes prices none of it (${hermes.totals.unknownCost} sessions have \`cost_status = unknown\`, estimated cost ${usd(hermes.totals.estimatedUsd)}), which is why the cost calculator exists.
- **Estimates:** ${n0(estimatedCount)} failed attempts (5xx/499, usually still processed upstream) were given the token counts of the successful retry for the same request; OmniRoute logs them with 0 tokens.
- **Sessions:** ${hermes.totals.orphaned} of ${hermes.totals.sessions} sessions ended as \`startup_orphan_reap\` (never closed); their runs hold ${mTok(tokensOf(orphanTokens))} tokens.

## 3. Definitions

${table(
  ['Flag', 'Detector', 'Counts as waste'],
  [
    [
      '`failed_attempt`',
      'an upstream attempt for the turn returned non-200',
      'the failed attempt (tokens estimated for 5xx/499)'
    ],
    [
      '`retry_storm`',
      `more than ${config.retry_threshold} failed attempts in one turn (\`retry_threshold\`)`,
      'via failed_attempt'
    ],
    [
      '`repeat_call` (loop_flag)',
      'same tool + same args hash earlier in the same run',
      'no (re-running a build after a fix is normal)'
    ],
    [
      '`no_new_info`',
      'repeat_call whose output hash is also identical (low-information-gain proxy)',
      "yes, the turn's share"
    ],
    [
      '`repeated_error`',
      'repeat_call where both the earlier and this call errored (unrecoverable pattern)',
      "yes, the turn's share"
    ],
    [
      '`invalid_tool_call`',
      'unparseable arguments, or the tool rejected the call (unknown tool, bad args)',
      "yes, the turn's share"
    ],
    [
      '`tool_error`',
      'non-zero exit, `success: false`, error field or traceback',
      'no (errors are often informative)'
    ],
    ['`truncated_output`', '`finish_reason = length`', 'yes, the whole turn'],
    ['`failed_turn`', 'Hermes marked the turn `failed_turn`', 'yes, the whole turn'],
    [
      '`budget_exceeded`',
      `run spend already above \`budget_usd_per_run\` (${config.budget_usd_per_run ?? 'not set'})`,
      'yes, the whole turn'
    ]
  ]
)}

- **Run:** the part of one Hermes session between branch switches (\`git checkout|switch task/PSI-xxx\` starts a task run; \`master\`/\`main\` starts overhead). Sessions whose working directory is outside this repo are \`outside_repo\`.
- **Task outcome:** \`success\` = task stamped \`done\` by a human (C-21) **and** the latest Hermes history attempt says \`done\` with typecheck, lint, build, db_reset, db_tests all \`pass\` or \`n/a\`. \`failed\` = a check failed, the attempt was blocked/abandoned, or the task is blocked. \`unverified\` = done but a check was \`skipped\` or no Hermes attempt exists. \`pending\` = not stamped done yet.
- **successful_compute** = tokens of successful task runs minus flagged waste. **wasted_compute** = every token of failed task runs + flagged waste in any run + failed unattributed attempts. The other buckets cannot be classified either way and are shown separately.
- **Token convention:** \`prompt\` = uncached input, \`cached\` = cache reads, \`completion\` = output incl. reasoning. OmniRoute's \`tokens_in\` includes cache reads and is split accordingly.

## 4. Wasted vs successful compute

${table(
  ['Bucket', 'Prompt', 'Cached', 'Completion', 'Total tokens', 'Share', 'Cost (config prices)'],
  [
    ...BUCKETS.map((b) => [
      bucketLabel[b],
      mTok(split[b].prompt),
      mTok(split[b].cached),
      mTok(split[b].completion),
      mTok(tokensOf(split[b])),
      pct(share(tokensOf(split[b]), totalTokens)),
      usd(split[b].usd)
    ]),
    [
      '**Total**',
      mTok(total.prompt),
      mTok(total.cached),
      mTok(total.completion),
      mTok(totalTokens),
      '100%',
      usd(total.usd)
    ]
  ]
)}

\`\`\`mermaid
pie showData title Hermes tokens by bucket
${pie}
\`\`\`

## 5. Tasks

${table(
  [
    'Task',
    'Status',
    'Attempts (verdicts)',
    'Outcome',
    'Runs',
    'Hermes activity (UTC)',
    'History entry claims',
    'Tokens',
    'Cost',
    'Waste'
  ],
  taskRows.map((t) => [
    t.task_id,
    t.status,
    t.attempts ? `${t.attempts} (${t.verdicts})` : '0',
    t.outcome,
    t.runs,
    t.first_activity_utc
      ? `${t.first_activity_utc.slice(5, 16)} → ${t.last_activity_utc.slice(5, 16)}`
      : 'no run found',
    t.claimed_start_utc
      ? `${t.claimed_start_utc.slice(5, 16)} → ${t.claimed_end_utc.slice(5, 16)}${t.claim_matches_activity === false ? ' ⚠' : ''}`
      : '',
    mTok(t.tokens),
    usd(t.cost_usd),
    t.tokens ? pct(share(t.waste_tokens, t.tokens)) : 'n/a'
  ])
)}

⚠ = the history entry's claimed session window does not overlap any Hermes activity on that task. Full data: \`reports/tasks.csv\`, \`reports/runs.csv\`.

## 6. Providers (Hermes key)

${table(
  [
    'Provider / model',
    'Attempts',
    'Failed',
    'Prompt',
    'Cached',
    'Cache hit',
    'Completion',
    'Cost',
    'Est. cost of failed',
    'Price'
  ],
  providerRows
    .slice(0, 15)
    .map((p) => [
      `${p.provider} / ${p.model}`,
      n0(p.attempts),
      `${n0(p.failed)} (${pct(p.failure_rate)})`,
      mTok(p.prompt_tokens),
      mTok(p.cached_tokens),
      pct(p.cache_hit_rate),
      mTok(p.completion_tokens),
      usd(p.cost_ok_usd),
      usd(p.cost_failed_est_usd),
      p.price_source
    ])
)}

Failed attempts by provider: ${failedByProvider.map((f) => `**${f.provider}** ${n0(f.failed)}/${n0(f.all)} (${f.top})`).join('; ')}. OmniRoute's own ledger prices the key at ${usd(omni.gateway.usd)} over ${n0(omni.gateway.n)} priced requests; that is its list-price view, including subscription providers, not money billed.

## 7. Actual vs expected cost per token

${billing
  .map(
    (b) => `### ${b.provider}

Actual = the provider's billing export. Expected = config price (${priceFor(pricing, b.provider, '')?.source ?? 'no price'}) × the billed tokens. Delivered = tokens OmniRoute received back from successful calls on the models the bill lists (all API keys). Flag threshold: ${threshold}%. The per-day split assumes the export uses UTC days; the total does not depend on it.

${table(
  [
    'Period',
    'Billed req',
    'Billed tokens',
    'Billed',
    'List',
    'Expected',
    'Actual $/1M',
    'Expected $/1M',
    'Actual vs expected',
    'Delivered req',
    'Delivered tokens',
    'Paid for undelivered',
    'Flags'
  ],
  b.recon.map((r) => [
    r.period,
    n0(r.billed.requests),
    mTok(tokensOf(r.billed)),
    usd(r.billed.usd),
    usd(r.billed.listUsd),
    usd(r.expectedUsd),
    usd(r.actualPer1M),
    usd(r.expectedPer1M),
    signed(r.actualVsExpectedPct),
    n0(r.delivered.requests),
    mTok(tokensOf(r.delivered)),
    signed(r.undeliveredPct),
    r.flags.join(', ') || '—'
  ])
)}

${table(
  ['Model', 'Billed requests', 'Delivered OK', 'Failed 5xx/499', 'Billed − delivered'],
  b.models.map((m) => [
    m.model,
    n0(m.billedRequests),
    n0(m.deliveredOk),
    n0(m.likelyBilledFailed),
    n0(m.excess)
  ])
)}

Cross-check: billed minus delivered = ${mTok(tokensOf(b.recon.at(-1)!.billed) - tokensOf(b.recon.at(-1)!.delivered))}; the estimate for Hermes' timed-out ${b.provider} attempts (each given its successful retry's tokens) = ${mTok(
      sum(
        finalCalls.filter(
          (c) =>
            c.estimated && c.provider === b.provider && b.days.some((d) => d.date === day(c.end))
        ),
        tokensOf
      )
    )}, an upper bound because not every timeout reaches the bill (see "Failed 5xx/499" vs "Billed − delivered" above).`
  )
  .join('\n\n')}

## 8. Waste signals

${table(
  ['Signal', 'Count', 'Rate'],
  [
    ['Upstream attempts failed', n0(stats.failedAttempts), pct(stats.attemptFailureRate)],
    [
      'Turns with ≥ 1 failed attempt (retry rate)',
      n0(steps.filter((s) => s.flags.includes('failed_attempt')).length),
      pct(stats.retryRate)
    ],
    [`Retry storms (> ${config.retry_threshold} failed attempts)`, n0(stats.retryStorms), ''],
    ['Repeated identical tool calls (loop rate)', n0(stats.repeatCalls), pct(stats.loopRate)],
    [
      '… with identical output (no new info)',
      n0(stats.noNewInfo),
      pct(share(stats.noNewInfo, stats.toolCalls))
    ],
    [
      '… repeating an error',
      n0(stats.repeatedErrors),
      pct(share(stats.repeatedErrors, stats.toolCalls))
    ],
    [
      'Invalid tool calls',
      n0(stats.invalidToolCalls),
      pct(share(stats.invalidToolCalls, stats.toolCalls))
    ],
    ['Tool errors (tool error rate)', n0(stats.toolErrors), pct(stats.toolErrorRate)],
    ['Truncated turns', n0(stats.truncated), pct(share(stats.truncated, stats.steps))],
    ['Failed turns', n0(stats.failedTurns), pct(share(stats.failedTurns, stats.steps))],
    [
      'Over budget',
      config.budget_usd_per_run === null ? 'budget not set' : n0(stats.overBudget),
      ''
    ]
  ]
)}

Most repeated: ${toolsWith('repeat_call')}. Tool error classes: ${errorClasses || 'none'}. Turns: ${n0(stats.steps)}; tool calls: ${n0(stats.toolCalls)}.

## 9. Recommendations

${recs.map((r, i) => `${i + 1}. ${r}`).join('\n')}

## 10. Not available

- **Billed cost for providers without an export** (every provider except ${billing.map((b) => b.provider).join(', ') || 'none'}): priced from \`config.json\` only; subscription providers are assumed $0 per call.
- **Expected cost per run** and **budget per task:** not given in the brief (\`budget_usd_per_run\` = ${config.budget_usd_per_run ?? 'null'}).
- **Low information gain** beyond the \`no_new_info\` proxy (identical call + identical output): needs semantic judgement.
- **Attempt-level pass@k:** Hermes history entries do not carry real timestamps or the Hermes session id, so runs cannot be tied to a specific attempt; runs take their task's final outcome, and pass@k counts recorded attempts.
- **Re-running tests/build/lint for past runs:** the code has moved on; outcomes come from the recorded checks plus the human stamp.
- **Per-model billed tokens:** the billing export has tokens per day and request counts per model only.
- **Per-call gateway cost:** OmniRoute's cost ledger has no request id, so only its per-key total is shown.
`;
}
