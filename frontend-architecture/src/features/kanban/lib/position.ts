import { generateKeyBetween } from 'fractional-indexing';

export const positionBetween = (
  prev?: { position: string } | null,
  next?: { position: string } | null
): string => generateKeyBetween(prev?.position ?? null, next?.position ?? null);
