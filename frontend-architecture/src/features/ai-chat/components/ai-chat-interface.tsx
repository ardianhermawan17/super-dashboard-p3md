'use client';

import * as React from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller';
import { Message, MessageAvatar, MessageContent } from '@/components/ui/message';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker';
import PageContainer from '@/components/layout/page-container';

const SUGGESTED_PROMPTS = [
  'What happened this week across our boards?',
  "Show today's agenda and upcoming meetings",
  'List any overdue or blocked tasks',
  'Summarize recent finance expenses by category',
];

type ToolPart = {
  type: string;
  toolName?: string;
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error';
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

function ToolMarker({ part }: { part: ToolPart }) {
  const name = part.toolName ?? part.type.replace(/^tool-/, '');
  const running = part.state === 'input-streaming' || part.state === 'input-available';
  const done = part.state === 'output-available';
  const errored = part.state === 'output-error';

  return (
    <div className='flex flex-col gap-1.5'>
      <Marker>
        <MarkerIcon>
          <Icons.code className='h-3.5 w-3.5' />
        </MarkerIcon>
        {running ? (
          <MarkerContent className='shimmer'>Querying {name}…</MarkerContent>
        ) : (
          <MarkerContent>
            {errored ? 'Failed' : 'Executed'}{' '}
            <span className='text-foreground font-medium'>{name}</span>
          </MarkerContent>
        )}
      </Marker>
      {done && part.output != null && (
        <Bubble variant='outline'>
          <BubbleContent>
            <pre className='overflow-x-auto font-mono text-xs max-h-48'>
              {JSON.stringify(part.output, null, 2)}
            </pre>
          </BubbleContent>
        </Bubble>
      )}
      {errored && part.errorText && (
        <p className='text-destructive text-xs'>{part.errorText}</p>
      )}
    </div>
  );
}

export function AiChatInterface() {
  const [input, setInput] = React.useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, status, setMessages, stop } = useChat<UIMessage>({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });

  const isBusy = status === 'submitted' || status === 'streaming';

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isBusy) return;
    const text = input.trim();
    setInput('');
    void sendMessage({ parts: [{ type: 'text', text }] });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  return (
    <PageContainer
      pageTitle='AI Assistant'
      pageDescription='Ask questions about your projects, calendar, documents, and finance with real-time tool grounding.'
      pageHeaderAction={
        <div className='flex items-center gap-2'>
          <Badge variant='outline' className='gap-1.5 py-1 px-2.5 text-xs text-muted-foreground'>
            <span className='h-2 w-2 rounded-full bg-emerald-500 animate-pulse' />
            Tools Connected
          </Badge>
          {messages.length > 0 && (
            <Button
              variant='outline'
              size='sm'
              onClick={() => setMessages([])}
              disabled={isBusy}
            >
              <Icons.trash className='mr-1.5 h-3.5 w-3.5' />
              Clear Chat
            </Button>
          )}
        </div>
      }
    >
      <Card className='flex flex-col h-[calc(100vh-14rem)] min-h-[500px] border shadow-xs overflow-hidden'>
        <MessageScrollerProvider defaultScrollPosition='end' scrollPreviousItemPeek={64}>
          <MessageScroller className='min-h-0 flex-1 p-4 sm:p-6 overflow-hidden'>
            <MessageScrollerViewport className='h-full pr-2'>
              <MessageScrollerContent className='space-y-6'>
                {messages.length === 0 ? (
                  /* Empty State / Welcome Screen */
                  <div className='flex flex-col items-center justify-center h-full min-h-[320px] text-center max-w-lg mx-auto space-y-5 my-auto py-8'>
                    <div className='flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs'>
                      <Icons.sparkles className='h-7 w-7' />
                    </div>

                    <div className='space-y-1.5'>
                      <h3 className='text-lg font-semibold text-foreground'>
                        How can I help you today?
                      </h3>
                      <p className='text-xs sm:text-sm text-muted-foreground leading-relaxed'>
                        I can inspect your Kanban boards, review today&apos;s calendar agenda, check team activity logs, and summarize finance totals.
                      </p>
                    </div>

                    <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 w-full pt-2'>
                      {SUGGESTED_PROMPTS.map((prompt) => (
                        <Button
                          key={prompt}
                          variant='outline'
                          className='h-auto py-2.5 px-3 text-xs justify-start text-left font-normal hover:bg-primary/5 hover:border-primary/30 transition-colors whitespace-normal'
                          onClick={() => handlePromptClick(prompt)}
                        >
                          <Icons.chevronRight className='mr-1.5 h-3.5 w-3.5 shrink-0 text-primary' />
                          <span>{prompt}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Messages List */
                  messages.map((message) => {
                    const isUser = message.role === 'user';

                    return (
                      <MessageScrollerItem
                        key={message.id}
                        messageId={message.id}
                        scrollAnchor={isUser}
                      >
                        <Message align={isUser ? 'end' : 'start'}>
                          {!isUser && (
                            <MessageAvatar className='h-8 w-8 rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0 self-start mt-1'>
                              <Icons.sparkles className='h-4 w-4' />
                            </MessageAvatar>
                          )}

                          <MessageContent className='max-w-2xl'>
                            {message.parts?.map((part, index) => {
                              const key = `${message.id}-${index}`;
                              if (part.type === 'text') {
                                return (
                                  <Bubble
                                    key={key}
                                    variant={isUser ? 'default' : 'secondary'}
                                    className='text-sm leading-relaxed whitespace-pre-wrap'
                                  >
                                    <BubbleContent>{part.text}</BubbleContent>
                                  </Bubble>
                                );
                              }
                              if (part.type === 'reasoning') {
                                return (
                                  <Marker key={key}>
                                    <MarkerIcon>
                                      <Icons.sparkles className='h-3.5 w-3.5' />
                                    </MarkerIcon>
                                    <MarkerContent className='italic text-xs text-muted-foreground'>
                                      {part.text}
                                    </MarkerContent>
                                  </Marker>
                                );
                              }
                              if (
                                part.type === 'dynamic-tool' ||
                                part.type.startsWith('tool-')
                              ) {
                                return (
                                  <ToolMarker
                                    key={key}
                                    part={part as unknown as ToolPart}
                                  />
                                );
                              }
                              return null;
                            })}
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    );
                  })
                )}

                {status === 'submitted' && (
                  <MessageScrollerItem messageId='pending'>
                    <Message align='start'>
                      <MessageAvatar className='bg-primary/10 text-primary h-8 w-8 self-start rounded-lg border border-primary/20'>
                        <Icons.sparkles className='h-4 w-4' />
                      </MessageAvatar>
                      <MessageContent>
                        <Marker>
                          <MarkerContent className='shimmer text-xs'>
                            Thinking…
                          </MarkerContent>
                        </Marker>
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                )}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>

        {/* Input & Action Bar */}
        <div className='p-3 sm:p-4 border-t bg-muted/20'>
          <form onSubmit={handleSubmit} className='relative flex items-end gap-2'>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='Ask about tasks, calendar, activity, finance… (Enter to send)'
              aria-label='Ask AI assistant'
              rows={2}
              className='flex-1 resize-none rounded-lg border bg-background px-3 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'
              disabled={isBusy}
            />

            <div className='flex items-center gap-1.5'>
              {isBusy ? (
                <Button
                  type='button'
                  size='icon'
                  variant='outline'
                  onClick={() => stop()}
                  className='h-10 w-10 shrink-0 text-destructive'
                  title='Stop generation'
                >
                  <Icons.close className='h-4 w-4' />
                </Button>
              ) : (
                <Button
                  type='submit'
                  size='icon'
                  disabled={!input.trim() || isBusy}
                  className='h-10 w-10 shrink-0'
                  title='Send message'
                >
                  <Icons.send className='h-4 w-4' />
                </Button>
              )}
            </div>
          </form>
          <div className='flex items-center justify-between text-[11px] text-muted-foreground mt-2 px-1'>
            <span>
              Grounding: Shared read-only tool registry · Audit:{' '}
              <code className='font-mono text-foreground'>client_id: in-app</code>
            </span>
            <span className='hidden sm:inline'>Shift+Enter for newline</span>
          </div>
        </div>
      </Card>
    </PageContainer>
  );
}
