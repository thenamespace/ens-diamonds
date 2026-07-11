import { getSession } from "@/lib/session";
import { getWatched } from "@/lib/watchlist";
import { getEnsNameData, weiToUsd, type EnsStatus } from "@/lib/ens-name";
import { fmtUsd, fmtEth } from "@/lib/format";
import SignInPrompt from "@/components/sign-in-prompt";
import WatchingCard, { type WatchingCardData } from "@/components/watching-card";

export const dynamic = "force-dynamic";

const STATUS_TEXT: Record<EnsStatus, string> = {
  active: "Registered",
  grace: "In grace period",
  premium: "In premium",
  available: "Available",
  tooShort: "Too short",
  invalid: "Invalid",
};

export default async function WatchingPage() {
  const session = await getSession();

  if (!session.address) {
    return (
      <div className="wrap">
        <div className="page-head">
          <div>
            <h1>Your watchlist</h1>
            <p>Sign in with your wallet to see the names you’re watching.</p>
          </div>
        </div>
        <SignInPrompt />
      </div>
    );
  }

  let cards: WatchingCardData[] = [];
  let failed = false;
  try {
    const labels = await getWatched(session.address);
    cards = await Promise.all(
      labels.map(async (label) => {
        try {
          const d = await getEnsNameData(label);
          const usd = weiToUsd(d.totalWei, d.ethUsd);
          const priceText = usd !== null ? fmtUsd(usd) : `${fmtEth(d.totalWei)} ETH`;
          return { label, statusText: STATUS_TEXT[d.status], priceText } as WatchingCardData;
        } catch {
          return { label, statusText: "—", priceText: "—" } as WatchingCardData;
        }
      }),
    );
  } catch {
    failed = true;
  }

  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <h1>Your watchlist</h1>
          <p>{cards.length === 0 ? "Names you watch show up here." : `${cards.length} name${cards.length === 1 ? "" : "s"} you’re tracking.`}</p>
        </div>
      </div>

      {failed ? (
        <div className="note note-warn">
          <span>⚠</span>
          <span>Couldn’t load your watchlist right now. Please try again in a moment.</span>
        </div>
      ) : cards.length === 0 ? (
        <div className="empty">
          <span className="mark" aria-hidden />
          <h3>No names yet</h3>
          <p>Tap the ☆ on any name to start watching it.</p>
        </div>
      ) : (
        <div className="grid">
          {cards.map((c) => (
            <WatchingCard key={c.label} data={c} />
          ))}
        </div>
      )}
    </div>
  );
}
