import { formatEther, parseEther } from "viem";

export { parseEther, formatEther };

export function fmtEth(wei: bigint, dp = 4): string {
  const n = Number(formatEther(wei));
  const s = n.toFixed(dp).replace(/\.?0+$/, "");
  return `${s || "0"} ETH`;
}

export function pct(part: bigint, whole: bigint): number {
  if (whole === 0n) return 0;
  return Math.min(100, Number((part * 10000n) / whole) / 100);
}

export function shortAddr(a?: string): string {
  return a ? a.slice(0, 6) + "…" + a.slice(-4) : "";
}

export function fmtCountdown(deadlineSec: number): string {
  const now = Math.floor(Date.now() / 1000);
  let d = deadlineSec - now;
  if (d <= 0) return "ended";
  const days = Math.floor(d / 86400);
  d -= days * 86400;
  const hrs = Math.floor(d / 3600);
  if (days > 0) return `${days}d ${hrs}h`;
  const mins = Math.floor((d % 3600) / 60);
  return `${hrs}h ${mins}m`;
}

export function fmtUsd(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

// Long ENS labels get a middle ellipsis for display (keeps start + end
// readable); the full label should still be used for links, checks, and txs.
export function shortLabel(label: string, max = 24): string {
  return label.length <= max ? label : `${label.slice(0, 14)}…${label.slice(-6)}`;
}
