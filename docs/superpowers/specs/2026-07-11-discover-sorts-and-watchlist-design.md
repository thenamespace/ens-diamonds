# Discover sort fix + wallet-synced watchlist — design

**Date:** 2026-07-11
**Status:** Approved design, pre-implementation
**Builds on:** `2026-07-11-ensjs-and-live-discover-design.md` (live Discover, now merged/deployed).

## 1. Goal & decisions

Fix the Discover sort tabs so they show meaningfully different names, and add a **wallet-synced
watchlist**: users sign in with their wallet (SIWE), click a star to "watch" any `.eth` name, and see
their watched names on a dedicated `/watching` page. Watches are stored server-side keyed by address, so
they sync across devices and can later feed a Trending ranking.

Locked decisions (user, 2026-07-11):
- **Sort tabs:** `Newest` (most recently expired → priciest), `Ending soon` (nearest the end of the 21-day
  premium → cheapest), `Shortest` (fewest letters). **Remove `Cheapest`.** **Trending is out of scope** here
  (later phase: on-chain pool counts + watch/view counts).
- **Watch storage:** wallet-synced **backend** (not localStorage).
- **Watching UI:** a **dedicated `/watching` page** (nav link), not a Portfolio tab.
- **Auth:** **Sign-In-with-Ethereum**, lean custom flow (nonce → sign → verify → encrypted cookie), **sign
  once** per session. No NextAuth.
- **Sign-in is lazy:** connecting a wallet (for pooling) does NOT force sign-in. The first **watch** action
  triggers the one-time SIWE sign-in. Keeps pooling frictionless.

## 2. Verified facts (live research, 2026-07-11 — versions pinned)

- **KV store:** `@vercel/kv` is **deprecated** (existing stores auto-migrated to Upstash Dec 2024). Current
  path = **Upstash Redis via Vercel Marketplace**. SDK **`@upstash/redis` 1.38.x**, HTTP-based (Node or Edge).
  `new Redis({ url, token })` or `Redis.fromEnv()`; ops `sadd`/`srem`/`smembers`/`sismember`. Env var names
  vary by provisioning: **either** `KV_REST_API_URL`/`KV_REST_API_TOKEN` **or**
  `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` — read **both** defensively.
- **SIWE:** plain `siwe` (3.0.0) is stale + needs an `ethers` peer dep. Use **`@signinwithethereum/siwe`
  4.2.x** — viem-native, same API shape: `generateNonce()`, `new SiweMessage({domain,address,statement,uri,
  version,chainId,nonce,issuedAt})`, `.prepareMessage()` (string to sign), server `await
  message.verify({signature, domain, nonce}, {suppressExceptions:true})` → `{success, data, error}`.
- **Session:** **`iron-session` 8.0.4** (Web Crypto; Node+Edge). `getIronSession<SessionData>(await cookies(),
  sessionOptions)`. `password` ≥ 32 chars, `cookieName`, `cookieOptions {httpOnly:true, sameSite:'lax',
  secure: prod}`.
- **Next.js 15.5:** `cookies()` is **async** (`await cookies()`). Put the SIWE **verify** route (and all KV
  routes) on the **Node runtime** (`export const runtime = "nodejs"`). All same-origin → no CORS.
- **Client signing:** wagmi **v2.19** (our pin) — `useAccount()` for `{address, chainId, isConnected}`,
  `useSignMessage().signMessageAsync({ message })`. (wagmi `latest` is now v3 — we intentionally stay on v2.19;
  do not import v3-only APIs.) The custom nonce→sign→verify flow is an officially supported RainbowKit pattern.
- **Security invariants (from RainbowKit/SIWE docs):** the **server** must independently validate `domain`
  (=== its own host) and `nonce` (=== the nonce it issued into the session); nonce is **single-use** (cleared
  on verify). Never trust client-supplied domain/nonce.

## 3. Part 1 — Discover sort fix (no backend)

### The bug
`getPremiumNames` runs one subgraph query `orderBy:expiryDate, orderDirection:desc, first:limit`, so the grid
only ever holds the **most recently expired** names (day ~0, all ~$100M). "Ending soon"/cheapest names (day
~21) are never fetched — so switching tabs barely changes the set.

### The fix — fetch both ends of the 21-day window
In `lib/ens-premium.ts`, `getPremiumNames(limit = 24)`:
1. Query the subgraph **twice** over the same window (`expiryDate` in `[now-111d, now-90d]`,
   `labelName_not: null`): once `orderDirection: desc` (newest/priciest) and once `asc` (ending-soon/cheapest),
   each `first: ceil(limit/2)`.
2. **Merge + dedupe by label** (a name can appear in both ends only if the window is tiny). Keep ≤ `limit`.
3. Price the **union** per-name via `getPrice` (unchanged per-name pricing), one `getEthUsd`.
4. Return `PremiumEntry[]` (unchanged shape). Now `Newest` (expiry desc) and `Ending soon` (`premiumEndsAt`
   asc) surface genuinely different names, and `Shortest` has real variety.

Pure helper `mergeWindows(desc, asc, limit)` extracted for unit testing (dedupe by label, cap length, preserve
one representative per label).

### `discover-grid.tsx`
- `Sort` type → `"newest" | "ending" | "shortest"`. Remove the `cheapest` case + tab.
- `SORTS` = `[Newest, Ending soon, Shortest]`. Keep default `"ending"` (leads with poolable/cheap names).
- `sortEntries`: `newest` → `expiryDate` desc; `ending` → `premiumEndsAt` asc; `shortest` → `letters` asc,
  tiebreak `priceEth` asc.
- Add a **watch star** (Part 2) to each `NameCard` (top-right, next to the timer).

## 4. Part 2 — Wallet-synced watchlist (SIWE + iron-session + Upstash)

### Data model (Upstash Redis)
- `watch:<addr>` → SET of normalized labels (no `.eth`), the user's list. `<addr>` = **lowercased** 0x address.
- `watchers:<label>` → SET of lowercased addresses watching that label. (Kept in sync for future Trending.)
Both keys mutate together on watch/unwatch.

### Redis client — `lib/kv.ts`
`export const kv = new Redis({ url: KV_REST_API_URL ?? UPSTASH_REDIS_REST_URL, token: KV_REST_API_TOKEN ??
UPSTASH_REDIS_REST_TOKEN })`. Read both env-var name pairs defensively. Throw a clear error if neither is set.
Server-only (never imported by a `"use client"` file).

### Session — `lib/session.ts`
`SessionData = { address?: string; nonce?: string }`. `sessionOptions` (password = `SESSION_SECRET`,
`cookieName: "coffer_session"`, httpOnly, sameSite lax, secure in prod). `getSession()` =
`getIronSession<SessionData>(await cookies(), sessionOptions)`.

### API routes (all `export const runtime = "nodejs"`)
- `GET  /api/auth/nonce` → `generateNonce()`, store in `session.nonce`, `session.save()`, return the nonce
  (text/plain).
- `POST /api/auth/verify` → body `{ message, signature }`. Build `new SiweMessage(message)`; `verify({
  signature, domain: <server host from request headers>, nonce: session.nonce })`. On success: set
  `session.address = fields.address.toLowerCase()`, clear `session.nonce`, save. 422 on failure. Also reject if
  `session.nonce` is empty (nonce already used / no challenge).
- `POST /api/auth/logout` → `session.destroy()`.
- `GET  /api/auth/me` → `{ address: session.address ?? null }`.
- `GET  /api/watching` → require `session.address` (else 401); `smembers("watch:"+addr)` → `{ labels }`.
- `POST /api/watching` → `{ label }`; require session; `normalizeLabel` (viem `normalize`, strip `.eth`, len
  ≥ 3, else 400); `sadd` both keys; return `{ labels }`.
- `DELETE /api/watching` → `{ label }`; require session; `srem` both keys; return `{ labels }`.

Shared helpers in `lib/watchlist.ts`: `normalizeLabel(raw): string | null`, `getWatched(addr)`,
`addWatch(addr,label)`, `removeWatch(addr,label)` (each touches both Redis keys). Server-only.

### Client
- **`hooks/use-auth.ts`** — react-query (`@tanstack/react-query` already present):
  - `useAuth()` returns `{ address, isSignedIn, signIn, signOut, isSigningIn }`.
  - `me` query hits `GET /api/auth/me`.
  - `signIn()`: guard `isConnected`; `GET /api/auth/nonce`; build `SiweMessage` client-side (`domain =
    window.location.host`, `uri = window.location.origin`, `address`, `chainId` from `useAccount`, `version:
    "1"`, `nonce`, `statement: "Sign in to Coffer to manage your watchlist."`, `issuedAt`); `prepareMessage()`;
    `signMessageAsync({ message })`; `POST /api/auth/verify {message, signature}`; invalidate `me`.
- **`hooks/use-watching.ts`** — `useWatching()`: `list` query (`GET /api/watching`, enabled only when signed
  in), `isWatching(label)`, `toggle(label)` mutation (optimistic add/remove; if not signed in, call
  `signIn()` first, then mutate). Invalidate on settle.
- **`components/watch-button.tsx`** (`"use client"`): star ☆/★ toggle. States: not-connected → clicking opens
  RainbowKit connect (via `useConnectModal`); connected-not-signed-in → clicking runs `signIn()` then adds;
  signed-in → toggles. Small + `aria-pressed`. Used on `NameCard` and the name page. `stopPropagation` so a
  click on the star inside the card's `<Link>` doesn't navigate.

### `/watching` page — `app/watching/page.tsx` (server component, `dynamic = "force-dynamic"`)
Reads `getSession()`. If no `session.address` → a "Sign in to see your watchlist" state with a client
sign-in button. Else `getWatched(addr)` → for each label `getEnsNameData(label)` (live status/price) →
render cards (reuse the Discover card look) each linking to `/name/[label]` with a `WatchButton`. Empty list →
"You're not watching any names yet — tap the star on any name to add it."

### Nav
Add **Watching** to the header nav in `components/app-shell.tsx`, between Discover and Portfolio.

## 5. Data flow & boundaries

- `lib/kv.ts`, `lib/session.ts`, `lib/watchlist.ts` and all `app/api/**` handlers are **server-only** — never
  imported by a `"use client"` file. Secrets (`SESSION_SECRET`, Upstash token) stay server-side.
- The mainnet ENS read clients (Part 1 + `/watching` status) stay read-only and separate from the Sepolia
  wallet/wagmi write path. Watching is chain-agnostic (off-chain signature) — we accept whatever `chainId` the
  wallet reports and do **not** gate watching by chain.

## 6. Error handling

- Discover: if either window query or pricing fails → existing "Couldn't load live names" state (unchanged).
- Auth: nonce/verify failure → toast "Sign-in failed, try again"; never crash. Expired/again-needed session →
  `me` returns null → star silently re-prompts sign-in on next click.
- KV down: watch routes 500 → client toast "Couldn't update watchlist"; optimistic update rolls back.
- `/watching`: KV/ENS failure → friendly "Couldn't load your watchlist right now" (never crash).

## 7. Testing

- **Unit (vitest):**
  - `mergeWindows(desc, asc, limit)` — dedupe by label, cap length, both-ends represented (fixed fixtures).
  - `normalizeLabel` — strips `.eth`, lowercases/normalizes, rejects < 3 chars and invalid, returns null on
    throw.
  - `sortEntries` — `newest`/`ending`/`shortest` order on a small fixture (pure; export it).
- **Integration (guarded):**
  - KV round-trip guarded by `UPSTASH_REDIS_REST_URL || KV_REST_API_URL`: `addWatch`→`getWatched`→
    `removeWatch` against the real store returns/removes the label. Skips cleanly without env.
  - `getPremiumNames()` (existing guarded test) still returns sane entries; add an assertion that the set spans
    more than one `dayIntoPremium` value when ≥ 2 names (proves both-ends fetch).
- **Manual (documented in the plan):** full SIWE sign-in + watch/unwatch + `/watching` in the browser (can't
  automate wallet signing).

## 8. Setup (user actions, at build/deploy time)

1. **Upstash Redis:** Vercel → project **coffer-web** → **Storage** → browse → **Upstash** → Install → Free
   plan → create DB (pick region near the app) → connect to project. Env vars auto-inject (note which pair:
   `KV_REST_API_*` or `UPSTASH_REDIS_REST_*`).
2. **`SESSION_SECRET`:** add a ≥ 32-char random string to Vercel env (Production + Preview, Sensitive).
3. **Local dev:** `vercel env pull apps/web/.env.local` (or paste the Upstash URL/token + `SESSION_SECRET`
   into the gitignored `apps/web/.env.local`). Restart dev.

All secrets gitignored; never committed.

## 9. Out of scope

- **Trending** (later): rank by on-chain pool count per label (`PoolCreated.label`, already emitted) +
  `watchers:<label>` counts + view counts (needs a view counter). The `watchers:<label>` set we build now is
  the foundation.
- View/impression counting, rate-limiting, and notifications.
- The Execute/registration flow (separate later phase).
- Pushing/deploying is a separate user-authorized step per the git rule.

## 10. Rules honored

- **prefer-established-libraries:** SIWE (`@signinwithethereum/siwe`), `iron-session`, `@upstash/redis`,
  react-query, wagmi — all standard; no hand-rolled auth/crypto.
- **ethskills MO:** every library version, the Vercel-KV-deprecation, the SIWE package switch, env-var names,
  and Next 15 async-cookies were verified live (2026-07-11), not from memory.
- **Sepolia-first:** watching is off-chain; the Sepolia write path is untouched; two-domain plan unaffected
  (note: SIWE `domain` + cookie must match each deployed host).
- **No secrets in git:** `SESSION_SECRET` + Upstash token via gitignored env only.
