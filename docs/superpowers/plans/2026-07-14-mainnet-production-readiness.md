# Coffer Mainnet Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take Coffer from a Sepolia-only test app to a production mainnet launch: chain-aware ENS registration (Sepolia = free/instant, mainnet = paid commit-reveal), a real-time price tracker with "name has just been bought" snipe detection, mainnet escrow deployment, security hardening, and a test suite + CI that keeps the app working at all times.

**Architecture:** One codebase, two deployments selected by `NEXT_PUBLIC_APP_CHAIN` (`sepolia` | `mainnet`). A single `lib/app-chain.ts` module is the source of truth for every chain-dependent address and behavior flag; `lib/ens-registrar.ts` exposes a `REGISTRATION_MODE` (`"free-instant"` vs `"commit-reveal"`) that the solo-buy page, vault register panel, and API routes branch on. Charging is never display-driven: the ENS controller enforces price on-chain and refunds excess; our Chainlink read is display-only with staleness guards.

**Tech Stack:** Next.js 15 App Router, wagmi v2 + viem, Foundry (contracts), Upstash Redis (coordination), vitest (tests), GitHub Actions (CI).

---

## Verified on-chain facts (2026-07-14 — do not re-derive, do not trust docs/ensjs blindly)

| Thing | Sepolia | Mainnet |
|---|---|---|
| Registration mode | free, instant, no commit | paid, commit → 60s → register |
| Registrar/controller | `0xdf60C561Ca35AD3C89D24BbA854654b1c3477078` (TestnetV1PremigrationRegistrar) | `0x59E16fcCd424Cc24e280Be16E11Bcd56fb0CE547` (ETHRegistrarController v2, struct ABI) |
| Authorized on BaseRegistrar? | ✅ verified `controllers()==true` | ✅ verified `controllers()==true` |
| BaseRegistrar | `0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85` | same address |
| PublicResolver | `0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5` | `0xF29100983E058B709F3D539b0c765937B804AC15` |
| minCommitmentAge / maxCommitmentAge | n/a | 60 / 86400 (verified live) |
| Registration struct | `(label,owner,duration,secret,resolver,data[],reverseRecord uint8,referrer bytes32)` | identical (verified `makeCommitment` live) |
| CofferEscrow | `0x5229b09a1f1EC16E69545bAE19E3b2A453a3Ae39` (deploy block 11258818) | to be deployed (Phase E) |
| ENS app URL | `sepolia.app.ens.domains` | `app.ens.domains` |

**The rule that found two bugs already:** before integrating ANY controller, verify `BaseRegistrar.controllers(addr) == true` on-chain and trace a recent successful third-party registration to it. ensjs's address book was stale for Sepolia.

**Restoration source:** the mainnet commit-reveal flow (solo + vault commit step + KV secret record) existed in this repo until it was removed for Sepolia. Retrieve exact prior implementations with:
```bash
git show 553b484^:apps/web/app/name/\[label\]/buy/page.tsx   # solo commit-reveal page
git show 553b484^:apps/web/components/pool-register.tsx      # vault 3-step panel
git show 553b484^:apps/web/lib/pool-registration.ts          # CommitRecord KV store
git show 553b484^:apps/web/app/api/pools/registration/route.ts
git show 553b484^:apps/web/app/api/pools/registration/sign/route.ts
git show 553b484^:apps/web/lib/ens-registrar.ts              # v2 controller ABI w/ commit
```

**Working conventions (apply to every task):**
- Never run `next build` while `next dev` runs; kill dev, `rm -rf .next`, build, restart dev.
- All ENS *resolution* via Resolvio; `ensClient`/RPC only for price/status/registration.
- Commit after each task; NEVER push without the user's explicit approval.
- All commands below run from `apps/web/` unless stated.

---

## File structure (end state)

```
apps/web/lib/app-chain.ts          NEW  single source of chain config + REGISTRATION_MODE
apps/web/lib/ens-registrar.ts      MOD  both registrar ABIs; addresses come from app-chain
apps/web/lib/registrar-flow.ts     NEW  pure helpers: value buffer, commit freshness (unit-tested)
apps/web/lib/rate-limit.ts         NEW  KV sliding-window limiter (unit-tested w/ fake KV)
apps/web/lib/chain.ts              MOD  escrow address/deploy block per app-chain
apps/web/lib/wagmi.ts              MOD  active chain from app-chain
apps/web/app/name/[label]/buy/page.tsx        MOD  branches on REGISTRATION_MODE
apps/web/components/pool-register.tsx         MOD  2-step (sepolia) / 3-step (mainnet)
apps/web/components/live-price.tsx            MOD  real-time ticker + "just bought" banner
apps/web/app/api/name-status/route.ts         MOD  + availability on the app chain
apps/web/app/api/pools/registration/route.ts  MOD  mode-aware SafeTx builder
apps/web/app/api/pools/registration/sign/route.ts MOD mode-aware value validation
apps/web/lib/pool-registration.ts  MOD  optional commit record (mainnet) + pinned params
packages/contracts/script/Deploy.s.sol        REUSE mainnet deploy
.github/workflows/ci.yml           NEW  typecheck + unit tests + build
docs/RUNBOOK.md                    NEW  deploy/env matrix + mainnet rehearsal checklist
```

---

# Phase A — Chain-aware foundation

### Task A1: `lib/app-chain.ts` + unit tests

**Files:**
- Create: `apps/web/lib/app-chain.ts`
- Test: `apps/web/lib/app-chain.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/lib/app-chain.test.ts
import { describe, it, expect } from "vitest";
import { resolveAppChain } from "./app-chain";

describe("resolveAppChain", () => {
  it("defaults to sepolia", () => {
    const c = resolveAppChain(undefined);
    expect(c.key).toBe("sepolia");
    expect(c.registrationMode).toBe("free-instant");
    expect(c.ensController).toBe("0xdf60C561Ca35AD3C89D24BbA854654b1c3477078");
  });
  it("mainnet flips every knob", () => {
    const c = resolveAppChain("mainnet");
    expect(c.key).toBe("mainnet");
    expect(c.registrationMode).toBe("commit-reveal");
    expect(c.ensController).toBe("0x59E16fcCd424Cc24e280Be16E11Bcd56fb0CE547");
    expect(c.ensResolver).toBe("0xF29100983E058B709F3D539b0c765937B804AC15");
    expect(c.ensAppUrl).toBe("https://app.ens.domains");
    expect(c.chainId).toBe(1);
  });
  it("BaseRegistrar address is chain-invariant", () => {
    expect(resolveAppChain("sepolia").ensBaseRegistrar).toBe(resolveAppChain("mainnet").ensBaseRegistrar);
  });
  it("throws on garbage", () => {
    expect(() => resolveAppChain("goerli")).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm exec vitest run lib/app-chain.test.ts` → FAIL (module not found)

- [ ] **Step 3: Implement**

```ts
// apps/web/lib/app-chain.ts
import { mainnet, sepolia } from "viem/chains";
import type { Chain } from "viem";

// Single source of truth for everything that differs between the Sepolia test
// deployment and the mainnet deployment. Selected by NEXT_PUBLIC_APP_CHAIN.
// Addresses were verified ON-CHAIN (controllers() authorization + traced live
// registrations) on 2026-07-14 — see docs/superpowers/plans/2026-07-14-*.md.

export type RegistrationMode = "free-instant" | "commit-reveal";

export type AppChain = {
  key: "sepolia" | "mainnet";
  chain: Chain;
  chainId: number;
  registrationMode: RegistrationMode;
  ensController: `0x${string}`;
  ensBaseRegistrar: `0x${string}`;
  ensResolver: `0x${string}`;
  ensAppUrl: string;
  explorerUrl: string;
};

const SEPOLIA: AppChain = {
  key: "sepolia",
  chain: sepolia,
  chainId: sepolia.id,
  registrationMode: "free-instant",
  ensController: "0xdf60C561Ca35AD3C89D24BbA854654b1c3477078", // TestnetV1PremigrationRegistrar
  ensBaseRegistrar: "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85",
  ensResolver: "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5",
  ensAppUrl: "https://sepolia.app.ens.domains",
  explorerUrl: "https://sepolia.etherscan.io",
};

const MAINNET: AppChain = {
  key: "mainnet",
  chain: mainnet,
  chainId: mainnet.id,
  registrationMode: "commit-reveal",
  ensController: "0x59E16fcCd424Cc24e280Be16E11Bcd56fb0CE547", // ETHRegistrarController v2
  ensBaseRegistrar: "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85",
  ensResolver: "0xF29100983E058B709F3D539b0c765937B804AC15",
  ensAppUrl: "https://app.ens.domains",
  explorerUrl: "https://etherscan.io",
};

export function resolveAppChain(raw: string | undefined): AppChain {
  const key = raw ?? "sepolia";
  if (key === "sepolia") return SEPOLIA;
  if (key === "mainnet") return MAINNET;
  throw new Error(`Unknown NEXT_PUBLIC_APP_CHAIN: ${raw}`);
}

export const APP_CHAIN = resolveAppChain(process.env.NEXT_PUBLIC_APP_CHAIN);
```

- [ ] **Step 4: Run tests** — `pnpm exec vitest run lib/app-chain.test.ts` → 4 pass
- [ ] **Step 5: Commit** — `git add apps/web/lib/app-chain.ts apps/web/lib/app-chain.test.ts && git commit -m "feat(web): chain-aware app config (sepolia/mainnet)"`

### Task A2: route existing modules through app-chain

**Files:**
- Modify: `apps/web/lib/ens-registrar.ts` (addresses + both ABIs)
- Modify: `apps/web/lib/chain.ts` (escrow + CHAIN come from app-chain; keep `SEPOLIA_RPC` name working via a generic `APP_RPC`)
- Modify: `apps/web/lib/wagmi.ts` (chains: `[APP_CHAIN.chain]`)

- [ ] **Step 1:** In `ens-registrar.ts`: replace the hardcoded consts with

```ts
import { APP_CHAIN } from "./app-chain";
export const ENS_CONTROLLER = APP_CHAIN.ensController;
export const ENS_BASE_REGISTRAR = APP_CHAIN.ensBaseRegistrar;
export const ENS_RESOLVER = APP_CHAIN.ensResolver;
export const REGISTRATION_MODE = APP_CHAIN.registrationMode;
export const MIN_COMMIT_WAIT = 60;      // verified live on the mainnet controller
export const MAX_COMMIT_AGE = 86400;    // verified live on the mainnet controller
```

Keep the existing premigration ABI as `premigrationRegistrarAbi`; restore the v2 controller ABI (with `commit`, `makeCommitment`, `rentPrice`, `available`, and its real 3-arg errors `CommitmentTooNew(bytes32,uint256,uint256)` / `CommitmentTooOld(bytes32,uint256,uint256)`, `CommitmentNotFound(bytes32)`, `NameNotAvailable(string)`, `InsufficientValue()`, `DurationTooShort(uint256)`) via `git show 553b484^:apps/web/lib/ens-registrar.ts` and merge the error fixes. Export `controllerAbi = REGISTRATION_MODE === "commit-reveal" ? v2ControllerAbi : premigrationRegistrarAbi`.

`buildRegistration(label, owner, secret?)`: secret param returns (defaults to zero bytes32 — free-instant passes nothing, commit-reveal passes a random secret). `randomSecret()` restored.

- [ ] **Step 2:** `pnpm exec tsc --noEmit` → clean; `pnpm exec vitest run` → all pass
- [ ] **Step 3:** grep-check nothing still hardcodes the old addresses: `grep -rn "0xdf60C561\|0x59E16f" app components lib --include="*.ts*" | grep -v app-chain` → only comments
- [ ] **Step 4:** Manual: `pnpm dev`, load `/name/<premium-name>/buy` on Sepolia → unchanged behavior
- [ ] **Step 5: Commit** — `git commit -am "refactor(web): registrar/wagmi/escrow config through app-chain"`

### Task A3: pure flow helpers + tests (`lib/registrar-flow.ts`)

**Files:**
- Create: `apps/web/lib/registrar-flow.ts`
- Test: `apps/web/lib/registrar-flow.test.ts`

- [ ] **Step 1: Failing tests**

```ts
// apps/web/lib/registrar-flow.test.ts
import { describe, it, expect } from "vitest";
import { registerValue, commitFreshness, validateSignedValue } from "./registrar-flow";

describe("registerValue", () => {
  it("adds a 10% buffer on commit-reveal", () => {
    expect(registerValue(1000n, "commit-reveal")).toBe(1100n);
  });
  it("is zero on free-instant regardless of price", () => {
    expect(registerValue(1000n, "free-instant")).toBe(0n);
  });
});

describe("commitFreshness", () => {
  const t = 1_000_000;
  it("too-new inside minAge", () => expect(commitFreshness(t, t + 30)).toBe("waiting"));
  it("ready after minAge", () => expect(commitFreshness(t, t + 61)).toBe("ready"));
  it("expired after maxAge", () => expect(commitFreshness(t, t + 86401)).toBe("expired"));
});

describe("validateSignedValue (server-side sign gate)", () => {
  const price = 1000n, balance = 5000n;
  it("accepts price..130% within balance", () => {
    expect(validateSignedValue(1100n, price, balance, "commit-reveal")).toBe(true);
  });
  it("rejects under price", () => expect(validateSignedValue(999n, price, balance, "commit-reveal")).toBe(false));
  it("rejects over 130%", () => expect(validateSignedValue(1301n, price, balance, "commit-reveal")).toBe(false));
  it("rejects over Safe balance", () => expect(validateSignedValue(1100n, price, 1000n, "commit-reveal")).toBe(false));
  it("free-instant only accepts exactly 0", () => {
    expect(validateSignedValue(0n, 0n, balance, "free-instant")).toBe(true);
    expect(validateSignedValue(1n, 0n, balance, "free-instant")).toBe(false);
  });
});
```

- [ ] **Step 2:** `pnpm exec vitest run lib/registrar-flow.test.ts` → FAIL
- [ ] **Step 3: Implement**

```ts
// apps/web/lib/registrar-flow.ts
import type { RegistrationMode } from "./app-chain";
import { MIN_COMMIT_WAIT, MAX_COMMIT_AGE } from "./ens-registrar";

// Value to send with register(): fresh on-chain price + 10% drift buffer.
// The ENS controller refunds any excess in the same transaction, so the buffer
// can only be temporarily locked, never lost. Free-instant registrars take 0.
export function registerValue(totalPrice: bigint, mode: RegistrationMode): bigint {
  return mode === "commit-reveal" ? (totalPrice * 110n) / 100n : 0n;
}

export type CommitFreshness = "waiting" | "ready" | "expired";
export function commitFreshness(committedAt: number, now: number): CommitFreshness {
  const age = now - committedAt;
  if (age > MAX_COMMIT_AGE) return "expired";
  if (age < MIN_COMMIT_WAIT) return "waiting";
  return "ready";
}

// Server-side gate for the value co-owners sign: must cover the fresh price,
// not exceed a 30% ceiling (prevents a malicious client draining the Safe via
// gross overpayment), and fit the Safe's balance. Free-instant is always 0.
export function validateSignedValue(
  value: bigint,
  freshTotalPrice: bigint,
  safeBalance: bigint,
  mode: RegistrationMode,
): boolean {
  if (mode === "free-instant") return value === 0n;
  if (value < freshTotalPrice) return false;
  if (value > (freshTotalPrice * 130n) / 100n) return false;
  if (value > safeBalance) return false;
  return true;
}
```

- [ ] **Step 4:** tests pass; **Step 5: Commit** — `git commit -am "feat(web): pure registrar flow helpers with tests"`

---

# Phase B — Solo buy, chain-aware

### Task B1: restore commit-reveal solo flow behind the mode switch

**Files:**
- Modify: `apps/web/app/name/[label]/buy/page.tsx`

- [ ] **Step 1:** Recover the old page for reference: `git show 553b484^:"apps/web/app/name/[label]/buy/page.tsx" > /tmp/old-buy.tsx`
- [ ] **Step 2:** Restructure the page into two components in the same file: `BuyInstant` (current content, unchanged) and `BuyCommitReveal` (old content, updated: import `REGISTRATION_MODE`, `registerValue` from `registrar-flow`, availability read from BaseRegistrar by labelhash — NOT the controller's `available` — and price via the controller's `rentPrice` `useReadContract` with `refetchInterval: 10_000`). Page body:

```tsx
export default function BuySoloPage() {
  return REGISTRATION_MODE === "commit-reveal" ? <BuyCommitReveal /> : <BuyInstant />;
}
```

The commit-reveal variant keeps: localStorage recovery keyed `coffer:commit:${APP_CHAIN.key}:${label}` (chain-scoped so stale Sepolia commits can't leak into mainnet), the 3-step stepper with wait progress bar, `MAX_COMMIT_AGE` expiry cleanup, and `value: registerValue(price.base + price.premium, "commit-reveal")` computed at REGISTER time (fresh read), not page load.
- [ ] **Step 3:** `pnpm exec tsc --noEmit` → clean
- [ ] **Step 4:** Manual on Sepolia (`NEXT_PUBLIC_APP_CHAIN` unset): buy page unchanged. Then `NEXT_PUBLIC_APP_CHAIN=mainnet pnpm dev`: buy page renders the 3-step variant with live mainnet prices (do NOT transact).
- [ ] **Step 5: Commit** — `git commit -am "feat(web): chain-aware solo buy (instant vs commit-reveal)"`

---

# Phase C — Vault registration, chain-aware

### Task C1: KV commit record returns (mainnet-only)

**Files:**
- Modify: `apps/web/lib/pool-registration.ts`
- Test: `apps/web/lib/pool-registration.integration.test.ts` (extend)

- [ ] **Step 1:** Re-add `CommitRecord` alongside `RegParams` (recover shape via `git show 553b484^:apps/web/lib/pool-registration.ts`): `{ secret, committedAt, safe, label }` at key `poolcommit:<id>`, plus `getCommit/saveCommit/clearCommit`. Keep the existing pinned-params/signature helpers untouched.
- [ ] **Step 2:** Extend the integration test (guarded by KV env, mirroring the existing style): saveCommit → getCommit roundtrip → clearCommit → null.
- [ ] **Step 3:** `pnpm exec vitest run lib/pool-registration.integration.test.ts` (skips without KV env; passes with it)
- [ ] **Step 4: Commit** — `git commit -am "feat(web): commit record store for mainnet vault registration"`

### Task C2: mode-aware registration API

**Files:**
- Modify: `apps/web/app/api/pools/registration/route.ts`
- Modify: `apps/web/app/api/pools/registration/sign/route.ts`

- [ ] **Step 1:** `route.ts` GET, commit-reveal branch: response gains `commit: {committedAt} | null` and `registerTx` is only built when a commit exists and `commitFreshness(committedAt, now) === "ready"`; `value` = `registerValue(freshRentPrice, mode)` (pinned on first signature as today). Free-instant branch: exactly today's behavior (`commit: null`, value 0). POST (save commit) returns, SIWE + `isContributor`-gated, body `{poolId, secret, committedAt}` — restore from `git show 553b484^:apps/web/app/api/pools/registration/route.ts` and adapt to keep `nameOwner` in the GET response.
- [ ] **Step 2:** `sign/route.ts`: replace the `value === 0` check with `validateSignedValue(BigInt(value), freshTotal, safeBalance, REGISTRATION_MODE)` where commit-reveal reads `rentPrice` + `getBalance(safe)` fresh; rebuild the SafeTx with the commit's secret on mainnet (`buildRegistration(label, safe, commit.secret)`).
- [ ] **Step 3:** `pnpm exec tsc --noEmit`; run full `pnpm exec vitest run`
- [ ] **Step 4:** Manual Sepolia regression: existing vault → sign → register still works end-to-end on dev.
- [ ] **Step 5: Commit** — `git commit -am "feat(web): mode-aware vault registration API"`

### Task C3: vault panel — 2-step vs 3-step

**Files:**
- Modify: `apps/web/components/pool-register.tsx`

- [ ] **Step 1:** Recover the 3-step panel for reference (`git show 553b484^:apps/web/components/pool-register.tsx`). Render: if `REGISTRATION_MODE === "commit-reveal"` show steps Commit → Wait 60s (progress bar) → Sign & register; else today's Sign → Register. `doCommit` restored (uses `randomSecret()`, POSTs the commit record, SIWE sign-in first). Keep the sniped/owned states and the `buy-grid` + `LivePrice` layout wrapping both variants.
- [ ] **Step 2:** `pnpm exec tsc --noEmit` → clean; Sepolia manual regression (2-step unchanged).
- [ ] **Step 3:** `NEXT_PUBLIC_APP_CHAIN=mainnet pnpm dev` → panel shows 3 steps (no transactions).
- [ ] **Step 4: Commit** — `git commit -am "feat(web): chain-aware vault register panel"`

---

# Phase D — Real-time price tracker + snipe detection

### Task D1: name-status returns availability on the app chain

**Files:**
- Modify: `apps/web/app/api/name-status/route.ts`

- [ ] **Step 1:** Add to the response: `available: boolean | null` — `BaseRegistrar.available(labelhash)` read via the app chain's server client (`sepoliaClient` today; it is already built from `APP_CHAIN.chain` after Task A2). Keep `status`/`price` (mainnet reference data) as-is.
- [ ] **Step 2:** `curl "localhost:3000/api/name-status?label=<taken>"` → `available: false`; `<free>` → `true`.
- [ ] **Step 3: Commit** — `git commit -am "feat(web): name-status exposes app-chain availability"`

### Task D2: LivePrice becomes a real-time tracker with a "just bought" banner

**Files:**
- Modify: `apps/web/components/live-price.tsx`
- Modify: `apps/web/components/pool-register.tsx` (pass `taken`/`sniped` down)

- [ ] **Step 1:** In `live-price.tsx`:
  - `refetchInterval: 10_000` (was 30s) and `refetchIntervalInBackground: true`.
  - A 1-second local ticker (`useEffect` + `setInterval`) so the "premium gone in Xh Ym Zs" countdown ticks live between fetches (extend `fmtCountdown` display to include seconds under 1h).
  - New prop `boughtByOther?: boolean`. When true, replace the price rows with:

```tsx
<div className="note note-warn" style={{ margin: 0 }}>
  <span>⚠</span>
  <span><strong>This name has just been bought.</strong> Someone registered it before the vault could — the pooled ETH is untouched in the Safe.</span>
</div>
```

  - Self-detection fallback when used standalone: track `prevAvailable` from the API response; if it flips `true → false`, show the banner (covers the solo-buy page too).
- [ ] **Step 2:** In `pool-register.tsx`, pass `boughtByOther={sniped}` so the vault panel flips the moment its 6-second poll sees a foreign owner.
- [ ] **Step 3:** Manual test: open a vault page for an available name, register it from another wallet (Sepolia, free), watch the panel flip to the banner within ~10s without a reload.
- [ ] **Step 4: Commit** — `git commit -am "feat(web): real-time price tracker with just-bought detection"`

---

# Phase E — Mainnet escrow deploy + environments

### Task E1: parameterize contracts deploy for mainnet

**Files:**
- Modify: `packages/contracts/.env` (new vars, NEVER committed)
- Reuse: `packages/contracts/script/Deploy.s.sol`

- [ ] **Step 1:** Verify canonical Safe v1.4.1 infra exists at the same addresses on mainnet (bytecode present): `cast code <SAFE_PROXY_FACTORY> --rpc-url <mainnet>` and singleton + fallback handler → non-empty.
- [ ] **Step 2:** Fill `MAINNET_RPC_URL` + reuse `DEPLOYER_PRIVATE_KEY` (fund with ~0.05 real ETH — **user action**).
- [ ] **Step 3:** Dry-run: `forge script script/Deploy.s.sol --rpc-url $MAINNET_RPC_URL` (simulation only, no `--broadcast`) → succeeds.
- [ ] **Step 4:** **USER APPROVAL GATE** → deploy with `--broadcast`, record address + deploy block in `docs/RUNBOOK.md`.
- [ ] **Step 5:** Verify on-chain: `cast call <escrow> 'EXECUTION_WINDOW()(uint256)'` → `86400`; Sourcify/Etherscan verify.

### Task E2: env matrix + runbook

**Files:**
- Create: `docs/RUNBOOK.md`
- Modify: `apps/web/.env.example` (create if missing)

- [ ] **Step 1:** Document both deployments: Vercel project A (Sepolia, current domain) and project B (mainnet domain), with the full env table: `NEXT_PUBLIC_APP_CHAIN`, `NEXT_PUBLIC_ESCROW_ADDRESS`, `NEXT_PUBLIC_SEPOLIA_RPC_URL`/mainnet RPC, `MAINNET_RPC_URL`, `GRAPH_API_KEY`, Upstash creds (SEPARATE database per deployment — pool ids collide otherwise), `NEXT_PUBLIC_WC_PROJECT_ID`, SIWE session secret.
- [ ] **Step 2:** Mainnet rehearsal checklist (real money, ~$50–80, user executes with assistant): solo-buy a $5 name end-to-end; full vault cycle with 2 wallets (create → fund → finalize → commit → wait → 2-of-2 sign → execute) on a $5 name; verify portfolio, ENS app, Safe UI; test refund path (withdraw before finalize).
- [ ] **Step 3: Commit** — `git commit -m "docs: deployment runbook + env matrix"`

---

# Phase F — Security hardening

### Task F1: truth in copy — remove "audited" claims

**Files:**
- Modify: `apps/web/components/app-shell.tsx` (footer), `apps/web/app/layout.tsx` (metadata), `apps/web/app/pools/new/page.tsx`, any others from `grep -rin "audited" apps/web/app apps/web/components`

- [ ] **Step 1:** `grep -rin "audited" app components` → replace every "audited escrow" with "open-source escrow" (link the GitHub repo in the footer instance).
- [ ] **Step 2:** grep returns zero "audited"; commit — `git commit -am "fix(web): remove unearned 'audited' claims"`

### Task F2: KV rate limiter on write routes + tests

**Files:**
- Create: `apps/web/lib/rate-limit.ts`
- Test: `apps/web/lib/rate-limit.test.ts`
- Modify: `apps/web/app/api/pools/registration/sign/route.ts`, `apps/web/app/api/pools/registration/route.ts` (POST), `apps/web/app/api/portfolio/record/route.ts`, `apps/web/app/api/pools/visibility/route.ts`, `apps/web/app/api/watching/route.ts`

- [ ] **Step 1: Failing test** (fake KV = in-memory Map implementing `incr`/`expire`):

```ts
// apps/web/lib/rate-limit.test.ts
import { describe, it, expect } from "vitest";
import { makeLimiter } from "./rate-limit";

function fakeKv() {
  const m = new Map<string, { n: number; exp: number }>();
  return {
    incr: async (k: string) => {
      const e = m.get(k) ?? { n: 0, exp: 0 };
      e.n += 1; m.set(k, e); return e.n;
    },
    expire: async (k: string, s: number) => {
      const e = m.get(k); if (e) e.exp = s; return 1;
    },
  };
}

describe("rate limiter", () => {
  it("allows up to the cap then blocks", async () => {
    const limit = makeLimiter(fakeKv() as never, { max: 3, windowSec: 60 });
    expect(await limit("ip:1", "sign")).toBe(true);
    expect(await limit("ip:1", "sign")).toBe(true);
    expect(await limit("ip:1", "sign")).toBe(true);
    expect(await limit("ip:1", "sign")).toBe(false);
  });
  it("keys are isolated", async () => {
    const limit = makeLimiter(fakeKv() as never, { max: 1, windowSec: 60 });
    expect(await limit("ip:1", "sign")).toBe(true);
    expect(await limit("ip:2", "sign")).toBe(true);
  });
});
```

- [ ] **Step 2:** FAIL → **Step 3: Implement**

```ts
// apps/web/lib/rate-limit.ts
import { getKv } from "./kv";

type KvLike = { incr(k: string): Promise<number>; expire(k: string, s: number): Promise<unknown> };

// Fixed-window limiter on Upstash: INCR + EXPIRE on first hit. Fails OPEN on
// KV errors — availability beats strictness for these low-stakes writes (every
// write route also has on-chain or signature verification as the real gate).
export function makeLimiter(kv: KvLike, opts: { max: number; windowSec: number }) {
  return async function limit(id: string, bucket: string): Promise<boolean> {
    try {
      const key = `rl:${bucket}:${id}`;
      const n = await kv.incr(key);
      if (n === 1) await kv.expire(key, opts.windowSec);
      return n <= opts.max;
    } catch {
      return true;
    }
  };
}

export const apiLimiter = makeLimiter(getKv(), { max: 30, windowSec: 60 });

export function clientId(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
}
```

- [ ] **Step 4:** Wire into each listed POST route as the first statement: `if (!(await apiLimiter(clientId(req), "sign"))) return Response.json({ error: "Too many requests" }, { status: 429 });` (bucket string per route). Tests pass; typecheck clean.
- [ ] **Step 5: Commit** — `git commit -am "feat(web): rate-limit write API routes"`

### Task F3: WalletConnect + misc hardening

**Files:**
- Modify: `apps/web/lib/wagmi.ts`, `apps/web/app/api/name-status/route.ts`, `apps/web/app/api/resolve/route.ts`

- [ ] **Step 1:** WalletConnect: user creates a project at cloud.reown.com (**user action**); set `NEXT_PUBLIC_WC_PROJECT_ID` in both Vercel projects + `.env.local`. Code: if the env is missing, pass `projectId: ""`— and log one server-side warning at build. (Kills the console 403 spam.)
- [ ] **Step 2:** Input bounds: in `name-status` and `resolve`, reject labels > 63 chars and query strings > 255 chars with 400 before doing any work.
- [ ] **Step 3:** typecheck + tests + commit — `git commit -am "fix(web): WC project id env + input bounds"`

---

# Phase G — Tests & CI

### Task G1: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1:**

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:
jobs:
  web:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: apps/web } }
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm, cache-dependency-path: pnpm-lock.yaml }
      - run: pnpm install --frozen-lockfile
        working-directory: .
      - run: pnpm exec tsc --noEmit
      - run: pnpm exec vitest run
      - run: pnpm build
        env:
          NEXT_PUBLIC_ESCROW_ADDRESS: "0x5229b09a1f1EC16E69545bAE19E3b2A453a3Ae39"
  contracts:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: packages/contracts } }
    steps:
      - uses: actions/checkout@v4
      - uses: foundry-rs/foundry-toolchain@v1
      - run: forge test -vv
```

- [ ] **Step 2:** Push to a branch, confirm both jobs green in Actions, then merge. Commit — `git commit -m "ci: typecheck, unit tests, build, forge test"`

### Task G2: post-deploy smoke script

**Files:**
- Create: `apps/web/scripts/smoke.mjs`

- [ ] **Step 1:**

```js
// apps/web/scripts/smoke.mjs — run after every deploy: node scripts/smoke.mjs https://<deployment>
const base = process.argv[2];
if (!base) { console.error("usage: node scripts/smoke.mjs <baseUrl>"); process.exit(1); }
const checks = [
  ["/", 200, "Coffer"],
  ["/pools", 200, "Vaults"],
  ["/about", 200, "Namespace"],
  ["/api/discover?sort=ending&offset=0", 200, '"entries"'],
  ["/api/name-status?label=vitalik", 200, '"status"'],
  ["/api/resolve?q=vitalik.eth", 200, '"address"'],
];
let failed = 0;
for (const [path, code, needle] of checks) {
  const res = await fetch(base + path);
  const body = await res.text();
  const ok = res.status === code && body.includes(needle);
  console.log(ok ? "✓" : "✗", path, res.status);
  if (!ok) failed++;
}
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2:** `node scripts/smoke.mjs https://coffer-web-delta.vercel.app` → all ✓. Commit — `git commit -m "test: post-deploy smoke script"`

### Task G3: mainnet read-only integration test (guarded)

**Files:**
- Create: `apps/web/lib/mainnet-registrar.integration.test.ts`

- [ ] **Step 1:** Guarded by `MAINNET_RPC_URL` (skip otherwise), assert live: controller is authorized on the BaseRegistrar (`controllers()==true`), `minCommitmentAge()==60`, `rentPrice` returns a positive base for a normal label, and `makeCommitment(buildRegistration(...))` returns 32 bytes. This is the canary that fails loudly if ENS rotates controllers again.

```ts
import { describe, it, expect } from "vitest";
import { createPublicClient, http, parseAbi } from "viem";
import { mainnet } from "viem/chains";

const RPC = process.env.MAINNET_RPC_URL;
const maybe = RPC ? describe : describe.skip;
const CONTROLLER = "0x59E16fcCd424Cc24e280Be16E11Bcd56fb0CE547";
const BASE = "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85";

maybe("mainnet controller canary", () => {
  const client = createPublicClient({ chain: mainnet, transport: http(RPC) });
  it("controller is still authorized + parameters intact", async () => {
    const authorized = await client.readContract({
      address: BASE,
      abi: parseAbi(["function controllers(address) view returns (bool)"]),
      functionName: "controllers",
      args: [CONTROLLER],
    });
    expect(authorized).toBe(true);
    const minAge = await client.readContract({
      address: CONTROLLER,
      abi: parseAbi(["function minCommitmentAge() view returns (uint256)"]),
      functionName: "minCommitmentAge",
    });
    expect(Number(minAge)).toBe(60);
  }, 30_000);
});
```

- [ ] **Step 2:** `MAINNET_RPC_URL=<rpc> pnpm exec vitest run lib/mainnet-registrar.integration.test.ts` → pass. Commit.

---

# Phase H — Mainnet rehearsal & launch (user-driven, assistant-guided)

### Task H1: rehearsal (real ETH, ~$50–80) — follow `docs/RUNBOOK.md` checklist
- [ ] Solo-buy a cheap throwaway name end-to-end on the mainnet deployment (commit → 60s → register). Verify wallet owns it + portfolio shows it.
- [ ] Full vault cycle with 2 wallets on a second cheap name; verify Safe owns it, portfolio + ENS app + Safe UI all agree.
- [ ] Exercise the refund path: third vault, deposit, withdraw before finalize.

### Task H2: launch gate checklist
- [ ] CI green; smoke script green on both deployments
- [ ] Mainnet canary test green
- [ ] No "audited" copy anywhere; escrow README states unaudited status honestly
- [ ] Separate Upstash DBs confirmed; WC project id live; rate limits active
- [ ] **Recommended before public marketing (not before friends-and-family):** independent review/audit of CofferEscrow.sol

---

## Self-review notes
- Spec coverage: chain-aware registration (A, B, C) ✓; real-time tracker + "just bought" (D) ✓; mainnet escrow deploy (E) ✓; security (F) ✓; tests/CI (G) ✓; real-money rehearsal per user preference, no fork (H) ✓.
- All addresses verified on-chain this session, not copied from docs.
- Type consistency: `RegistrationMode`, `registerValue`, `commitFreshness`, `validateSignedValue`, `APP_CHAIN` used consistently across A3/B1/C2.
