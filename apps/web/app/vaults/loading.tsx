import { SkeletonCardGrid } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <h1>Vaults</h1>
          <p>
            Public vaults plus any private vaults you belong to. Ownership is always reconstructable from onchain
            deposits.
          </p>
        </div>
      </div>
      <SkeletonCardGrid count={6} />
    </div>
  );
}
