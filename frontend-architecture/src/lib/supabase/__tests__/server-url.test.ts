import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { serverSupabaseUrl } from '../server-url';

const ORIGINAL = { ...process.env };

function withEnv(env: Record<string, string | undefined>, fn: () => void) {
  const prevSupabase = process.env.SUPABASE_URL;
  const prevNext = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (env.SUPABASE_URL === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = env.SUPABASE_URL;
  if (env.NEXT_PUBLIC_SUPABASE_URL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    fn();
  } finally {
    if (prevSupabase === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = prevSupabase;
    if (prevNext === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = prevNext;
  }
}

describe('serverSupabaseUrl (server-side / Docker networking split)', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = ORIGINAL.SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL.NEXT_PUBLIC_SUPABASE_URL;
  });
  afterEach(() => {
    process.env.SUPABASE_URL = ORIGINAL.SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL.NEXT_PUBLIC_SUPABASE_URL;
  });

  it('prefers SUPABASE_URL (host-reachable) when running inside Docker', () => {
    withEnv(
      {
        SUPABASE_URL: 'http://host.docker.internal:54371',
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54371',
      },
      () => {
        expect(serverSupabaseUrl()).toBe('http://host.docker.internal:54371');
      },
    );
  });

  it('falls back to NEXT_PUBLIC_SUPABASE_URL when SUPABASE_URL is unset (local dev)', () => {
    withEnv(
      {
        SUPABASE_URL: undefined,
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54371',
      },
      () => {
        expect(serverSupabaseUrl()).toBe('http://127.0.0.1:54371');
      },
    );
  });

  it('returns a default when neither is set', () => {
    withEnv(
      {
        SUPABASE_URL: undefined,
        NEXT_PUBLIC_SUPABASE_URL: undefined,
      },
      () => {
        expect(serverSupabaseUrl()).toContain('127.0.0.1');
      },
    );
  });
});
