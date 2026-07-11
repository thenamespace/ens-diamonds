import { getPremiumNames } from "@/lib/ens-premium";
import DiscoverGrid from "@/components/discover-grid";

// Cache the live premium list ~60s (bounds subgraph/RPC usage).
export const revalidate = 60;

export default async function Discover() {
  let names: Awaited<ReturnType<typeof getPremiumNames>> | null = null;
  try {
    names = await getPremiumNames();
  } catch {
    names = null;
  }

  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <span className="eyebrow">◆ Ethereum mainnet · live auction</span>
          <h1 style={{ marginTop: 16 }}>Names in temporary premium</h1>
          <p>
            Recently expired ENS names, decaying through their 21-day premium auction. The price falls roughly 50% a day
            — pool up to grab the ones worth having before someone else does.
          </p>
        </div>
      </div>

      {names === null ? (
        <div className="note note-warn">
          <span>⚠</span>
          <span>Couldn’t load live names from mainnet ENS right now. Please try again in a moment.</span>
        </div>
      ) : (
        <DiscoverGrid names={names} />
      )}
    </div>
  );
}
