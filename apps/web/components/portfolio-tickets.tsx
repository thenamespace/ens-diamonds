"use client";

import Link from "next/link";
import { buttonVariants, Card, Chip } from "@thenamespace/uikit";
import AddressLabel from "@/components/address-label";
import NameAvatar from "@/components/name-avatar";
import { fmtEth } from "@/lib/format";
import { APP_CHAIN } from "@/lib/app-chain";

export type Solo = { label: string; expiry: number };
export type Vault = {
  poolId: number;
  label: string;
  safe: string;
  safeOwns: boolean;
  expiry: number | null;
  yourDeposit: string;
  totalDeposited: string;
  coOwners: { address: string; deposit: string }[];
};

function fmtExpiry(unix: number | null): string {
  if (!unix) return "—";
  const months = Math.round((unix * 1000 - Date.now()) / (30.44 * 24 * 3600 * 1000));
  if (months <= 0) return "expired";
  return `expires in ~${months} month${months === 1 ? "" : "s"}`;
}

function sharePct(deposit: string, total: string): number {
  const t = BigInt(total || "0");
  if (t === 0n) return 0;
  return Number((BigInt(deposit || "0") * 10000n) / t) / 100;
}

// Identity zone of a portfolio ticket: mascot/avatar, big name, holding line.
function TicketHead({ label, sub, chip }: { label: string; sub: string; chip: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3.5">
        <NameAvatar className="shrink-0 rounded-xl" label={label} size={44} />
        <div className="min-w-0">
          <div className="text-[26px] leading-[1.1] font-semibold tracking-tight break-words [overflow-wrap:anywhere] text-foreground">
            {label}
            <span className="font-normal text-muted">.eth</span>
          </div>
          <div className="mt-0.5 text-[13px] text-muted">{sub}</div>
        </div>
      </div>
      <Chip color="success" variant="soft" size="sm" className="mono mt-1 shrink-0 text-[10.5px] uppercase tracking-[0.07em]">
        {chip}
      </Chip>
    </div>
  );
}

// Ledger stat on the stub — same voice as CURRENT PRICE on discover tickets.
function TicketStat({ label, children, mono = true }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold tracking-[0.09em] uppercase text-muted">{label}</div>
      <div className={`${mono ? "font-mono " : ""}mt-1 text-[22px] leading-none font-semibold tracking-tight text-foreground`}>
        {children}
      </div>
    </div>
  );
}

const ticketCardClass =
  "gap-0 bg-transparent p-0 shadow-none transition-all duration-200 [filter:drop-shadow(0_2px_6px_rgba(18,21,28,0.08))] hover:[filter:drop-shadow(0_8px_12px_rgba(18,21,28,0.12))]";

// One fully-owned name, as a claim ticket.
export function SoloTicket({ n }: { n: Solo }) {
  return (
    <Card className={`reveal ${ticketCardClass}`}>
      <div className="ticket-top p-4">
        <TicketHead chip="Owned" label={n.label} sub={`in your wallet · ${fmtExpiry(n.expiry)}`} />
      </div>
      <div className="ticket-stub px-4 pt-3.5 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="flex flex-wrap gap-x-10 gap-y-3">
            <TicketStat label="Ownership">100%</TicketStat>
            <TicketStat label="Held by" mono={false}>
              Your wallet
            </TicketStat>
          </div>
          <a
            className={buttonVariants({ variant: "outline", size: "sm" })}
            href={`${APP_CHAIN.ensAppUrl}/${n.label}.eth`}
            target="_blank"
            rel="noreferrer"
          >
            View on ENS →
          </a>
        </div>
      </div>
    </Card>
  );
}

// One vault-co-owned name, as a claim ticket with the ownership ledger.
export function VaultTicket({ v, viewer }: { v: Vault; viewer?: string }) {
  const coOwners = [...v.coOwners].sort((a, b) => (BigInt(b.deposit) > BigInt(a.deposit) ? 1 : -1));
  const yourPct = sharePct(v.yourDeposit, v.totalDeposited);
  return (
    <Card className={`reveal ${ticketCardClass}`}>
      <div className="ticket-top p-4">
        <TicketHead chip="Co-owned" label={v.label} sub={`held by your vault's Safe · ${fmtExpiry(v.expiry)}`} />
      </div>

      <div className="ticket-stub px-4 pt-3.5 pb-4">
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <TicketStat label="Your share">{yourPct.toFixed(1)}%</TicketStat>
          <TicketStat label="Your deposit">{fmtEth(BigInt(v.yourDeposit), 4)}</TicketStat>
          <TicketStat label="Pooled total">{fmtEth(BigInt(v.totalDeposited), 4)}</TicketStat>
        </div>

        {/* Your slice of the vault, at a glance. */}
        <div aria-hidden className="bg-foreground/10 mt-3.5 h-1.5 overflow-hidden rounded-full">
          <div className="bg-foreground/75 h-full rounded-full" style={{ width: `${Math.min(100, yourPct)}%` }} />
        </div>

        <details className="group mt-3.5 border-t border-dashed border-separator pt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold text-muted [&::-webkit-details-marker]:hidden">
            Co-owners · {coOwners.length}
            <svg
              className="transition-transform duration-150 group-open:rotate-180"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </summary>
          <div className="mt-3 flex flex-col gap-2.5">
            {coOwners.map((m) => {
              const isYou = !!viewer && m.address.toLowerCase() === viewer.toLowerCase();
              const pctN = sharePct(m.deposit, v.totalDeposited);
              return (
                <div key={m.address} className="flex flex-wrap items-center gap-3">
                  <span
                    className="grid size-7 flex-none place-items-center rounded-full border border-separator bg-surface text-xs font-semibold text-muted"
                    aria-hidden
                  >
                    {m.address.slice(2, 3).toUpperCase()}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <AddressLabel address={m.address as `0x${string}`} />
                      {isYou && (
                        <Chip color="accent" variant="soft" size="sm">
                          you
                        </Chip>
                      )}
                    </span>
                    <span className="mono truncate text-[11px] text-muted">{m.address}</span>
                  </span>
                  <span className="mono text-[13px]">{fmtEth(BigInt(m.deposit), 4)}</span>
                  <span className="flex w-[130px] flex-none items-center gap-2">
                    <span className="bg-foreground/10 h-1.5 flex-1 overflow-hidden rounded-full" aria-hidden>
                      <span className="bg-foreground/75 block h-full rounded-full" style={{ width: `${Math.min(100, pctN)}%` }} />
                    </span>
                    <span className="mono text-[11.5px] text-muted">{pctN.toFixed(1)}%</span>
                  </span>
                </div>
              );
            })}
          </div>
        </details>

        <div className="mt-3.5 flex flex-wrap gap-2">
          <Link className={buttonVariants({ variant: "secondary", size: "sm" })} href={`/pools/${v.poolId}`}>
            View vault →
          </Link>
          <a
            className={buttonVariants({ variant: "outline", size: "sm" })}
            href={`${APP_CHAIN.ensAppUrl}/${v.label}.eth`}
            target="_blank"
            rel="noreferrer"
          >
            View on ENS →
          </a>
          <a
            className={buttonVariants({ variant: "outline", size: "sm" })}
            href={`https://app.safe.global/home?safe=${APP_CHAIN.safePrefix}:${v.safe}`}
            target="_blank"
            rel="noreferrer"
          >
            View in Safe →
          </a>
        </div>
      </div>
    </Card>
  );
}
