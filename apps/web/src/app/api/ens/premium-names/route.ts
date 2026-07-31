import { NextResponse } from "next/server";

import {
  getPremiumNames,
  type PremiumNameMatch,
  type PremiumNameOrder,
  type PremiumNamesFilters,
} from "@/lib/ens";

const NAME_MATCHES = new Set<PremiumNameMatch>(["contains", "startsWith", "exact"]);
const DEFAULT_LIMIT = 24;
const MAX_NAME_LENGTH = 255;

export async function GET(request: Request) {
  try {
    const parameters = new URL(request.url).searchParams;
    const name = parameters.get("name")?.trim();
    const match = parseNameMatch(parameters.get("match"));
    const filters: PremiumNamesFilters = {
      ...(name
        ? {
            name: {
              match,
              value: name,
            },
          }
        : {}),
      ...parseAvailability(parameters),
    };

    if (name && name.length > MAX_NAME_LENGTH) {
      throw new RangeError(`name must be at most ${MAX_NAME_LENGTH} characters`);
    }

    const page = await getPremiumNames({
      filters,
      order: parseOrder(parameters.get("order")),
      limit: parsePositiveInteger(parameters.get("limit"), "limit") ?? DEFAULT_LIMIT,
      after: parameters.get("cursor"),
    });

    return NextResponse.json(page, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    if (error instanceof RangeError || error instanceof TypeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Premium names are temporarily unavailable" },
      { status: 502 },
    );
  }
}

function parseOrder(value: string | null): PremiumNameOrder {
  if (value === null || value === "desc") return "desc";
  if (value === "asc") return "asc";

  throw new TypeError("order must be asc or desc");
}

function parseNameMatch(value: string | null): PremiumNameMatch {
  if (value === null) return "contains";
  if (NAME_MATCHES.has(value as PremiumNameMatch)) return value as PremiumNameMatch;

  throw new TypeError("match must be contains, startsWith, or exact");
}

function parseAvailability(parameters: URLSearchParams): Pick<PremiumNamesFilters, "availableAt"> {
  const from = parsePositiveInteger(parameters.get("availableFrom"), "availableFrom");
  const to = parsePositiveInteger(parameters.get("availableTo"), "availableTo");

  if (from === undefined && to === undefined) return {};

  return {
    availableAt: {
      ...(from === undefined ? {} : { from }),
      ...(to === undefined ? {} : { to }),
    },
  };
}

function parsePositiveInteger(value: string | null, field: string): number | undefined {
  if (value === null) return undefined;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new RangeError(`${field} must be a positive integer`);
  }

  return parsed;
}
