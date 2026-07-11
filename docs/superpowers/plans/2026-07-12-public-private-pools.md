# Public / Private Pools — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let a pool creator mark a pool public or private; `/pools` shows public pools to everyone and private pools only to their creator/invitees.

**Architecture:** Off-chain visibility bit in Upstash (`pools:private` set; absence = public), creator-gated writes (SIWE session + server-side Sepolia read of `pools(id).creator`), on-chain membership (`invited(id, viewer)` + creator) for who sees a private pool. No contract change.

**Tech:** Next.js 15 App Router, wagmi v2.19, viem 2.55, `@upstash/redis`, `iron-session`, existing `useAuth`.

**Spec:** `docs/superpowers/specs/2026-07-12-public-private-pools-design.md` · **Branch:** `feat/public-private-pools`. Run web cmds with `pnpm --filter @coffer/web ...`. **Controller commits; implementers do NOT commit.**

---

## Task 1: Off-chain visibility store (`lib/pool-visibility.ts`)

**Files:** Create `apps/web/lib/pool-visibility.ts`, `apps/web/lib/pool-visibility.integration.test.ts`

- [ ] **Step 1: Create `lib/pool-visibility.ts`**
```ts
import { getKv } from "./kv";

const PRIVATE_SET = "pools:private";

// A pool id is in this set iff it is PRIVATE. Absence = public.
export async function getPrivatePoolIds(): Promise<number[]> {
  const kv = getKv();
  const members = (await kv.smembers(PRIVATE_SET)) as (string | number)[];
  return members.map((m) => Number(m)).filter((n) => Number.isInteger(n));
}

export async function setPoolPrivate(poolId: number, isPrivate: boolean): Promise<void> {
  const kv = getKv();
  if (isPrivate) await kv.sadd(PRIVATE_SET, poolId);
  else await kv.srem(PRIVATE_SET, poolId);
}
```

- [ ] **Step 2: Guarded integration test `lib/pool-visibility.integration.test.ts`**
```ts
import { describe, it, expect } from "vitest";
import { getPrivatePoolIds, setPoolPrivate } from "./pool-visibility";

const hasKv = !!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL);
const maybe = hasKv ? describe : describe.skip;

maybe("pool-visibility against Upstash", () => {
  const id = 999999; // throwaway id, cleaned up
  it("marks private, lists, and clears", async () => {
    await setPoolPrivate(id, false); // clean slate
    await setPoolPrivate(id, true);
    expect(await getPrivatePoolIds()).toContain(id);
    await setPoolPrivate(id, false);
    expect(await getPrivatePoolIds()).not.toContain(id);
  }, 20000);
});
```

- [ ] **Step 3: Run offline (skips) + typecheck**
`pnpm --filter @coffer/web test pool-visibility` → PASS (skipped without KV). `pnpm --filter @coffer/web exec tsc --noEmit` → clean.

---

## Task 2: Server-side Sepolia read (`lib/sepolia-client.ts`)

**Files:** Create `apps/web/lib/sepolia-client.ts`

- [ ] **Step 1: Create it**
```ts
import { createPublicClient, http } from "viem";
import { CHAIN, SEPOLIA_RPC } from "./chain";
import { cofferEscrow } from "./contract";

// Read-only Sepolia client for server routes (verify a pool's on-chain creator).
// Server-only — never import from a "use client" file.
export const sepoliaClient = createPublicClient({ chain: CHAIN, transport: http(SEPOLIA_RPC) });

// Lowercased creator of a pool, or null if out of range / unreadable.
export async function getPoolCreator(poolId: number): Promise<string | null> {
  try {
    const pool = (await sepoliaClient.readContract({
      ...cofferEscrow,
      functionName: "pools",
      args: [BigInt(poolId)],
    })) as readonly unknown[];
    const creator = pool[1] as string; // struct index 1 = creator
    if (!creator || creator === "0x0000000000000000000000000000000000000000") return null;
    return creator.toLowerCase();
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Typecheck** — `pnpm --filter @coffer/web exec tsc --noEmit` → clean.

---

## Task 3: Visibility API route (`app/api/pools/visibility/route.ts`)

**Files:** Create `apps/web/app/api/pools/visibility/route.ts`

- [ ] **Step 1: Create it**
```ts
import { getSession } from "@/lib/session";
import { getPoolCreator } from "@/lib/sepolia-client";
import { getPrivatePoolIds, setPoolPrivate } from "@/lib/pool-visibility";

export const runtime = "nodejs";

// Public: the set of private pool ids (not sensitive; membership gating is done
// client-side against on-chain data).
export async function GET() {
  const ids = await getPrivatePoolIds();
  return Response.json({ private: ids }, { headers: { "cache-control": "no-store" } });
}

// Creator-only: set a pool public/private. Requires a SIWE session AND that the
// session address is the pool's on-chain creator.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session.address) return Response.json({ error: "Not signed in" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { poolId?: unknown; public?: unknown };
  const poolId = body.poolId;
  const isPublic = body.public;
  if (typeof poolId !== "number" || !Number.isInteger(poolId) || poolId < 0 || typeof isPublic !== "boolean") {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const creator = await getPoolCreator(poolId);
  if (!creator) return Response.json({ error: "Pool not found" }, { status: 404 });
  if (creator !== session.address) return Response.json({ error: "Not the pool creator" }, { status: 403 });

  await setPoolPrivate(poolId, !isPublic);
  return Response.json({ ok: true, public: isPublic });
}
```

- [ ] **Step 2: Typecheck** — clean.

---

## Task 4: Pure visibility filter (`lib/pool-filter.ts`)

**Files:** Create `apps/web/lib/pool-filter.ts`, `apps/web/lib/pool-filter.test.ts`

- [ ] **Step 1: Failing test `lib/pool-filter.test.ts`**
```ts
import { describe, it, expect } from "vitest";
import { isPoolVisible } from "./pool-filter";

const C = "0xAAaAAAAaaAAAAaAAAAaaAAaaaAaAaaAAAAaaAAaa";
const V = "0xBBbBBBBbbBBBbbBBBBbbBBbbbBbBbbBBBBbbBBbb";

describe("isPoolVisible", () => {
  it("public pool is visible to everyone (even not connected)", () =>
    expect(isPoolVisible({ isPrivate: false, viewer: null, creator: C, invited: false })).toBe(true));
  it("private pool hidden when not connected", () =>
    expect(isPoolVisible({ isPrivate: true, viewer: null, creator: C, invited: false })).toBe(false));
  it("private pool hidden from a non-member", () =>
    expect(isPoolVisible({ isPrivate: true, viewer: V, creator: C, invited: false })).toBe(false));
  it("private pool visible to its creator (case-insensitive)", () =>
    expect(isPoolVisible({ isPrivate: true, viewer: C.toLowerCase(), creator: C, invited: false })).toBe(true));
  it("private pool visible to an invited viewer", () =>
    expect(isPoolVisible({ isPrivate: true, viewer: V, creator: C, invited: true })).toBe(true));
});
```

- [ ] **Step 2: Run → FAIL** (`pnpm --filter @coffer/web test pool-filter`).

- [ ] **Step 3: Create `lib/pool-filter.ts`**
```ts
// Should this pool be shown to this viewer? Public → always. Private → only the
// creator or an on-chain-invited address (viewer must be connected).
export function isPoolVisible(opts: {
  isPrivate: boolean;
  viewer: string | null | undefined;
  creator: string;
  invited: boolean;
}): boolean {
  if (!opts.isPrivate) return true;
  if (!opts.viewer) return false;
  const v = opts.viewer.toLowerCase();
  return opts.creator.toLowerCase() === v || opts.invited;
}
```

- [ ] **Step 4: Run → PASS**, typecheck clean.

---

## Task 5: Filter the `/pools` list

**Files:** Modify `apps/web/app/pools/page.tsx`

- [ ] **Step 1: Rewrite the component body** to add the viewer, the private-set fetch, per-pool `invited` reads, and filtering. Replace the whole file with:
```tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { cofferEscrow, statusName } from "@/lib/contract";
import { isEscrowConfigured } from "@/lib/chain";
import { isPoolVisible } from "@/lib/pool-filter";
import { fmtEth, pct } from "@/lib/format";
import AddressLabel from "@/components/address-label";

type PoolTuple = readonly [string, `0x${string}`, bigint, bigint, number, number, number, `0x${string}`];

async function fetchPrivateIds(): Promise<number[]> {
  try {
    const res = await fetch("/api/pools/visibility");
    if (!res.ok) return [];
    return ((await res.json()) as { private: number[] }).private ?? [];
  } catch {
    return []; // fail-open: never hide public pools on a fetch blip
  }
}

export default function PoolsPage() {
  const { address: viewer } = useAccount();

  const { data: countData } = useReadContract({
    ...cofferEscrow,
    functionName: "poolCount",
    query: { enabled: isEscrowConfigured, refetchInterval: 12000 },
  });
  const count = countData ? Number(countData) : 0;

  const { data: privateData } = useQuery({ queryKey: ["pool-visibility"], queryFn: fetchPrivateIds });
  const privateIds = useMemo(() => new Set(privateData ?? []), [privateData]);

  // Per pool: pools(i), status(i), and — when a viewer is connected — invited(i, viewer).
  const per = viewer ? 3 : 2;
  const contracts = Array.from({ length: count }, (_, i) => {
    const base: unknown[] = [
      { ...cofferEscrow, functionName: "pools", args: [BigInt(i)] },
      { ...cofferEscrow, functionName: "status", args: [BigInt(i)] },
    ];
    if (viewer) base.push({ ...cofferEscrow, functionName: "invited", args: [BigInt(i), viewer] });
    return base;
  }).flat();
  const { data } = useReadContracts({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: contracts as any,
    query: { enabled: count > 0 },
  });

  const visible = Array.from({ length: count }, (_, i) => i).filter((i) => {
    const pool = data?.[i * per]?.result as PoolTuple | undefined;
    if (!pool) return false;
    const creator = pool[1];
    const invited = viewer ? (data?.[i * per + 2]?.result as boolean | undefined) === true : false;
    return isPoolVisible({ isPrivate: privateIds.has(i), viewer, creator, invited });
  });

  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <h1>Pools</h1>
          <p>
            Public pools plus any private pools you belong to. Ownership is always reconstructable from on-chain
            deposits.
          </p>
        </div>
        <Link className="btn btn-primary" href="/pools/new">
          Start a pool
        </Link>
      </div>

      {!isEscrowConfigured ? (
        <div className="note note-warn">
          <span>⚠</span>
          <span>Escrow address not configured. Set NEXT_PUBLIC_ESCROW_ADDRESS and restart the dev server.</span>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty">
          <span className="mark" aria-hidden />
          <h3>{count === 0 ? "No pools yet" : "No pools to show"}</h3>
          <p>
            {count === 0
              ? "Be the first — start a pool for a name and invite people."
              : "Public pools you can join appear here. Connect your wallet to also see private pools you belong to."}
          </p>
          <Link className="btn btn-primary" href="/pools/new">
            Start a pool
          </Link>
        </div>
      ) : (
        <div className="grid">
          {visible.map((i) => {
            const pool = data![i * per]!.result as PoolTuple;
            const statusNum = data?.[i * per + 1]?.result as number | undefined;
            const [label, creator, targetAmount, totalDeposited, , , threshold] = pool;
            const status = statusNum !== undefined ? statusName(statusNum) : "funding";
            const funded = pct(totalDeposited, targetAmount);
            const isPrivate = privateIds.has(i);
            return (
              <Link key={i} href={`/pools/${i}`} className="ncard">
                <div className="ncard-top">
                  <span className={`tag tag-${status}`}>{status}</span>
                  <span className="mono" style={{ fontSize: 12, color: "var(--faint)" }}>
                    {isPrivate ? "🔒 " : ""}#{i} · {threshold}-of-N
                  </span>
                </div>
                <div className="ncard-name">
                  {label}
                  <span className="eth">.eth</span>
                </div>
                <div className="ncard-sub">
                  by <AddressLabel address={creator} />
                </div>
                <div className="progress mt-16">
                  <div className="fill" style={{ width: `${funded}%` }} />
                </div>
                <div className="progress-label">
                  <span>{funded.toFixed(0)}% funded</span>
                  <span>
                    {fmtEth(totalDeposited, 2)} / {fmtEth(targetAmount, 2)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck** — clean. (Note: `useQuery` is already a dep via the app's `QueryClientProvider` in `app/providers.tsx`.)

---

## Task 6: Public/private toggle on the create form

**Files:** Modify `apps/web/app/pools/new/page.tsx`

- [ ] **Step 1: Import `useAuth`** — add near the other imports:
```tsx
import { useAuth } from "@/hooks/use-auth";
```

- [ ] **Step 2: Add state + hook** — in `NewPoolForm`, after `const [labelInput, setLabelInput] = useState(label || "");` add:
```tsx
  const [isPublic, setIsPublic] = useState(true);
  const { isSignedIn, signIn } = useAuth();
```

- [ ] **Step 3: Write visibility after the deposit tx** — in `submit`, replace:
```tsx
      await publicClient.waitForTransactionReceipt({ hash: hash2 });

      setStep("done");
      router.push(`/pools/${poolId.toString()}`);
```
with:
```tsx
      await publicClient.waitForTransactionReceipt({ hash: hash2 });

      // Public is the default (absence of a record) — no call needed. Only a
      // private pool needs a creator-signed visibility write; failure is non-fatal.
      if (!isPublic) {
        try {
          if (!isSignedIn) await signIn();
          await fetch("/api/pools/visibility", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ poolId: Number(poolId), public: false }),
          });
        } catch {
          /* non-fatal: pool stays public until retried */
        }
      }

      setStep("done");
      router.push(`/pools/${poolId.toString()}`);
```

- [ ] **Step 4: Add the toggle UI** — in the "1 · Pool basics" panel, insert this as a new field BEFORE the closing `</div>` of that panel (right after the "Signatures to buy" field block, i.e. after its closing `</div>` and before the panel's closing `</div>`):
```tsx
            <div className="field" style={{ marginTop: 18, marginBottom: 0 }}>
              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span>
                  List this pool publicly{" "}
                  <span className="hint">shows in the Pools directory</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isPublic}
                  className={`toggle${isPublic ? " on" : ""}`}
                  onClick={() => setIsPublic((v) => !v)}
                >
                  <span className="toggle-knob" />
                </button>
              </label>
              <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                {isPublic
                  ? "Anyone can find this pool in the directory. Only addresses you invite can deposit."
                  : "Private — only you and the people you invite can see it. You’ll sign a quick message to confirm you’re the creator."}
              </p>
            </div>
```

- [ ] **Step 5: Add toggle styles** — append to `apps/web/app/globals.css`:
```css
/* Public/private toggle switch */
.toggle {
  position: relative;
  width: 44px;
  height: 26px;
  border-radius: 999px;
  border: none;
  background: var(--hairline, rgba(15, 23, 42, 0.12));
  cursor: pointer;
  transition: background 0.15s ease;
  flex: 0 0 auto;
}
.toggle.on {
  background: #2f6bff;
}
.toggle-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  transition: transform 0.15s ease;
}
.toggle.on .toggle-knob {
  transform: translateX(18px);
}
```

- [ ] **Step 6: Typecheck** — `pnpm --filter @coffer/web exec tsc --noEmit` → clean.

---

## Task 7: Verification

- [ ] **Step 1: Full unit suite offline** — `pnpm --filter @coffer/web test` → all pass; KV-guarded blocks skip.
- [ ] **Step 2: Guarded KV run (if env present)**
```bash
cd apps/web && export $(grep -E '^(UPSTASH_REDIS_REST_URL|UPSTASH_REDIS_REST_TOKEN|KV_REST_API_URL|KV_REST_API_TOKEN)=' .env.local | sed 's/"//g' | xargs) && pnpm --filter @coffer/web test pool-visibility.integration; cd ..
```
Expect PASS (add→list→remove).
- [ ] **Step 3: Stop dev server, typecheck + build**
```bash
pnpm --filter @coffer/web exec tsc --noEmit && pnpm --filter @coffer/web build
```
Expect clean; `/api/pools/visibility` builds as a dynamic route handler; `/pools` still `○`/`ƒ` as before.
- [ ] **Step 4: Manual checklist (needs a wallet + KV; documented)**
  1. Create a pool with the toggle **ON** (public) → appears in `/pools` for any/no wallet.
  2. Create a pool with the toggle **OFF** (private) → sign the confirm message → it shows in `/pools` for the creator with a 🔒 tag; open `/pools` in a different wallet (or disconnected) → it's absent.
  3. Invite a second address to the private pool at creation → that address sees it in `/pools`.
  4. Legacy demo pool #0 (no record) still shows for everyone.

---

## Self-review notes for the implementer
- Server-only modules (`lib/pool-visibility.ts`, `lib/sepolia-client.ts`, `app/api/pools/**`) must never be imported by a `"use client"` file.
- `pools()` returns a tuple; `creator` is index **1**. Compare addresses **lowercased** everywhere.
- Visibility default is **public via absence** — the create form makes ZERO API calls for a public pool.
- The `/api/pools/visibility` GET is intentionally public; do not gate it. The POST is creator-gated (SIWE + on-chain creator check).
- Fail-open on the list: if the visibility fetch fails, treat all pools as public (never hide a public pool).
