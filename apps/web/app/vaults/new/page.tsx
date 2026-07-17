"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { getAddress, isAddress, parseEventLogs } from "viem";
import { Alert, Button, Card, Input, InputGroup, Label, Spinner, Switch } from "@thenamespace/uikit";
import NameAvatar from "@/components/name-avatar";

import { APP_CHAIN } from "@/lib/app-chain";
import { cofferEscrow } from "@/lib/contract";
import { cofferEscrowAbi } from "@/lib/abi/coffer-escrow";
import { isEscrowConfigured } from "@/lib/chain";
import { parseEther, shortLabel, fmtCountdown } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { txErrorMessage } from "@/lib/tx-error";

const MAX_SIGNERS = 10;
const MIN_CONTRIB = 0.01; // matches EnsDiamondsEscrow MIN_CONTRIBUTION for partial deposits

type Invitee = { id: number; value: string };

// Result of resolving one invitee entry (name→address or address→name).
type Resolution = "checking" | "bad" | { address: `0x${string}`; name: string | null };

type NameCheck = null | "checking" | "premium" | "available" | "active" | "grace" | "tooShort" | "invalid" | "unknown";

// How each live ENS status reads in the create form. `ok` = poolable; `block`
// = you can't register it, so funding a pool would waste everyone's money.
const NAME_STATUS: Record<
  Exclude<NameCheck, null | "checking">,
  { text: string; kind: "ok" | "block" | "info"; note: string }
> = {
  premium: {
    text: "Temporary premium",
    kind: "ok",
    note: "In its 21-day premium auction, exactly what vaults are for. Good to go.",
  },
  available: {
    text: "Available",
    kind: "ok",
    note: "Expired and available at base price. Good to start a vault for.",
  },
  active: {
    text: "Registered",
    kind: "block",
    note: "This name is currently registered to someone else. You can't register it, so a vault for it can never succeed.",
  },
  grace: {
    text: "In grace period",
    kind: "block",
    note: "Expired but still in its 90-day grace period, so the current owner can renew it. You can't start a vault for it until it enters the premium auction.",
  },
  tooShort: { text: "Too short", kind: "info", note: "ENS names need at least 3 characters." },
  invalid: { text: "Not a valid name", kind: "block", note: "This isn't a registrable ENS label." },
  unknown: { text: "Couldn't verify", kind: "info", note: "Couldn't check this name's status right now. Double-check before funding." },
};

// note kind → Alert status
const NOTE_STATUS = { ok: "success", block: "warning", info: "accent" } as const;

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

// One invitee input that live-resolves ENS names ↔ addresses against mainnet and
// reports the resolved address up to the form. Names are shown over addresses.
function InviteeRow({
  value,
  selfAddress,
  duplicate,
  onChange,
  onRemove,
  onResolve,
}: {
  value: string;
  selfAddress?: string;
  duplicate?: boolean;
  onChange: (v: string) => void;
  onRemove: () => void;
  onResolve: (r: Resolution | null) => void;
}) {
  const v = value.trim();
  const [res, setRes] = useState<Resolution | null>(null);

  useEffect(() => {
    if (!v) {
      setRes(null);
      onResolve(null);
      return;
    }
    let cancelled = false;

    // A raw address is valid immediately (local checksum) — show ✓ now and only
    // look up its primary ENS name in the background, upgrading the display if
    // one exists. A failed name lookup never invalidates a good address.
    if (isAddress(v)) {
      const address = getAddress(v);
      const base: Resolution = { address, name: null };
      setRes(base);
      onResolve(base);
      const t = setTimeout(async () => {
        try {
          const r = await fetch(`/api/resolve?q=${encodeURIComponent(v)}`);
          const j = (await r.json()) as { name?: string | null };
          if (cancelled || !j.name) return;
          const named: Resolution = { address, name: j.name };
          setRes(named);
          onResolve(named);
        } catch {
          /* keep the address-only ✓ */
        }
      }, 350);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }

    // An ENS name genuinely needs the network to resolve to an address.
    setRes("checking");
    onResolve("checking");
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/resolve?q=${encodeURIComponent(v)}`);
        const j = (await r.json()) as { ok?: boolean; address?: `0x${string}`; name?: string | null };
        if (cancelled) return;
        if (j.ok && j.address) {
          const out: Resolution = { address: j.address, name: j.name ?? null };
          setRes(out);
          onResolve(out);
        } else {
          setRes("bad");
          onResolve("bad");
        }
      } catch {
        if (!cancelled) {
          setRes("bad");
          onResolve("bad");
        }
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);

  const ok = res && res !== "checking" && res !== "bad" ? res : null;
  const isSelf = !!(ok && selfAddress && ok.address.toLowerCase() === selfAddress.toLowerCase());
  const isDupe = !!(ok && duplicate);
  const invalid = res === "bad" || isSelf || isDupe;

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <Input
          aria-label="Co-owner ENS name or address"
          className={`flex-1 ${invalid ? "border-danger" : ok ? "border-success" : ""}`}
          placeholder="vitalik.eth or 0x… address"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <Button isIconOnly aria-label="Remove co-owner" size="sm" variant="ghost" onPress={onRemove}>
          ✕
        </Button>
      </div>
      {res === "checking" ? (
        <div className="mt-1.5 text-xs text-muted">Resolving…</div>
      ) : isSelf ? (
        <div className="mt-1.5 text-xs text-danger">That&rsquo;s your own wallet. Invite someone else.</div>
      ) : isDupe ? (
        <div className="mt-1.5 text-xs text-danger">
          Already added{ok.name ? ` as ${ok.name}` : ""}. Remove this duplicate.
        </div>
      ) : ok ? (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-success">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6L9 17l-5-5" />
          </svg>
          {ok.name ? (
            <>
              <strong>{ok.name}</strong>
              <span className="mono text-muted">{shortAddr(ok.address)}</span>
            </>
          ) : (
            <span className="mono">{shortAddr(ok.address)}</span>
          )}
        </div>
      ) : res === "bad" ? (
        <div className="mt-1.5 text-xs text-danger">Couldn&rsquo;t resolve. Enter a valid ENS name or 0x address.</div>
      ) : null}
    </div>
  );
}

function NewPoolForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const label = (sp.get("label") ?? "").toLowerCase().replace(/\.eth$/, "");

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [target, setTarget] = useState("0.03");
  const [yourContrib, setYourContrib] = useState("0.02");
  const [days, setDays] = useState(1);
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  const [resolved, setResolved] = useState<Record<number, Resolution | undefined>>({});
  const [labelInput, setLabelInput] = useState(label || "");
  const [isPublic, setIsPublic] = useState(true);
  const { isSignedIn, signIn } = useAuth();

  const [step, setStep] = useState<"idle" | "creating" | "depositing" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  // Live ENS status of the typed name (debounced), so people don't fund a pool
  // for a name they could never register.
  const cleanLabel = labelInput.trim().toLowerCase().replace(/\.eth$/, "");
  const [nameStatus, setNameStatus] = useState<NameCheck>(null);
  const [premiumEndsAt, setPremiumEndsAt] = useState<number | null>(null);
  useEffect(() => {
    setPremiumEndsAt(null);
    if (cleanLabel.length < 3) {
      setNameStatus(null);
      return;
    }
    setNameStatus("checking");
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/name-status?label=${encodeURIComponent(cleanLabel)}`);
        const json = (await res.json()) as { status?: NameCheck; price?: { premiumEndsAt?: number | null } | null };
        if (!cancelled) {
          setNameStatus(json.status ?? "unknown");
          setPremiumEndsAt(json.price?.premiumEndsAt ?? null);
        }
      } catch {
        if (!cancelled) setNameStatus("unknown");
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [cleanLabel]);

  // Ticker so the "gone in Xh Ym" countdown moves without a page refresh;
  // fmtCountdown is minute-granular, so 30s keeps it fresh enough.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!premiumEndsAt) return;
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, [premiumEndsAt]);

  // Only hard-block the states where a pool provably can't work.
  const nameBlocked = nameStatus === "active" || nameStatus === "grace" || nameStatus === "invalid";
  const statusInfo = nameStatus && nameStatus !== "checking" ? NAME_STATUS[nameStatus] : null;

  const targetNum = Math.max(0, parseFloat(target) || 0);
  const yourNum = Math.max(0, parseFloat(yourContrib) || 0);
  const selfLower = (address ?? "").toLowerCase();
  const badInvitees = invitees.filter((i) => resolved[i.id] === "bad");
  const checkingInvitees = invitees.filter((i) => resolved[i.id] === "checking");
  const okResolutions = invitees
    .map((i) => resolved[i.id])
    .filter((r): r is { address: `0x${string}`; name: string | null } => !!r && r !== "checking" && r !== "bad");
  const hasSelfInvite = okResolutions.some((r) => r.address.toLowerCase() === selfLower);
  // The 2nd+ row resolving to an address already listed is a duplicate — the
  // contract rejects these (DuplicateInvitee), and they carry no meaning since
  // ownership is by ETH contributed, not by owner-slot count.
  const duplicateIds = new Set<number>();
  {
    const seen = new Set<string>();
    for (const i of invitees) {
      const r = resolved[i.id];
      if (r && r !== "checking" && r !== "bad") {
        const key = r.address.toLowerCase();
        if (seen.has(key)) duplicateIds.add(i.id);
        else seen.add(key);
      }
    }
  }
  const hasDuplicate = duplicateIds.size > 0;
  // Unique invitee addresses, excluding the creator's own wallet.
  const inviteeAddrs = Array.from(
    new Map(
      okResolutions.filter((r) => r.address.toLowerCase() !== selfLower).map((r) => [r.address.toLowerCase(), r.address]),
    ).values(),
  );
  const signers = inviteeAddrs.length + 1;
  const majority = Math.floor(signers / 2) + 1;
  // Until a real co-owner is added, the scheme is a placeholder (a solo pool
  // isn't allowed), so don't imply a misleading 1-of-1.
  const schemeLabel = inviteeAddrs.length === 0 ? "n-of-n" : `${majority}-of-${signers}`;
  const yourPct = targetNum > 0 ? Math.min(100, (yourNum / targetNum) * 100) : 0;

  // The contract requires a partial deposit be >= 0.01 ETH unless it funds the
  // exact remaining gap. The creator's initial deposit is partial whenever it
  // doesn't cover the whole target, so enforce the same rule to avoid a revert.
  const fundsFullTarget = targetNum > 0 && yourNum >= targetNum;
  const contribTooLow = yourNum > 0 && !fundsFullTarget && yourNum < MIN_CONTRIB;

  const wrongChain = isConnected && chainId !== APP_CHAIN.chainId;
  const canSubmit =
    isConnected &&
    !wrongChain &&
    isEscrowConfigured &&
    labelInput.trim().length >= 3 &&
    !nameBlocked &&
    targetNum > 0 &&
    yourNum > 0 &&
    yourNum <= targetNum &&
    !contribTooLow &&
    inviteeAddrs.length >= 1 &&
    !hasSelfInvite &&
    !hasDuplicate &&
    checkingInvitees.length === 0 &&
    signers <= MAX_SIGNERS &&
    badInvitees.length === 0 &&
    step === "idle";

  function addInvitee() {
    if (invitees.length + 1 >= MAX_SIGNERS) return;
    setInvitees((v) => [...v, { id: Date.now(), value: "" }]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !publicClient) return;
    setError(null);
    try {
      const deadline = Math.floor(Date.now() / 1000) + days * 86400; // uint40 → number
      const targetWei = parseEther(target);

      setStep("creating");
      const hash1 = await writeContractAsync({
        ...cofferEscrow,
        functionName: "createPool",
        args: [labelInput.trim(), targetWei, deadline, inviteeAddrs],
      });
      const rc1 = await publicClient.waitForTransactionReceipt({ hash: hash1 });
      const events = parseEventLogs({ abi: cofferEscrowAbi, logs: rc1.logs, eventName: "PoolCreated" });
      const poolId = (events[0] as unknown as { args: { poolId: bigint } }).args.poolId;

      setStep("depositing");
      const hash2 = await writeContractAsync({
        ...cofferEscrow,
        functionName: "deposit",
        args: [poolId],
        value: parseEther(yourContrib),
      });
      await publicClient.waitForTransactionReceipt({ hash: hash2 });

      // Public is the default (absence of a record). Only a private pool needs a
      // creator-signed visibility write; failure is non-fatal.
      if (!isPublic) {
        try {
          if (!isSignedIn) await signIn();
          await fetch("/api/pools/visibility", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ poolId: Number(poolId), public: false }),
          });
        } catch {
          /* non-fatal: pool stays public until retried */
        }
      }

      setStep("done");
      router.push(`/vaults/${poolId.toString()}`);
    } catch (err) {
      setStep("idle");
      setError(txErrorMessage(err));
    }
  }

  const busy = step === "creating" || step === "depositing";

  return (
    <form className="wrap" onSubmit={submit}>
      <div className="crumb">
        <Link href="/">Discover</Link> <span>/</span>
        {label ? (
          <>
            <Link href={`/name/${label}`}>{label}.eth</Link> <span>/</span>
          </>
        ) : null}
        <span>Start a vault</span>
      </div>

      <div className="page-head">
        <div>
          <h1>Start a vault{labelInput ? ` to buy ${shortLabel(labelInput)}.eth` : ""}</h1>
          <p>
            Set your stake, then invite people by address. Everyone deposits into the open-source escrow on {APP_CHAIN.label}; on
            success it deploys a multisig you all control.
          </p>
        </div>
      </div>

      {!isEscrowConfigured && (
        <Alert className="mb-5" status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>
              Escrow address not configured. Set NEXT_PUBLIC_ESCROW_ADDRESS and restart the dev server.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <div className="cols">
        <div className="stack">
          <Card className="card-pill-header">
            <Card.Header>
              <Card.Title className="pill-num" data-num="1">
                Vault basics
              </Card.Title>
            </Card.Header>
            <Card.Content className="flex flex-col">
              <div className="flex flex-col gap-1.5 pb-5">
                <Label>
                  Name <span className="text-xs font-normal text-muted">the one .eth name this vault will buy · min 3 chars</span>
                </Label>
                <InputGroup fullWidth className={nameBlocked ? "border-danger" : undefined}>
                  {cleanLabel.length >= 3 && (
                    <InputGroup.Prefix>
                      <NameAvatar className="rounded-md" label={cleanLabel} size={24} />
                    </InputGroup.Prefix>
                  )}
                  <InputGroup.Input
                    className="text-base font-semibold tracking-tight"
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value.toLowerCase())}
                    placeholder="defi"
                  />
                  <InputGroup.Suffix>.eth</InputGroup.Suffix>
                </InputGroup>
                {(nameStatus === "checking" || statusInfo) && (
                  <p
                    className={`mt-1 inline-flex items-center gap-1 self-start text-xs font-medium ${
                      nameStatus === "checking"
                        ? "text-muted"
                        : nameStatus === "premium"
                          ? "text-[#7141c9]"
                          : nameStatus === "available"
                            ? "text-[#2e6b35]"
                            : statusInfo!.kind === "block"
                              ? "text-[#91414d]"
                              : "text-muted"
                    }`}
                    title={statusInfo?.note}
                  >
                    {nameStatus === "checking" ? (
                      <>
                        <Spinner color="current" size="sm" /> checking…
                      </>
                    ) : (
                      <>
                        {statusInfo!.kind === "block" ? "✕" : statusInfo!.kind === "ok" ? "✓" : "·"} {statusInfo!.text}
                        {nameStatus === "premium" && premiumEndsAt && premiumEndsAt * 1000 > Date.now()
                          ? ` · gone in ${fmtCountdown(premiumEndsAt)}`
                          : ""}
                      </>
                    )}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5 border-t border-dashed border-separator pt-5 pb-5">
                <Label>
                  Target amount <span className="text-xs font-normal text-muted">total the vault must raise · overpay refunded</span>
                </Label>
                <InputGroup fullWidth>
                  <InputGroup.Input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
                  <InputGroup.Suffix>ETH</InputGroup.Suffix>
                </InputGroup>
                <p className="mt-1 text-xs text-muted">
                  {signers > 1
                    ? `Split across ${signers} people. Aim for at least ${(signers * MIN_CONTRIB).toFixed(2)} ETH so each can clear the minimum.`
                    : "The full amount to raise. Invite people below to split it."}
                </p>
              </div>

              <div className="flex flex-col gap-1.5 border-t border-dashed border-separator pt-5 pb-5">
                <Label>
                  Your contribution <span className="text-xs font-normal text-muted">{yourPct.toFixed(1)}% ownership</span>
                </Label>
                <InputGroup fullWidth>
                  <InputGroup.Input inputMode="decimal" value={yourContrib} onChange={(e) => setYourContrib(e.target.value)} />
                  <InputGroup.Suffix>ETH</InputGroup.Suffix>
                </InputGroup>
                <input
                  className="range mt-2"
                  type="range"
                  min={0}
                  max={targetNum || 1}
                  step={0.001}
                  value={Math.min(yourNum, targetNum || 1)}
                  onChange={(e) => setYourContrib(e.target.value)}
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-xs text-muted">
                    Minimum <strong className="text-foreground">{MIN_CONTRIB} ETH</strong> per person
                  </span>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant={yourNum === MIN_CONTRIB ? "secondary" : "outline"}
                      onPress={() => setYourContrib(String(MIN_CONTRIB))}
                    >
                      Min
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      isDisabled={targetNum <= 0}
                      onPress={() => setYourContrib((targetNum / 2).toFixed(3))}
                    >
                      Half
                    </Button>
                    <Button
                      size="sm"
                      variant={fundsFullTarget ? "secondary" : "outline"}
                      isDisabled={targetNum <= 0}
                      onPress={() => setYourContrib(target)}
                    >
                      Fund it all
                    </Button>
                  </div>
                </div>
                {contribTooLow && (
                  <Alert className="mt-2" status="warning">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Description>
                        That&rsquo;s below the {MIN_CONTRIB} ETH minimum. Raise it to at least {MIN_CONTRIB} ETH, or fund the
                        full {targetNum > 0 ? targetNum.toFixed(3) : ""} ETH target yourself.
                      </Alert.Description>
                    </Alert.Content>
                  </Alert>
                )}
              </div>

              <div className="flex flex-col gap-1.5 border-t border-dashed border-separator pt-5 pb-5">
                <Label>
                  Funding deadline <span className="text-xs font-normal text-muted">days from now</span>
                </Label>
                <div className="flex items-center gap-3.5">
                  <input className="range" type="range" min={1} max={14} value={days} onChange={(e) => setDays(+e.target.value)} />
                  <span className="flex min-w-[118px] flex-col items-end">
                    <span className="mono font-semibold">{days}d</span>
                    <span className="text-[11px] whitespace-nowrap text-muted" suppressHydrationWarning>
                      ends {new Date(Date.now() + days * 86400_000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 border-t border-dashed border-separator pt-5">
                <Switch className="w-full" isSelected={isPublic} onChange={setIsPublic}>
                  <Switch.Content className="w-full justify-between">
                    <span>
                      List this vault publicly <span className="text-xs font-normal text-muted">shows in the Vaults directory</span>
                    </span>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Content>
                </Switch>
                <p className="mt-1 text-[13px] text-muted">
                  {isPublic
                    ? "Anyone can find this vault in the directory. Only addresses you invite can deposit."
                    : "Private Vault: only you and the people you invite can see it. You’ll sign a quick message to confirm you’re the creator."}
                </p>
              </div>
            </Card.Content>
          </Card>

          <Card className="card-pill-header">
            <Card.Header>
              <Card.Title className="pill-num" data-num="2">
                Invite co-owners
              </Card.Title>
            </Card.Header>
            <Card.Content>
              <p className="text-sm text-muted">
                <strong>At least one co-owner is required</strong>. Add each by ENS name or wallet address.
              </p>
              {invitees.map((i) => (
                <InviteeRow
                  key={i.id}
                  value={i.value}
                  selfAddress={address}
                  duplicate={duplicateIds.has(i.id)}
                  onChange={(val) => setInvitees((v) => v.map((x) => (x.id === i.id ? { ...x, value: val } : x)))}
                  onRemove={() => {
                    setInvitees((v) => v.filter((x) => x.id !== i.id));
                    setResolved((m) => {
                      const next = { ...m };
                      delete next[i.id];
                      return next;
                    });
                  }}
                  onResolve={(r) => setResolved((m) => ({ ...m, [i.id]: r ?? undefined }))}
                />
              ))}
              <Button
                className="mt-4"
                size="sm"
                variant="secondary"
                isDisabled={invitees.length + 1 >= MAX_SIGNERS}
                onPress={addInvitee}
              >
                + Add member {invitees.length + 1 >= MAX_SIGNERS ? "(max 10)" : ""}
              </Button>
              {signers === 2 && (
                <Alert className="mt-4" status="warning">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>
                      With 2 people it&rsquo;s 2-of-2: if one loses their key, the wallet is frozen. Add a third for a safety margin.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              )}
            </Card.Content>
          </Card>
        </div>

        <div className="stack">
          {/* mt matches the pill cards' overhang offset so the row tops align. */}
          <Card
            className="mt-[14px] border border-separator p-0 transition-all duration-150 hover:border-foreground/25 hover:bg-foreground/[0.03]"
            variant="secondary"
          >
            <details className="group">
              {/* Padding lives on the summary so the ENTIRE bar is the click target. */}
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-[inherit] p-4 text-sm font-medium text-foreground select-none [&::-webkit-details-marker]:hidden">
                How a vault works
                <svg
                  aria-hidden
                  className="shrink-0 text-muted transition-transform duration-150 group-open:rotate-180"
                  fill="none"
                  height="15"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.2"
                  viewBox="0 0 24 24"
                  width="15"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </summary>
              <div className="flex flex-col gap-3 px-4 pb-4">
                <div className="flex items-start gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center text-[12px] font-semibold text-muted">
                    1
                  </span>
                  <span className="text-sm">
                    You raise ETH to buy <strong>{labelInput ? `${shortLabel(labelInput)}.eth` : "one specific name"}</strong>.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center text-[12px] font-semibold text-muted">
                    2
                  </span>
                  <span className="text-sm">Everyone you invite deposits toward the target.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center text-[12px] font-semibold text-muted">
                    3
                  </span>
                  <span className="text-sm">
                    Once it&rsquo;s met, a shared Safe wallet is deployed to buy the name with. Each person co-owns it in
                    proportion to their deposit.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center text-[12px] font-semibold text-muted">
                    4
                  </span>
                  <span className="text-sm">
                    Buying needs a <strong>majority</strong> of co-owners to sign, so no one can act alone.
                  </span>
                </div>
                <p className="m-0 text-xs text-muted">The name is locked in once you start, so choose carefully.</p>
              </div>
            </details>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>Deploy</Card.Title>
            </Card.Header>
            <Card.Content>
              <div className="kv">
                <span className="k">Target</span>
                <span className="v">{targetNum.toFixed(3)} ETH</span>
              </div>
              <div className="kv">
                <span className="k">Your deposit</span>
                <span className="v accent">
                  {yourNum.toFixed(3)} ETH · {yourPct.toFixed(1)}%
                </span>
              </div>
              <div className="kv">
                <span className="k">Scheme</span>
                <span className="v">{schemeLabel}</span>
              </div>

              {!isConnected ? (
                <Alert className="mt-4" status="accent">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>Connect your wallet (top right) to create the vault.</Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : wrongChain ? (
                <Alert className="mt-4" status="warning">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>Switch your wallet to {APP_CHAIN.label} to continue.</Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : checkingInvitees.length > 0 ? (
                <Alert className="mt-4" status="accent">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>Resolving co-owners… hang on a moment.</Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : badInvitees.length > 0 || hasDuplicate || hasSelfInvite ? (
                <Alert className="mt-4" status="warning">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>
                      Fix the highlighted co-owner {badInvitees.length + duplicateIds.size + (hasSelfInvite ? 1 : 0) === 1 ? "error" : "errors"} above before creating the vault.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : inviteeAddrs.length === 0 ? (
                <Alert className="mt-4" status="accent">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>Invite at least one co-owner to start a vault, or buy the name solo instead.</Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : null}

              {error && (
                <Alert className="mt-4" status="warning">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>{error}</Alert.Description>
                  </Alert.Content>
                </Alert>
              )}

              <Button className="mt-4" fullWidth size="lg" type="submit" variant="primary" isDisabled={!canSubmit}>
                {step === "creating" ? "Confirm create in wallet…" : step === "depositing" ? "Confirm deposit in wallet…" : "Create vault & deposit"}
              </Button>
              <div className="mt-2.5 text-center text-xs text-muted">
                {busy ? "Two transactions: createPool, then your deposit." : `A ${schemeLabel} Safe deploys at finalization.`}
              </div>
            </Card.Content>
          </Card>
        </div>
      </div>
    </form>
  );
}

export default function NewPoolPage() {
  return (
    <Suspense
      fallback={
        <div className="wrap">
          <Spinner />
        </div>
      }
    >
      <NewPoolForm />
    </Suspense>
  );
}
