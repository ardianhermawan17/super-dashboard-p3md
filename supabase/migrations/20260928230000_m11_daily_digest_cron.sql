-- PSI-077 · Daily digest pg_cron schedule
-- Runs daily at 06:00 WIB (23:00 UTC) via public.internal_post('functions', 'daily-digest')
-- Spec: docs/backend-architecture/edge-functions.md § "daily-digest"

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('daily-digest');
    perform cron.schedule(
      'daily-digest',
      '0 23 * * *', -- 06:00 WIB (Asia/Jakarta, UTC+7)
      $cron$ select public.internal_post('functions', 'daily-digest') $cron$
    );
  end if;
exception
  when others then null;
end $$;
