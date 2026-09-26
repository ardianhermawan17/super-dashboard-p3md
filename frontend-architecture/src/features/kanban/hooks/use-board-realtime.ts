'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { kanbanKeys } from '../api/keys';

export function useBoardRealtime(boardId?: string) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!boardId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`board:${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `board_id=eq.${boardId}`
        },
        () => {
          qc.invalidateQueries({ queryKey: kanbanKeys.board(boardId) });
          qc.invalidateQueries({ queryKey: kanbanKeys.board('default') });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'board_columns',
          filter: `board_id=eq.${boardId}`
        },
        () => {
          qc.invalidateQueries({ queryKey: kanbanKeys.board(boardId) });
          qc.invalidateQueries({ queryKey: kanbanKeys.board('default') });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId, qc]);
}
