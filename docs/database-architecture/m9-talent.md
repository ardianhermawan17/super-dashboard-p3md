# M9 · Talent (phase 8, outline)

> **Scope:** skill taxonomy, candidates, extracted skills, scoring view.
> Parser: [edge-functions.md](../backend-architecture/edge-functions.md#parse-cv-psi-082-outline) · UI: [talent.md](../frontend-architecture/features/talent.md) · Index: [database-architecture/](README.md) · Gateway: [README_AI_AGENT.md](../../README_AI_AGENT.md)

```sql
create table public.skill_groups (id uuid primary key default gen_random_uuid(), name text not null unique);  -- 'Software Engineer'
create table public.skills (id uuid primary key default gen_random_uuid(), name text not null unique);        -- 'Next.js'
create table public.skill_aliases (alias text primary key, skill_id uuid not null references public.skills(id) on delete cascade);  -- 'nextjs' → Next.js
create table public.skill_group_skills (
  group_id uuid references public.skill_groups(id) on delete cascade,
  skill_id uuid references public.skills(id) on delete cascade,
  weight smallint not null default 1 check (weight between 1 and 5),
  required boolean not null default false,
  primary key (group_id, skill_id)
);
create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  consent_at timestamptz not null,               -- no consent, no row
  cv_source text not null check (cv_source in ('storage', 'drive')),
  cv_path text,                                  -- storage: '<user_id>/<file>'; nulled after parsing
  cv_drive_file_id text references public.drive_files(id) on delete set null,   -- drive: talent root ([google-integration.md](../backend-architecture/google-integration.md#talent-cvs-in-drive))
  parsed_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.candidate_skills (
  candidate_id uuid references public.candidates(id) on delete cascade,
  skill_id uuid references public.skills(id) on delete cascade,
  confidence numeric(3,2) not null check (confidence between 0 and 1),
  evidence text check (char_length(evidence) <= 160),   -- short phrase, never contact data
  years numeric(4,1),
  primary key (candidate_id, skill_id)
);
-- + RLS on all six tables: owner reads own row; talent.read reads scores; talent.manage edits taxonomy.
-- + private bucket 'cvs', path '<user_id>/<file>', policy (storage.foldername(name))[1] = auth.uid()::text

create view public.candidate_group_scores with (security_invoker = true) as
select c.id as candidate_id, g.id as group_id, g.name as group_name,
       round(100 * sum(gs.weight * coalesce(cs.confidence, 0)) / nullif(sum(gs.weight), 0)) as score,
       bool_and(not gs.required or cs.skill_id is not null) as meets_required
  from public.candidates c
  cross join public.skill_groups g
  join public.skill_group_skills gs on gs.group_id = g.id
  left join public.candidate_skills cs on cs.candidate_id = c.id and cs.skill_id = gs.skill_id
 group by c.id, g.id, g.name;
```

"Strong skills" for a candidate = their top 5 `candidate_skills` by `confidence` within the group being screened. `agent_talent_overview` (PSI-084) exposes group, score, `meets_required` and skill names only.
