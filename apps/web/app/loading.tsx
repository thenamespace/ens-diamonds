import { SkeletonPageHead, SkeletonCardGrid } from "@/components/skeletons";

// Generic route-loading fallback. Because it lives at the app root it also
// covers any nested route without its own loading.tsx (name page, buy, etc.),
// so it stays neutral rather than Discover-specific.
export default function Loading() {
  return (
    <div className="wrap">
      <SkeletonPageHead />
      <div className="toolbar" aria-hidden>
        <span className="skeleton sk-line" style={{ width: 320, height: 42, borderRadius: 999 }} />
        <span className="skeleton sk-line" style={{ width: 340, height: 42, borderRadius: 999, marginLeft: "auto" }} />
      </div>
      <SkeletonCardGrid count={9} />
    </div>
  );
}
