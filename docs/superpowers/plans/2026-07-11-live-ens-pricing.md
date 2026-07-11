# Live ENS Pricing (Phase 3a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/name/[label]` and "search any name" show real mainnet ENS status + live price, replacing the `lib/data.ts` seed lookup. Pooling/writes stay on Sepolia.

**Architecture:** A standalone **read-only mainnet viem client** (not wired to the wallet) runs **server-side** in the Name page. Per label we multicall `rentPrice` (base+premium), `nameExpires` (expiry), and the Chainlink ETH/USD feed, then derive a status (`active`/`grace`/`premium`/`available`) from expiry vs. now. Discover home stays on seed data (Phase 3b).

**Tech Stack:** Next.js 15 (server components), viem (mainnet public client + multicall), vitest (new — unit tests), Chainlink ETH/USD feed.

**Spec:** `docs/superpowers/specs/2026-07-11-live-ens-pricing-design.md`

**Verified mainnet values (on-chain, 2026-07-11):**
- ETHRegistrarController `0x59E16fcCd424Cc24e280Be16E11Bcd56fb0CE547` — `rentPrice(string,uint256)` → `{base,premium}`
- BaseRegistrar `0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85` — `nameExpires(uint256)`, `tokenId = uint256(labelhash(label))`
- Chainlink ETH/USD `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` — `decimals()=8`, `latestRoundData()`

---

## File Structure

- Create `apps/web/vitest.config.ts` — vitest config (node env, `@` alias).
- Create `apps/web/lib/ens-mainnet.ts` — mainnet client + verified addresses + minimal ABIs. One responsibility: read-only mainnet ENS access.
- Create `apps/web/lib/ens-name.ts` — `deriveStatus` (pure), `weiToUsd` (pure), `getEnsNameData` (orchestration), `EnsNameData`/`EnsStatus` types.
- Create `apps/web/lib/ens-name.test.ts` — unit tests for the pure functions.
- Create `apps/web/lib/ens-name.integration.test.ts` — light mainnet read test (guarded).
- Modify `apps/web/app/name/[label]/page.tsx` — consume `getEnsNameData`, status-aware UI.
- Modify `apps/web/package.json` — add vitest dev dep + `test` script.
- Modify `apps/web/.env.local` (local, gitignored) — add optional `MAINNET_RPC_URL` (documented; public fallback works without it).

---

## Task 1: Set up vitest in apps/web

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/vitest.config.ts`

- [ ] **Step 1: Add vitest dev dependency**

Run (from repo root):
```bash
pnpm --filter @coffer/web add -D vitest
```
Expected: vitest added to `apps/web/package.json` devDependencies; lockfile updated.

- [ ] **Step 2: Add the test script**

Modify `apps/web/package.json` `scripts` to add:
```json
"test": "vitest run"
```
(Place it alongside the existing `dev`/`build`/`start`/`lint` scripts.)

- [ ] **Step 3: Create the vitest config**

Create `apps/web/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: { environment: "node" },
  resolve: {
    // mirror tsconfig "@/*" -> "./*"
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
});
```

- [ ] **Step 4: Add a smoke test and verify the runner works**

Create `apps/web/lib/_smoke.test.ts`:
```ts
import { it, expect } from "vitest";

it("vitest runs", () => {
  expect(1 + 1).toBe(2);
});
```
Run:
```bash
pnpm --filter @coffer/web test
```
Expected: PASS (1 test passed).

- [ ] **Step 5: Delete the smoke test**

```bash
rm apps/web/lib/_smoke.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/vitest.config.ts pnpm-lock.yaml
git commit -m "chore(web): add vitest for unit tests"
```

---

## Task 2: Mainnet client + verified ENS constants

**Files:**
- Create: `apps/web/lib/ens-mainnet.ts`

- [ ] **Step 1: Create the client + constants module**

Create `apps/web/lib/ens-mainnet.ts`:
```ts
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

// Read-only mainnet ENS access. NOT wired to the wallet — writes/pooling stay on
// Sepolia via wagmi. Used server-side only, so the RPC endpoint is a server env
// (no NEXT_PUBLIC_). Public fallback works without config.
const MAINNET_RPC = process.env.MAINNET_RPC_URL || "https://ethereum-rpc.publicnode.com";

export const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(MAINNET_RPC),
});

// Verified on mainnet 2026-07-11 via eth_getCode + live reads:
//   controller.rentPrice("vitalik",1y) -> {base,premium}; registrar.nameExpires -> expiry;
//   feed.decimals() == 8. Source: docs.ens.domains/learn/deployments + on-chain checks.
export const ETH_REGISTRAR_CONTROLLER = "0x59E16fcCd424Cc24e280Be16E11Bcd56fb0CE547" as const;
export const BASE_REGISTRAR = "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85" as const;
export const CHAINLINK_ETH_USD = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419" as const;

export const controllerAbi = [
  {
    name: "rentPrice",
    stateMutability: "view",
    type: "function",
    inputs: [
      { name: "name", type: "string" },
      { name: "duration", type: "uint256" },
    ],
    outputs: [
      {
        name: "price",
        type: "tuple",
        components: [
          { name: "base", type: "uint256" },
          { name: "premium", type: "uint256" },
        ],
      },
    ],
  },
] as const;

export const registrarAbi = [
  {
    name: "nameExpires",
    stateMutability: "view",
    type: "function",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const chainlinkAbi = [
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

export const ONE_YEAR = 31_536_000n;
```

- [ ] **Step 2: Typecheck**

Run:
```bash
pnpm --filter @coffer/web exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/ens-mainnet.ts
git commit -m "feat(web): read-only mainnet ENS client + verified constants"
```

---

## Task 3: Pure logic — deriveStatus + weiToUsd (TDD)

**Files:**
- Create: `apps/web/lib/ens-name.ts`
- Test: `apps/web/lib/ens-name.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/ens-name.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { deriveStatus, weiToUsd } from "./ens-name";

const DAY = 86400;
const GRACE = 90 * DAY;
const PREMIUM = 21 * DAY;
const now = 1_000_000_000;

describe("deriveStatus", () => {
  it("active when expiry is in the future", () => {
    expect(deriveStatus(now + DAY, now)).toBe("active");
  });
  it("grace just after expiry", () => {
    expect(deriveStatus(now - DAY, now)).toBe("grace");
  });
  it("grace at the last second of the grace window", () => {
    expect(deriveStatus(now - GRACE + 1, now)).toBe("grace");
  });
  it("premium exactly when grace ends", () => {
    expect(deriveStatus(now - GRACE, now)).toBe("premium");
  });
  it("premium near the end of the premium window", () => {
    expect(deriveStatus(now - GRACE - PREMIUM + 1, now)).toBe("premium");
  });
  it("available once the premium window passes", () => {
    expect(deriveStatus(now - GRACE - PREMIUM, now)).toBe("available");
  });
  it("available for a never-registered name (expiry 0)", () => {
    expect(deriveStatus(0, now)).toBe("available");
  });
});

describe("weiToUsd", () => {
  it("converts 1 ETH at $2000", () => {
    expect(weiToUsd(10n ** 18n, 2000)).toBe(2000);
  });
  it("returns null when ethUsd is null", () => {
    expect(weiToUsd(10n ** 18n, null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
pnpm --filter @coffer/web test
```
Expected: FAIL — cannot import `deriveStatus`/`weiToUsd` from `./ens-name` (module/exports missing).

- [ ] **Step 3: Write the minimal implementation**

Create `apps/web/lib/ens-name.ts`:
```ts
import { normalize } from "viem/ens";
import { labelhash, formatEther } from "viem";
import {
  mainnetClient,
  ETH_REGISTRAR_CONTROLLER,
  BASE_REGISTRAR,
  CHAINLINK_ETH_USD,
  controllerAbi,
  registrarAbi,
  chainlinkAbi,
  ONE_YEAR,
} from "./ens-mainnet";

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

const DAY = 86400;
const GRACE = 90 * DAY;
const PREMIUM = 21 * DAY;

// Pure status derivation from expiry vs now (unix seconds). expiry === 0 (never
// registered) falls through to "available".
export function deriveStatus(expiry: number, now: number): "active" | "grace" | "premium" | "available" {
  if (expiry > now) return "active";
  if (now < expiry + GRACE) return "grace";
  if (now < expiry + GRACE + PREMIUM) return "premium";
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

// Read real mainnet ENS status + price for a label. Throws on RPC/multicall
// failure (the caller renders an error state). Returns a stub (no reads) for
// invalid or too-short labels.
export async function getEnsNameData(rawLabel: string): Promise<EnsNameData> {
  const stripped = rawLabel.replace(/\.eth$/i, "");
  let normalized: string;
  try {
    normalized = normalize(stripped);
  } catch {
    return stub(rawLabel, "", "invalid");
  }
  if (normalized.length < 3) return stub(rawLabel, normalized, "tooShort");

  const tokenId = BigInt(labelhash(normalized));
  const [price, expiryRaw, decimals, round] = await mainnetClient.multicall({
    allowFailure: false,
    contracts: [
      { address: ETH_REGISTRAR_CONTROLLER, abi: controllerAbi, functionName: "rentPrice", args: [normalized, ONE_YEAR] },
      { address: BASE_REGISTRAR, abi: registrarAbi, functionName: "nameExpires", args: [tokenId] },
      { address: CHAINLINK_ETH_USD, abi: chainlinkAbi, functionName: "decimals" },
      { address: CHAINLINK_ETH_USD, abi: chainlinkAbi, functionName: "latestRoundData" },
    ],
  });

  const expiry = Number(expiryRaw);
  const now = Math.floor(Date.now() / 1000);
  const status = deriveStatus(expiry, now);
  const baseWei = price.base;
  const premiumWei = price.premium;
  const ethUsd = Number(round[1]) / 10 ** Number(decimals);

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

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
pnpm --filter @coffer/web test
```
Expected: PASS — all `deriveStatus` + `weiToUsd` cases green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/ens-name.ts apps/web/lib/ens-name.test.ts
git commit -m "feat(web): ENS status derivation + live-price data loader"
```

---

## Task 4: Light mainnet integration test (guarded)

**Files:**
- Create: `apps/web/lib/ens-name.integration.test.ts`

- [ ] **Step 1: Write the guarded integration test**

Create `apps/web/lib/ens-name.integration.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { getEnsNameData } from "./ens-name";

// Only runs when a mainnet RPC is configured, to keep default `test` runs
// offline and deterministic (mirrors the contracts' guarded fork tests).
const maybe = process.env.MAINNET_RPC_URL ? describe : describe.skip;

maybe("getEnsNameData against mainnet", () => {
  it("flags a 2-char label as tooShort without any reads", async () => {
    const d = await getEnsNameData("ab");
    expect(d.status).toBe("tooShort");
  });

  it(
    "resolves a long-registered name as active with a live ETH/USD",
    async () => {
      const d = await getEnsNameData("vitalik");
      expect(d.status).toBe("active");
      expect(d.expiry).toBeGreaterThan(0);
      expect(d.ethUsd).not.toBeNull();
      expect(d.ethUsd as number).toBeGreaterThan(0);
    },
    20000,
  );
});
```

- [ ] **Step 2: Verify it is skipped by default**

Run:
```bash
pnpm --filter @coffer/web test
```
Expected: PASS overall; the integration `describe` is reported skipped (no `MAINNET_RPC_URL`).

- [ ] **Step 3: Verify it passes against mainnet**

Run:
```bash
MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com pnpm --filter @coffer/web test
```
Expected: PASS — the two integration cases run and pass (`vitalik` → active).

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/ens-name.integration.test.ts
git commit -m "test(web): guarded mainnet integration test for ENS name data"
```

---

## Task 5: Status-aware Name page

**Files:**
- Modify: `apps/web/app/name/[label]/page.tsx` (full replacement)

- [ ] **Step 1: Replace the Name page with the live, status-aware version**

Replace the entire contents of `apps/web/app/name/[label]/page.tsx` with:
```tsx
import Link from "next/link";
import DecayChart from "@/components/decay-chart";
import { usd } from "@/lib/data";
import { fmtEth, fmtCountdown } from "@/lib/format";
import { getEnsNameData, weiToUsd, type EnsNameData } from "@/lib/ens-name";

// Cache the rendered page ~60s per name (satisfies the spec's caching
// requirement): bounds mainnet RPC usage, and premium decay tolerates 60s
// staleness. HTML-level caching avoids the bigint-serialization problem that
// unstable_cache would hit on the wei fields.
export const revalidate = 60;

const DAY = 86400;
const GRACE = 90 * DAY;

function fmtUsdWei(wei: bigint, ethUsd: number | null): string {
  const v = weiToUsd(wei, ethUsd);
  return v === null ? "—" : usd(v);
}

function fmtDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const STATUS_TAG: Record<EnsNameData["status"], { text: string; cls: string }> = {
  active: { text: "Registered", cls: "tag-finalized" },
  grace: { text: "In grace period", cls: "tag-funding" },
  premium: { text: "In temporary premium", cls: "tag-premium" },
  available: { text: "Available", cls: "tag-cheap" },
  tooShort: { text: "Too short", cls: "tag-funding" },
  invalid: { text: "Invalid", cls: "tag-funding" },
};

function Shell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="wrap">
      <div className="crumb">
        <Link href="/">Discover</Link> <span>/</span> <span>{label}.eth</span>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ label, title, body }: { label: string; title: string; body: string }) {
  return (
    <Shell label={label}>
      <div className="empty">
        <span className="mark" aria-hidden />
        <h3>{title}</h3>
        <p>{body}</p>
        <Link className="btn btn-primary" href="/">
          Browse names in premium
        </Link>
      </div>
    </Shell>
  );
}

export default async function NamePage({ params }: { params: Promise<{ label: string }> }) {
  const { label } = await params;
  const raw = decodeURIComponent(label);

  let d: EnsNameData;
  try {
    d = await getEnsNameData(raw);
  } catch {
    return (
      <EmptyState
        label={raw.replace(/\.eth$/i, "")}
        title="Couldn’t load live price"
        body="We couldn’t reach mainnet ENS to read this name right now. Please try again in a moment."
      />
    );
  }

  const display = d.normalized || raw.replace(/\.eth$/i, "");

  if (d.status === "invalid") {
    return (
      <EmptyState
        label={display}
        title="Not a valid ENS name"
        body="That isn’t a registerable .eth label. Check the spelling and try again."
      />
    );
  }
  if (d.status === "tooShort") {
    return (
      <EmptyState
        label={display}
        title={`${display}.eth is too short to register`}
        body="ENS .eth names must be at least 3 characters. Try a longer name."
      />
    );
  }

  const tag = STATUS_TAG[d.status];

  // Non-buyable states (active / grace): show status, no buy box.
  if (!d.buyable) {
    const until = d.status === "active" ? d.expiry : d.expiry + GRACE;
    const body =
      d.status === "active"
        ? `This name is registered until ${fmtDate(until)}. It isn’t available to buy — it would need to expire and pass its 90-day grace period first.`
        : `This name expired and is in its 90-day grace period until ${fmtDate(until)}. The current owner can still renew it, so it can’t be pooled yet. If it isn’t renewed, it enters the 21-day premium auction after that.`;
    return (
      <Shell label={display}>
        <div className="page-head">
          <div>
            <div className="row" style={{ gap: 14 }}>
              <h1 style={{ fontSize: 46, margin: 0 }}>
                {display}
                <span style={{ color: "var(--faint)", fontWeight: 400 }}>.eth</span>
              </h1>
              <span className={`tag ${tag.cls}`}>{tag.text}</span>
            </div>
            <p>
              {d.letters} letters · {d.status === "active" ? "registered" : "in grace period"}
            </p>
          </div>
          <div className="row">
            <Link className="btn btn-ghost" href="/">
              ← Discover
            </Link>
          </div>
        </div>
        <div className="panel">
          <span className="panel-title">Status</span>
          <p className="muted" style={{ fontSize: 15 }}>
            {body}
          </p>
        </div>
      </Shell>
    );
  }

  // Buyable states (premium / available).
  const nowSec = Math.floor(Date.now() / 1000);
  const premiumEndsAt = d.expiry + GRACE + 21 * DAY;
  const dayIntoPremium = d.status === "premium" ? Math.min(21, Math.max(0, Math.floor((nowSec - (d.expiry + GRACE)) / DAY))) : 0;

  return (
    <Shell label={display}>
      <div className="page-head">
        <div>
          <div className="row" style={{ gap: 14 }}>
            <h1 style={{ fontSize: 46, margin: 0 }}>
              {display}
              <span style={{ color: "var(--faint)", fontWeight: 400 }}>.eth</span>
            </h1>
            <span className={`tag ${tag.cls}`}>{tag.text}</span>
          </div>
          <p>
            {d.letters} letters · {d.status === "premium" ? "in the 21-day premium auction" : "available at base price"}
          </p>
        </div>
        <div className="row">
          <Link className="btn btn-ghost" href="/">
            ← Discover
          </Link>
          <Link className="btn btn-primary" href={`/pools/new?label=${display}`}>
            Start a pool to buy
          </Link>
        </div>
      </div>

      <div className="cols">
        <div className="stack">
          <div className="panel">
            <div className="spread" style={{ marginBottom: 14 }}>
              <span className="panel-title" style={{ margin: 0 }}>
                Premium price decay
              </span>
              {d.status === "premium" ? (
                <span className="tag tag-premium">NOW · DAY {dayIntoPremium}</span>
              ) : (
                <span className="tag tag-cheap">No premium</span>
              )}
            </div>
            <DecayChart nowDay={dayIntoPremium} showMarker={d.status === "premium"} />
            <div className="axis">
              <span>Day 0</span>
              <span>Day 7</span>
              <span>Day 14</span>
              <span>Day 21 · $0</span>
            </div>
            <div className="note note-info mt-16">
              <span>ℹ</span>
              <span>
                The premium starts near $100M and halves every day until it reaches $0 at day 21, added on top of the
                standard fee. The headline price is a live on-chain <span className="mono">rentPrice</span> read.
              </span>
            </div>
          </div>

          <div className="panel">
            <span className="panel-title">Name details</span>
            <div>
              <div className="kv">
                <span className="k">Length</span>
                <span className="v">{d.letters} characters</span>
              </div>
              <div className="kv">
                <span className="k">Status</span>
                <span className="v">{tag.text}</span>
              </div>
              {d.expiry > 0 && (
                <div className="kv">
                  <span className="k">Released after</span>
                  <span className="v">{fmtDate(d.expiry + GRACE)}</span>
                </div>
              )}
              <div className="kv">
                <span className="k">Registrar</span>
                <span className="v">.eth</span>
              </div>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="panel">
            <span className="panel-title">Register for 1 year</span>
            <div className="kv">
              <span className="k">Registration (1 yr)</span>
              <span className="v">{fmtUsdWei(d.baseWei, d.ethUsd)}</span>
            </div>
            <div className="kv">
              <span className="k">Temporary premium</span>
              <span className="v">{fmtUsdWei(d.premiumWei, d.ethUsd)}</span>
            </div>
            <div className="kv">
              <span className="k">Total to buy now</span>
              <span className="v big accent">{fmtUsdWei(d.totalWei, d.ethUsd)}</span>
            </div>
            <div className="progress-label" style={{ marginTop: 6 }}>
              <span>≈ {fmtEth(d.totalWei, 3)}</span>
              {d.status === "premium" && <span>premium gone in {fmtCountdown(premiumEndsAt)}</span>}
            </div>
            <Link className="btn btn-primary btn-block btn-lg mt-16" href={`/pools/new?label=${display}`}>
              Start a pool to buy together
            </Link>
          </div>

          <div className="panel">
            <span className="panel-title">Pools</span>
            <p className="muted" style={{ fontSize: 14, marginTop: -4 }}>
              Start a pool for {display}.eth and invite people, or browse every open pool on the escrow.
            </p>
            <div className="row mt-8" style={{ gap: 8 }}>
              <Link className="btn btn-primary btn-sm" href={`/pools/new?label=${display}`}>
                Start a pool
              </Link>
              <Link className="btn btn-ghost btn-sm" href="/pools">
                All pools →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
pnpm --filter @coffer/web exec tsc --noEmit
```
Expected: no errors. (Note: `getName`, `usdToEth`, `eth`, `AddressLabel` are no longer imported here — confirm no leftover references.)

- [ ] **Step 3: Manually verify the page renders live data**

Ensure the dev server is running (`pnpm --filter @coffer/web dev`), then check a few statuses:
```bash
# active (registered): expect "Registered" tag, no buy box
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/name/vitalik
# available (long word unlikely registered): expect "Available" tag + base price
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/name/thisnameisprobablyfree12345
# too short: expect "too short" empty state
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/name/ab
```
Expected: all `200`. Then open `http://localhost:3000/name/vitalik` in a browser and confirm: "Registered" status tag, a real "Released after" date, and NO buy box. Confirm `http://localhost:3000/name/ab` shows the "too short" state. (Finding a live `premium` name is opportunistic — the logic is unit-tested; any name in the 90–111-day-post-expiry window will render the buy box with a live premium.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/name/[label]/page.tsx
git commit -m "feat(web): live ENS status + price on the Name page"
```

---

## Task 6: Document the mainnet RPC env

**Files:**
- Modify: `apps/web/.env.local` (local only, gitignored — do NOT commit secrets)

- [ ] **Step 1: Add the optional mainnet RPC var locally**

Append to `apps/web/.env.local` (create the line if absent). A dedicated mainnet RPC (e.g. Alchemy/Infura) avoids public-RPC rate limits; the public fallback in `ens-mainnet.ts` works without it:
```
# Read-only mainnet RPC for live ENS pricing (Phase 3a). Optional — public fallback used if unset.
MAINNET_RPC_URL=
```

- [ ] **Step 2: Verify the app still runs with the var present but empty**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/name/vitalik
```
Expected: `200` (empty value → falls back to the public RPC).

- [ ] **Step 3: No commit**

`.env.local` is gitignored. Nothing to commit for this task. (If a team-facing `.env.example` exists later, add `MAINNET_RPC_URL=` there instead.)

---

## Task 7: Full verification pass

- [ ] **Step 1: Run the unit + integration tests**

```bash
MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com pnpm --filter @coffer/web test
```
Expected: all tests PASS (unit + the two integration cases).

- [ ] **Step 2: Typecheck + production build**

Stop the dev server first (shared `.next` corruption otherwise), then:
```bash
pnpm --filter @coffer/web exec tsc --noEmit && pnpm --filter @coffer/web build
```
Expected: typecheck clean; build succeeds.

- [ ] **Step 3: Final commit if any build fixups were needed**

```bash
git add -A
git commit -m "chore(web): verification fixups for live ENS pricing" || echo "nothing to commit"
```

---

## Notes for the implementer

- **Do not touch** the Sepolia wagmi config, the pool lifecycle pages, or the Discover home grid — all out of scope for 3a.
- The mainnet client is **read-only and server-side**. Never import `ens-name.ts`/`ens-mainnet.ts` into a client component (`"use client"`), or the mainnet RPC URL/logic leaks into the bundle and reads run in the browser.
- `deriveStatus` and `weiToUsd` are pure — keep all time/RPC dependencies out of them so they stay unit-testable.
- Reuse existing helpers (`usd` from `lib/data`, `fmtEth`/`fmtCountdown` from `lib/format`, `DecayChart`) rather than reimplementing.
