export type MailStatus = 'draft' | 'queued' | 'sending' | 'sent' | 'failed';

export type DeliveryStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'complained'
  | 'failed';

export type RoleMailMessage = {
  id: string;
  sender_id: string | null;
  sender_name: string | null;
  is_system: boolean;
  to_role_id: string | null;
  to_role_name: string | null;
  to_group_id: string | null;
  to_group_name: string | null;
  target_kind: 'role' | 'group';
  target_name: string;
  target_slug: string;
  subject: string;
  body_md: string;
  status: MailStatus;
  created_at: string;
  sent_at: string | null;
  recipient_count?: number;
};

export type RecipientDelivery = {
  user_id: string;
  user_name: string | null;
  delivery_status: DeliveryStatus;
  updated_at: string;
};

export type MailThread = {
  id: string;
  target_kind: 'role' | 'group';
  target_id: string;
  target_name: string;
  target_slug: string;
  messages: RoleMailMessage[];
  last_message: RoleMailMessage;
};
