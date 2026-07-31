import { Avatar } from "@thenamespace/uikit";

import { truncateAddress } from "@/lib/helpers";

interface WalletAvatarProps {
  address: string;
  className?: string;
}

export function WalletAvatar({ address, className = "size-6" }: WalletAvatarProps) {
  return (
    <Avatar className={className}>
      <Avatar.Image alt="" src={`https://api.dicebear.com/9.x/glass/svg?seed=${address}`} />
      <Avatar.Fallback>{truncateAddress(address)}</Avatar.Fallback>
    </Avatar>
  );
}
