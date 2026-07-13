"use client";

import { useEffect, useState } from "react";
import { useAccount, useChainId, usePublicClient, useReadContract, useSignTypedData, useSwitchChain, useWriteContract } from "wagmi";
import { sepolia } from "wagmi/chains";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  buildRegistration,
  controllerAbi,
  randomSecret,
  ENS_CONTROLLER,
  MIN_COMMIT_WAIT,
} from "@/lib/ens-registrar";
import { SAFE_TX_TYPES, safeAbi, safeTxDomain, buildCallSafeTx, packSignatures, ZERO_ADDRESS } from "@/lib/safe";
import { useAuth } from "@/hooks/use-auth";
import { txErrorMessage } from "@/lib/tx-error";
import { fmtEth } from "@/lib/format";

type RegisterTx = { to: `0x${string}`; value: string; data: `0x${string}`; nonce: string; safeTxHash: string };
type State = {
  safe: string | null;
  label: string;
  threshold: number;
  available: boolean | null;
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
  const wrongChain = isConnected && chainId !== sepolia.id;
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

  // Is the connected wallet a Safe owner (= a contributor)? Gates signing.
  const { data: amOwner } = useReadContract({
    address: safe,
    abi: safeAbi,
    functionName: "isOwner",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // tick the countdown
  useEffect(() => {
    const t = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const label = data?.label ?? "";
  const threshold = data?.threshold ?? 0;
  const registered = data?.available === false;
  const commit = data?.commit ?? null;
  const registerTx = data?.registerTx ?? null;
  const signatures = data?.signatures ?? [];
  const iSigned = !!address && signatures.some((s) => s.signer.toLowerCase() === address.toLowerCase());
  const enough = signatures.length >= threshold && threshold > 0;

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
        abi: controllerAbi,
        functionName: "makeCommitment",
        args: [reg],
      })) as `0x${string}`;
      const hash = await writeContractAsync({ address: ENS_CONTROLLER, abi: controllerAbi, functionName: "commit", args: [commitment] });
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
        domain: safeTxDomain(safe, sepolia.id),
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
        await refresh(); // params moved on us — reload and let the user re-sign
        throw new Error("The transaction changed (price or Safe nonce moved). Please sign again.");
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
      {registered ? <span className="tag tag-finalized">Registered</span> : <span className="tag tag-premium">Action needed</span>}
    </div>
  );

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

  return (
    <div className="panel">
      {header}
      <p className="muted" style={{ fontSize: 13.5, marginTop: -4 }}>
        Funds are pooled in your Safe. Register <strong>{label}.eth</strong> to the Safe with a two-step ENS commit → wait →
        register. {threshold > 1 ? `Registering needs ${threshold} of your signers to sign.` : "You can do it in one go."}
      </p>

      <ol className="buy-steps" style={{ marginTop: 14 }}>
        <li className={!commit ? "on" : "done"}>
          <strong>1. Commit</strong> — any contributor reserves the claim (one free tx).
        </li>
        <li className={commit && !readyToSign ? "on" : readyToSign ? "done" : ""}>
          <strong>2. Wait ~60s</strong> — ENS anti-front-running delay.
        </li>
        <li className={readyToSign ? "on" : ""}>
          <strong>3. Sign &amp; register</strong> — owners sign; then anyone submits it from the Safe.
        </li>
      </ol>

      {!isConnected ? (
        <div className="note note-info mt-16">
          <span>ℹ</span>
          <span>Connect your wallet to register the name.</span>
        </div>
      ) : wrongChain ? (
        <button className="btn btn-primary btn-block mt-16" onClick={() => switchChain({ chainId: sepolia.id })}>
          Switch to Sepolia
        </button>
      ) : !commit ? (
        amOwner === false ? (
          <div className="note note-info mt-16">
            <span>ℹ</span>
            <span>Only contributors can register this vault’s name.</span>
          </div>
        ) : (
          <button className="btn btn-primary btn-block btn-lg mt-16" disabled={busy !== null} onClick={doCommit}>
            {busy === "commit" ? "Committing…" : "Step 1 · Commit"}
          </button>
        )
      ) : !readyToSign ? (
        <button className="btn btn-primary btn-block btn-lg mt-16" disabled>
          Waiting… {remaining}s
        </button>
      ) : (
        <>
          {registerTx && (
            <div className="kv mt-16">
              <span className="k">Cost from the Safe</span>
              <span className="v accent">{fmtEth(BigInt(registerTx.value), 4)} ETH</span>
            </div>
          )}
          <div className="kv">
            <span className="k">Signatures</span>
            <span className="v">
              {signatures.length} of {threshold}
            </span>
          </div>

          {!enough ? (
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
        </>
      )}

      {error && (
        <div className="note note-warn mt-16">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
