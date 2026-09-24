# Data-layer pattern

> **Scope:** how every feature reads and writes data. Shown for the calendar; every feature follows the same five files.
> Index: [frontend-architecture/](README.md) · Gateway: [README_AI_AGENT.md](../../README_AI_AGENT.md)

Shown for the calendar; every feature follows the same five files.

```ts
// src/features/calendar/api/keys.ts
export const calendarKeys = {
  all: ['calendar'] as const,
  range: (from: string, to: string) => [...calendarKeys.all, 'range', from, to] as const,
};
```

```ts
// src/features/calendar/api/queries.ts  (no 'use client' / 'server-only': runs on both sides)
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// from/to are UTC ISO strings (Date.toISOString()); recurring app events are always fetched
// and expanded client-side for the visible range (features/calendar.md).
export async function fetchEvents(db: SupabaseClient<Database>, from: string, to: string) {
  const { data, error } = await db
    .from('events')
    .select('id, title, description, location, starts_at, ends_at, all_day, rrule, source, ' +
            'event_audience(user_id, role_id, group_id), event_google_links(html_link)')
    .or(`rrule.not.is.null,and(starts_at.lt."${to}",ends_at.gt."${from}")`)
    .order('starts_at');
  if (error) throw error;
  return data;
}
```

```tsx
// src/app/dashboard/calendar/page.tsx  (Server Component)
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client'; // template helper: adjust to its actual export
import { createClient } from '@/lib/supabase/server';
import { calendarKeys } from '@/features/calendar/api/keys';
import { fetchEvents } from '@/features/calendar/api/queries';
import { monthRange } from '@/features/calendar/lib/range';
import { CalendarView } from '@/features/calendar/components/calendar-view';

export default async function CalendarPage() {
  const qc = getQueryClient();
  const db = await createClient();
  const { from, to } = monthRange(new Date());
  await qc.prefetchQuery({ queryKey: calendarKeys.range(from, to), queryFn: () => fetchEvents(db, from, to) });
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <CalendarView from={from} to={to} />
    </HydrationBoundary>
  );
}
```

```ts
// src/features/calendar/hooks/use-events.ts
'use client';
import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { calendarKeys } from '../api/keys';
import { fetchEvents } from '../api/queries';

export function useEvents(from: string, to: string) {
  const db = useMemo(() => createClient(), []);
  return useSuspenseQuery({ queryKey: calendarKeys.range(from, to), queryFn: () => fetchEvents(db, from, to) });
}
```

```ts
// src/features/calendar/api/actions.ts
'use server';
import { createClient } from '@/lib/supabase/server';
import { eventInputSchema, type EventInput } from '../schemas/event';

export async function createEvent(input: EventInput) {
  const parsed = eventInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues };

  const db = await createClient(); // runs as the user → RLS applies
  const { audience, ...event } = parsed.data;
  const { data, error } = await db.from('events').insert(event).select('id').single();
  if (error) return { ok: false as const, error: error.message };

  if (audience.length) {
    // One insert statement → one invite notification batch and one Google push.
    const rows = audience.map((a) => ({
      event_id: data.id,
      user_id: a.kind === 'user' ? a.id : null,
      role_id: a.kind === 'role' ? a.id : null,
      group_id: a.kind === 'group' ? a.id : null,
    }));
    const { error: aErr } = await db.from('event_audience').insert(rows);
    if (aErr) return { ok: false as const, error: aErr.message };
  }
  return { ok: true as const, id: data.id };
}
```

On the client, call the action from `useMutation` and `invalidateQueries({ queryKey: calendarKeys.all })` on success, the same way the template's product form does.

**Rules of the pattern**
- Query functions take the Supabase client as a parameter. Never create a client inside them.
- Every mutation is a Server Action that re-validates with the shared Zod schema and returns `{ ok, error }`, never throws to the client.
- Query keys come from the feature's `keys.ts`; no inline arrays.
