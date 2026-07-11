// Should this pool be shown to this viewer? Public → always. Private → only the
// creator or an on-chain-invited address (viewer must be connected).
export function isPoolVisible(opts: {
  isPrivate: boolean;
  viewer: string | null | undefined;
  creator: string;
  invited: boolean;
}): boolean {
  if (!opts.isPrivate) return true;
  if (!opts.viewer) return false;
  const v = opts.viewer.toLowerCase();
  return opts.creator.toLowerCase() === v || opts.invited;
}
