import { getDiscoverPage, type DiscoverPage } from "@/lib/discover-feed";
import DiscoverGrid from "@/components/discover-grid";

// Default tab: "ending" (deepest into the 21-day decay = lowest premium = the
// actually-poolable names); day-0 names carry ENS's huge starting premium.
const INITIAL_SORT = "ending" as const;

// Cache the live premium list ~60s (bounds subgraph/RPC usage).
export const revalidate = 60;

export default async function Discover() {
  let initial: DiscoverPage | null = null;
  try {
    initial = await getDiscoverPage(INITIAL_SORT, 0);
  } catch {
    initial = null;
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

      {initial === null ? (
        <div className="note note-warn">
          <span>⚠</span>
          <span>Couldn’t load live names from mainnet ENS right now. Please try again in a moment.</span>
        </div>
      ) : (
        <DiscoverGrid initial={initial} initialSort={INITIAL_SORT} />
      )}
    </div>
  );
}
