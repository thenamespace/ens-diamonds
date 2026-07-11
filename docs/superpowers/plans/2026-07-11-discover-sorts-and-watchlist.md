# Discover Sort Fix + Wallet-Synced Watchlist — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Discover sort tabs to show meaningfully different names, and add a wallet-synced watchlist (SIWE sign-in → star any name → dedicated `/watching` page).

**Architecture:** Part 1 fixes `getPremiumNames` to fetch both ends of the 21-day premium window so sorts differ, and trims the grid's sort tabs. Part 2 adds a lean SIWE auth flow (`@signinwithethereum/siwe` + `iron-session` cookie) and an Upstash Redis store keyed by address, exposed through Next.js route handlers and consumed by react-query hooks + a star button.

**Tech Stack:** Next.js 15.5 App Router, React 19, wagmi v2.19, RainbowKit 2.2, viem 2.55, `@ensdomains/ensjs`, `@signinwithethereum/siwe` 4.2, `iron-session` 8.0.4, `@upstash/redis` 1.38, `@tanstack/react-query` 5.

**Spec:** `docs/superpowers/specs/2026-07-11-discover-sorts-and-watchlist-design.md`

**Working dir:** `/Users/kriskocic/Projects/ens-coffer` · **Branch:** `feat/watchlist-and-sorts` · all `pnpm --filter @coffer/web ...`

---

## Task 1: Fix the Discover data window (fetch both ends)

**Files:**
- Modify: `apps/web/lib/ens-premium.ts`
- Test: `apps/web/lib/ens-premium.test.ts` (exists — append)

- [ ] **Step 1: Write the failing test for `mergeWindows`**

Append to `apps/web/lib/ens-premium.test.ts`:
```ts
import { mergeWindows } from "./ens-premium";

describe("mergeWindows", () => {
  const mk = (label: string, expiryDate: number) => ({ label, expiryDate });

  it("dedupes by label and caps to limit", () => {
    const desc = [mk("aaa", 300), mk("bbb", 200)];
    const asc = [mk("ccc", 100), mk("bbb", 200)]; // bbb overlaps
    const out = mergeWindows(desc, asc, 10);
    const labels = out.map((v) => v.label).sort();
    expect(labels).toEqual(["aaa", "bbb", "ccc"]);
  });

  it("keeps both extremes when capped (highest and lowest expiry survive)", () => {
    const desc = [mk("new1", 999), mk("new2", 998)];
    const asc = [mk("old1", 1), mk("old2", 2)];
    const out = mergeWindows(desc, asc, 2);
    expect(out).toHaveLength(2);
    const exps = out.map((v) => v.expiryDate);
    expect(Math.max(...exps)).toBe(999); // a newest survives
    expect(Math.min(...exps)).toBe(1); // an ending-soon survives
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `pnpm --filter @coffer/web test ens-premium` — Expected: FAIL (`mergeWindows` not exported).

- [ ] **Step 3: Implement `mergeWindows` and switch `getPremiumNames` to two-ended fetch**

In `apps/web/lib/ens-premium.ts`:

Add this exported helper (after `premiumProgress`):
```ts
type WindowRow = { label: string; expiryDate: number };

// Merge the newest-first and ending-soon-first halves into one deduped list that
// keeps BOTH extremes when capped: interleave desc/asc so the cap can't drop a
// whole end. Dedupe by label (a name can appear in both halves in a tiny window).
export function mergeWindows(desc: WindowRow[], asc: WindowRow[], limit: number): WindowRow[] {
  const out: WindowRow[] = [];
  const seen = new Set<string>();
  const push = (r: WindowRow | undefined) => {
    if (!r || seen.has(r.label) || out.length >= limit) return;
    seen.add(r.label);
    out.push(r);
  };
  const n = Math.max(desc.length, asc.length);
  for (let i = 0; i < n && out.length < limit; i++) {
    push(desc[i]);
    push(asc[i]);
  }
  return out;
}
```

Replace the single-query body of `getPremiumNames`. Change the `query` construction + fetch into a reusable inner fetch over an order direction, call it twice, and merge. Replace the block from `const query = \`{ ... }\`;` through `const valid ... = [];` (the `regs` derivation) with:
```ts
  const windowQuery = (dir: "desc" | "asc", first: number) => `{
    registrations(first: ${first}, orderBy: expiryDate, orderDirection: ${dir}, where: { expiryDate_gte: ${lo}, expiryDate_lte: ${hi}, labelName_not: null }) {
      labelName
      expiryDate
    }
  }`;

  const fetchWindow = async (dir: "desc" | "asc", first: number): Promise<Registration[]> => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: windowQuery(dir, first) }),
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`ENS subgraph HTTP ${res.status}`);
    const json = (await res.json()) as { data?: { registrations?: Registration[] }; errors?: unknown };
    if (json.errors) throw new Error("ENS subgraph query error");
    return json.data?.registrations ?? [];
  };

  const perEnd = Math.ceil(limit / 2);
  const [descRegs, ascRegs] = await Promise.all([fetchWindow("desc", perEnd), fetchWindow("asc", perEnd)]);

  const toRows = (regs: Registration[]): WindowRow[] => {
    const rows: WindowRow[] = [];
    for (const r of regs) {
      if (!r.labelName || r.labelName.length < 3) continue;
      try {
        normalize(r.labelName);
      } catch {
        continue;
      }
      rows.push({ label: r.labelName, expiryDate: Number(r.expiryDate) });
    }
    return rows;
  };

  const valid = mergeWindows(toRows(descRegs), toRows(ascRegs), limit);
```
Leave the rest (`if (valid.length === 0) return [];`, the `getPrice`/`getEthUsd` block, the `.map` to `PremiumEntry`) unchanged — `valid` still has `{ label, expiryDate }`.

Delete the now-unused old `const query = ...` and the old inline `regs`/`valid` loop that this replaces.

- [ ] **Step 4: Run the test, confirm pass**

Run: `pnpm --filter @coffer/web test ens-premium` — Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm --filter @coffer/web exec tsc --noEmit` — Expected: clean.
```bash
git add apps/web/lib/ens-premium.ts apps/web/lib/ens-premium.test.ts
git commit -m "fix(web): fetch both ends of premium window so Discover sorts differ"
```

---

## Task 2: Trim + fix Discover sort tabs

**Files:**
- Create: `apps/web/lib/discover-sort.ts`
- Test: `apps/web/lib/discover-sort.test.ts`
- Modify: `apps/web/components/discover-grid.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/discover-sort.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { sortEntries, type Sort } from "./discover-sort";
import type { PremiumEntry } from "./ens-premium";

const e = (label: string, o: Partial<PremiumEntry>): PremiumEntry => ({
  label,
  letters: label.length,
  priceUsd: 0,
  priceEth: 0,
  dayIntoPremium: 0,
  premiumEndsAt: 0,
  expiryDate: 0,
  ...o,
});

const rows: PremiumEntry[] = [
  e("bbbb", { expiryDate: 200, premiumEndsAt: 200, priceEth: 5 }),
  e("aaa", { expiryDate: 300, premiumEndsAt: 300, priceEth: 9 }),
  e("cc c", { expiryDate: 100, premiumEndsAt: 100, priceEth: 1 }),
];

const first = (s: Sort) => sortEntries(rows, s)[0].label;

describe("sortEntries", () => {
  it("newest = highest expiry first", () => expect(first("newest")).toBe("aaa"));
  it("ending = soonest premiumEndsAt first", () => expect(first("ending")).toBe("cc c"));
  it("shortest = fewest letters first", () => expect(first("shortest")).toBe("aaa"));
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `pnpm --filter @coffer/web test discover-sort` — Expected: FAIL (module missing).

- [ ] **Step 3: Create the pure sort module**

Create `apps/web/lib/discover-sort.ts`:
```ts
import type { PremiumEntry } from "./ens-premium";

export type Sort = "newest" | "ending" | "shortest";

export const SORTS: { key: Sort; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "ending", label: "Ending soon" },
  { key: "shortest", label: "Shortest" },
];

// newest = most recently expired (priciest); ending = nearest the end of the
// 21-day premium (cheapest); shortest = fewest letters.
export function sortEntries(entries: PremiumEntry[], sort: Sort): PremiumEntry[] {
  const a = [...entries];
  switch (sort) {
    case "newest":
      return a.sort((x, y) => y.expiryDate - x.expiryDate);
    case "ending":
      return a.sort((x, y) => x.premiumEndsAt - y.premiumEndsAt);
    case "shortest":
      return a.sort((x, y) => x.letters - y.letters || x.priceEth - y.priceEth);
  }
}
```

- [ ] **Step 4: Run the test, confirm pass**

Run: `pnpm --filter @coffer/web test discover-sort` — Expected: PASS.

- [ ] **Step 5: Point `discover-grid.tsx` at the module (remove Cheapest)**

In `apps/web/components/discover-grid.tsx`:
- Remove the local `type Sort`, the local `SORTS` array, and the local `sortEntries` function.
- Add import: `import { sortEntries, SORTS, type Sort } from "@/lib/discover-sort";`
- Keep default `useState<Sort>("ending")`.
Everything else in the file stays. (The `cheapest` case is gone with the removed local function.)

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm --filter @coffer/web exec tsc --noEmit` — Expected: clean.
```bash
git add apps/web/lib/discover-sort.ts apps/web/lib/discover-sort.test.ts apps/web/components/discover-grid.tsx
git commit -m "feat(web): Discover sorts = Newest/Ending soon/Shortest (drop Cheapest)"
```

---

## Task 3: Install watchlist dependencies

**Files:** Modify `apps/web/package.json` (via pnpm)

- [ ] **Step 1: Install**

Run:
```bash
pnpm --filter @coffer/web add @signinwithethereum/siwe@^4.2.0 iron-session@^8.0.4 @upstash/redis@^1.38.0
```
Expected: three deps added to `apps/web/package.json` dependencies.

- [ ] **Step 2: Verify versions resolved**

Run: `pnpm --filter @coffer/web ls @signinwithethereum/siwe iron-session @upstash/redis` — Expected: shows 4.2.x / 8.0.x / 1.38.x. If `@signinwithethereum/siwe` fails to resolve, STOP and report (the package name/version was verified 2026-07-11 but confirm before improvising).

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json ../../pnpm-lock.yaml
git commit -m "chore(web): add siwe, iron-session, upstash/redis for watchlist"
```

---

## Task 4: KV client + watchlist helpers

**Files:**
- Create: `apps/web/lib/kv.ts`
- Create: `apps/web/lib/watchlist.ts`
- Test: `apps/web/lib/watchlist.test.ts`

- [ ] **Step 1: Write the failing test for `normalizeLabel`**

Create `apps/web/lib/watchlist.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { normalizeLabel } from "./watchlist";

describe("normalizeLabel", () => {
  it("strips .eth and lowercases/normalizes", () => {
    expect(normalizeLabel("Vitalik.eth")).toBe("vitalik");
    expect(normalizeLabel("defi")).toBe("defi");
  });
  it("rejects labels under 3 chars", () => {
    expect(normalizeLabel("ab")).toBeNull();
    expect(normalizeLabel("a.eth")).toBeNull();
  });
  it("rejects unnormalizable input", () => {
    expect(normalizeLabel("bad name with spaces!!")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `pnpm --filter @coffer/web test watchlist` — Expected: FAIL (module missing).

- [ ] **Step 3: Create `lib/kv.ts`**

Create `apps/web/lib/kv.ts`:
```ts
import { Redis } from "@upstash/redis";

// Upstash provisions EITHER the KV_REST_API_* names (Vercel-KV back-compat) or
// the UPSTASH_REDIS_REST_* names, depending on how the store was linked. Read
// both. Construct lazily so a build without KV env still compiles/prerenders.
export function getKv(): Redis {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("KV not configured: set UPSTASH_REDIS_REST_URL/TOKEN (or KV_REST_API_URL/TOKEN)");
  }
  return new Redis({ url, token });
}
```

- [ ] **Step 4: Create `lib/watchlist.ts`**

Create `apps/web/lib/watchlist.ts`:
```ts
import { normalize } from "viem/ens";
import { getKv } from "./kv";

// Normalize a user-supplied name to a bare label (no .eth), or null if invalid
// / too short. Mirrors the ENS rules used elsewhere.
export function normalizeLabel(raw: string): string | null {
  const stripped = raw.trim().replace(/\.eth$/i, "");
  let n: string;
  try {
    n = normalize(stripped);
  } catch {
    return null;
  }
  if (n.length < 3) return null;
  return n;
}

const watchKey = (addr: string) => `watch:${addr.toLowerCase()}`;
const watchersKey = (label: string) => `watchers:${label}`;

export async function getWatched(addr: string): Promise<string[]> {
  const kv = getKv();
  const members = (await kv.smembers(watchKey(addr))) as string[];
  return members.sort();
}

export async function addWatch(addr: string, label: string): Promise<void> {
  const kv = getKv();
  const a = addr.toLowerCase();
  await Promise.all([kv.sadd(watchKey(a), label), kv.sadd(watchersKey(label), a)]);
}

export async function removeWatch(addr: string, label: string): Promise<void> {
  const kv = getKv();
  const a = addr.toLowerCase();
  await Promise.all([kv.srem(watchKey(a), label), kv.srem(watchersKey(label), a)]);
}
```

- [ ] **Step 5: Run the test, confirm pass**

Run: `pnpm --filter @coffer/web test watchlist` — Expected: PASS.

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm --filter @coffer/web exec tsc --noEmit` — Expected: clean.
```bash
git add apps/web/lib/kv.ts apps/web/lib/watchlist.ts apps/web/lib/watchlist.test.ts
git commit -m "feat(web): KV client + watchlist helpers (normalizeLabel, add/remove/get)"
```

---

## Task 5: Iron-session helper

**Files:** Create `apps/web/lib/session.ts`

- [ ] **Step 1: Create `lib/session.ts`**

Create `apps/web/lib/session.ts`:
```ts
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type SessionData = {
  address?: string; // lowercased, set after SIWE verify
  nonce?: string; // single-use SIWE challenge
};

export const sessionOptions: SessionOptions = {
  // iron-session requires a >= 32 char password; set SESSION_SECRET in env.
  password: process.env.SESSION_SECRET ?? "",
  cookieName: "coffer_session",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  },
};

// Next.js 15: cookies() is async.
export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm --filter @coffer/web exec tsc --noEmit` — Expected: clean.
```bash
git add apps/web/lib/session.ts
git commit -m "feat(web): iron-session helper for SIWE sessions"
```

---

## Task 6: SIWE auth route handlers

**Files:**
- Create: `apps/web/app/api/auth/nonce/route.ts`
- Create: `apps/web/app/api/auth/verify/route.ts`
- Create: `apps/web/app/api/auth/logout/route.ts`
- Create: `apps/web/app/api/auth/me/route.ts`

- [ ] **Step 1: Nonce route**

Create `apps/web/app/api/auth/nonce/route.ts`:
```ts
import { generateNonce } from "@signinwithethereum/siwe";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  session.nonce = generateNonce();
  await session.save();
  return new Response(session.nonce, { headers: { "content-type": "text/plain" } });
}
```

- [ ] **Step 2: Verify route**

Create `apps/web/app/api/auth/verify/route.ts`:
```ts
import { SiweMessage } from "@signinwithethereum/siwe";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.nonce) return Response.json({ error: "No sign-in challenge" }, { status: 422 });

  let body: { message?: unknown; signature?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const { message, signature } = body;
  if (typeof message !== "string" || typeof signature !== "string") {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const host = req.headers.get("host") ?? "";
  try {
    const siwe = new SiweMessage(message);
    const result = await siwe.verify(
      { signature, domain: host, nonce: session.nonce },
      { suppressExceptions: true },
    );
    if (!result.success) {
      return Response.json({ error: "Verification failed" }, { status: 422 });
    }
    session.address = siwe.address.toLowerCase();
    session.nonce = undefined; // single-use
    await session.save();
    return Response.json({ address: session.address });
  } catch {
    return Response.json({ error: "Verification failed" }, { status: 422 });
  }
}
```

- [ ] **Step 3: Logout + me routes**

Create `apps/web/app/api/auth/logout/route.ts`:
```ts
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST() {
  const session = await getSession();
  session.destroy();
  return Response.json({ ok: true });
}
```

Create `apps/web/app/api/auth/me/route.ts`:
```ts
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  return Response.json({ address: session.address ?? null });
}
```

- [ ] **Step 4: Typecheck + commit**

Run: `pnpm --filter @coffer/web exec tsc --noEmit` — Expected: clean.
```bash
git add apps/web/app/api/auth
git commit -m "feat(web): SIWE auth routes (nonce/verify/logout/me)"
```

---

## Task 7: Watching route handlers

**Files:** Create `apps/web/app/api/watching/route.ts`

- [ ] **Step 1: Create the route**

Create `apps/web/app/api/watching/route.ts`:
```ts
import { getSession } from "@/lib/session";
import { getWatched, addWatch, removeWatch, normalizeLabel } from "@/lib/watchlist";

export const runtime = "nodejs";

async function requireAddress() {
  const session = await getSession();
  return session.address ?? null;
}

export async function GET() {
  const addr = await requireAddress();
  if (!addr) return Response.json({ error: "Not signed in" }, { status: 401 });
  const labels = await getWatched(addr);
  return Response.json({ labels });
}

export async function POST(req: Request) {
  const addr = await requireAddress();
  if (!addr) return Response.json({ error: "Not signed in" }, { status: 401 });
  const { label } = await req.json().catch(() => ({}) as { label?: unknown });
  const norm = typeof label === "string" ? normalizeLabel(label) : null;
  if (!norm) return Response.json({ error: "Invalid label" }, { status: 400 });
  await addWatch(addr, norm);
  return Response.json({ labels: await getWatched(addr) });
}

export async function DELETE(req: Request) {
  const addr = await requireAddress();
  if (!addr) return Response.json({ error: "Not signed in" }, { status: 401 });
  const { label } = await req.json().catch(() => ({}) as { label?: unknown });
  const norm = typeof label === "string" ? normalizeLabel(label) : null;
  if (!norm) return Response.json({ error: "Invalid label" }, { status: 400 });
  await removeWatch(addr, norm);
  return Response.json({ labels: await getWatched(addr) });
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm --filter @coffer/web exec tsc --noEmit` — Expected: clean.
```bash
git add apps/web/app/api/watching
git commit -m "feat(web): watching API (GET/POST/DELETE, session-gated)"
```

---

## Task 8: `useAuth` hook

**Files:** Create `apps/web/hooks/use-auth.ts`

- [ ] **Step 1: Create the hook**

Create `apps/web/hooks/use-auth.ts`:
```ts
"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useSignMessage } from "wagmi";
import { SiweMessage } from "@signinwithethereum/siwe";

async function fetchMe(): Promise<string | null> {
  const res = await fetch("/api/auth/me");
  if (!res.ok) return null;
  const j = (await res.json()) as { address: string | null };
  return j.address;
}

export function useAuth() {
  const qc = useQueryClient();
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { data: sessionAddress, isLoading } = useQuery({ queryKey: ["auth-me"], queryFn: fetchMe });

  const signIn = useCallback(async () => {
    if (!isConnected || !address) throw new Error("Connect a wallet first");
    const nonce = await fetch("/api/auth/nonce").then((r) => r.text());
    const message = new SiweMessage({
      domain: window.location.host,
      address,
      statement: "Sign in to Coffer to manage your watchlist.",
      uri: window.location.origin,
      version: "1",
      chainId: chainId ?? 1,
      nonce,
      issuedAt: new Date().toISOString(),
    });
    const prepared = message.prepareMessage();
    const signature = await signMessageAsync({ message: prepared });
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: prepared, signature }),
    });
    if (!res.ok) throw new Error("Sign-in failed");
    await qc.invalidateQueries({ queryKey: ["auth-me"] });
    await qc.invalidateQueries({ queryKey: ["watching"] });
  }, [address, chainId, isConnected, signMessageAsync, qc]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    await qc.invalidateQueries({ queryKey: ["auth-me"] });
    await qc.invalidateQueries({ queryKey: ["watching"] });
  }, [qc]);

  // Signed in only if the session address matches the currently-connected one.
  const isSignedIn = !!sessionAddress && !!address && sessionAddress === address.toLowerCase();

  return { sessionAddress: sessionAddress ?? null, isSignedIn, isLoadingAuth: isLoading, signIn, signOut };
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm --filter @coffer/web exec tsc --noEmit` — Expected: clean.
```bash
git add apps/web/hooks/use-auth.ts
git commit -m "feat(web): useAuth hook (SIWE sign-in/out via react-query)"
```

---

## Task 9: `useWatching` hook + `WatchButton` + styles

**Files:**
- Create: `apps/web/hooks/use-watching.ts`
- Create: `apps/web/components/watch-button.tsx`
- Modify: `apps/web/app/globals.css` (append `.watch-btn` styles)

- [ ] **Step 1: Create `hooks/use-watching.ts`**

Create `apps/web/hooks/use-watching.ts`:
```ts
"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

async function fetchWatching(): Promise<string[]> {
  const res = await fetch("/api/watching");
  if (!res.ok) return [];
  const j = (await res.json()) as { labels: string[] };
  return j.labels ?? [];
}

export function useWatching() {
  const qc = useQueryClient();
  const { isSignedIn, signIn } = useAuth();

  const { data: labels = [] } = useQuery({
    queryKey: ["watching"],
    queryFn: fetchWatching,
    enabled: isSignedIn,
  });

  const isWatching = useCallback(
    (label: string) => labels.map((l) => l.toLowerCase()).includes(label.toLowerCase()),
    [labels],
  );

  const mutation = useMutation({
    mutationFn: async (label: string) => {
      if (!isSignedIn) await signIn();
      const currentlyWatching = labels.map((l) => l.toLowerCase()).includes(label.toLowerCase());
      const res = await fetch("/api/watching", {
        method: currentlyWatching ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) throw new Error("Failed to update watchlist");
      return (await res.json()).labels as string[];
    },
    onSuccess: (next) => qc.setQueryData(["watching"], next),
  });

  const toggle = useCallback((label: string) => mutation.mutate(label), [mutation]);

  return { labels, isWatching, toggle, isPending: mutation.isPending };
}
```

- [ ] **Step 2: Create `components/watch-button.tsx`**

Create `apps/web/components/watch-button.tsx`:
```tsx
"use client";

import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useWatching } from "@/hooks/use-watching";

export default function WatchButton({ label, className }: { label: string; className?: string }) {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { isWatching, toggle, isPending } = useWatching();
  const active = isWatching(label);

  return (
    <button
      type="button"
      className={`watch-btn${active ? " on" : ""}${className ? ` ${className}` : ""}`}
      aria-pressed={active}
      aria-label={active ? `Unwatch ${label}.eth` : `Watch ${label}.eth`}
      disabled={isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isConnected) {
          openConnectModal?.();
          return;
        }
        toggle(label);
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" aria-hidden>
        <path d="M12 17.3l-5.4 3 1-6-4.3-4.2 6-.9L12 3l2.7 5.2 6 .9-4.3 4.2 1 6z" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </button>
  );
}
```

- [ ] **Step 3: Append styles to `app/globals.css`**

Append to `apps/web/app/globals.css`:
```css
/* Watch star */
.watch-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  border: 1px solid var(--hairline, rgba(15, 23, 42, 0.08));
  background: rgba(255, 255, 255, 0.7);
  color: #94a3b8;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease, transform 0.1s ease;
}
.watch-btn:hover {
  color: #f59e0b;
  border-color: rgba(245, 158, 11, 0.4);
}
.watch-btn.on {
  color: #f59e0b;
  border-color: rgba(245, 158, 11, 0.5);
  background: rgba(245, 158, 11, 0.1);
}
.watch-btn:active {
  transform: scale(0.92);
}
.watch-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
```
(If a `--hairline` variable does not exist in the file, the fallback in the `border` shorthand covers it.)

- [ ] **Step 4: Typecheck + commit**

Run: `pnpm --filter @coffer/web exec tsc --noEmit` — Expected: clean.
```bash
git add apps/web/hooks/use-watching.ts apps/web/components/watch-button.tsx apps/web/app/globals.css
git commit -m "feat(web): useWatching hook + WatchButton star + styles"
```

---

## Task 10: Add the star to name cards + the name page

**Files:**
- Modify: `apps/web/components/discover-grid.tsx`
- Modify: `apps/web/app/name/[label]/page.tsx`

- [ ] **Step 1: Star on each Discover card**

In `apps/web/components/discover-grid.tsx`:
- Add import: `import WatchButton from "@/components/watch-button";`
- In `NameCard`, inside the `.ncard-top` div, place the star to the LEFT of the timer so the row reads `[monogram] ....... [star][timer]`. Wrap the star + timer in a flex span. Replace the existing `.ncard-top` contents:
```tsx
      <div className="ncard-top">
        <span className="ncard-mono" aria-hidden>
          {n.label.slice(0, 1).toUpperCase()}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <WatchButton label={n.label} />
          <span className="ncard-timer">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {fmtCountdown(n.premiumEndsAt)} left
          </span>
        </span>
      </div>
```

- [ ] **Step 2: Star on the name page**

In `apps/web/app/name/[label]/page.tsx`:
- Add import: `import WatchButton from "@/components/watch-button";`
- In the `Shell` component, add the star to the crumb row so it appears for every status. Replace the `.crumb` block:
```tsx
      <div className="crumb" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>
          <Link href="/">Discover</Link> <span>/</span> <span>{label}.eth</span>
        </span>
        <WatchButton label={label} />
      </div>
```

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm --filter @coffer/web exec tsc --noEmit` — Expected: clean.
```bash
git add apps/web/components/discover-grid.tsx "apps/web/app/name/[label]/page.tsx"
git commit -m "feat(web): watch star on Discover cards + name page"
```

---

## Task 11: `/watching` page + nav link

**Files:**
- Create: `apps/web/components/sign-in-prompt.tsx`
- Create: `apps/web/components/watching-card.tsx`
- Create: `apps/web/app/watching/page.tsx`
- Modify: `apps/web/components/app-shell.tsx`

- [ ] **Step 1: Sign-in prompt (client)**

Create `apps/web/components/sign-in-prompt.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAuth } from "@/hooks/use-auth";

export default function SignInPrompt() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { signIn } = useAuth();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    setBusy(true);
    try {
      await signIn();
      router.refresh(); // re-render the server component now that the cookie is set
    } catch {
      // swallowed; user can retry
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className="btn btn-primary" onClick={onClick} disabled={busy}>
      {isConnected ? (busy ? "Check your wallet…" : "Sign in to view") : "Connect wallet"}
    </button>
  );
}
```
(If `.btn`/`.btn-primary` classes don't exist in globals.css, use whatever the app's existing primary button class is — check `components/connect-button.tsx` or `app/pools/new/page.tsx` for the pattern and match it.)

- [ ] **Step 2: Watching card (client, disappears on unwatch)**

Create `apps/web/components/watching-card.tsx`:
```tsx
"use client";

import Link from "next/link";
import { useWatching } from "@/hooks/use-watching";
import WatchButton from "@/components/watch-button";

export type WatchingCardData = {
  label: string;
  statusText: string;
  priceText: string;
};

export default function WatchingCard({ data }: { data: WatchingCardData }) {
  const { isWatching } = useWatching();
  // Optimistically drop the card the moment it's unwatched on this page.
  if (!isWatching(data.label)) return null;

  return (
    <Link href={`/name/${data.label}`} className="ncard reveal">
      <div className="ncard-top">
        <span className="ncard-mono" aria-hidden>
          {data.label.slice(0, 1).toUpperCase()}
        </span>
        <WatchButton label={data.label} />
      </div>
      <div className="ncard-name">
        {data.label}
        <span className="eth">.eth</span>
      </div>
      <div className="ncard-price">
        <span className="ncard-price-label">Status</span>
        <span className="p">{data.statusText}</span>
      </div>
      <div className="ncard-foot">
        <span className="watchers">{data.priceText}</span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: The `/watching` page (server component)**

Create `apps/web/app/watching/page.tsx`:
```tsx
import { getSession } from "@/lib/session";
import { getWatched } from "@/lib/watchlist";
import { getEnsNameData, weiToUsd, type EnsStatus } from "@/lib/ens-name";
import { fmtUsd, fmtEth } from "@/lib/format";
import SignInPrompt from "@/components/sign-in-prompt";
import WatchingCard, { type WatchingCardData } from "@/components/watching-card";

export const dynamic = "force-dynamic";

const STATUS_TEXT: Record<EnsStatus, string> = {
  active: "Registered",
  grace: "In grace period",
  premium: "In premium",
  available: "Available",
  tooShort: "Too short",
  invalid: "Invalid",
};

export default async function WatchingPage() {
  const session = await getSession();

  if (!session.address) {
    return (
      <div className="wrap">
        <div className="page-head">
          <div>
            <h1>Your watchlist</h1>
            <p>Sign in with your wallet to see the names you’re watching.</p>
          </div>
        </div>
        <SignInPrompt />
      </div>
    );
  }

  let cards: WatchingCardData[] = [];
  let failed = false;
  try {
    const labels = await getWatched(session.address);
    const data = await Promise.all(
      labels.map(async (label) => {
        try {
          const d = await getEnsNameData(label);
          const usd = weiToUsd(d.totalWei, d.ethUsd);
          const priceText = usd !== null ? fmtUsd(usd) : `${fmtEth(d.totalWei)} ETH`;
          return { label, statusText: STATUS_TEXT[d.status], priceText } as WatchingCardData;
        } catch {
          return { label, statusText: "—", priceText: "—" } as WatchingCardData;
        }
      }),
    );
    cards = data;
  } catch {
    failed = true;
  }

  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <h1>Your watchlist</h1>
          <p>{cards.length === 0 ? "Names you watch show up here." : `${cards.length} name${cards.length === 1 ? "" : "s"} you’re tracking.`}</p>
        </div>
      </div>

      {failed ? (
        <div className="note note-warn">
          <span>⚠</span>
          <span>Couldn’t load your watchlist right now. Please try again in a moment.</span>
        </div>
      ) : cards.length === 0 ? (
        <div className="empty">
          <span className="mark" aria-hidden />
          <h3>No names yet</h3>
          <p>Tap the ☆ on any name to start watching it.</p>
        </div>
      ) : (
        <div className="grid">
          {cards.map((c) => (
            <WatchingCard key={c.label} data={c} />
          ))}
        </div>
      )}
    </div>
  );
}
```
Note: confirm `EnsStatus` and `fmtEth` are exported from `@/lib/ens-name` and `@/lib/format` respectively (they are, per current code). If `fmtEth` signature differs, match it.

- [ ] **Step 4: Nav link**

In `apps/web/components/app-shell.tsx`, add `Watching` to `.topnav` between Discover and Portfolio:
```tsx
          <nav className="topnav">
            <Link href="/">Discover</Link>
            <Link href="/pools">Pools</Link>
            <Link href="/watching">Watching</Link>
            <Link href="/portfolio">Portfolio</Link>
          </nav>
```

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm --filter @coffer/web exec tsc --noEmit` — Expected: clean.
```bash
git add apps/web/components/sign-in-prompt.tsx apps/web/components/watching-card.tsx apps/web/app/watching/page.tsx apps/web/components/app-shell.tsx
git commit -m "feat(web): /watching page + nav link"
```

---

## Task 12: Guarded KV integration test + full verification

**Files:**
- Create: `apps/web/lib/watchlist.integration.test.ts`

- [ ] **Step 1: Guarded KV round-trip test**

Create `apps/web/lib/watchlist.integration.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { addWatch, removeWatch, getWatched } from "./watchlist";

// Runs only when an Upstash/KV REST URL is present (mirrors the other guarded
// integration tests). Uses a throwaway address so it can't collide with real data.
const hasKv = !!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL);
const maybe = hasKv ? describe : describe.skip;

maybe("watchlist against Upstash", () => {
  const addr = "0x000000000000000000000000000000000000dEaD";

  it("adds, lists, and removes a label", async () => {
    await removeWatch(addr, "coffertest"); // clean slate
    await addWatch(addr, "coffertest");
    const after = await getWatched(addr);
    expect(after).toContain("coffertest");
    await removeWatch(addr, "coffertest");
    const gone = await getWatched(addr);
    expect(gone).not.toContain("coffertest");
  }, 20000);
});
```

- [ ] **Step 2: Run unit tests offline (guarded skips)**

Run: `pnpm --filter @coffer/web test` — Expected: PASS; KV block skipped; all Task 1/2/4 unit tests green.

- [ ] **Step 3: Run with env (real KV round-trip), if env available**

Only if the KV env vars are present in `apps/web/.env.local`:
```bash
cd apps/web && export $(grep -E '^(UPSTASH_REDIS_REST_URL|UPSTASH_REDIS_REST_TOKEN|KV_REST_API_URL|KV_REST_API_TOKEN)=' .env.local | xargs) && pnpm --filter @coffer/web test watchlist.integration; cd ..
```
Expected: PASS (add/list/remove round-trips). If env not present yet, note it — the store is created in a later user step; this is verified during manual testing.

- [ ] **Step 4: Stop dev server, typecheck + production build**

Stop any running `next dev` first (shared `.next` corruption otherwise), then:
```bash
pnpm --filter @coffer/web exec tsc --noEmit && pnpm --filter @coffer/web build
```
Expected: typecheck clean; build succeeds. `/watching` builds as a dynamic (`ƒ`) route; `/api/*` as dynamic route handlers. The build must NOT require KV/SIWE env (routes construct clients lazily / at request time).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/watchlist.integration.test.ts
git commit -m "test(web): guarded Upstash watchlist round-trip"
```

- [ ] **Step 6: Manual test checklist (documented — needs a wallet + KV env; run after setup)**

After the user creates the Upstash store and sets `SESSION_SECRET` + KV env (Vercel + local), verify in the browser:
1. Discover: switch Newest / Ending soon / Shortest → the leading names visibly change; "Ending soon" shows lower prices than "Newest".
2. Click the ☆ on a card while disconnected → RainbowKit connect modal opens.
3. Connect (Sepolia or mainnet) → click ☆ → one signature prompt → star fills.
4. Reload → star still filled (session persists). Open `/watching` → the name is listed with status/price.
5. Unwatch from `/watching` → card disappears; from a name page → star empties.
6. Sign out (if wired) or clear the `coffer_session` cookie → `/watching` shows the sign-in prompt.

---

## Self-review notes for the implementer

- **Server-only modules** (`lib/kv.ts`, `lib/session.ts`, `lib/watchlist.ts`, all `app/api/**`) must never be imported by a `"use client"` file. The client only ever talks to them over `fetch`.
- **wagmi is v2.19** here — do not use v3-only APIs. `useSignMessage().signMessageAsync({ message })` and `useAccount()` are correct for v2.
- **SIWE message is sent as the prepared STRING**, and the server reconstructs with `new SiweMessage(string)` — this guarantees the verified bytes equal the signed bytes. Don't send the object.
- **Server derives `domain` from the `host` header** and `nonce` from the session — never trust client-supplied values (replay/phishing guard).
- **Lazy client construction**: `getKv()` and `getSession()` must not throw at import time, or `next build` prerender breaks. They throw only when actually called at request time.
- Bigints (`EnsNameData.totalWei`) stay server-side in `/watching`; only the formatted strings cross to `WatchingCard`.
