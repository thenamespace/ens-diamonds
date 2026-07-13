// Server-safe skeleton primitives for route loading states (loading.tsx). Pure
// markup that reuses the shimmer CSS in globals.css (.skeleton, .sk, sk-*).

export function SkeletonCard() {
  return (
    <div className="ncard sk" aria-hidden>
      <div className="ncard-top">
        <span className="skeleton sk-mono" />
        <span className="skeleton sk-star" />
      </div>
      <span className="skeleton sk-line" style={{ width: "62%", height: 24, marginTop: 4 }} />
      <div className="ncard-price">
        <span className="skeleton sk-line" style={{ width: 74, height: 9 }} />
        <span className="skeleton sk-line" style={{ width: "56%", height: 24, marginTop: 6 }} />
        <span className="skeleton sk-line" style={{ width: 96, height: 11, marginTop: 6 }} />
      </div>
      <div className="ncard-foot">
        <span className="skeleton sk-chip" />
      </div>
    </div>
  );
}

export function SkeletonCardGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonPanelList({ count = 4 }: { count?: number }) {
  return (
    <div className="stack" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="panel sk">
          <div className="row" style={{ gap: 14, alignItems: "center" }}>
            <span className="skeleton sk-mono" />
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <span className="skeleton sk-line" style={{ width: 170, height: 18 }} />
              <span className="skeleton sk-line" style={{ width: 230, height: 12 }} />
            </div>
            <span className="skeleton sk-chip" style={{ marginLeft: "auto" }} />
          </div>
          <span className="skeleton sk-line" style={{ width: "100%", height: 8, marginTop: 18, borderRadius: 999 }} />
        </div>
      ))}
    </div>
  );
}

// Neutral page-head placeholder (eyebrow / title / subtitle lines).
export function SkeletonPageHead() {
  return (
    <div className="page-head" aria-hidden>
      <div>
        <span className="skeleton sk-line" style={{ display: "block", width: 190, height: 13 }} />
        <span className="skeleton sk-line" style={{ display: "block", width: 300, height: 34, marginTop: 16 }} />
        <span className="skeleton sk-line" style={{ display: "block", width: "70%", maxWidth: 560, height: 14, marginTop: 14 }} />
      </div>
    </div>
  );
}
