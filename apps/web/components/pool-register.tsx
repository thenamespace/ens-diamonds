"use client";

import { useEffect, useState } from "react";
import { useAccount, useChainId, usePublicClient, useReadContract, useSignTypedData, useSwitchChain, useWriteContract } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { APP_CHAIN } from "@/lib/app-chain";
import { SAFE_TX_TYPES, safeAbi, safeTxDomain, buildCallSafeTx, packSignatures, ZERO_ADDRESS } from "@/lib/safe";
import { txErrorMessage } from "@/lib/tx-error";
import { buildRegistration, randomSecret, v2ControllerAbi, ENS_CONTROLLER, MIN_COMMIT_WAIT, REGISTRATION_MODE } from "@/lib/ens-registrar";
import { useAuth } from "@/hooks/use-auth";
import LivePrice from "@/components/live-price";

type RegisterTx = { to: `0x${string}`; value: string; data: `0x${string}`; nonce: string; safeTxHash: string };
type State = {
  safe: string | null;
  label: string;
  threshold: number;
  mode: "free-instant" | "commit-reveal";
  available: boolean | null;
  nameOwner: string | null;
  commit: { committedAt: number } | null;
  registerTx: RegisterTx | null;
  signatures: { signer: string; signature: string }[];
};

async function fetchState(poolId: number): Promise<State> {
  const res = await fetch(`/api/pools/registration?poolId=${poolId}`);
  if (!res.ok) throw new Error("Failed to load registration state");
  return res.json();
}

export default function PoolRegister({ poolId, safe }: { poolId: number; label: string; safe: `0x${string}` }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const wrongChain = isConnected && chainId !== APP_CHAIN.chainId;
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();
  const { isSignedIn, signIn } = useAuth();
  const qc = useQueryClient();

  const [busy, setBusy] = useState<null | "commit" | "sign" | "execute">(null);
  const [error, setError] = useState<string | null>(null);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  const { data } = useQuery({
    queryKey: ["pool-register", poolId],
    queryFn: () => fetchState(poolId),
    refetchInterval: 6000,
  });

  // Countdown ticker for the commit-reveal wait step — cheap to run always
  // (free-instant deployments never have a commit, so it's a no-op there).
  useEffect(() => {
    const t = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  // Is the connected wallet a Safe owner (= a contributor)? Gates signing.
  const { data: amOwner } = useReadContract({
    address: safe,
    abi: safeAbi,
    functionName: "isOwner",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const label = data?.label ?? "";
  const threshold = data?.threshold ?? 0;
  // Server is authoritative on which flow applies — fall back to the client's
  // build-time constant only before the first fetch resolves (same build, so
  // they agree; this just avoids a layout flash).
  const mode = data?.mode ?? REGISTRATION_MODE;
  // "Taken" only means success if the Safe is the actual owner.
  const taken = data?.available === false;
  const safeOwnsIt = taken && !!data?.nameOwner && data.nameOwner.toLowerCase() === safe.toLowerCase();
  const sniped = taken && !!data?.nameOwner && data.nameOwner.toLowerCase() !== safe.toLowerCase();
  const snipedByMe = sniped && !!address && data?.nameOwner?.toLowerCase() === address.toLowerCase();
  const registered = safeOwnsIt;
  const commit = data?.commit ?? null;
  const registerTx = data?.registerTx ?? null;
  const signatures = data?.signatures ?? [];
  const iSigned = !!address && signatures.some((s) => s.signer.toLowerCase() === address.toLowerCase());
  const enough = signatures.length >= threshold && threshold > 0;

  // Commit-reveal wait: only meaningful when a commit exists (mode === "commit-reveal").
  const waited = commit ? nowSec - commit.committedAt : 0;
  const remaining = Math.max(0, MIN_COMMIT_WAIT - waited);
  const readyToSign = !!commit && remaining === 0;

  const refresh = () => qc.invalidateQueries({ queryKey: ["pool-register", poolId] });

  async function doCommit() {
    if (!publicClient || !address) return;
    setError(null);
    setBusy("commit");
    try {
      if (!isSignedIn) await signIn(); // commit record write is contributor-gated (SIWE)
      const secret = randomSecret();
      const reg = buildRegistration(label, safe, secret);
      const commitment = (await publicClient.readContract({
        address: ENS_CONTROLLER,
        abi: v2ControllerAbi,
        functionName: "makeCommitment",
        args: [reg],
      })) as `0x${string}`;
      const hash = await writeContractAsync({
        address: ENS_CONTROLLER,
        abi: v2ControllerAbi,
        functionName: "commit",
        args: [commitment],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      const committedAt = Math.floor(Date.now() / 1000);
      const res = await fetch("/api/pools/registration", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ poolId, secret, committedAt }),
      });
      if (!res.ok) throw new Error("Committed on-chain, but couldn't save the shared secret. Please retry.");
      await refresh();
    } catch (err) {
      setError(txErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function doSign() {
    if (!registerTx) return;
    setError(null);
    setBusy("sign");
    try {
      const tx = buildCallSafeTx({
        to: registerTx.to,
        value: BigInt(registerTx.value),
        data: registerTx.data,
        nonce: BigInt(registerTx.nonce),
      });
      const signature = await signTypedDataAsync({
        domain: safeTxDomain(safe, APP_CHAIN.chainId),
        types: SAFE_TX_TYPES,
        primaryType: "SafeTx",
        message: tx,
      });
      const res = await fetch("/api/pools/registration/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ poolId, value: registerTx.value, nonce: registerTx.nonce, signature }),
      });
      if (res.status === 409) {
        await refresh(); // params moved on us (nonce, price, or a stale/missing commit) — reload and let the user re-sign
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ? `${body.error}.` : "The transaction changed. Please sign again.");
      }
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't submit signature");
      await refresh();
    } catch (err) {
      setError(txErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function doExecute() {
    if (!publicClient || !registerTx) return;
    setError(null);
    setBusy("execute");
    try {
      const packed = packSignatures(
        signatures.map((s) => ({ signer: s.signer as `0x${string}`, signature: s.signature as `0x${string}` })),
      );
      const hash = await writeContractAsync({
        address: safe,
        abi: safeAbi,
        functionName: "execTransaction",
        args: [
          registerTx.to,
          BigInt(registerTx.value),
          registerTx.data,
          0,
          0n,
          0n,
          0n,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          packed,
        ],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await refresh();
    } catch (err) {
      setError(txErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  // ---- render ----
  const header = (
    <div className="spread" style={{ marginBottom: 12 }}>
      <span className="panel-title" style={{ margin: 0 }}>
        Buy the name
      </span>
      {registered ? (
        <span className="tag tag-finalized">Registered</span>
      ) : sniped ? (
        <span className="tag tag-funding">Unavailable</span>
      ) : (
        <span className="tag tag-premium">Action needed</span>
      )}
    </div>
  );

  if (sniped) {
    return (
      <div className="panel">
        {header}
        <div className="buy-grid">
          <div className="buy-main">
            <div className="note note-warn">
              <span>⚠</span>
              <span>
                <strong>{label}.eth</strong> was registered by{" "}
                {snipedByMe ? (
                  <>
                    <strong>your connected wallet</strong> (outside this vault)
                  </>
                ) : (
                  <span className="mono">{data?.nameOwner?.slice(0, 6)}…{data?.nameOwner?.slice(-4)}</span>
                )}{" "}
                — not by this vault&rsquo;s Safe, so the vault can&rsquo;t buy it anymore. The pooled ETH is untouched
                and stays in the Safe under its multisig control.
              </span>
            </div>
          </div>

          {label && <LivePrice label={label} boughtByOther />}
        </div>
      </div>
    );
  }

  if (registered) {
    return (
      <div className="panel">
        {header}
        <div className="note note-info" style={{ background: "rgba(34,197,94,0.1)" }}>
          <span>✓</span>
          <span>
            <strong>{label}.eth</strong> is registered and owned by your vault’s Safe.{" "}
            <a href={`https://sepolia.app.ens.domains/${label}.eth`} target="_blank" rel="noreferrer" style={{ color: "var(--accent-2)" }}>
              View on ENS →
            </a>
          </span>
        </div>
      </div>
    );
  }

  const signed = signatures.length;

  return (
    <div className="panel">
      {header}
      <div className="buy-grid">
        <div className="buy-main">
          <p className="muted" style={{ fontSize: 13.5, marginTop: -4 }}>
            Register <strong>{label}.eth</strong> to your Safe.
          </p>

          {mode === "commit-reveal" ? (
            <div className="stepper" style={{ marginTop: 14 }}>
              <div className={`sstep ${!commit ? "on" : "done"}`}>
                <span className="sstep-dot">
                  {!commit ? (
                    "1"
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </span>
                <span>
                  <span className="sstep-t">Commit</span>
                  <span className="sstep-d">Any contributor reserves the claim on-chain — one small gas fee.</span>
                </span>
              </div>

              <div className={`sstep ${commit && !readyToSign ? "on" : readyToSign ? "done" : ""}`}>
                <span className="sstep-dot">
                  {readyToSign ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : (
                    "2"
                  )}
                </span>
                <span>
                  <span className="sstep-t">Wait 60 seconds</span>
                  <span className="sstep-d">ENS&rsquo;s anti-front-running delay.</span>
                  {commit && !readyToSign && (
                    <span className="sstep-wait" style={{ display: "block" }}>
                      <span className="wait-bar" style={{ display: "block" }}>
                        <span
                          className="wait-fill"
                          style={{ display: "block", width: `${Math.min(100, (waited / MIN_COMMIT_WAIT) * 100)}%` }}
                        />
                      </span>
                      <span className="wait-label">
                        <span>Keep this tab open · safe to refresh</span>
                        <span>{remaining}s</span>
                      </span>
                    </span>
                  )}
                </span>
              </div>

              <div className={`sstep ${readyToSign ? "on" : ""}`}>
                <span className="sstep-dot">3</span>
                <span>
                  <span className="sstep-t">Sign &amp; register</span>
                  <span className="sstep-d">Owners sign; then anyone submits it from the Safe.</span>
                </span>
              </div>
            </div>
          ) : (
            <div className="stepper" style={{ marginTop: 14 }}>
              <div className={`sstep ${enough ? "done" : "on"}`}>
                <span className="sstep-dot">
                  {enough ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : (
                    "1"
                  )}
                </span>
                <span>
                  <span className="sstep-t">Sign</span>
                  <span className="sstep-d">
                    Safe owners approve the registration — {signed} of {threshold} signed.
                  </span>
                </span>
              </div>

              <div className={`sstep ${enough ? "on" : ""}`}>
                <span className="sstep-dot">2</span>
                <span>
                  <span className="sstep-t">Register</span>
                  <span className="sstep-d">Anyone submits it from the Safe; the name mints to the Safe.</span>
                </span>
              </div>
            </div>
          )}

          {!isConnected ? (
            <div className="note note-info mt-16">
              <span>ℹ</span>
              <span>Connect your wallet to register the name.</span>
            </div>
          ) : wrongChain ? (
            <button className="btn btn-primary btn-block mt-16" onClick={() => switchChain({ chainId: APP_CHAIN.chainId })}>
              Switch to Sepolia
            </button>
          ) : mode === "commit-reveal" && !commit ? (
            amOwner === false ? (
              <div className="note note-info mt-16">
                <span>ℹ</span>
                <span>Only contributors can register this vault&rsquo;s name.</span>
              </div>
            ) : (
              <button className="btn btn-primary btn-block btn-lg mt-16" disabled={busy !== null} onClick={doCommit}>
                {busy === "commit" ? "Committing…" : "Commit"}
              </button>
            )
          ) : mode === "commit-reveal" && !readyToSign ? (
            <button className="btn btn-primary btn-block btn-lg mt-16" disabled>
              Sign &amp; register — ready in {remaining}s
            </button>
          ) : !registerTx ? (
            <div className="note note-info mt-16">
              <span>ℹ</span>
              <span>Preparing the registration…</span>
            </div>
          ) : !enough ? (
            iSigned ? (
              <div className="note note-info mt-16">
                <span>✓</span>
                <span>You’ve signed. Waiting for {threshold - signatures.length} more owner(s).</span>
              </div>
            ) : amOwner === false ? (
              <div className="note note-info mt-16">
                <span>ℹ</span>
                <span>Waiting for the Safe owners to sign. You’re not an owner of this Safe.</span>
              </div>
            ) : (
              <button className="btn btn-primary btn-block btn-lg mt-16" disabled={busy !== null} onClick={doSign}>
                {busy === "sign" ? "Check your wallet…" : "Sign the registration"}
              </button>
            )
          ) : (
            <button className="btn btn-primary btn-block btn-lg mt-16" disabled={busy !== null} onClick={doExecute}>
              {busy === "execute" ? "Registering…" : "Register & claim the name"}
            </button>
          )}

          {error && (
            <div className="note note-warn mt-16">
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}
        </div>

        {label && <LivePrice label={label} />}
      </div>
    </div>
  );
}
