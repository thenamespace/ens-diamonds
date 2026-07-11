"use client";

import { useEffect, useState } from "react";
import { useEnsProfile } from "@/hooks/use-ens-name";

/**
 * Renders an address's ENS avatar (resolved via Resolvio) as a circular image.
 * Falls back to `fallback` when the address has no avatar set or the image
 * fails to load. `size` is the pixel diameter; `className` is applied to the
 * <img> so callers can reuse existing avatar sizing (e.g. the `.avatar` class).
 */
export default function EnsAvatar({
  address,
  size = 20,
  className,
  fallback = null,
}: {
  address?: string;
  size?: number;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const { avatar } = useEnsProfile(address);
  const [errored, setErrored] = useState(false);

  // Reset the error state if the resolved avatar URL changes.
  useEffect(() => setErrored(false), [avatar]);

  if (avatar && !errored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatar}
        alt=""
        width={size}
        height={size}
        onError={() => setErrored(true)}
        className={className}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flex: "none", display: "block" }}
      />
    );
  }

  return <>{fallback}</>;
}
