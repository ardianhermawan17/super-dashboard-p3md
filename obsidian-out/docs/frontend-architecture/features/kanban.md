# Kanban (board on Supabase)

> **Scope:** the template board wired to Supabase: membership, ordering, moves, realtime. Schema: [m5-kanban.md](../../database-architecture/m5-kanban.md).
> Index: [frontend-architecture/](../README.md) · Gateway: [README_AI_AGENT.md](../../../README_AI_AGENT.md)

The template board uses dnd-kit for drag-and-drop and Zustand for state. Keep dnd-kit. Replace the Zustand persistence with the query cache; Zustand may stay for pure UI state (open card, drag overlay).

- **Membership:** a board is shared with users and/or groups (`board_members`, `board_groups`).
- **Ordering:** fractional keys, so a move writes one row instead of renumbering a column.

```ts
// src/features/kanban/lib/position.ts
import { generateKeyBetween } from 'fractional-indexing';

export const positionBetween = (prev?: { position: string } | null, next?: { position: string } | null) =>
  generateKeyBetween(prev?.position ?? null, next?.position ?? null);
```

  The DB column is `position text collate "C"` ([m5-kanban.md](../../database-architecture/m5-kanban.md)) so Postgres sorts exactly like JavaScript string comparison. Without `collate "C"` the order drifts.

- **Move:** on drag end, `setQueryData` optimistically, then call `moveTask(taskId, toColumnId, position)`; roll back on `{ ok: false }`.
- **Assign:** changing the assignee notifies them (`task.assigned`, [push-notifications.md](../../backend-architecture/push-notifications.md#what-creates-notifications)).
- **Realtime:**

```ts
// src/features/kanban/hooks/use-board-realtime.ts
'use client';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { kanbanKeys } from '../api/keys';

export function useBoardRealtime(boardId: string) {
  const qc = useQueryClient();
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`board:${boardId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `board_id=eq.${boardId}` },
        () => qc.invalidateQueries({ queryKey: kanbanKeys.board(boardId) }))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId, qc]);
}
```
