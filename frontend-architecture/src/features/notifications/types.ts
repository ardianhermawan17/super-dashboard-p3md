export type NotificationType =
  | 'mail.received'
  | 'event.invited'
  | 'event.updated'
  | 'task.assigned'
  | 'digest.ready'
  | 'document.added'
  | 'system';

export type NotificationPref = {
  type: string;
  push: boolean;
};

export type PushSubscriptionDevice = {
  id: string;
  endpoint: string;
  user_agent: string | null;
  created_at: string;
  last_success_at: string | null;
};

export type NotificationItem = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
  read_at: string | null;
  pushed_at: string | null;
};
