import { NextResponse } from "next/server";

import { normalize } from "viem/ens";

import { readNamePrices } from "@/lib/ens/read-name-prices";

const MAX_LABELS = 24;
const MAX_LABEL_LENGTH = 255;

export async function GET(request: Request) {
  try {
    const labels = parseLabels(new URL(request.url).searchParams.getAll("label"));
    const prices = await readNamePrices(labels);

    return NextResponse.json(prices, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    if (error instanceof RangeError || error instanceof TypeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Name prices are temporarily unavailable" }, { status: 502 });
  }
}

function parseLabels(values: string[]) {
  if (values.length === 0) throw new RangeError("At least one label is required");
  if (values.length > MAX_LABELS) throw new RangeError(`At most ${MAX_LABELS} labels are allowed`);

  const labels = values.map((value) => {
    const label = value.trim().replace(/\.eth$/iu, "");
    if (!label || label.length > MAX_LABEL_LENGTH || label.includes(".")) {
      throw new TypeError("Labels must be second-level .eth labels");
    }

    return normalize(`${label}.eth`).slice(0, -4);
  });

  return [...new Set(labels)];
}
