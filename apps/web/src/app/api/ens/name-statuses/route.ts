import { NextResponse } from "next/server";

import { parseNameLabels } from "@/lib/ens/parse-name-labels";
import { readNameStatuses } from "@/lib/ens/read-name-statuses";

const MAX_LABELS = 24;

export async function GET(request: Request) {
  try {
    const labels = parseNameLabels(new URL(request.url).searchParams.getAll("label"), MAX_LABELS);
    const statuses = await readNameStatuses(labels);

    return NextResponse.json(statuses, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    if (error instanceof RangeError || error instanceof TypeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Name statuses are temporarily unavailable" },
      { status: 502 },
    );
  }
}
