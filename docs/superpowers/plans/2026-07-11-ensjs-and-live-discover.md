# ensjs Data Layer + Live Discover — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the ENS read layer onto official `@ensdomains/ensjs` (retrofit Phase 3a) and make the Discover home grid show real names currently in temporary premium, priced live.

**Architecture:** A read-only mainnet viem client wrapped with `addEnsContracts` drives ensjs `getPrice`/`getExpiry` for per-name status/price; a server-side subgraph query enumerates names in the premium window and batch-prices them via ensjs. All mainnet reads are server-side; the wallet/wagmi Sepolia path is untouched; resolvio keeps name/avatar resolution.

**Tech Stack:** Next.js 15 (server components + `revalidate`), `@ensdomains/ensjs` v4.3.1 (viem peer ^2.35, we have 2.55), Chainlink ETH/USD feed, ENS subgraph (decentralized network, gateway URL), vitest.

**Spec:** `docs/superpowers/specs/2026-07-11-ensjs-and-live-discover-design.md`

**Verified (source/npm/live spike, 2026-07-11):**
- `getPrice(client, { nameOrNames, duration })` → `{ base, premium }` (single or array), from `@ensdomains/ensjs/public`.
- `getExpiry(client, { name })` → `null` if never registered, else `{ expiry: { value: bigint }, gracePeriod: number, status }`, from `@ensdomains/ensjs/public`.
- Client: `createPublicClient({ chain: addEnsContracts(mainnet, { subgraphApiKey }), transport: http(rpc) })`; `addEnsContracts` from `@ensdomains/ensjs/contracts`. Names must be `.eth`-suffixed.
- Mainnet ENS subgraph gateway: `https://gateway-arbitrum.network.thegraph.com/api/<GRAPH_API_KEY>/subgraphs/id/5XqPmWe6gjyrJtFn9cLy237i4cWw2j9HcUJEXsP5qGtH`; `registrations(where:{expiryDate_gte,expiryDate_lte})` returns names in premium (spike-confirmed).
- `GRAPH_API_KEY` + `MAINNET_RPC_URL` already in `apps/web/.env.local` (gitignored). **Never commit the key.**

**Constraints for the implementer:**
- Never import `lib/ens-client.ts`, `lib/ens-name.ts`, or `lib/ens-premium.ts` from a `"use client"` file — they carry the mainnet RPC/key and read logic; they must stay server-only. Client components receive already-fetched, **bigint-free** plain data as props (bigint is not serializable across the server→client boundary).
- Per-task commits on the working branch are pre-authorized as part of this approved plan; commit without pausing. Do NOT push.

---

## File Structure

- Modify `apps/web/package.json` — add `@ensdomains/ensjs`.
- Create `apps/web/lib/ens-client.ts` — mainnet ensjs client + Chainlink `getEthUsd` + `ONE_YEAR`.
- Delete `apps/web/lib/ens-mainnet.ts` — replaced by `ens-client.ts`.
- Modify `apps/web/lib/ens-name.ts` — use ensjs; `deriveStatus` gains `gracePeriod`.
- Modify `apps/web/lib/ens-name.test.ts` — add a custom-gracePeriod case.
- Create `apps/web/lib/ens-premium.ts` — `premiumProgress` (pure) + `getPremiumNames`.
- Create `apps/web/lib/ens-premium.test.ts` — `premiumProgress` unit tests.
- Modify `apps/web/lib/ens-name.integration.test.ts` — add a guarded `getPremiumNames` case.
- Modify `apps/web/lib/format.ts` — add `fmtUsd`.
- Create `apps/web/components/discover-grid.tsx` — `"use client"` grid + sort tabs + `NameCard`.
- Modify `apps/web/app/page.tsx` — server component fetching `getPremiumNames`.

---

## Task 1: Install @ensdomains/ensjs

**Files:** Modify `apps/web/package.json`

- [ ] **Step 1: Install**

Run from repo root:
```bash
pnpm --filter @coffer/web add @ensdomains/ensjs
```
Expected: `@ensdomains/ensjs` (^4.3.1) added to `apps/web/package.json` dependencies; lockfile updated. Peer `viem ^2.35` is satisfied by the existing `viem ^2.55`.

- [ ] **Step 2: Verify the import resolves**

Run:
```bash
pnpm --filter @coffer/web exec node -e "import('@ensdomains/ensjs/public').then(m=>console.log('getPrice' in m, 'getExpiry' in m))"
```
Expected: `true true`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add @ensdomains/ensjs"
```

---

## Task 2: Mainnet ensjs client + Chainlink USD helper

**Files:** Create `apps/web/lib/ens-client.ts`

- [ ] **Step 1: Create the client module**

Create `apps/web/lib/ens-client.ts`:
```ts
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { addEnsContracts } from "@ensdomains/ensjs/contracts";

// Read-only mainnet ENS access via ensjs. NOT wired to the wallet — writes/pooling
// stay on Sepolia via wagmi. Server-side only (RPC endpoint + Graph key are server
// env, no NEXT_PUBLIC_). Public RPC fallback works without config.
const MAINNET_RPC = process.env.MAINNET_RPC_URL || "https://ethereum-rpc.publicnode.com";
const GRAPH_API_KEY = process.env.GRAPH_API_KEY;

export const ensClient = createPublicClient({
  chain: GRAPH_API_KEY
    ? addEnsContracts(mainnet, { subgraphApiKey: GRAPH_API_KEY })
    : addEnsContracts(mainnet),
  transport: http(MAINNET_RPC),
});

export const ONE_YEAR = 31_536_000n;

// Chainlink ETH/USD (mainnet) — ensjs has no USD conversion. Verified on-chain
// 2026-07-11: decimals() == 8, latestRoundData() returns a live answer.
const CHAINLINK_ETH_USD = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419" as const;

const chainlinkAbi = [
  { name: "decimals", stateMutability: "view", type: "function", inputs: [], outputs: [{ type: "uint8" }] },
  {
    name: "latestRoundData",
    stateMutability: "view",
    type: "function",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

// Live ETH/USD, or null if the oracle read fails (callers degrade to ETH-only).
export async function getEthUsd(): Promise<number | null> {
  try {
    const [decimals, round] = await ensClient.multicall({
      allowFailure: false,
      contracts: [
        { address: CHAINLINK_ETH_USD, abi: chainlinkAbi, functionName: "decimals" },
        { address: CHAINLINK_ETH_USD, abi: chainlinkAbi, functionName: "latestRoundData" },
      ],
    });
    return Number(round[1]) / 10 ** Number(decimals);
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @coffer/web exec tsc --noEmit` — Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/ens-client.ts
git commit -m "feat(web): mainnet ensjs client + Chainlink USD helper"
```

---

## Task 3: Retrofit getEnsNameData onto ensjs

**Files:** Modify `apps/web/lib/ens-name.ts`, `apps/web/lib/ens-name.test.ts`; Delete `apps/web/lib/ens-mainnet.ts`

- [ ] **Step 1: Add the failing custom-gracePeriod test**

In `apps/web/lib/ens-name.test.ts`, inside the existing `describe("deriveStatus", ...)` block, add these two cases (keep all existing cases unchanged):
```ts
  it("uses a custom gracePeriod when provided (shorter grace)", () => {
    // With a 10-day grace, a name expired 15 days ago is already in premium.
    expect(deriveStatus(now - 15 * DAY, now, 10 * DAY)).toBe("premium");
  });
  it("defaults gracePeriod to 90 days when omitted", () => {
    // Same 15-days-expired name is still in grace under the 90-day default.
    expect(deriveStatus(now - 15 * DAY, now)).toBe("grace");
  });
```

- [ ] **Step 2: Run the test to verify the new case fails**

Run: `pnpm --filter @coffer/web test` — Expected: the "custom gracePeriod" case FAILS (deriveStatus ignores the 3rd arg today), other cases pass.

- [ ] **Step 3: Rewrite `ens-name.ts` to use ensjs**

Replace the ENTIRE contents of `apps/web/lib/ens-name.ts` with:
```ts
import { normalize } from "viem/ens";
import { formatEther } from "viem";
import { getPrice, getExpiry } from "@ensdomains/ensjs/public";
import { ensClient, getEthUsd, ONE_YEAR } from "./ens-client";

export type EnsStatus = "active" | "grace" | "premium" | "available" | "tooShort" | "invalid";

export type EnsNameData = {
  label: string; // raw input (for display fallback)
  normalized: string; // normalized label, "" if invalid
  letters: number;
  status: EnsStatus;
  expiry: number; // unix seconds, 0 if never registered / n/a
  baseWei: bigint;
  premiumWei: bigint;
  totalWei: bigint;
  ethUsd: number | null;
  buyable: boolean;
};

export const DAY = 86400;
export const GRACE = 90 * DAY;
export const PREMIUM = 21 * DAY;

// Pure status derivation from expiry vs now (unix seconds). `gracePeriod` is the
// real registrar grace (from ensjs), defaulting to 90d. expiry === 0 (never
// registered) falls through to "available".
export function deriveStatus(
  expiry: number,
  now: number,
  gracePeriod: number = GRACE,
): "active" | "grace" | "premium" | "available" {
  if (expiry > now) return "active";
  if (now < expiry + gracePeriod) return "grace";
  if (now < expiry + gracePeriod + PREMIUM) return "premium";
  return "available";
}

export function weiToUsd(wei: bigint, ethUsd: number | null): number | null {
  if (ethUsd === null) return null;
  return Number(formatEther(wei)) * ethUsd;
}

function stub(label: string, normalized: string, status: EnsStatus): EnsNameData {
  return {
    label,
    normalized,
    letters: normalized.length,
    status,
    expiry: 0,
    baseWei: 0n,
    premiumWei: 0n,
    totalWei: 0n,
    ethUsd: null,
    buyable: false,
  };
}

// Read real mainnet ENS status + price for a label via ensjs. Throws on RPC
// failure of the core reads (caller renders an error state). Returns a stub (no
// reads) for invalid or too-short labels. ETH/USD degrades to null on oracle
// failure rather than failing the page.
export async function getEnsNameData(rawLabel: string): Promise<EnsNameData> {
  const stripped = rawLabel.replace(/\.eth$/i, "");
  let normalized: string;
  try {
    normalized = normalize(stripped);
  } catch {
    return stub(rawLabel, "", "invalid");
  }
  if (normalized.length < 3) return stub(rawLabel, normalized, "tooShort");

  const name = `${normalized}.eth`;
  const [price, expiryData] = await Promise.all([
    getPrice(ensClient, { nameOrNames: name, duration: ONE_YEAR }),
    getExpiry(ensClient, { name }),
  ]);
  const ethUsd = await getEthUsd();

  // getExpiry returns null for a never-registered name.
  const expiry = expiryData ? Number(expiryData.expiry.value) : 0;
  const gracePeriod = expiryData ? expiryData.gracePeriod : GRACE;
  const now = Math.floor(Date.now() / 1000);
  const status = deriveStatus(expiry, now, gracePeriod);
  const baseWei = price.base;
  const premiumWei = price.premium;

  return {
    label: rawLabel,
    normalized,
    letters: normalized.length,
    status,
    expiry,
    baseWei,
    premiumWei,
    totalWei: baseWei + premiumWei,
    ethUsd,
    buyable: status === "premium" || status === "available",
  };
}
```

- [ ] **Step 4: Delete the obsolete raw-viem module**

```bash
git rm apps/web/lib/ens-mainnet.ts
```
Expected: removed. (Grep `git grep -n "ens-mainnet"` → no remaining references.)

- [ ] **Step 5: Run unit tests + typecheck**

Run: `pnpm --filter @coffer/web test` — Expected: all pass (incl. both new gracePeriod cases; integration block skipped without env).
Run: `pnpm --filter @coffer/web exec tsc --noEmit` — Expected: no errors.

- [ ] **Step 6: Run the integration test through ensjs against mainnet**

Run:
```bash
MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com pnpm --filter @coffer/web test
```
Expected: PASS — `getEnsNameData("vitalik")` still resolves to `active` with `expiry > 0` and non-null `ethUsd`, now via ensjs.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/ens-name.ts apps/web/lib/ens-name.test.ts
git commit -m "refactor(web): drive getEnsNameData with ensjs getPrice/getExpiry"
```

---

## Task 4: Verify the Name page still renders

**Files:** none (verification only — the Name page consumes `getEnsNameData` unchanged)

- [ ] **Step 1: Start the dev server if not running**

Run (background): `pnpm --filter @coffer/web dev`. Wait for it to be ready (`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` → 200).

- [ ] **Step 2: Verify statuses render via ensjs**

```bash
curl -s http://localhost:3000/name/vitalik | grep -c "Registered"        # expect >= 1
curl -s http://localhost:3000/name/ab | grep -c "too short"              # expect >= 1
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/name/thisnameisprobablyfree12345  # expect 200
```
Expected: `vitalik` shows "Registered" (active), `ab` shows "too short", the random label returns 200 (Available). No commit (no code change).

---

## Task 5: Live premium enumeration (getPremiumNames)

**Files:** Modify `apps/web/lib/format.ts`; Create `apps/web/lib/ens-premium.ts`, `apps/web/lib/ens-premium.test.ts`

- [ ] **Step 1: Add `fmtUsd` to `format.ts`**

Add to `apps/web/lib/format.ts` (append; keep existing exports):
```ts
export function fmtUsd(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}
```

- [ ] **Step 2: Write the failing `premiumProgress` test**

Create `apps/web/lib/ens-premium.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { premiumProgress } from "./ens-premium";

const DAY = 86400;
const GRACE = 90 * DAY;
const PREMIUM = 21 * DAY;
const now = 1_000_000_000;

describe("premiumProgress", () => {
  it("day 0 the moment the name is released (expiry + grace = now)", () => {
    const r = premiumProgress(now - GRACE, now);
    expect(r.dayIntoPremium).toBe(0);
    expect(r.premiumEndsAt).toBe(now - GRACE + GRACE + PREMIUM);
  });
  it("counts whole days into the premium window", () => {
    expect(premiumProgress(now - GRACE - 5 * DAY, now).dayIntoPremium).toBe(5);
  });
  it("clamps to 21 past the end of the window", () => {
    expect(premiumProgress(now - GRACE - 30 * DAY, now).dayIntoPremium).toBe(21);
  });
  it("clamps to 0 before release (still in grace)", () => {
    expect(premiumProgress(now - GRACE + 5 * DAY, now).dayIntoPremium).toBe(0);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm --filter @coffer/web test` — Expected: FAIL (cannot import `premiumProgress`).

- [ ] **Step 4: Implement `ens-premium.ts`**

Create `apps/web/lib/ens-premium.ts`:
```ts
import { normalize } from "viem/ens";
import { formatEther } from "viem";
import { getPrice } from "@ensdomains/ensjs/public";
import { ensClient, getEthUsd, ONE_YEAR } from "./ens-client";
import { DAY, GRACE, PREMIUM, weiToUsd } from "./ens-name";

// Client-facing entry — NO bigints (must serialize across the server→client
// boundary into the Discover grid).
export type PremiumEntry = {
  label: string;
  letters: number;
  priceUsd: number | null; // total (base + premium) in USD, null if no ETH/USD
  priceEth: number; // total in ETH
  dayIntoPremium: number; // 0..21
  premiumEndsAt: number; // unix seconds
  expiryDate: number; // registrar expiry (unix seconds) — for the "newest" sort
};

// Pure: where a name sits in its 21-day premium window, from its registrar
// expiry. Released at expiry + grace; premium ends 21 days later.
export function premiumProgress(expiryDate: number, now: number): { dayIntoPremium: number; premiumEndsAt: number } {
  const releasedAt = expiryDate + GRACE;
  const premiumEndsAt = releasedAt + PREMIUM;
  const dayIntoPremium = Math.min(21, Math.max(0, Math.floor((now - releasedAt) / DAY)));
  return { dayIntoPremium, premiumEndsAt };
}

const SUBGRAPH_ID = "5XqPmWe6gjyrJtFn9cLy237i4cWw2j9HcUJEXsP5qGtH";

function subgraphUrl(): string | null {
  const key = process.env.GRAPH_API_KEY;
  if (!key) return null;
  return `https://gateway-arbitrum.network.thegraph.com/api/${key}/subgraphs/id/${SUBGRAPH_ID}`;
}

type Registration = { labelName: string | null; expiryDate: string };

// Names currently in the 21-day temporary premium (registrar expiry 90–111 days
// ago), priced live via ensjs. Returns [] when no Graph key is set. Throws on
// subgraph/pricing failure (the page renders an error state).
export async function getPremiumNames(limit = 24): Promise<PremiumEntry[]> {
  const url = subgraphUrl();
  if (!url) return [];

  const now = Math.floor(Date.now() / 1000);
  const lo = now - (GRACE + PREMIUM); // expiry 111 days ago
  const hi = now - GRACE; // expiry 90 days ago
  const query = `{
    registrations(first: ${limit}, orderBy: expiryDate, orderDirection: desc, where: { expiryDate_gte: ${lo}, expiryDate_lte: ${hi} }) {
      labelName
      expiryDate
    }
  }`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`ENS subgraph HTTP ${res.status}`);
  const json = (await res.json()) as { data?: { registrations?: Registration[] }; errors?: unknown };
  if (json.errors) throw new Error("ENS subgraph query error");

  const regs = json.data?.registrations ?? [];
  const valid: { label: string; expiryDate: number }[] = [];
  for (const r of regs) {
    if (!r.labelName || r.labelName.length < 3) continue;
    try {
      normalize(r.labelName);
    } catch {
      continue;
    }
    valid.push({ label: r.labelName, expiryDate: Number(r.expiryDate) });
  }
  if (valid.length === 0) return [];

  const [prices, ethUsd] = await Promise.all([
    getPrice(ensClient, { nameOrNames: valid.map((v) => `${v.label}.eth`), duration: ONE_YEAR }),
    getEthUsd(),
  ]);

  const now2 = Math.floor(Date.now() / 1000);
  return valid.map((v, i) => {
    const totalWei = prices[i].base + prices[i].premium;
    const { dayIntoPremium, premiumEndsAt } = premiumProgress(v.expiryDate, now2);
    return {
      label: v.label,
      letters: v.label.length,
      priceUsd: weiToUsd(totalWei, ethUsd),
      priceEth: Number(formatEther(totalWei)),
      dayIntoPremium,
      premiumEndsAt,
      expiryDate: v.expiryDate,
    };
  });
}
```

- [ ] **Step 5: Run to verify `premiumProgress` passes**

Run: `pnpm --filter @coffer/web test` — Expected: PASS (all `premiumProgress` cases). `tsc --noEmit` clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/format.ts apps/web/lib/ens-premium.ts apps/web/lib/ens-premium.test.ts
git commit -m "feat(web): live ENS premium enumeration via subgraph + ensjs pricing"
```

---

## Task 6: Discover grid client component

**Files:** Create `apps/web/components/discover-grid.tsx`

- [ ] **Step 1: Create the client grid (sort tabs + NameCard on real data)**

Create `apps/web/components/discover-grid.tsx`:
```tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PremiumEntry } from "@/lib/ens-premium";
import { fmtUsd, fmtCountdown } from "@/lib/format";
import SearchBar from "@/components/search-bar";

type Sort = "newest" | "ending" | "cheapest" | "shortest";

const SORTS: { key: Sort; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "ending", label: "Ending soon" },
  { key: "cheapest", label: "Cheapest" },
  { key: "shortest", label: "Shortest" },
];

function sortEntries(entries: PremiumEntry[], sort: Sort): PremiumEntry[] {
  const a = [...entries];
  switch (sort) {
    case "newest":
      return a.sort((x, y) => y.expiryDate - x.expiryDate);
    case "ending":
      return a.sort((x, y) => x.premiumEndsAt - y.premiumEndsAt);
    case "cheapest":
      return a.sort((x, y) => x.priceEth - y.priceEth);
    case "shortest":
      return a.sort((x, y) => x.letters - y.letters || x.priceEth - y.priceEth);
  }
}

// Stable, on-brand gradient per name so the grid reads as cohesive.
const CARD_GRADIENTS: [string, string][] = [
  ["#2f6bff", "#1f54e6"],
  ["#6366f1", "#8b5cf6"],
  ["#0ea5e9", "#06b6d4"],
  ["#3b82f6", "#2f6bff"],
  ["#7c3aed", "#4f46e5"],
  ["#0891b2", "#22c1c3"],
];

function gradientFor(label: string): [string, string] {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return CARD_GRADIENTS[h % CARD_GRADIENTS.length];
}

function NameCard({ n }: { n: PremiumEntry }) {
  const [c1, c2] = gradientFor(n.label);
  const price = n.priceUsd !== null ? fmtUsd(n.priceUsd) : `${n.priceEth.toFixed(3)} ETH`;
  return (
    <Link
      className="ncard reveal"
      href={`/name/${n.label}`}
      style={{ ["--c1"]: c1, ["--c2"]: c2 } as React.CSSProperties}
    >
      <div className="ncard-top">
        <span className="ncard-mono" aria-hidden>
          {n.label.slice(0, 1).toUpperCase()}
        </span>
        <span className="ncard-timer">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {fmtCountdown(n.premiumEndsAt)} left
        </span>
      </div>

      <div className="ncard-name">
        {n.label}
        <span className="eth">.eth</span>
      </div>

      <div className="ncard-price">
        <span className="ncard-price-label">Current price</span>
        <span className="p">{price}</span>
      </div>

      <div className="ncard-foot">
        <span className="pools-chip">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          day {n.dayIntoPremium}/21 of premium
        </span>
        <span className="watchers">≈ {n.priceEth.toFixed(3)} ETH</span>
      </div>
    </Link>
  );
}

export default function DiscoverGrid({ names }: { names: PremiumEntry[] }) {
  const [sort, setSort] = useState<Sort>("newest");
  const sorted = useMemo(() => sortEntries(names, sort), [names, sort]);

  return (
    <>
      <div className="toolbar">
        <div className="segmented" role="tablist" aria-label="Sort names">
          {SORTS.map((s) => (
            <button key={s.key} className={sort === s.key ? "on" : ""} onClick={() => setSort(s.key)}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="toolbar-search">
          <SearchBar />
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="empty">
          <span className="mark" aria-hidden />
          <h3>No names in premium right now</h3>
          <p>When recently-expired .eth names enter their 21-day premium auction, they’ll show up here.</p>
        </div>
      ) : (
        <div className="grid">
          {sorted.map((n) => (
            <NameCard key={n.label} n={n} />
          ))}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @coffer/web exec tsc --noEmit` — Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/discover-grid.tsx
git commit -m "feat(web): Discover grid client component on live premium data"
```

---

## Task 7: Discover page → server component on live data

**Files:** Modify `apps/web/app/page.tsx` (full replacement)

- [ ] **Step 1: Replace `app/page.tsx`**

Replace the ENTIRE contents of `apps/web/app/page.tsx` with:
```tsx
import { getPremiumNames } from "@/lib/ens-premium";
import DiscoverGrid from "@/components/discover-grid";

// Cache the live premium list ~60s (bounds subgraph/RPC usage).
export const revalidate = 60;

export default async function Discover() {
  let names: Awaited<ReturnType<typeof getPremiumNames>> | null = null;
  try {
    names = await getPremiumNames();
  } catch {
    names = null;
  }

  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <span className="eyebrow">◆ Ethereum mainnet · live auction</span>
          <h1 style={{ marginTop: 16 }}>Names in temporary premium</h1>
          <p>
            Recently expired ENS names, decaying through their 21-day premium auction. The price falls roughly 50% a day
            — pool up to grab the ones worth having before someone else does.
          </p>
        </div>
      </div>

      {names === null ? (
        <div className="note note-warn">
          <span>⚠</span>
          <span>Couldn’t load live names from mainnet ENS right now. Please try again in a moment.</span>
        </div>
      ) : (
        <DiscoverGrid names={names} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + confirm no seed-data import remains on Discover**

Run: `pnpm --filter @coffer/web exec tsc --noEmit` — Expected: no errors.
Run: `git grep -n "from \"@/lib/data\"" apps/web/app/page.tsx` — Expected: no output (Discover no longer imports the seed).

- [ ] **Step 3: Verify live Discover renders**

With the dev server running and `GRAPH_API_KEY` present in `.env.local`, load the home page:
```bash
curl -s http://localhost:3000/ | grep -c "temporary premium"   # expect >= 1 (header)
curl -s http://localhost:3000/ | grep -oE "[a-z0-9-]+\.eth" | head -5   # expect real premium labels, not the old seed (zk/dao/defi...)
```
Expected: header renders; the grid shows real `.eth` labels pulled live (e.g. names currently in premium), not the seed set. Open `http://localhost:3000/` in a browser to eyeball the cards + sort tabs (Newest/Ending soon/Cheapest/Shortest) and the "day X/21 of premium" footer.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat(web): live Discover home from real ENS premium names"
```

---

## Task 8: Guarded Discover integration test + full verification

**Files:** Modify `apps/web/lib/ens-name.integration.test.ts`

- [ ] **Step 1: Add a guarded `getPremiumNames` integration case**

In `apps/web/lib/ens-name.integration.test.ts`, add at the top-level (alongside the existing guarded block):
```ts
import { getPremiumNames } from "./ens-premium";

// getPremiumNames needs the Graph key; the RPC falls back to a public endpoint.
const maybeSubgraph = process.env.GRAPH_API_KEY ? describe : describe.skip;

maybeSubgraph("getPremiumNames against mainnet", () => {
  it(
    "returns real premium names with sane fields",
    async () => {
      const names = await getPremiumNames(5);
      expect(Array.isArray(names)).toBe(true);
      for (const n of names) {
        expect(n.label.length).toBeGreaterThanOrEqual(3);
        expect(n.priceEth).toBeGreaterThanOrEqual(0);
        expect(n.dayIntoPremium).toBeGreaterThanOrEqual(0);
        expect(n.dayIntoPremium).toBeLessThanOrEqual(21);
      }
    },
    30000,
  );
});
```

- [ ] **Step 2: Run tests offline (guarded blocks skip) and with env (run for real)**

Run: `pnpm --filter @coffer/web test` — Expected: PASS; subgraph + mainnet blocks skipped.
Run (load env from the gitignored file, do not echo the key). Set `MAINNET_RPC_URL` inline so the `getEnsNameData` mainnet block also runs:
```bash
cd apps/web && export $(grep -E '^GRAPH_API_KEY=' .env.local | xargs) && MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com pnpm --filter @coffer/web test; cd ..
```
Expected: PASS — the `getPremiumNames` case runs and returns real names with sane fields (and the `getEnsNameData` mainnet case passes too).

- [ ] **Step 3: Stop dev server, then typecheck + production build**

Stop any running `next dev` (shared `.next` corruption otherwise), then:
```bash
pnpm --filter @coffer/web exec tsc --noEmit && pnpm --filter @coffer/web build
```
Expected: typecheck clean; build succeeds. `/` builds as a dynamic/ISR route; `/name/[label]` unchanged.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/ens-name.integration.test.ts
git commit -m "test(web): guarded integration test for live premium names"
```

---

## Self-review notes for the implementer

- Bigints never cross into `discover-grid.tsx` — `PremiumEntry` is all numbers/strings. Do not add bigint fields to it.
- `lib/ens-client.ts` / `lib/ens-name.ts` / `lib/ens-premium.ts` are server-only. If the build errors about server code in a client bundle, you imported one of them into a `"use client"` file — pass plain data as props instead.
- Keep `resolvio`-based name/avatar resolution and the Sepolia wagmi/pool code untouched — out of scope.
- `lib/data.ts` stays (portfolio + `usd`/`eth` helpers still use it); only the Discover page stops importing `NAMES`.
- Reuse `fmtUsd`/`fmtCountdown` from `lib/format`, `weiToUsd`/`deriveStatus` from `lib/ens-name`; don't duplicate them.
