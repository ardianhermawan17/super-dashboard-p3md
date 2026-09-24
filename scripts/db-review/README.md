# db-review

Checks that the SQL in `docs/database-architecture/m1..m9` really works on the local Postgres, and audits what it builds. Everything runs inside one transaction that is **rolled back**, so nothing is left in the database. Written for the 2026-09-24 review (history entry `..__PSI-008__claude-code`); PSI-015's pgTAP tests are the long-term replacement.

Needs: local stack running (`supabase start`, container `supabase_db_p3md`), Node.

```bash
D=$(mktemp -d)
# 1. build one psql script from every ```sql block, in migration order (skip usage examples 5,6,7 in m1-rbac.md)
SKIP=5,6,7 node scripts/db-review/extract.mjs "$(pwd)" $D/all.sql
# 2. apply the migrations only: prints @@FAILED <block> for any block that errors
docker exec -i supabase_db_p3md psql -U postgres -d postgres -X -q < $D/all.sql | grep "@@FAILED\|@@DONE"
# 3. apply + audit (RLS, policies, grants, FK indexes, cron, triggers, permission keys)
{ head -n -2 $D/all.sql; cat scripts/db-review/audit.sql; echo 'rollback;'; } | docker exec -i supabase_db_p3md psql -U postgres -d postgres -X -q
# 4. apply + behaviour tests (inheritance, suspension, escalation, last admin, anon access)
{ head -n -2 $D/all.sql; cat scripts/db-review/behaviour.sql; echo 'rollback;'; } | docker exec -i supabase_db_p3md psql -U postgres -d postgres -X -q
# 5. names used in docs vs names that exist (save the step 3 output to $D/audit.txt first)
node scripts/db-review/xref.mjs "$(pwd)" $D/audit.txt
```

Read the output: `@@T..` lines in `behaviour.sql` say PASS/FAIL or the expected value; in `audit.sql` each `@@A..` section lists offenders (empty = good).

## psi012-verify.sql

Checks the real local database after `supabase db reset` against PSI-012's accept line (tables with RLS, 15 permissions, system rows, seeded users, functions, policies, no-escalation, own-profile column grants, anon access). Behaviour probes run in a transaction that is rolled back.

```bash
docker exec -i supabase_db_p3md psql -U postgres -d postgres -X -q < scripts/db-review/psi012-verify.sql
```

Each `@@N` line states the expected value. PSI-015's pgTAP tests should replace it.
