// Extract a human-readable reason from a viem/wagmi transaction error. These
// errors aren't always plain `Error` instances (so `String(err)` yields the
// useless "[object Object]"), and the useful reason is usually on `shortMessage`
// or a nested `cause`.
export function txErrorMessage(err: unknown): string {
  const chain: Record<string, unknown>[] = [];
  let cur: unknown = err;
  for (let i = 0; i < 8 && cur && typeof cur === "object"; i++) {
    chain.push(cur as Record<string, unknown>);
    cur = (cur as { cause?: unknown }).cause;
  }

  // First pass: a decoded revert (viem ContractFunctionRevertedError) anywhere
  // in the cause chain. Outer errors carry a bland "reverted with the following
  // reason:" shortMessage, so the error name must win over them.
  for (const rec of chain) {
    const data = rec.data as Record<string, unknown> | undefined;
    const errorName =
      (typeof rec.reason === "string" && rec.reason.trim() && rec.reason) ||
      (data && typeof data.errorName === "string" && data.errorName.trim() ? data.errorName : null);
    if (errorName) return `Reverted: ${errorName}`.slice(0, 200);
  }

  // Second pass: best available message text.
  for (const rec of chain) {
    for (const key of ["shortMessage", "details", "message"]) {
      const v = rec[key];
      if (typeof v === "string" && v.trim()) return v.split("\n")[0].slice(0, 200);
    }
  }

  if (typeof err === "string" && err.trim()) return err;
  return "Transaction failed. Please try again.";
}
