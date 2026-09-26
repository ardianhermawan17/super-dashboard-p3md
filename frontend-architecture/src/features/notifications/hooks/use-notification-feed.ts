'use client';

import * as React from 'react';
import { createClient } from '@/lib/supabase/client';

export function useNotificationFeed(
  userId?: string | null,
  onRefresh?: () => void
) {
  React.useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        () => {
          if (onRefresh) {
            onRefresh();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, onRefresh]);
}
