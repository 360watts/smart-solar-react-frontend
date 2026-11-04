export function daysSince(dateString: string, now: Date = new Date()): number {
  const then = new Date(dateString).getTime();
  const diffMs = now.getTime() - then;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
