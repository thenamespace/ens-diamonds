// Extract a human-readable reason from a viem/wagmi transaction error. These
// errors aren't always plain `Error` instances (so `String(err)` yields the
// useless "[object Object]"), and the useful reason is usually on `shortMessage`
// or a nested `cause`.
export function txErrorMessage(err: unknown): string {
  const fromObj = (o: unknown): string | null => {
    if (!o || typeof o !== "object") return null;
    const rec = o as Record<string, unknown>;
    for (const key of ["shortMessage", "details", "message"]) {
      const v = rec[key];
      if (typeof v === "string" && v.trim()) return v.split("\n")[0].slice(0, 200);
    }
    return null;
  };

  // Walk the cause chain (viem nests the revert reason a few levels deep).
  let cur: unknown = err;
  for (let i = 0; i < 5 && cur; i++) {
    const msg = fromObj(cur);
    if (msg) return msg;
    cur = (cur as { cause?: unknown }).cause;
  }
  if (typeof err === "string" && err.trim()) return err;
  return "Transaction failed. Please try again.";
}
