"use client";

import { useEffect, useState } from "react";
import { useAccount, useChainId, usePublicClient, useReadContract, useSignTypedData, useSwitchChain, useWriteContract } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Chip, ProgressBar, Spinner, Stepper, buttonVariants } from "@thenamespace/uikit";
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
      if (!res.ok) throw new Error("Committed onchain, but couldn't save the shared secret. Please retry.");
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
    <Card.Header className="w-full flex-row items-center justify-between">
      <Card.Title>Buy the name</Card.Title>
      {registered ? (
        <Chip color="success" size="sm" variant="soft">
          Registered
        </Chip>
      ) : sniped ? (
        <Chip color="warning" size="sm" variant="soft">
          Unavailable
        </Chip>
      ) : (
        <Chip color="accent" size="sm" variant="soft">
          Action needed
        </Chip>
      )}
    </Card.Header>
  );

  if (sniped) {
    return (
      <Card>
        {header}
        <div className="grid items-start gap-5 md:grid-cols-[1.4fr_0.9fr]">
          <div className="min-w-0">
            <Alert status="warning">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>
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
                </Alert.Description>
              </Alert.Content>
            </Alert>
          </div>

          {label && <LivePrice label={label} boughtByOther />}
        </div>
      </Card>
    );
  }

  if (registered) {
    return (
      <Card>
        {header}
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-success text-success-foreground" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
          <h3 className="text-xl font-semibold tracking-tight">
            Congrats on registering {label}
            <span className="text-muted">.eth</span>
          </h3>
          <p className="max-w-md text-sm text-muted">
            The name belongs to your vault&rsquo;s Safe — its contributors control it together.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <a
              className={buttonVariants({ size: "sm", variant: "primary" })}
              href={`${APP_CHAIN.ensAppUrl}/${label}.eth`}
              target="_blank"
              rel="noreferrer"
            >
              View on ENS
            </a>
            <a
              className={buttonVariants({ size: "sm", variant: "outline" })}
              href={`https://app.safe.global/home?safe=${APP_CHAIN.safePrefix}:${safe}`}
              target="_blank"
              rel="noreferrer"
            >
              View in Safe
            </a>
          </div>
        </div>
      </Card>
    );
  }

  const signed = signatures.length;

  return (
    <Card>
      {header}
      <div className="grid items-start gap-5 md:grid-cols-[1.4fr_0.9fr]">
        <div className="min-w-0">
          <p className="text-sm text-muted">
            Register <strong>{label}.eth</strong> to your Safe.
          </p>

          {mode === "commit-reveal" ? (
            <Stepper className="mt-3.5" currentStep={!commit ? 0 : !readyToSign ? 1 : 2} orientation="vertical">
              <Stepper.Step>
                <Stepper.Indicator />
                <Stepper.Content>
                  <Stepper.Title>Commit</Stepper.Title>
                  <Stepper.Description>Any contributor reserves the claim onchain — one small gas fee.</Stepper.Description>
                </Stepper.Content>
                <Stepper.Separator />
              </Stepper.Step>

              <Stepper.Step>
                <Stepper.Indicator />
                <Stepper.Content>
                  <Stepper.Title>Wait 60 seconds</Stepper.Title>
                  <Stepper.Description>ENS&rsquo;s anti-front-running delay.</Stepper.Description>
                  {commit && !readyToSign && (
                    <span className="mt-2 block w-full">
                      <ProgressBar
                        aria-label="Commit wait"
                        size="sm"
                        value={Math.min(100, (waited / MIN_COMMIT_WAIT) * 100)}
                      >
                        <ProgressBar.Track>
                          <ProgressBar.Fill />
                        </ProgressBar.Track>
                      </ProgressBar>
                      <span className="mt-1 flex items-center justify-between text-xs text-muted">
                        <span>Keep this tab open · safe to refresh</span>
                        <span>{remaining}s</span>
                      </span>
                    </span>
                  )}
                </Stepper.Content>
                <Stepper.Separator />
              </Stepper.Step>

              <Stepper.Step>
                <Stepper.Indicator />
                <Stepper.Content>
                  <Stepper.Title>Sign &amp; register</Stepper.Title>
                  <Stepper.Description>Owners sign; then anyone submits it from the Safe.</Stepper.Description>
                </Stepper.Content>
              </Stepper.Step>
            </Stepper>
          ) : (
            <Stepper className="mt-3.5" currentStep={enough ? 1 : 0} orientation="vertical">
              <Stepper.Step>
                <Stepper.Indicator />
                <Stepper.Content>
                  <Stepper.Title>Sign</Stepper.Title>
                  <Stepper.Description>
                    Safe owners approve the registration — {signed} of {threshold} signed.
                  </Stepper.Description>
                </Stepper.Content>
                <Stepper.Separator />
              </Stepper.Step>

              <Stepper.Step>
                <Stepper.Indicator />
                <Stepper.Content>
                  <Stepper.Title>Register</Stepper.Title>
                  <Stepper.Description>Anyone submits it from the Safe; the name mints to the Safe.</Stepper.Description>
                </Stepper.Content>
              </Stepper.Step>
            </Stepper>
          )}

          {!isConnected ? (
            <Alert className="mt-4" status="accent">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>Connect your wallet to register the name.</Alert.Description>
              </Alert.Content>
            </Alert>
          ) : wrongChain ? (
            <Button className="mt-4" fullWidth variant="primary" onPress={() => switchChain({ chainId: APP_CHAIN.chainId })}>
              Switch to {APP_CHAIN.label}
            </Button>
          ) : mode === "commit-reveal" && !commit ? (
            amOwner === false ? (
              <Alert className="mt-4" status="accent">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>Only contributors can register this vault&rsquo;s name.</Alert.Description>
                </Alert.Content>
              </Alert>
            ) : (
              <Button className="mt-4" fullWidth size="lg" variant="primary" isDisabled={busy !== null} onPress={doCommit}>
                {busy === "commit" ? "Committing…" : "Commit"}
              </Button>
            )
          ) : mode === "commit-reveal" && !readyToSign ? (
            <Button className="mt-4" fullWidth isDisabled size="lg" variant="primary">
              Sign &amp; register — ready in {remaining}s
            </Button>
          ) : !registerTx ? (
            <Alert className="mt-4" status="accent">
              <Alert.Indicator>
                <Spinner size="sm" />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Description>Preparing the registration…</Alert.Description>
              </Alert.Content>
            </Alert>
          ) : !enough ? (
            iSigned ? (
              <Alert className="mt-4" status="accent">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>You’ve signed. Waiting for {threshold - signatures.length} more owner(s).</Alert.Description>
                </Alert.Content>
              </Alert>
            ) : amOwner === false ? (
              <Alert className="mt-4" status="accent">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>Waiting for the Safe owners to sign. You’re not an owner of this Safe.</Alert.Description>
                </Alert.Content>
              </Alert>
            ) : (
              <Button className="mt-4" fullWidth size="lg" variant="primary" isDisabled={busy !== null} onPress={doSign}>
                {busy === "sign" ? "Check your wallet…" : "Sign the registration"}
              </Button>
            )
          ) : (
            <Button className="mt-4" fullWidth size="lg" variant="primary" isDisabled={busy !== null} onPress={doExecute}>
              {busy === "execute" ? "Registering…" : "Register & claim the name"}
            </Button>
          )}

          {error && (
            <Alert className="mt-4" status="warning">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>{error}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}
        </div>

        {label && <LivePrice label={label} />}
      </div>
    </Card>
  );
}
