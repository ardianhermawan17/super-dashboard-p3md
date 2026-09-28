'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Icons } from '@/components/icons';
import { formatGrantDate, formatGrantRelative, formatGrantScopes } from '../lib/format';
import type { ConnectedAppGrant } from '../types';

interface ConnectedAppCardProps {
  grant: ConnectedAppGrant;
  onRevoke: (grant: ConnectedAppGrant) => void;
  disabled?: boolean;
}

export function ConnectedAppCard({ grant, onRevoke, disabled = false }: ConnectedAppCardProps) {
  const { client, scopes, granted_at } = grant;
  const formattedScopes = formatGrantScopes(scopes);
  const initial = client.name ? client.name.charAt(0).toUpperCase() : 'A';
  const relativeDate = formatGrantRelative(granted_at);
  const fullDate = formatGrantDate(granted_at);

  return (
    <Card className='overflow-hidden transition-colors hover:border-foreground/20'>
      <CardContent className='p-5 sm:p-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
          {/* Left: App Identity */}
          <div className='flex items-start gap-4'>
            <Avatar className='h-12 w-12 rounded-xl border bg-muted/30 shadow-xs shrink-0'>
              {client.logo_uri ? (
                <AvatarImage src={client.logo_uri} alt={`${client.name} logo`} />
              ) : null}
              <AvatarFallback className='rounded-xl text-base font-semibold'>
                {initial}
              </AvatarFallback>
            </Avatar>

            <div className='space-y-1'>
              <div className='flex flex-wrap items-center gap-2'>
                <h3 className='text-base font-semibold tracking-tight text-foreground'>
                  {client.name}
                </h3>
                <Badge variant='outline' className='text-[10px] font-normal text-muted-foreground'>
                  OAuth 2.1
                </Badge>
              </div>

              {client.uri ? (
                <a
                  href={client.uri}
                  target='_blank'
                  rel='noreferrer'
                  className='inline-flex items-center gap-1 text-xs text-primary hover:underline'
                >
                  <span>{client.uri.replace(/^https?:\/\//, '')}</span>
                  <Icons.externalLink className='h-3 w-3' />
                </a>
              ) : (
                <p className='text-xs text-muted-foreground'>External MCP Client / Agent</p>
              )}

              <p className='text-xs text-muted-foreground pt-1' title={fullDate}>
                Connected <span className='font-medium text-foreground'>{relativeDate}</span> ({fullDate})
              </p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className='flex items-center sm:self-center'>
            <Button
              variant='outline'
              size='sm'
              className='text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30'
              onClick={() => onRevoke(grant)}
              disabled={disabled}
            >
              <Icons.trash className='mr-1.5 h-3.5 w-3.5' />
              Revoke Access
            </Button>
          </div>
        </div>

        {/* Bottom: Granted Scopes */}
        <div className='mt-4 pt-4 border-t space-y-2'>
          <p className='text-xs font-medium text-muted-foreground'>Granted Permissions:</p>
          <div className='flex flex-wrap gap-1.5'>
            {formattedScopes.map((scope) => (
              <Badge
                key={scope.scope}
                variant='secondary'
                className='text-xs font-normal py-0.5 px-2'
                title={scope.description}
              >
                <Icons.check className='mr-1 h-3 w-3 text-emerald-600 dark:text-emerald-400' />
                {scope.label}
              </Badge>
            ))}
            {formattedScopes.length === 0 && (
              <span className='text-xs text-muted-foreground italic'>
                No explicit permissions listed
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
