import { getDiscoverPage, searchDiscoverPage } from "@/lib/discover-feed";
import { isSort } from "@/lib/discover-sort";
import { readLimiter, clientId } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Batch endpoint for the Discover infinite-scroll feed.
//   browse: GET /api/discover?sort=newest|trending|ending|shortest&offset=0
//   search: GET /api/discover?q=<query>&offset=0  (searches the whole premium set)
export async function GET(req: Request) {
  // Each call can fan out to ~24 mainnet price reads; keep it behind the
  // generous read limiter so normal infinite-scroll is unaffected but a
  // scripted loop can't drain the RPC/subgraph quota.
  if (!(await readLimiter(clientId(req), "discover"))) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const rawOffset = Number(searchParams.get("offset") ?? "0");
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;
  const q = searchParams.get("q")?.trim() ?? "";

  try {
    const page = q.length >= 2 ? await searchDiscoverPage(q, offset) : await getDiscoverPage(sortOf(searchParams), offset);
    return Response.json(page);
  } catch {
    return Response.json({ error: "load-failed" }, { status: 502 });
  }
}

function sortOf(params: URLSearchParams) {
  const s = params.get("sort");
  return isSort(s) ? s : "ending";
}
