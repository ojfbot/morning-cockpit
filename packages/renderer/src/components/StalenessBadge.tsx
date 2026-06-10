export function StalenessBadge({ days }: { days: number | undefined }) {
  if (days === undefined || days < 14) return null;
  return <span className="stale-badge">{days}d stale</span>;
}
