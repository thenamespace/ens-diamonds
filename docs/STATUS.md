# Coffer — Status & Handoff

_Last updated: 2026-07-13. Living doc — update as things change._

## TL;DR

**Coffer** lets people pool ETH to buy premium ENS names together (or buy solo).
The whole app is **live on Sepolia testnet** and deployed on Vercel. Everything
below is committed and pushed to `main` (tip `5aaac05`, in sync with origin).

- **Live app:** https://coffer-web-delta.vercel.app
- **Local dev:** `cd apps/web && pnpm dev` → http://localhost:3000
- **Status:** stable, in friends-testing. Nothing holding real funds — testnet only.

---

## On-chain (Sepolia)

| Thing | Address / value |
|---|---|
| **CofferEscrow (current)** | `0x5229b09a1f1EC16E69545bAE19E3b2A453a3Ae39` |
| Deploy block | `11258818` (`ESCROW_DEPLOY_BLOCK` in `apps/web/lib/chain.ts`) |
| `EXECUTION_WINDOW` | **24h** (was 7d) |
| `MIN_CONTRIBUTION` | 0.01 ETH |
| ENS ETHRegistrarController | `0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968` |
| ENS PublicResolver | `0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5` |
| Safe v1.4.1 factory/singleton/handler | in `packages/contracts/.env` (verified on-chain) |

The escrow address is baked into `lib/chain.ts` as `DEFAULT_ESCROW`. Vercel has
**no** `NEXT_PUBLIC_ESCROW_ADDRESS` override, so the live site uses this default.
Prior escrows (superseded): `0xa356c3…` (7-day window), `0x4D47f7…`, `0xb35B…`.

**Prices/names are live MAINNET ENS data; all transactions run on SEPOLIA.**
So premium names show real ~$50M day-0 prices; the affordable ones are deep in
the "Ending soon" tab. Testers need free Sepolia ETH.

---

## How the app works (the important mental model)

A pool moves: **Funding → Funded → Finalized → name registered.** Nothing is
automatic — every step is a button someone presses.

1. **Funding** — invited members deposit toward a target. Withdraw anytime.
2. **Funded** — the moment deposits hit target, a **24h lock** starts (no
   withdrawals) so the group can execute. If nobody finalizes in 24h, it
   reverts to Funding (withdrawable again).
3. **Finalize** — any contributor clicks it → one tx **deploys the group's Safe
   multisig (owners = contributors, threshold = majority N/2+1) and moves 100%
   of pooled ETH into it.**
4. **Register the name** — on the finalized pool page, the group buys the name
   **through Coffer's UI** (not app.safe.global): ENS commit → wait ~60s →
   collect majority owner signatures in-app → Safe `execTransaction` pays for
   and registers the name. The Safe now owns it.

**Safety:** deposits are refundable/withdrawable at every stage except the 24h
post-funding lock (which itself auto-reopens). After finalize, funds live in a
multisig the contributors control together. The contract is blind to ENS, so
there's no auto-refund if a name is sniped — you just don't finalize (withdraw
instead), or move funds via the Safe if already finalized.

Pools are **bound to one specific name** (target derived from that name's price;
clear per-name ownership; no governance). Trade-off: inflexible if the name is
lost. A "guild / shared treasury" model was discussed and **deferred** — see
Open Decisions.

---

## Done this session (2026-07-12 → 13)

**Discover overhaul** (`01292e1`)
- Shows the **entire premium set (~23k names)**, infinite scroll 24/batch, across
  4 tabs: **Newest, Trending, Ending soon, Shortest**.
- **Trending** ranks by live watcher counts (`watchers:z` ZSET in `lib/watchlist.ts`).
- Perf: Newest/Ending paginate straight from the subgraph (one request/batch,
  ~0.2s); Shortest/Trending order the full label set, cached 5m (`unstable_cache`),
  shared across users/tabs.
- **Search hits the ENTIRE premium set server-side** (debounced, ranked
  prefix-first, paginated) via `/api/discover?q=` — not just loaded names.
- Card ⇄ list **view toggle** (persisted in localStorage), left of search.
- **Skeleton shimmer cards + pulsing-dot spinner** while loading/searching.

**Card + UI polish** (`01292e1`)
- Card: ETH value under the dollar price; countdown moved to a bottom footer
  pinned to the card base; long names wrap instead of overflowing.
- **Eye** watch icon (filled pupil = watching) instead of a star.
- Name-page CTA → **"Buy now (pay solo)"**.

**Contract** (`c469e31`)
- `EXECUTION_WINDOW` 7d → **24h**. Redeployed escrow to Sepolia
  (`0x5229b0…`). 41 Foundry tests + invariants pass.

**Portfolio** (`128be64`, `5aaac05`)
- **Co-owners list** per owned name: every funder's ENS name/handle + address,
  contribution, and an ownership-share bar with %. "You" badged.
- **Transfer name** + **Sell name** CTAs added (UI placeholders, not wired).

---

## Architecture map (key files)

**Discover / search**
- `apps/web/app/page.tsx` — Discover page (SSR batch 0)
- `apps/web/components/discover-grid.tsx` — client feed: tabs, infinite scroll,
  search, view toggle, skeletons, `NameCard`/`NameRow`
- `apps/web/lib/discover-feed.ts` — `getDiscoverPage(sort,offset)` +
  `searchDiscoverPage(q,offset)` (server-only)
- `apps/web/lib/ens-premium.ts` — `getAllPremiumLabels` (cached full set),
  `getPremiumLabelsPage` (fast paginated), `priceLabels`
- `apps/web/app/api/discover/route.ts` — batch endpoint (browse + search)
- `apps/web/lib/discover-sort.ts` — sort tab defs

**Watchlist / auth**
- `apps/web/lib/watchlist.ts` (+ `watchers:z` trending ZSET), `hooks/use-watching.ts`,
  `components/watch-button.tsx` (eye icon), `app/api/watching`, SIWE auth in
  `app/api/auth/*` + `lib/session.ts`

**Pools / registration**
- `apps/web/app/pools/*` — list, create, detail
- `apps/web/components/pool-register.tsx` — in-app buy flow (commit → sign → execute)
- `apps/web/lib/safe.ts`, `lib/pool-registration.ts`, `app/api/pools/registration/*`
- `apps/web/lib/sepolia-client.ts` — server-side Sepolia reads

**Portfolio**
- `apps/web/app/portfolio/page.tsx` — **still on seed data** (`lib/data.ts`);
  co-owners list + Renew/Transfer/Sell placeholders live here

**Contract**
- `packages/contracts/src/CofferEscrow.sol`, `test/CofferEscrow.t.sol`,
  `script/Deploy.s.sol`
- Audit: `docs/security/2026-07-12-cofferescrow-audit.md`

---

## Resume locally

```bash
# from repo root
cd apps/web && pnpm dev            # http://localhost:3000

# checks
cd apps/web && pnpm exec tsc --noEmit
cd apps/web && pnpm test           # vitest
cd packages/contracts && forge test

# IMPORTANT: never run `next build` while `next dev` is running —
# they share .next and it corrupts the dev server (500s). Stop dev first.
```

**Deploy is automatic:** push to `main` → Vercel builds & deploys.

---

## Environment / secrets (gitignored — never commit)

- `apps/web/.env.local` — `NEXT_PUBLIC_*`, `GRAPH_API_KEY`, Upstash
  `KV_REST_API_URL/TOKEN`, `SESSION_SECRET`, `MAINNET_RPC_URL` (Alchemy)
- `packages/contracts/.env` — `SEPOLIA_RPC_URL`, throwaway testnet
  `DEPLOYER_PRIVATE_KEY` (addr `0x3aCb…Dc248`), Safe addresses, `ESCROW_ADDRESS`
- Vercel project `coffer-web` (org `thecaphimselfs-projects`): same vars set for
  Production + Preview. No `NEXT_PUBLIC_ESCROW_ADDRESS` (code default is used).

---

## What's next / open decisions

**Open product decisions**
- **Guild / shared-treasury model** (one persistent Safe, deposit anytime, buy
  many names) vs the current **one-Safe-per-name** model. Full pros/cons analysis
  done; **deferred**. If pursued, needs share accounting + governance + exit
  mechanics (a bigger build). Natural first step: let an existing Safe buy
  additional names.
- **Transfer / Sell name** — buttons exist, functionality TBD. Both are Safe
  multisig actions (majority sign). "Sell" also needs a venue decision
  (ENS marketplace listing vs direct offer).

**Engineering backlog**
- Portfolio is **still on seed data** (`lib/data.ts`) — wire it to real on-chain
  ownership (finalized pools where the wallet contributed; read Safe owners +
  `getContributors` for the co-owners list).
- End-to-end **wallet test** of the pool → Safe registration flow (built + read
  paths verified; not fully exercised with real wallets/signatures).
- Trending could later fold in on-chain pool counts + view counts.
- Silence the harmless `Can't resolve 'ethers'` dev warning from
  `@signinwithethereum/siwe`.

**Before any mainnet move (gated)**
- Professional third-party audit of CofferEscrow (internal audit done; not a
  substitute for real funds).
- Mainnet migration: env-drive the chain (wagmi chain → mainnet, ENS
  controller/resolver → mainnet addresses, Safe v1.4.1 mainnet addresses, deploy
  escrow to mainnet). See `[[sepolia-first-rule]]`.

---

## Known caveats

- Newest/Ending tabs paginate via subgraph `skip` (capped at 5000) → those two
  tabs scroll ~5k names deep before "end"; Shortest/Trending show the full set.
- First click on a cold Trending/Shortest tab (or first search) after the 5-min
  cache expires does the full ~23k label scan (~10s), shown behind skeletons;
  instant after that for everyone.
- Occasional Newest/Ending batch shows slightly <24 cards (client-side filtering
  of a subgraph page) — intentional, keeps pagination from skipping/duplicating.
