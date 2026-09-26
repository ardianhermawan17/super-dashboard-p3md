-- ============================================================
-- M9 · Talent (PSI-080)
--
-- The outline in docs/database-architecture/m9-talent.md warns that as written it creates
-- six tables with NO RLS, and Supabase grants anon table access by default — on 2026-09-24 the
-- anonymous role could read and delete `candidates` (C-05, C-08). This migration therefore
-- enables RLS on every table in the same transaction that creates it, and grants nothing to anon.
--
-- Access model:
--   skill_groups / skills / skill_aliases / skill_group_skills  -> readable by any authenticated
--                                                                  user; writable with talent.manage
--   candidates / candidate_skills                               -> owner reads own row;
--                                                                  talent.read reads all
--   candidate_group_scores                                      -> security_invoker view over the above
-- ============================================================

-- ---------------------------------------------------------------- taxonomy

create table if not exists public.skill_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, -- 'Software Engineer'
  created_at timestamptz not null default now()
);

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, -- 'Next.js'
  created_at timestamptz not null default now()
);

-- 'nextjs' → Next.js. Keyed by the alias text itself; case-folded on write by the app.
create table if not exists public.skill_aliases (
  alias text primary key,
  skill_id uuid not null references public.skills(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.skill_group_skills (
  group_id uuid not null references public.skill_groups(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  weight smallint not null default 1 check (weight between 1 and 5),
  required boolean not null default false,
  primary key (group_id, skill_id)
);

-- ---------------------------------------------------------------- candidates

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  consent_at timestamptz not null, -- no consent, no row
  cv_source text not null check (cv_source in ('storage', 'drive')),
  cv_path text, -- storage: '<user_id>/<file>'; nulled after parsing
  cv_drive_file_id text references public.drive_files(id) on delete set null,
  parsed_at timestamptz,
  created_at timestamptz not null default now(),
  -- A CV must come from exactly one place, and the path must match the source.
  constraint candidates_cv_source_matches check (
    (cv_source = 'storage' and cv_path is not null) or
    (cv_source = 'drive' and cv_drive_file_id is not null)
  )
);

create table if not exists public.candidate_skills (
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  confidence numeric(3,2) not null check (confidence between 0 and 1),
  evidence text check (char_length(evidence) <= 160), -- short phrase, never contact data
  years numeric(4,1) check (years is null or years >= 0),
  primary key (candidate_id, skill_id)
);

create index if not exists idx_candidates_user on public.candidates (user_id);
create index if not exists idx_candidate_skills_skill on public.candidate_skills (skill_id);
create index if not exists idx_skill_aliases_skill on public.skill_aliases (skill_id);

-- ---------------------------------------------------------------- RLS

alter table public.skill_groups enable row level security;
alter table public.skills enable row level security;
alter table public.skill_aliases enable row level security;
alter table public.skill_group_skills enable row level security;
alter table public.candidates enable row level security;
alter table public.candidate_skills enable row level security;

-- Taxonomy: read for any signed-in user (it is not personal data), write with talent.manage.
do $$
declare t text;
begin
  foreach t in array array['skill_groups', 'skills', 'skill_aliases', 'skill_group_skills']
  loop
    execute format(
      'create policy "taxonomy readable" on public.%I for select to authenticated using (true)', t);
    execute format(
      'create policy "taxonomy managed with talent.manage" on public.%I for all to authenticated '
      'using (public.has_permission(''talent.manage'')) '
      'with check (public.has_permission(''talent.manage''))', t);
  end loop;
end $$;

-- Candidates: the owner always sees their own row; talent.read sees every row.
create policy "candidate reads own row" on public.candidates for select to authenticated
  using (user_id = (select auth.uid()) or public.has_permission('talent.read'));

-- A candidate row is created by the person consenting (their own user_id), or by talent.manage.
create policy "candidate created as self or by talent.manage" on public.candidates for insert to authenticated
  with check (user_id = (select auth.uid()) or public.has_permission('talent.manage'));

create policy "candidate updated by owner or talent.manage" on public.candidates for update to authenticated
  using (user_id = (select auth.uid()) or public.has_permission('talent.manage'))
  with check (user_id = (select auth.uid()) or public.has_permission('talent.manage'));

-- Deleting candidate data (withdrawing consent) is the owner's right, or talent.manage.
create policy "candidate deletable by owner or talent.manage" on public.candidates for delete to authenticated
  using (user_id = (select auth.uid()) or public.has_permission('talent.manage'));

-- Extracted skills follow their candidate row.
create policy "candidate skills visible with the candidate" on public.candidate_skills for select to authenticated
  using (
    exists (
      select 1 from public.candidates c
      where c.id = candidate_skills.candidate_id
        and (c.user_id = (select auth.uid()) or public.has_permission('talent.read'))
    )
  );

-- Only the parser (service role) and talent.manage write extracted skills.
create policy "candidate skills managed" on public.candidate_skills for all to authenticated
  using (public.has_permission('talent.manage'))
  with check (public.has_permission('talent.manage'));

-- ---------------------------------------------------------------- scoring view

-- security_invoker: the caller's own RLS decides which candidate rows feed the scores, so a
-- user without talent.read sees only their own score instead of everyone's.
create or replace view public.candidate_group_scores
with (security_invoker = true) as
select
  c.id as candidate_id,
  g.id as group_id,
  g.name as group_name,
  round(100 * sum(gs.weight * coalesce(cs.confidence, 0)) / nullif(sum(gs.weight), 0)) as score,
  bool_and(not gs.required or cs.skill_id is not null) as meets_required
from public.candidates c
cross join public.skill_groups g
join public.skill_group_skills gs on gs.group_id = g.id
left join public.candidate_skills cs on cs.candidate_id = c.id and cs.skill_id = gs.skill_id
group by c.id, g.id, g.name;

-- ---------------------------------------------------------------- CV storage bucket

-- Private bucket. Objects live at '<user_id>/<file>' and only the owner (or talent.manage)
-- can touch them; the folder check is what stops one user reading another's CV.
insert into storage.buckets (id, name, public)
values ('cvs', 'cvs', false)
on conflict (id) do update set public = false;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'cvs owner read'
  ) then
    create policy "cvs owner read" on storage.objects for select to authenticated
      using (
        bucket_id = 'cvs'
        and ((storage.foldername(name))[1] = (select auth.uid())::text
             or public.has_permission('talent.manage'))
      );

    create policy "cvs owner write" on storage.objects for insert to authenticated
      with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid())::text);

    create policy "cvs owner update" on storage.objects for update to authenticated
      using (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid())::text)
      with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid())::text);

    create policy "cvs owner delete" on storage.objects for delete to authenticated
      using (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
end $$;

-- ---------------------------------------------------------------- grants

-- No grant to anon anywhere in this migration: an unauthenticated caller must not be able to
-- enumerate candidates (C-05, C-08).
grant select on public.skill_groups, public.skills, public.skill_aliases, public.skill_group_skills
  to authenticated;
grant insert, update, delete on public.skill_groups, public.skills, public.skill_aliases, public.skill_group_skills
  to authenticated;

grant select, insert, update, delete on public.candidates, public.candidate_skills to authenticated;
grant select on public.candidate_group_scores to authenticated;

revoke all on public.skill_groups, public.skills, public.skill_aliases, public.skill_group_skills,
  public.candidates, public.candidate_skills, public.candidate_group_scores from anon;