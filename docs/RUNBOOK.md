# ens.diamonds — Deployment Runbook

Operational guide for deploying ens.diamonds to **Sepolia** and **mainnet**. Pairs
with `docs/STATUS.md` (state/handoff) and `apps/web/.env.example` (env template).

> **Golden rule — one build per chain.** `NEXT_PUBLIC_APP_CHAIN` and every
> `NEXT_PUBLIC_*` address are inlined into the JS bundle at build time. You
> cannot switch chains at runtime. Sepolia and mainnet are **two separate
> Vercel projects / deployments**, each with its own env, its own escrow, and
> its own KV database.

---

## 1. Architecture in one paragraph

A build is pinned to a chain by `NEXT_PUBLIC_APP_CHAIN` (`sepolia` | `mainnet`).
That selects the ENS controller/resolver/base-registrar addresses and the
**registration mode**: Sepolia uses the free, no-commit premigration registrar
(`REGISTRATION_MODE = "free-instant"`); mainnet uses the paid
commit→wait→register flow on the ETHRegistrarController v2
(`"commit-reveal"`). ENS **price/availability reads always hit Ethereum
mainnet** (via `MAINNET_RPC_URL`) so the live-price box shows real USD even on
the Sepolia site. Pool coordination (SIWE nonces, commit secrets, Safe
signatures, watching/visibility, rate limits) lives in Upstash/Vercel KV.

---

## 2. Env matrix

Legend: **B** = build-time (inlined, `NEXT_PUBLIC_*`), **S** = server-only
runtime. R = required, O = optional.

| Var | Scope | Sepolia | Mainnet | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_APP_CHAIN` | B | `sepolia` (R) | `mainnet` (R) | Selects chain + registration mode. |
| `NEXT_PUBLIC_ESCROW_ADDRESS` | B | O (baked default) | **R** | Mainnet never falls back to the Sepolia escrow; if unset, the build still succeeds but every escrow-backed API route 500s at runtime (`assertEscrowConfigured`). Verify it's set before deploying. |
| `NEXT_PUBLIC_RPC_URL` | B | O | R (prod) | App-chain RPC; public fallback if unset. Use a private RPC in prod. |
| `NEXT_PUBLIC_SEPOLIA_RPC_URL` | B | O | — | Legacy alias, honored ONLY on sepolia. Prefer `NEXT_PUBLIC_RPC_URL`. |
| `MAINNET_RPC_URL` | S | R (prod) | R (prod) | Mainnet reads for price/resolution on BOTH chains. Public fallback if unset. |
| `NEXT_PUBLIC_WC_PROJECT_ID` | B | O | R (prod) | Without it: injected + Coinbase only, no WalletConnect/mobile. |
| `SESSION_SECRET` | S | R | R | iron-session password, ≥32 chars. `openssl rand -base64 32`. |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | S | R | R | Or `KV_REST_API_URL` / `_TOKEN`. **Separate DB per chain.** |
| `GRAPH_API_KEY` | S | R | R | ENS subgraph (discover feed). |

**Never commit** `.env.local`, `SESSION_SECRET`, KV tokens, `GRAPH_API_KEY`, or
any `DEPLOYER_PRIVATE_KEY`.

### On-chain addresses per chain (ENS rows from `apps/web/lib/app-chain.ts`)

| | Sepolia | Mainnet |
|---|---|---|
| chainId | 11155111 | 1 |
| ENS controller | `0xdf60C561Ca35AD3C89D24BbA854654b1c3477078` (premigration, free) | `0x59E16fcCd424Cc24e280Be16E11Bcd56fb0CE547` (v2, commit-reveal) |
| ENS base registrar | `0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85` | `0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85` |
| ENS resolver | `0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5` | `0xF29100983E058B709F3D539b0c765937B804AC15` |

Chainlink ETH/USD (`0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419`, mainnet) lives
in `apps/web/lib/ens-client.ts` and is read on **both** deployments — price
reads always go to mainnet (see §1), so the Sepolia site prices in real USD too.

> These were verified on-chain (`BaseRegistrar.controllers(addr) == true` +
> traced live registrations). **Do not trust ensjs/docs address books** — they
> were stale for Sepolia. Re-verify before any mainnet money movement.

---

## 3. Deploy the web app (per chain)

Preconditions: `pnpm install --frozen-lockfile`, `pnpm exec tsc --noEmit` clean,
`pnpm exec vitest run` green, CI green.

1. **Create/pick the Vercel project** for this chain (two distinct projects).
2. **Set env** (Vercel dashboard → Settings → Environment Variables) per the
   matrix above. Double-check `NEXT_PUBLIC_APP_CHAIN` matches the project.
3. **Provision a dedicated KV** for this chain and wire its URL/token. Do not
   reuse the other chain's database.
4. **Deploy.** Vercel runs `pnpm build` with the inlined `NEXT_PUBLIC_*` values.
5. **Smoke test** the deployment (base URL is a positional arg):
   ```bash
   node apps/web/scripts/smoke.mjs https://<deployment-url>
   ```
   All 6 checks must pass (`/`, `/pools`, `/about`, `/api/discover`,
   `/api/name-status`, `/api/resolve`).
6. **Manual sanity:** connect a wallet, load `/pools`, open a name page and
   confirm the live-price box renders real USD.

### Local dev
```bash
cd apps/web && cp .env.example .env.local   # fill in secrets
pnpm dev                                     # http://localhost:3000
```
Never run `pnpm build` while `pnpm dev` is running (shared `.next`). To build
against a scratch dir instead: `NEXT_DIST_DIR=.next-check pnpm build`.

---

## 4. Deploy the escrow contract (mainnet) — USER-GATED

EnsDiamondsEscrow's constructor takes the canonical **Safe v1.4.1** infra:
`(SAFE_PROXY_FACTORY, SAFE_SINGLETON, SAFE_FALLBACK_HANDLER)`. The Sepolia
deployment used:

| | Address (Safe v1.4.1) |
|---|---|
| SafeProxyFactory | `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67` |
| Safe singleton | `0x41675C099F32341bf84BFc5382aF534df5C7461a` |
| CompatibilityFallbackHandler | `0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99` |

Safe v1.4.1 uses deterministic (CREATE2) deployment, so these addresses are the
same on mainnet — **but the constructor requires each to have code, and you
MUST re-verify them against the official Safe deployment list at deploy time**
(`Deploy.s.sol` warns the same). Do not trust these values from memory.

Steps (in `packages/contracts`, with a funded `DEPLOYER_PRIVATE_KEY`):
1. Fill `.env` from `.env.example`: `MAINNET_RPC_URL`, `DEPLOYER_PRIVATE_KEY`,
   and the three verified Safe addresses.
2. `forge test -vv` — all green. With `MAINNET_RPC_URL` set (step 1) Foundry
   also runs the 2 mainnet-fork tests, for 43 total; without it they skip (41).
3. **Dry run** (no broadcast) to confirm gas/addresses:
   ```bash
   forge script script/Deploy.s.sol --rpc-url "$MAINNET_RPC_URL"
   ```
4. **Broadcast** (spends real ETH — get explicit user approval first):
   ```bash
   forge script script/Deploy.s.sol --rpc-url "$MAINNET_RPC_URL" --broadcast
   ```
   To also verify on Etherscan, add `--verify` **and** set `ETHERSCAN_API_KEY`
   in the environment (not currently in `.env.example`); otherwise omit
   `--verify` and verify the contract manually afterward.
5. Record the deployed address → set `NEXT_PUBLIC_ESCROW_ADDRESS` on the mainnet
   Vercel project and update `docs/STATUS.md`. If the directory ever uses a
   deploy-block bound again, set the mainnet value (`ESCROW_DEPLOY_BLOCK` in
   `lib/chain.ts` is currently a dead Sepolia-only constant).

---

## 5. Post-deploy verification

- **Canary (mainnet controller sanity), no wallet needed** (run from `apps/web`):
  ```bash
  MAINNET_RPC_URL=<url> pnpm exec vitest run lib/mainnet-registrar.integration.test.ts
  ```
  Confirms the controller is authorized on the base registrar and
  `minCommitmentAge == 60`.
- **Smoke script** (section 3, step 5) against the live URL.
- **CI** stays green on `main` (`.github/workflows/ci.yml`: tsc, vitest,
  `pnpm build` with no WC id, and `forge test`).

---

## 6. Rollback

- **Web:** Vercel → Deployments → promote the previous good deployment. Env-only
  changes: fix the var and redeploy.
- **Escrow:** immutable once deployed. To "roll back," deploy a fresh escrow and
  point `NEXT_PUBLIC_ESCROW_ADDRESS` at it; in-flight pools on the old escrow are
  unaffected (funds remain refundable there per the contract).
- **KV:** coordination data only (no funds). Safe to flush if corrupted; users
  re-sign. Never point mainnet at the Sepolia KV.
