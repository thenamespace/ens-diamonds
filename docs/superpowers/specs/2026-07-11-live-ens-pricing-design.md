# Phase 3a — Live ENS pricing & status (Name page + search)

**Date:** 2026-07-11
**Status:** Approved design, pre-implementation
**Scope:** Make the Name page (`/name/[label]`) and "search any name" show **real** mainnet ENS
status and live price, replacing the `lib/data.ts` seed lookup. The Discover home grid stays on
seed data — the live "in premium now" feed is a separate later cycle (**Phase 3b**, ENS-subgraph
backed, needs a Graph API key).

## 1. Context & motivation

Coffer pools ETH to buy premium (recently-released) `.eth` names. Today the browse experience is
fake: `apps/web/lib/data.ts` supplies ~10 hardcoded names with invented prices/stats. The pool
lifecycle is real on Sepolia, but you can't look up a real name or see its real price.

Premium names are a **mainnet** phenomenon (Sepolia is a testnet with no meaningful premium
stream). Per the project's Sepolia-first rule, **writes/pooling stay on Sepolia**; only **read-only
discovery/pricing reads mainnet**. This matches the eventual mainnet version 1:1 — when we ship the
mainnet deployment, the read chain and write chain simply become the same.

## 2. ENS name lifecycle (the status model)

A `.eth` second-level name moves through these states after registration. Let `E` = expiry
timestamp, `G` = 90-day grace, `P` = 21-day temporary-premium window.

| Status      | Condition                          | Buyable? | Price shown                     |
|-------------|------------------------------------|----------|---------------------------------|
| `active`    | `now < E`                          | No       | "Registered until <date>"       |
| `grace`     | `E ≤ now < E + G`                  | No       | "In grace period until <date>"  |
| `premium`   | `E + G ≤ now < E + G + P`          | Yes      | Live total = base + premium     |
| `available` | `now ≥ E + G + P`                  | Yes      | Base price (premium = 0)        |

Never-registered labels resolve as `available` (base price, premium 0).

The 21-day temporary premium is a Dutch auction: premium starts high (~$100M-equivalent) and decays
to ~0 over 21 days, added on top of the base registration fee. We do **not** re-derive the decay
curve off-chain — `rentPrice` returns the authoritative live value.

## 3. On-chain reads (mainnet, read-only)

All reads target Ethereum **mainnet** via a standalone viem public client — **not** wired to the
wallet/wagmi (which stays Sepolia-only). Reads run **server-side** (the Name page is already an
async server component), so the RPC endpoint stays server-side and results are cached.

Per label, one multicall batches:

1. `ETHRegistrarController.rentPrice(string name, uint256 duration)` → `IPriceOracle.Price { uint256 base; uint256 premium; }`
   - `duration` = 1 year (`31_536_000` seconds).
2. `BaseRegistrarImplementation.nameExpires(uint256 tokenId)` → `uint256` expiry
   - `tokenId = uint256(keccak256(bytes(label)))` (the label, not the full name).
3. `ETHRegistrarController.available(string name)` → `bool`
4. Chainlink **ETH/USD** feed `latestRoundData()` → for USD conversion (real, on-chain).

**Addresses & the rentPrice ABI must be confirmed against mainnet at implementation time, not taken
from model memory** (per the ethskills MO). The canonical ENS mainnet controller/registrar
addresses and the current `IPriceOracle.Price` shape are resolved from ENS docs / Etherscan during
implementation and pinned in code with a comment citing the source.

**Config:** `MAINNET_RPC_URL` (server-only env; public fallback e.g. a public mainnet RPC). No
`NEXT_PUBLIC_` exposure needed since reads are server-side.

**Caching:** wrap the per-label read in a cached server function with ~60s revalidation. Premium
decays continuously but 60s granularity is fine and bounds RPC usage.

**Normalization:** normalize the label with ENS UTS-46 normalization (`normalize` from `viem/ens`)
before hashing/reads; reject labels that fail normalization with a clear message.

## 4. Components & data flow

- **`lib/ens-mainnet.ts`** (new): the standalone mainnet viem public client + ENS contract
  addresses/ABIs. One clear purpose: read-only mainnet ENS access. No wallet, no writes.
- **`lib/ens-name.ts`** (new): `getEnsNameData(label): Promise<EnsNameData | { error }>` — normalizes,
  runs the multicall, derives status, returns a typed struct. Pure-ish orchestration over the client;
  the status-derivation math is a separate exported pure function `deriveStatus(expiry, now, available)`
  so it can be unit-tested with fixed timestamps.
- **`EnsNameData` type:**
  ```
  { label, normalized, letters, status, expiry (unix, 0 if never registered),
    baseWei, premiumWei, totalWei, ethUsd, buyable }
  ```
- **`app/name/[label]/page.tsx`:** stop calling `getName()` seed lookup; call `getEnsNameData()`.
  Render real status + price. Replace the hard "isn't in premium right now" empty state with a
  status-aware view. Pool CTA (`Start a pool to buy`) enabled only when `buyable` (premium or
  available); otherwise shown disabled with the reason.
- **Search:** unchanged — `SearchBar` already routes to `/name/[label]`, so a real Name page makes
  search real automatically.

## 5. UI specifics

- **Price:** USD-primary (matches current UI), computed from `totalWei × ethUsd`. ETH shown
  secondary. For `active`/`grace`, show status text instead of a buy price.
- **Dropped in 3a** (need historical/subgraph data → 3b): `firstRegistered`, `prevOwner`, and the
  invented `poolsForming` / `watching` stats. `letters` = `normalized.length`.
- **Decay chart:** keep (illustrative). Set the "now" marker from real days-into-premium when in
  `premium`; hide/neutralize it for other statuses.
- **Discover home + card component:** untouched this phase (still seed data).

## 6. Error handling

- Invalid/unnormalizable label → friendly "not a valid ENS name" state, no reads.
- Labels shorter than 3 characters are not registrable on ENS (`rentPrice`/`available` may revert) →
  detect length pre-read and show a "too short to register" state without calling the chain.
- RPC/multicall failure → graceful "couldn't load live price, try again" state; never crash the page.
- Chainlink read failure → fall back to ETH-only display (skip USD) rather than failing the page.

## 7. Testing

- **Unit:** `deriveStatus()` across all four states with fixed `now`/`expiry` boundaries
  (off-by-one at grace end and premium end).
- **Unit:** USD conversion + wei formatting.
- **Integration (light):** read 2–3 known mainnet labels through `getEnsNameData` against a real
  mainnet RPC and assert plausible shape (status enum valid, wei ≥ 0). Guarded so it no-ops without
  `MAINNET_RPC_URL` (like the existing fork-test pattern).

## 8. Out of scope (explicitly)

- Discover "in premium now" live feed (Phase 3b — ENS subgraph + Graph API key).
- Historical fields (`firstRegistered`, `prevOwner`), pool counts, watcher counts.
- Any change to the Sepolia pool lifecycle / writes.
- The Execute / registration flow (later phase).

## 9. Non-negotiable rules honored

- **Sepolia-first:** writes stay on Sepolia; only read-only pricing reads mainnet. Two-domain plan
  unaffected — the mainnet version just points both read+write at mainnet.
- **ethskills MO:** ENS addresses, `rentPrice` ABI, and the decay behavior are confirmed live at
  implementation time, not from memory.
- **No secrets in git:** `MAINNET_RPC_URL` via env only.
