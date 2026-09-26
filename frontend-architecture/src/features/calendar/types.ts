export type CalendarViewType = 'month' | 'week' | 'day' | 'agenda';

export type EventSource = 'app' | 'google';

export type EventAudience = {
  user_id?: string | null;
  role_id?: string | null;
  group_id?: string | null;
  name?: string;
  kind: 'user' | 'role' | 'group';
};

export type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  rrule: string | null;
  source: EventSource;
  created_by: string | null;
  created_at: string;
  audience?: EventAudience[];
};
