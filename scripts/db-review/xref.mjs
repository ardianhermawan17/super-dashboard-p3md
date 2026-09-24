// Cross-check: table/view/function names used in docs and tasks vs what the migrations really create.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.argv[2];
const audit = readFileSync(process.argv[3], 'utf8');

// ---- what exists (from the live catalog audit)
const section = (name) => audit.split(`@@${name}`)[1]?.split('@@A')[0] ?? '';
const tables = new Set([...section('A1').matchAll(/^\s*([a-z_]+)\s+\|\s+[tf]\s+\|/gm)].map((m) => m[1]));
const views = new Set([...section('A8').matchAll(/^\s*([a-z_]+)\s+\|/gm)].map((m) => m[1]).filter((v) => v !== 'relname'));
const fns = new Set([...section('A7').matchAll(/^\s*([a-z_]+)\(/gm)].map((m) => m[1]));
const perms = new Set([...section('A14').matchAll(/^\s*([a-z]+\.[a-z_]+)\s*$/gm)].map((m) => m[1]));
console.log(`catalog: ${tables.size} tables, ${views.size} views, ${fns.size} functions, ${perms.size} permission keys`);

// ---- walk docs (not archive) + task list
const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    if (e === '_archive') continue;
    const p = join(d, e);
    statSync(p).isDirectory() ? walk(p) : e.endsWith('.md') && files.push(p);
  }
})(join(ROOT, 'docs'));

const known = new Set([...tables, ...views]);
const ext = new Set(['users', 'objects', 'buckets', 'identities', 'job', 'jobs', 'http_request_queue', 'secrets', 'decrypted_secrets', 'permissions_view']);
const refs = { table: new Map(), rpc: new Map(), perm: new Map() };
const add = (m, k, loc) => m.set(k, [...(m.get(k) ?? []), loc]);

for (const f of files) {
  const rel = relative(ROOT, f).replace(/\\/g, '/');
  readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
    const loc = `${rel}:${i + 1}`;
    for (const m of line.matchAll(/\.from\(\s*['"]([a-z_]+)['"]\s*\)/g)) add(refs.table, m[1], loc);
    for (const m of line.matchAll(/\.rpc\(\s*['"]([a-z_]+)['"]/g)) add(refs.rpc, m[1], loc);
    for (const m of line.matchAll(/(?:has_permission|requirePermission|users_with_permission)\(\s*['"]([a-z]+\.[a-z_]+)['"]/g)) add(refs.perm, m[1], loc);
    for (const m of line.matchAll(/`([a-z]+\.(?:read|write|manage|send|audit|chat|receive))`/g)) add(refs.perm, m[1], loc);
  });
}

const show = (title, map, exists, skip = new Set()) => {
  const missing = [...map].filter(([k]) => !exists.has(k) && !skip.has(k));
  console.log(`\n${title}: ${map.size} distinct referenced, ${missing.length} not in the built schema`);
  for (const [k, locs] of missing) console.log(`  ${k}  <- ${locs.slice(0, 3).join(', ')}${locs.length > 3 ? ` (+${locs.length - 3})` : ''}`);
};
show('.from(table|view)', refs.table, known, ext);
show('.rpc(function)', refs.rpc, fns);
show('permission keys', refs.perm, perms);

// permission keys that exist but nothing references (except the catalogue itself)
const unused = [...perms].filter((p) => !refs.perm.has(p));
console.log(`\npermission keys defined but never referenced outside the catalogue: ${unused.join(', ') || 'none'}`);
