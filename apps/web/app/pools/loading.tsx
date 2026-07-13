import { SkeletonPanelList } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <h1>Vaults</h1>
          <p>
            Public vaults plus any private vaults you belong to. Ownership is always reconstructable from on-chain
            deposits.
          </p>
        </div>
      </div>
      <SkeletonPanelList count={4} />
    </div>
  );
}
