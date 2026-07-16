"use client";

import { Avatar } from "@thenamespace/uikit";
import { useEnsProfile } from "@/hooks/use-ens-name";

/**
 * Renders an address's ENS avatar (resolved via Resolvio) as a circular image.
 * Falls back to `fallback` when the address has no avatar set or the image
 * fails to load. `size` is the pixel diameter.
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

  if (!avatar) return <>{fallback}</>;

  return (
    <Avatar className={className} style={{ width: size, height: size }}>
      <Avatar.Image alt="" src={avatar} />
      <Avatar.Fallback className="bg-transparent">{fallback}</Avatar.Fallback>
    </Avatar>
  );
}
