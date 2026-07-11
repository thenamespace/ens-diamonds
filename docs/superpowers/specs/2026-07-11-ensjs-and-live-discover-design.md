# ensjs data layer + live Discover feed — design

**Date:** 2026-07-11
**Status:** Approved design, pre-implementation
**Depends on / supersedes parts of:** `2026-07-11-live-ens-pricing-design.md` (Phase 3a). This retrofits 3a's
hand-rolled reads onto ensjs and adds the live Discover feed (3b).

## 1. Goal & decisions

Adopt the official **@ensdomains/ensjs** (v4.3.1, viem peer `^2.35.0` — compatible with our viem 2.55) as the
ENS **data layer**, and make the **Discover home grid** show real names currently in temporary premium.

Locked decisions (user, 2026-07-11):
- **ensjs for the ENS data layer** (pricing/status/enumeration). **Keep resolvio** for reverse-name + avatar
  resolution (already merged, working) — out of scope here.
- **Retrofit 3a** to ensjs now (don't leave two read styles).
- Discover reads **mainnet** (premium names are a mainnet phenomenon); pooling/writes stay **Sepolia**
  (Sepolia-first rule). Read chain and write chain are separate clients.
- **Drop the fake card footer** ("N pools forming · N watching") — no real source yet — and show real
  premium-progress instead (day X/21 + time left).
- Secrets: `MAINNET_RPC_URL` and `GRAPH_API_KEY` live in `.env.local` (gitignored). **Never commit the key.**

## 2. Verified facts (from ensjs source / npm / live spike, 2026-07-11)

- `getPrice(client, { nameOrNames, duration })` → `{ base: bigint, premium: bigint }`. Accepts a **single name
  or an array** → batch-price the whole Discover list in one call. From `@ensdomains/ensjs/public`.
- `getExpiry(client, { name })` → `{ expiry: DateWithValue<bigint>, gracePeriod: number, status: 'active'|'expired'|'gracePeriod' }`.
  `expiry.value` is the unix bigint; `gracePeriod` is seconds (real, not hardcoded). From `@ensdomains/ensjs/public`.
- Client: `createPublicClient({ chain: addEnsContracts(mainnet, { subgraphApiKey }), transport: http(MAINNET_RPC_URL) })`.
  `addEnsContracts` from `@ensdomains/ensjs/contracts`. getPrice/getExpiry need `.eth`-suffixed **full names**.
- ensjs status only distinguishes active/gracePeriod/expired — it does **not** model the 21-day temporary
  premium. We keep our own `deriveStatus` to split `expired` into `premium` vs `available`.
- Mainnet ENS subgraph (decentralized network) gateway URL:
  `https://gateway-arbitrum.network.thegraph.com/api/<GRAPH_API_KEY>/subgraphs/id/5XqPmWe6gjyrJtFn9cLy237i4cWw2j9HcUJEXsP5qGtH`.
  A `registrations(where: { expiryDate_gte, expiryDate_lte })` query returns real names in premium — **spike
  confirmed** 10 live results (e.g. gigaargentina.eth, qwhale.eth).

## 3. Part 1 — Retrofit 3a to ensjs

### Files
- **Add dep:** `@ensdomains/ensjs`.
- **Replace `lib/ens-mainnet.ts` → `lib/ens-client.ts`:** the read-only mainnet viem client wrapped with
  `addEnsContracts(mainnet, { subgraphApiKey: process.env.GRAPH_API_KEY })` over `http(MAINNET_RPC_URL)`. Keep the
  Chainlink ETH/USD address + minimal ABI + a `getEthUsd(client): Promise<number | null>` helper here (ensjs has
  no USD). Drop the hand-rolled `controllerAbi`/`registrarAbi`/`ONE_YEAR` (ensjs owns those now; keep a
  `ONE_YEAR` duration constant).
- **`lib/ens-name.ts`:** `getEnsNameData` uses `getPrice` (base/premium) + `getExpiry` (expiry.value +
  gracePeriod) + `getEthUsd`. `deriveStatus` gains a `gracePeriod` parameter (default 90d so existing tests pass)
  and is fed ensjs's real gracePeriod. Keep `weiToUsd`, `EnsNameData`, the status model, the invalid/tooShort
  short-circuits, and the Chainlink-degradation (`ethUsd: null` on oracle failure). The core ENS reads
  (getPrice + getExpiry) still throw → page error state.
- **`app/name/[label]/page.tsx`:** unchanged (consumes `getEnsNameData`).
- **Tests:** `deriveStatus` unit tests unchanged (default gracePeriod). Add one test that a custom gracePeriod
  shifts the grace/premium boundary. Integration test unchanged in intent (now runs through ensjs).

### Status derivation (unchanged model)
`deriveStatus(expiry, now, gracePeriod)`: active if `expiry > now`; grace if `now < expiry + gracePeriod`;
premium if `now < expiry + gracePeriod + 21d`; else available. `expiry === 0` → available.

## 4. Part 2 — Live Discover feed (3b)

### Files
- **New `lib/ens-premium.ts`:**
  - `PREMIUM_SUBGRAPH_URL` built from `GRAPH_API_KEY` + the mainnet subgraph id (§2).
  - `getPremiumNames(limit = 24): Promise<PremiumEntry[]>`:
    1. GraphQL `registrations(first: limit, orderBy: expiryDate, orderDirection: desc, where: { expiryDate_gte: now-111d, expiryDate_lte: now-90d, labelName_not: null })` → `{ labelName, expiryDate }[]` (plain `fetch`, server-side).
    2. Batch-price via `getPrice(ensClient, { nameOrNames: labels.map(l => l+'.eth'), duration: ONE_YEAR })`.
    3. One `getEthUsd(ensClient)` for USD.
    4. Map each to a `PremiumEntry`: `{ label, letters, totalWei, premiumWei, baseWei, ethUsd, dayIntoPremium (0–21), premiumEndsAt (unix) }`. Derive `dayIntoPremium` and time-left from `expiryDate + gracePeriod`.
  - Cached ~60s (module-level via the page's `revalidate`, see below).
- **`app/page.tsx`:** becomes a **server component** that calls `getPremiumNames()` and renders a header + the
  grid. `export const revalidate = 60`. On subgraph/RPC failure → a friendly "couldn't load live names" state
  (never crash).
- **New `components/discover-grid.tsx` (`"use client"`):** receives `PremiumEntry[]`, owns the sort tabs and
  renders the cards. Sorts operate on real fields: **Ending soon** (soonest `premiumEndsAt`), **Cheapest**
  (`totalWei` asc), **Shortest** (`letters` asc), and **Newest** (highest `expiryDate` = most recently released)
  — replacing the old fake "Trending" tab (no watch data to back it).
- **Card:** the `NameCard` (currently defined inline in `app/page.tsx`) moves into `components/discover-grid.tsx`
  alongside the grid that renders it (its only consumer), keeping the redesigned look (gradient monogram,
  countdown pill, price). Footer changes: **remove** "N pools forming · N watching"; **show** "day X/21 of
  premium" and the live price. Countdown pill shows time until premium ends. `usd()` from `lib/data` stays for
  formatting.
- **`lib/data.ts`:** Discover no longer imports `NAMES`. `data.ts` remains for the still-seeded pages
  (portfolio `POOLS`) and the `usd`/`eth` helpers. Do not delete it.

### PremiumEntry type
```
{ label: string; letters: number; baseWei: bigint; premiumWei: bigint; totalWei: bigint;
  ethUsd: number | null; expiryDate: number; premiumEndsAt: number; dayIntoPremium: number }
```

## 5. Data flow & boundaries

- All mainnet reads (ensjs + Chainlink + subgraph) run **server-side** in server components / `lib/*` modules.
  `lib/ens-client.ts`, `lib/ens-name.ts`, `lib/ens-premium.ts` must **never** be imported by a `"use client"`
  file (keeps `MAINNET_RPC_URL`/`GRAPH_API_KEY` and read logic out of the browser bundle). The only client
  component added, `discover-grid.tsx`, receives already-fetched plain data as props.
- Wallet/wagmi (Sepolia) is untouched; the ensjs mainnet client is read-only and separate.

## 6. Error handling

- Name page: getPrice/getExpiry failure → existing "Couldn't load live price" state; Chainlink failure →
  ETH-only (`ethUsd: null`).
- Discover: subgraph or pricing failure → "Couldn't load live names, try again" state; never crash. Names the
  batch price can't resolve are skipped, not fatal.
- Labels the subgraph returns that fail ENS normalization are filtered out before pricing.

## 7. Testing

- **Unit:** `deriveStatus` (existing + a custom-gracePeriod case); `weiToUsd` (existing); a pure helper that
  computes `dayIntoPremium`/`premiumEndsAt` from `expiryDate + gracePeriod` (fixed timestamps, boundaries 0 and
  21).
- **Integration (guarded by `MAINNET_RPC_URL`, + `GRAPH_API_KEY` for the subgraph one):**
  - `getEnsNameData("vitalik")` → active, expiry > 0, ethUsd not null (now via ensjs).
  - `getPremiumNames()` → returns ≥1 entry with a valid label, `totalWei ≥ 0`, `dayIntoPremium` in 0–21.
  Both skip cleanly when the env vars are absent (mirrors the existing guarded pattern).

## 8. Out of scope

- Replacing resolvio (name/avatar stays on resolvio).
- Real per-name pool counts / watcher counts (needs the CofferEscrow indexer — later phase).
- The Execute/registration flow (later; ensjs `commitName`/`registerName` will be adopted there).
- Pushing/deploying — remains a separate, user-authorized step. Mainnet still gated by fork tests + audit.

## 9. Rules honored

- **prefer-established-libraries:** ensjs is the official ENS lib.
- **ethskills MO:** ensjs API, version/peers, gateway URL, and the enumeration query were all verified from
  source/npm/live spike — not memory.
- **Sepolia-first:** only reads hit mainnet; writes stay Sepolia; two-domain plan unaffected.
- **No secrets in git:** `GRAPH_API_KEY` / `MAINNET_RPC_URL` via gitignored env only.
