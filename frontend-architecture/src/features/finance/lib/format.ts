/** "2000000.00" (decimal string from the wire) -> "Rp 2.000.000" (id-ID, 0 decimals). */
export function formatIDR(amount: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 'Rp 0';
  // Intl inserts a non-breaking space (U+00A0) between "Rp" and the number;
  // normalize to a plain space so the string is predictable to grep/compare
  // (CSV export, agent tool output, snapshot tests).
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  })
    .format(value)
    .replace(' ', ' ');
}

/** "2026-09-27" (date, no time) -> "27 Sep 2026" in WIB. */
export function formatDateWIB(occurredOn: string): string {
  return new Date(`${occurredOn}T00:00:00+07:00`).toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}
