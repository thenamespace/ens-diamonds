"use client";

import { isAddress } from "viem";
import { shortAddr } from "@/lib/format";
import { useEnsName } from "@/hooks/use-ens-name";
import { APP_CHAIN } from "@/lib/app-chain";

/**
 * Renders a wallet address as its primary ENS name when one is set (resolved
 * via Resolvio), otherwise falls back to a shortened 0x… address. Non-address
 * strings (e.g. seed placeholders) are rendered verbatim.
 *
 * `mono` keeps the JetBrains Mono treatment for the address fallback; when a
 * name resolves it drops mono so the name reads in the display font.
 * `linkEns` makes a resolved name link out to its ENS-app profile.
 */
export default function AddressLabel({
  address,
  className = "",
  mono = true,
  linkEns = false,
}: {
  address?: string;
  className?: string;
  mono?: boolean;
  linkEns?: boolean;
}) {
  const full = !!address && isAddress(address);
  const { data: name } = useEnsName(full ? address : undefined);

  if (name) {
    if (linkEns) {
      return (
        <a
          className={`${className ?? ""} underline-offset-2 hover:underline`.trim()}
          href={`${APP_CHAIN.ensAppUrl}/${name}`}
          rel="noreferrer"
          target="_blank"
          title={address}
          onClick={(e) => e.stopPropagation()}
        >
          {name}
        </a>
      );
    }
    return (
      <span className={className || undefined} title={address}>
        {name}
      </span>
    );
  }

  const text = full ? shortAddr(address) : address ?? "";
  const cls = [className, mono ? "mono" : ""].filter(Boolean).join(" ");
  return <span className={cls || undefined}>{text}</span>;
}
