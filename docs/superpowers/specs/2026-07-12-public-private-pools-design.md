# Public / private pools — design

**Date:** 2026-07-12
**Status:** Approved design, pre-implementation
**Builds on:** the watchlist infra (SIWE + iron-session + Upstash), now live.

## 1. Goal & decisions

Let a pool creator mark a pool **public** or **private** at creation. Public pools are listed on
`/pools` for everyone; private pools are hidden from non-members. This is a **visibility/discoverability**
feature only.

Locked decisions (user, 2026-07-12):
- **"Public" = publicly *visible*, not publicly *joinable***. The CofferEscrow contract is invite-only for
  deposits (`deposit()` reverts `NotInvited`), and we are **NOT** changing the contract. Joining any pool still
  requires the creator to invite the address on-chain. (Open-join public pools = a future contract change.)
- **Visibility is off-chain**, in the existing Upstash store. Only a hidden/not-hidden bit leaves — no pool
  data. **Absence of a record = public.** Only private pools get a record.
- **Only the creator** can set a pool's visibility — enforced by SIWE session + a server-side on-chain check
  that `session.address == pools(poolId).creator`.
- **Membership (for showing a private pool to its members) is read on-chain**: the viewer sees a private pool
  iff they are its `creator` or `invited(poolId, viewer) == true` (both already readable). No off-chain member
  list.
- **Legacy pools** (created before this feature, e.g. demo pool #0) have no record → treated as **public**
  (unchanged behavior).

## 2. Verified facts (from code, 2026-07-12)

- `Pool` struct (`CofferEscrow.sol:20-29`) has **no** visibility field; `createPool(label, targetAmount,
  fundingDeadline, threshold, invitees)` (`:125-131`) — no visibility param. We do **not** touch the contract.
- `invited` is a public mapping → `invited(poolId, addr)` is a readable on-chain getter (`:44`). `pools(id)`
  auto-getter returns the struct incl. `creator`. `poolCount` enumerates ids `0..poolCount-1`.
- `/pools` (`app/pools/page.tsx`) is a **client** component reading `poolCount` + `pools(i)`/`status(i)` via
  wagmi `useReadContracts`. It does **not** currently read the connected address or membership.
- `/pools/new` (`app/pools/new/page.tsx`) is a client component; tx flow is **createPool → deposit** (2 txs),
  then redirect to `/pools/<id>`. `poolId` is parsed from the `PoolCreated` receipt log.
- No server-side Sepolia viem client exists yet; the pattern (`createPublicClient({chain: sepolia, transport:
  http(SEPOLIA_RPC)})`) is established in `lib/ens-client.ts` / `auth/verify/route.ts`. ABI+address in
  `lib/contract.ts` (`cofferEscrow`), chain/RPC in `lib/chain.ts`.
- Upstash (`lib/kv.ts` `getKv()`) + SIWE session (`lib/session.ts` `getSession()`) already exist and are wired.

## 3. Data model (Upstash)

- `pools:private` → SET of stringified pool ids that are **private**. Not in the set (or unknown) = public.

That's the entire off-chain footprint.

## 4. Server pieces

### `lib/sepolia-client.ts` (new, server-only)
A read-only Sepolia viem `publicClient` over `SEPOLIA_RPC` (reuse `NEXT_PUBLIC_SEPOLIA_RPC_URL` / the public
fallback from `lib/chain.ts`) + a helper `getPoolCreator(poolId: number): Promise<string | null>` that reads
`pools(poolId).creator` (lowercased), returning `null` on any error/out-of-range. Never imported by a client
file.

### `lib/pool-visibility.ts` (new, server-only)
Upstash helpers over `pools:private`:
- `getPrivatePoolIds(): Promise<number[]>` — `smembers` → numbers.
- `setPoolPrivate(poolId: number, isPrivate: boolean): Promise<void>` — `sadd`/`srem`.

### API route `app/api/pools/visibility/route.ts` (Node runtime)
- `GET` → `{ private: number[] }` from `getPrivatePoolIds()`. **Public, no auth** (the ids of private pools
  are not sensitive; membership gating happens client-side against on-chain data). Cache-Control: no-store.
- `POST { poolId: number, public: boolean }` → **SIWE-gated + creator-gated**:
  1. `session.address` present else 401.
  2. `getPoolCreator(poolId)`; if null → 404; if `!== session.address` → 403.
  3. `setPoolPrivate(poolId, !public)`. Return `{ ok: true, public }`.
  Validates `poolId` is a non-negative integer and `public` is boolean (400 otherwise).

## 5. Client pieces

### Create pool (`app/pools/new/page.tsx`)
- Add `isPublic` state (default **true**) + a toggle in the "Pool basics" panel: **"List this pool publicly"**
  with helper text: *"Public pools appear in the Pools directory for everyone. Private pools are only visible
  to you and the people you invite. Either way, only invited addresses can deposit."*
- After the existing 2 txs succeed and `poolId` is known: **if `!isPublic`**, mark it private — this needs a
  SIWE session, so call the existing `useAuth().signIn()` if not signed in, then
  `POST /api/pools/visibility { poolId, public: false }`. Public pools (default) need **no** extra call
  (absence = public), so the common path adds zero friction. Failure to write visibility is **non-fatal**:
  still redirect to the pool, but toast "Pool created — couldn't set it private, you can retry from the pool
  page." (Retry UI is out of scope; a failed private-write just means it's temporarily public.)
- Uses `useAuth` (already exists). Redirect to `/pools/<id>` unchanged.

### Pools list (`app/pools/page.tsx`)
- Add `useAccount()` for the viewer address.
- Add a react-query fetch of `GET /api/pools/visibility` → `privateIds: Set<number>`.
- Extend the `useReadContracts` batch: when a viewer is connected, also read `invited(i, viewer)` for each
  pool id (alongside the existing `pools(i)`/`status(i)`). Keep existing reads.
- **Filter** before render: show pool `i` iff `!privateIds.has(i)` **OR** `viewer && (creator_i === viewer ||
  invited_i === true)`. Not connected → private pools hidden.
- Add a small **"Private"** tag on the cards the viewer sees because they're a member (so they know it's not
  publicly listed). Public cards unchanged.
- Empty/loading states: unchanged; if everything filters out, show the existing empty state.

### Name page Pools panel (`app/name/[label]/page.tsx`)
- Copy already reworded to "Browse every open pool" + `All pools →`. No change needed beyond what shipped.

## 6. Data flow & boundaries

- `lib/sepolia-client.ts`, `lib/pool-visibility.ts`, and `app/api/pools/**` are **server-only**.
- Visibility is a UI/discoverability bit; it is **not** a security boundary (the pool exists on-chain and is
  readable by anyone querying the contract directly). This is acceptable and matches the "visible-only"
  decision — private = "not listed in our UI to non-members".
- The creator-gate on writes prevents a signed-in stranger from hiding/exposing someone else's pool.

## 7. Error handling

- `GET /api/pools/visibility` failure → the list falls back to **treating all pools as public** (fail-open to
  the current behavior; never hides a public pool because Upstash blipped). Log client-side; no crash.
- `POST` failures → 401/403/404/400 as above; client treats a private-write failure as non-fatal (see §5).
- Sepolia read failure in `getPoolCreator` → `null` → POST returns 404 (can't verify creator → refuse).

## 8. Testing

- **Unit (vitest):**
  - `pool-visibility` set round-trip is covered by a guarded Upstash integration test (mirrors watchlist).
  - A pure filter helper `visiblePoolIds({ pools, privateIds, viewer })` extracted from the list page and
    unit-tested: public shown to all; private shown only to creator/invited; not-connected hides private;
    legacy (not in set) shown.
- **Integration (guarded by KV env):** `setPoolPrivate`/`getPrivatePoolIds` add→list→remove.
- **Manual (documented):** create a private pool (toggle off) → it appears in `/pools` for the creator with a
  "Private" tag, and is absent for a different/no wallet; an invited address sees it; createa public pool → all
  see it.
- Server-side creator verification is exercised in manual testing (needs a real pool + wallet).

## 9. Out of scope

- Any contract change / open-join public pools (future: `isPublic` in the struct + `deposit()` bypass +
  Sepolia redeploy).
- A "request to join" flow for public pools.
- Editing visibility from the pool detail page (only set at creation for now; a failed private-write stays
  public until the contract-side or a later edit UI lands).
- Trending, indexer, registration flow (separate phases).

## 10. Rules honored

- **prefer-established-libraries:** reuses Upstash/iron-session/SIWE + viem; no new deps.
- **ethskills MO:** contract facts (invite-only `deposit`, `invited`/`pools` getters, `createPool` sig,
  `PoolCreated`) were read from source, not memory; **no onchain change** so no redeploy/audit gate triggered.
- **Sepolia-first:** reads only; the Sepolia write path (createPool/deposit) is untouched.
- **No secrets in git:** no new secrets; Upstash/session already gitignored.
