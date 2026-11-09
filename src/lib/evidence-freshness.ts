export const RECENT_EVIDENCE_DAYS = 90;

export function isRecentDate(value: string | undefined, days = RECENT_EVIDENCE_DAYS, now = Date.now()): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  const age = now - timestamp;
  return age >= -86400000 && age <= days * 86400000;
}
