"use client";

import { useEffect, useState } from "react";
import { useEnsAvatar } from "@/hooks/use-ens-name";

const MASCOT_COUNT = 9;

// Deterministic pick so a given name shows the same mascot everywhere.
function mascotFor(label: string): string {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return `/nsicons/nsicon${(h % MASCOT_COUNT) + 1}.svg`;
}

/**
 * Avatar for an ENS *name*: resolves the name's avatar text record via
 * Resolvio (react-query cached) and falls back to a Namespace mascot when the
 * name has no avatar set (or its image fails to load). `size` is the pixel
 * square; pass rounding via `className`.
 */
export default function NameAvatar({
  label,
  size = 40,
  className = "",
}: {
  label: string;
  size?: number;
  className?: string;
}) {
  const { data: avatar } = useEnsAvatar(`${label}.eth`);
  const [errored, setErrored] = useState(false);

  // Reset the error state if the resolved avatar URL changes.
  useEffect(() => setErrored(false), [avatar]);

  const src = avatar && !errored ? avatar : mascotFor(label);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      aria-hidden
      className={`block flex-none object-cover ${className}`}
      height={size}
      src={src}
      style={{ width: size, height: size }}
      width={size}
      onError={() => setErrored(true)}
    />
  );
}
