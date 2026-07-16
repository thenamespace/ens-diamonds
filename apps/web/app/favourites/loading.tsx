import { SkeletonCardGrid } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <h1>Your favourites</h1>
          <p>Loading the names you’re tracking…</p>
        </div>
      </div>
      <SkeletonCardGrid count={6} />
    </div>
  );
}
