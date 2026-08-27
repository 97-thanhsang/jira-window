export function formatDuration(seconds: number): string {
  if (seconds === 0) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h >= 8 && h % 8 === 0 && m === 0) return `${h / 8}d`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function secondsToJiraEstimate(seconds: number): string {
  if (seconds === 0) return '0h';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h >= 8 && h % 8 === 0 && m === 0) return `${h / 8}d`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
