begin;
select plan(17);

-- ============================================================
-- M9 talent (PSI-080): RLS on every table, owner-own-row candidate access,
-- talent.read / talent.manage, anon locked out, scoring view, private CV bucket.
-- See docs/database-architecture/m9-talent.md — its own warning is that the outline
-- shipped without RLS and anon could read and delete candidates.
-- Fixtures: user 1 = member1 (no roles), user 2 = admin (all permissions incl. talent.*),
-- user 3 = member2, user 4 = member3.
-- ============================================================

-- ---------------------------------------------------------------- fixtures (as superuser)
reset role;

insert into public.skill_groups (id, name)
values ('aaaa0001-0000-0000-0000-000000000001', 'Software Engineer');

insert into public.skills (id, name) values
  ('bbbb0001-0000-0000-0000-000000000001', 'Next.js'),
  ('bbbb0001-0000-0000-0000-000000000002', 'SQL');

insert into public.skill_aliases (alias, skill_id) values
  ('nextjs', 'bbbb0001-0000-0000-0000-000000000001');

-- Software Engineer: Next.js weight 3 (required), SQL weight 2 (optional). Denominator 5.
insert into public.skill_group_skills (group_id, skill_id, weight, required) values
  ('aaaa0001-0000-0000-0000-000000000001', 'bbbb0001-0000-0000-0000-000000000001', 3, true),
  ('aaaa0001-0000-0000-0000-000000000001', 'bbbb0001-0000-0000-0000-000000000002', 2, false);

insert into public.candidates (id, user_id, consent_at, cv_source, cv_path) values
  ('cccc0001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   now(), 'storage', '00000000-0000-0000-0000-000000000001/cv.pdf'),
  ('cccc0001-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003',
   now(), 'storage', '00000000-0000-0000-0000-000000000003/cv.pdf');

-- Candidate 1: Next.js 0.90 + SQL 0.50  -> (3*0.9 + 2*0.5) / 5 = 74
-- Candidate 2: SQL 0.80 only           -> (3*0 + 2*0.8) / 5 = 32, required skill missing
insert into public.candidate_skills (candidate_id, skill_id, confidence, evidence, years) values
  ('cccc0001-0000-0000-0000-000000000001', 'bbbb0001-0000-0000-0000-000000000001', 0.90, 'Built the marketing site', 4.0),
  ('cccc0001-0000-0000-0000-000000000001', 'bbbb0001-0000-0000-0000-000000000002', 0.50, 'Wrote reporting queries', 3.0),
  ('cccc0001-0000-0000-0000-000000000002', 'bbbb0001-0000-0000-0000-000000000002', 0.80, 'Analytics warehouse', 5.0);

-- ---------------------------------------------------------------- 1-2 the security regression
select is(
  (select count(*) from pg_class c where c.relnamespace = 'public'::regnamespace
     and c.relname in ('skill_groups','skills','skill_aliases','skill_group_skills','candidates','candidate_skills')
     and c.relrowsecurity),
  6::bigint,
  'RLS is enabled on all six talent tables'
);

-- The documented failure: anon could read AND delete candidates.
set local role anon;
select throws_ok(
  $$ select * from public.candidates $$,
  '42501',
  null,
  'anon cannot read candidates'
);

reset role;

-- ---------------------------------------------------------------- 3-6 candidate row access
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- The owner reads their own candidate row.
select is(
  (select count(*) from public.candidates),
  1::bigint,
  'candidate reads exactly their own row'
);

select is(
  (select user_id from public.candidates),
  '00000000-0000-0000-0000-000000000001'::uuid,
  'the row a candidate reads is their own'
);

-- An unrelated member must not see another candidate at all.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}';

select is(
  (select count(*) from public.candidates where user_id = '00000000-0000-0000-0000-000000000001'),
  0::bigint,
  'member2 cannot see member1 candidate row'
);

-- talent.read (admin) sees every candidate.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  (select count(*) from public.candidates),
  2::bigint,
  'talent.read sees all candidate rows'
);

-- ---------------------------------------------------------------- 7-8 extracted skills follow the candidate
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*) from public.candidate_skills),
  2::bigint,
  'owner sees their own extracted skills'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}';

select is(
  (select count(*) from public.candidate_skills
    where candidate_id = 'cccc0001-0000-0000-0000-000000000001'),
  0::bigint,
  'member2 cannot see another candidate extracted skills'
);

-- ---------------------------------------------------------------- 9-11 taxonomy
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*) from public.skill_groups),
  1::bigint,
  'any signed-in user can read the taxonomy'
);

select throws_ok(
  $$ insert into public.skills (name) values ('Kubernetes') $$,
  '42501',
  null,
  'writing the taxonomy without talent.manage is rejected by RLS'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';

select lives_ok(
  $$ insert into public.skills (name) values ('Kubernetes') $$,
  'talent.manage can add a skill'
);

-- ---------------------------------------------------------------- 12-13 consent and self-creation
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ insert into public.candidates (user_id, consent_at, cv_source, cv_path)
     values ('00000000-0000-0000-0000-000000000004', now(), 'storage',
             '00000000-0000-0000-0000-000000000004/cv.pdf') $$,
  '42501',
  null,
  'a member cannot create a candidate row for someone else'
);

-- No consent, no row. talent.manage passes the policy, so the NOT NULL is what rejects it.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';

select throws_ok(
  $$ insert into public.candidates (user_id, consent_at, cv_source, cv_path)
     values ('00000000-0000-0000-0000-000000000004', null, 'storage',
             '00000000-0000-0000-0000-000000000004/cv.pdf') $$,
  '23502',
  null,
  'a candidate row without consent_at is rejected'
);

-- ---------------------------------------------------------------- 14-16 scoring view
reset role;

select is(
  (select score::int
     from public.candidate_group_scores
    where candidate_id = 'cccc0001-0000-0000-0000-000000000001'
      and group_id = 'aaaa0001-0000-0000-0000-000000000001'),
  74,
  'weighted score: (3*0.90 + 2*0.50) / 5 = 74'
);

select is(
  (select meets_required
     from public.candidate_group_scores
    where candidate_id = 'cccc0001-0000-0000-0000-000000000002'),
  false,
  'meets_required is false when a required skill is missing'
);

-- security_invoker: the caller's own RLS limits which candidates are scored.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*) from public.candidate_group_scores),
  1::bigint,
  'candidate_group_scores respects the caller RLS (member1 sees only their own score)'
);

-- ---------------------------------------------------------------- 17 CV bucket
reset role;

select is(
  (select public from storage.buckets where id = 'cvs'),
  false,
  'the cvs bucket is private'
);

rollback;