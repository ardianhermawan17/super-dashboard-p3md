// Builds one psql script from every ```sql block in docs/database-architecture/m1..m9, in order.
// Each block runs under a savepoint; on error we report the block and roll back to the savepoint.
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = process.argv[2];
const OUT = process.argv[3];
const files = ['m1-rbac', 'm2-notifications', 'm3-role-mail', 'm4-calendar', 'm5-kanban', 'm6-google', 'm7-activity-log', 'm8-agent-layer', 'm9-talent'];

const SKIP = new Set((process.env.SKIP||'').split(',').filter(Boolean).map(Number));
const out = ['\\set VERBOSITY terse', '\\set ON_ERROR_STOP off', 'begin;'];
let n = 0;
const index = [];
for (const f of files) {
  const lines = readFileSync(`${ROOT}/docs/database-architecture/${f}.md`, 'utf8').split(/\r?\n/);
  let inSql = false, buf = [], start = 0;
  lines.forEach((l, i) => {
    if (!inSql && /^```sql\s*$/.test(l)) { inSql = true; buf = []; start = i + 2; return; }
    if (inSql && /^```\s*$/.test(l)) {
      inSql = false; n++;
      const id = `${f}.md:${start}`;
      if (SKIP.has(n)) { index.push(`${n}	${id}	SKIPPED (example)`); return; }
      index.push(`${n}\t${id}\t${buf.length} lines`);
      out.push(`\\echo @@BLOCK ${n} ${id}`, `savepoint b${n};`, ...buf, `\\if :ERROR`, `  \\echo @@FAILED ${n} ${id}`, `  rollback to savepoint b${n};`, `\\else`, `  release savepoint b${n};`, `\\endif`);
      return;
    }
    if (inSql) buf.push(l);
  });
}
out.push('rollback;', '\\echo @@DONE (everything rolled back)');
writeFileSync(OUT, out.join('\n') + '\n');
writeFileSync(OUT + '.index.tsv', index.join('\n') + '\n');
console.log(`${n} sql blocks`);
