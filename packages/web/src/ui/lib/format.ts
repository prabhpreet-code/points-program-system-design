export function formatPoints(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs < 1) return n.toFixed(2);
  if (abs < 100) return n.toFixed(1);
  if (abs < 1000) return Math.round(n).toString();
  if (abs < 1_000_000) return (n / 1000).toFixed(1) + 'k';
  return (n / 1_000_000).toFixed(2) + 'M';
}

export function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs < 1000) return '$' + Math.round(n);
  if (abs < 1_000_000) return '$' + (n / 1000).toFixed(1) + 'k';
  return '$' + (n / 1_000_000).toFixed(2) + 'M';
}

export function truncateAddr(addr: string): string {
  if (addr.length <= 10) return addr;
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

export function formatDate(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

export function formatDateTime(ts: number): string {
  return new Date(ts * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

export function percent(num: number, denom: number): string {
  if (denom === 0) return '0%';
  return Math.round((num / denom) * 100) + '%';
}
