"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useAccount, useChainId, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { sepolia } from "wagmi/chains";
import { labelhash } from "viem";
import {
  ENS_CONTROLLER,
  ENS_BASE_REGISTRAR,
  controllerAbi,
  baseRegistrarAbi,
  buildRegistration,
} from "@/lib/ens-registrar";
import { txErrorMessage as errMsg } from "@/lib/tx-error";

type Step = "idle" | "registering" | "done";

export default function BuySoloPage() {
  const { label: rawLabel } = useParams<{ label: string }>();
  const label = decodeURIComponent(rawLabel).toLowerCase().replace(/\.eth$/, "");

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const wrongChain = isConnected && chainId !== sepolia.id;
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);

  const { data: available, isLoading } = useReadContract({
    address: ENS_BASE_REGISTRAR,
    abi: baseRegistrarAbi,
    functionName: "available",
    args: [BigInt(labelhash(label))],
    query: { enabled: label.length >= 3 },
  });

  async function doRegister() {
    if (!publicClient || !address) return;
    setError(null);
    const reg = buildRegistration(label, address);
    try {
      setStep("registering");
      const hash = await writeContractAsync({
        address: ENS_CONTROLLER,
        abi: controllerAbi,
        functionName: "register",
        args: [reg],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setStep("done");
      // Record for the portfolio page (server re-verifies ownership on-chain).
      fetch("/api/portfolio/record", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, label }),
      }).catch(() => {});
    } catch (err) {
      setStep("idle");
      setError(errMsg(err));
    }
  }

  return (
    <div className="wrap">
      <div className="crumb">
        <Link href="/">Discover</Link> <span>/</span> <Link href={`/name/${label}`}>{label}.eth</Link>{" "}
        <span>/</span> <span>Buy solo</span>
      </div>

      <div className="page-head">
        <div>
          <h1 style={{ margin: 0 }}>
            Buy {label}.eth <span style={{ color: "var(--faint)", fontWeight: 400 }}>solo</span>
          </h1>
          <p>Register it to your own wallet on Sepolia — no vault needed. One transaction and it&rsquo;s yours.</p>
        </div>
        <Link className="btn btn-ghost" href={`/name/${label}`}>
          ← Back
        </Link>
      </div>

      <div className="note note-info" style={{ marginBottom: 20 }}>
        <span>ℹ</span>
        <span>
          This registers on <strong>Sepolia testnet</strong>, where ENS registration is free — you pay only gas.
          Mainnet buying (with real premium pricing) arrives with the mainnet deployment.
        </span>
      </div>

      <div className="cols">
        <div className="stack">
          <div className="panel">
            <span className="panel-title">Register for 1 year</span>
            <div className="kv">
              <span className="k">Name</span>
              <span className="v">{label}.eth</span>
            </div>
            <div className="kv">
              <span className="k">Duration</span>
              <span className="v">1 year</span>
            </div>
            <div className="kv">
              <span className="k">Registration cost</span>
              <span className="v big accent">Free</span>
            </div>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
              Sepolia&rsquo;s ENS registrar charges nothing and refunds any ETH sent — the only cost is gas.
            </p>
          </div>
        </div>

        <div className="stack">
          <div className="panel">
            <span className="panel-title">Buy it</span>

            {label.length < 3 ? (
              <div className="note note-warn mt-8">
                <span>⚠</span>
                <span>ENS names must be at least 3 characters.</span>
              </div>
            ) : isLoading ? (
              <p className="muted">Checking availability…</p>
            ) : available === false && step !== "done" ? (
              <div className="note note-warn mt-8">
                <span>⚠</span>
                <span>{label}.eth is already registered on Sepolia. Try another name.</span>
              </div>
            ) : step === "done" ? (
              <div className="note note-ok mt-8" style={{ background: "rgba(34,197,94,0.1)" }}>
                <span>✓</span>
                <span>
                  Registered! {label}.eth is now owned by your wallet on Sepolia.{" "}
                  <a href={`https://sepolia.app.ens.domains/${label}.eth`} target="_blank" rel="noreferrer" style={{ color: "var(--accent-2)" }}>
                    View on ENS →
                  </a>
                </span>
              </div>
            ) : !isConnected ? (
              <div className="note note-info mt-8">
                <span>ℹ</span>
                <span>Connect your wallet (top right) to register.</span>
              </div>
            ) : wrongChain ? (
              <button className="btn btn-primary btn-block mt-8" onClick={() => switchChain({ chainId: sepolia.id })}>
                Switch to Sepolia
              </button>
            ) : (
              <>
                <p className="muted" style={{ fontSize: 13.5 }}>
                  One transaction registers <strong>{label}.eth</strong> to your wallet and sets the public resolver.
                </p>
                <button
                  className="btn btn-primary btn-block btn-lg mt-16"
                  disabled={step === "registering"}
                  onClick={doRegister}
                >
                  {step === "registering" ? "Confirm in wallet…" : "Register & claim"}
                </button>
              </>
            )}

            {error && (
              <div className="note note-warn mt-16">
                <span>⚠</span>
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
