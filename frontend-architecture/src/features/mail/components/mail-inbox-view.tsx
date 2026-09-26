'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Icons } from '@/components/icons';
import { getMessageRecipientsData } from '../actions';
import type { MailThread, RecipientDelivery, RoleMailMessage } from '../types';

const getStatusBadge = (status: RoleMailMessage['status']) => {
  switch (status) {
    case 'sent':
      return (
        <Badge variant='outline' className='text-[10px] text-emerald-500 border-emerald-500/30'>
          Sent
        </Badge>
      );
    case 'sending':
      return (
        <Badge variant='outline' className='text-[10px] text-blue-500 border-blue-500/30'>
          Sending
        </Badge>
      );
    case 'queued':
      return (
        <Badge variant='secondary' className='text-[10px]'>
          Queued
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant='destructive' className='text-[10px]'>
          Failed
        </Badge>
      );
    case 'draft':
    default:
      return (
        <Badge variant='outline' className='text-[10px]'>
          Draft
        </Badge>
      );
  }
};

const getDeliveryBadge = (status: RecipientDelivery['delivery_status']) => {
  switch (status) {
    case 'delivered':
      return (
        <Badge variant='outline' className='text-[10px] text-emerald-500 border-emerald-500/30'>
          Delivered
        </Badge>
      );
    case 'sent':
      return (
        <Badge variant='outline' className='text-[10px] text-blue-500 border-blue-500/30'>
          Sent
        </Badge>
      );
    case 'bounced':
    case 'failed':
    case 'complained':
      return (
        <Badge variant='destructive' className='text-[10px]'>
          {status}
        </Badge>
      );
    case 'pending':
    default:
      return (
        <Badge variant='secondary' className='text-[10px]'>
          Pending
        </Badge>
      );
  }
};

export function MailInboxView({ threads }: { threads: MailThread[] }) {
  const [selectedThreadId, setSelectedThreadId] = React.useState<string | null>(
    threads[0]?.id ?? null
  );
  const [selectedMessageId, setSelectedMessageId] = React.useState<string | null>(
    threads[0]?.messages[0]?.id ?? null
  );

  const activeThread = React.useMemo(() => {
    return threads.find((t) => t.id === selectedThreadId) ?? threads[0] ?? null;
  }, [threads, selectedThreadId]);

  const activeMessage = React.useMemo(() => {
    if (!activeThread) return null;
    return (
      activeThread.messages.find((m) => m.id === selectedMessageId) ??
      activeThread.messages[0] ??
      null
    );
  }, [activeThread, selectedMessageId]);

  const [recipients, setRecipients] = React.useState<RecipientDelivery[]>([]);
  const [loadingRecipients, setLoadingRecipients] = React.useState(false);

  React.useEffect(() => {
    if (activeMessage) {
      setLoadingRecipients(true);
      getMessageRecipientsData(activeMessage.id)
        .then((res) => {
          setRecipients(res.recipients);
        })
        .finally(() => {
          setLoadingRecipients(false);
        });
    }
  }, [activeMessage]);

  if (threads.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-20 border rounded-2xl bg-card shadow-xs text-center'>
        <div className='h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3 text-muted-foreground'>
          <Icons.mail className='h-6 w-6' />
        </div>
        <h3 className='text-sm font-semibold text-foreground'>Your Mailbox is Empty</h3>
        <p className='text-xs text-muted-foreground mt-1 max-w-sm'>
          No role or group messages have been sent or received yet.
        </p>
      </div>
    );
  }

  return (
    <div className='grid grid-cols-1 md:grid-cols-12 rounded-2xl border border-border bg-card shadow-xs overflow-hidden min-h-[600px]'>
      {/* Thread list (Roles & Groups) */}
      <div className='md:col-span-4 border-r border-border flex flex-col bg-muted/10'>
        <div className='p-3 border-b border-border flex items-center justify-between'>
          <span className='text-xs font-semibold text-foreground uppercase tracking-wider'>
            Audience Channels
          </span>
          <span className='text-[11px] text-muted-foreground'>
            {threads.length} {threads.length === 1 ? 'channel' : 'channels'}
          </span>
        </div>

        <ScrollArea className='flex-1 h-[540px]'>
          <div className='divide-y divide-border/60 p-1.5'>
            {threads.map((t) => {
              const isSelected = t.id === activeThread?.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedThreadId(t.id);
                    setSelectedMessageId(t.messages[0]?.id ?? null);
                  }}
                  className={`w-full text-left p-3 rounded-xl transition-colors space-y-1 ${
                    isSelected
                      ? 'bg-primary/10 border-primary/20 text-foreground'
                      : 'hover:bg-muted/40 text-muted-foreground'
                  }`}
                >
                  <div className='flex items-center justify-between gap-2'>
                    <div className='flex items-center gap-1.5'>
                      <Badge variant='outline' className='text-[10px] uppercase font-mono px-1.5 py-0'>
                        {t.target_kind}
                      </Badge>
                      <span className='text-xs font-semibold text-foreground truncate'>
                        {t.target_name}
                      </span>
                    </div>
                    <span className='text-[10px] text-muted-foreground shrink-0'>
                      {new Date(t.last_message.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className='text-xs font-medium text-foreground truncate'>
                    {t.last_message.subject}
                  </div>
                  <div className='text-[11px] text-muted-foreground truncate'>
                    {t.last_message.body_md || 'No text content'}
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Message list and Detail pane */}
      <div className='md:col-span-8 flex flex-col'>
        {activeThread && activeMessage ? (
          <>
            {/* Header */}
            <div className='p-4 border-b border-border flex flex-wrap items-center justify-between gap-3 bg-card'>
              <div className='space-y-0.5'>
                <div className='flex items-center gap-2'>
                  <span className='text-sm font-semibold text-foreground'>
                    {activeMessage.subject}
                  </span>
                  {getStatusBadge(activeMessage.status)}
                </div>
                <div className='text-xs text-muted-foreground flex items-center gap-2'>
                  <span>
                    Target: <strong>{activeThread.target_name}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Sender: <strong>{activeMessage.sender_name}</strong>
                  </span>
                  <span>•</span>
                  <span>{new Date(activeMessage.created_at).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Message Body & Delivery Statuses */}
            <ScrollArea className='flex-1 p-5 h-[480px]'>
              <div className='space-y-6 max-w-2xl'>
                {/* Body markdown */}
                <div className='p-4 rounded-xl border border-border/80 bg-background/50 shadow-2xs space-y-2'>
                  <div className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
                    Message Content
                  </div>
                  <div className='text-sm text-foreground whitespace-pre-wrap leading-relaxed'>
                    {activeMessage.body_md}
                  </div>
                </div>

                {/* Per-recipient Delivery Status Summary (Privacy-safe: no email addresses) */}
                <div className='space-y-3 pt-2'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <Icons.users className='h-4 w-4 text-primary' />
                      <h4 className='text-xs font-semibold text-foreground uppercase tracking-wider'>
                        Recipient Delivery Status ({recipients.length})
                      </h4>
                    </div>
                    {loadingRecipients && (
                      <Icons.spinner className='h-3.5 w-3.5 animate-spin text-muted-foreground' />
                    )}
                  </div>

                  {recipients.length === 0 ? (
                    <div className='text-xs text-muted-foreground p-3 rounded-lg border border-dashed bg-muted/20 text-center italic'>
                      No recipient delivery records yet.
                    </div>
                  ) : (
                    <div className='rounded-xl border border-border overflow-hidden divide-y divide-border/60 bg-background'>
                      {recipients.map((r) => (
                        <div
                          key={r.user_id}
                          className='flex items-center justify-between p-2.5 px-3 text-xs'
                        >
                          <span className='font-medium text-foreground'>{r.user_name}</span>
                          <div className='flex items-center gap-2'>
                            {getDeliveryBadge(r.delivery_status)}
                            <span className='text-[10px] text-muted-foreground'>
                              {new Date(r.updated_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className='text-[11px] text-muted-foreground flex items-center gap-1.5'>
                    <Icons.info className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
                    <span>
                      Per privacy rules, recipient delivery status displays registered member names
                      only. Raw email addresses are never exposed.
                    </span>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className='flex-1 flex items-center justify-center p-8 text-muted-foreground text-xs'>
            Select an audience channel to view messages.
          </div>
        )}
      </div>
    </div>
  );
}
