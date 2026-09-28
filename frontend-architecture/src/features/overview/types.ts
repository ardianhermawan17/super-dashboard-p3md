export type DigestRow = {
  id: string;
  created_at: string;
  period_start: string;
  period_end: string;
  content_md: string;
  model: string;
};

export type DigestActionResult =
  | { ok: true; data: DigestRow | null }
  | { ok: false; error: string };
