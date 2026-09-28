import { describe, expect, it } from 'bun:test';
import type { DigestRow } from '../types';

describe('Overview Daily Digest Feature (PSI-077)', () => {
  it('validates DigestRow model shape and formatting', () => {
    const digest: DigestRow = {
      id: 'd9e03d3c-9fb1-432b-9279-d5c4cb03e481',
      created_at: '2026-09-28T23:00:00Z',
      period_start: '2026-09-27T23:00:00Z',
      period_end: '2026-09-28T23:00:00Z',
      content_md: '## Morning Briefing\n- **Blockers**: None\n- **Agenda**: 2 events scheduled',
      model: 'anthropic:claude-haiku-4-5-20251001',
    };

    expect(digest.id).toBeDefined();
    expect(digest.model).toContain('anthropic:');
    expect(digest.content_md).toContain('Morning Briefing');

    // Date formatting test
    const dateLabel = new Date(digest.created_at).toLocaleDateString('en-GB', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    expect(dateLabel).toContain('2026');

    // Time formatting test (23:00 UTC = 06:00 WIB next day)
    const timeLabel = new Date(digest.created_at).toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    expect(timeLabel).toBe('06:00');
  });

  it('formats model name label cleanly for UI badges', () => {
    const cleanAnthropic = 'anthropic:claude-haiku-4-5-20251001'.replace(/^anthropic:|^hermes:/, '');
    expect(cleanAnthropic).toBe('claude-haiku-4-5-20251001');

    const cleanHermes = 'hermes:hermes-3-llama-3.1-405b'.replace(/^anthropic:|^hermes:/, '');
    expect(cleanHermes).toBe('hermes-3-llama-3.1-405b');
  });
});
