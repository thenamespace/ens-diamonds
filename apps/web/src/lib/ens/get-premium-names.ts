import type { Hex } from "viem";
import { normalize } from "viem/ens";

import { SECONDS_PER_DAY } from "@/lib/constants";
import { getUnixTime } from "@/lib/helpers";

const GRACE_PERIOD_SECONDS = 90 * SECONDS_PER_DAY;
const PREMIUM_PERIOD_SECONDS = 21 * SECONDS_PER_DAY;
const AVAILABLE_AT_OFFSET = GRACE_PERIOD_SECONDS + PREMIUM_PERIOD_SECONDS;
const SNAPSHOT_BLOCK_LAG = 32;
const MAX_PAGE_SIZE = 100;
const MAX_OFFSET = 100_000;
const FULL_SET_PAGE_SIZE = 1_000;
const FULL_SET_SHARDS = 7;
const FULL_SET_MAX_PAGES_PER_SHARD = 10;
const CACHE_SECONDS = 5 * 60;

export type PremiumNameMatch = "contains" | "startsWith" | "exact";
export type PremiumNameSort = "ending" | "newest" | "shortest" | "trending";

export type PremiumNamesFilters = {
  name?: {
    match: PremiumNameMatch;
    value: string;
  };
  availableAt?: {
    from?: number;
    to?: number;
  };
};

export type GetPremiumNamesProps = {
  filters?: PremiumNamesFilters;
  sort?: PremiumNameSort;
  limit?: number;
  after?: string | null;
};

export type PremiumName = {
  label: string;
  name: `${string}.eth`;
  labelhash: Hex;
  registrationExpiresAt: number;
  premiumStartsAt: number;
  availableAt: number;
};

export type PremiumNamesPage = {
  names: PremiumName[];
  pageInfo: {
    asOf: number;
    blockNumber: number;
    hasNextPage: boolean;
    endCursor: string | null;
  };
};

type NormalizedFilters = {
  name?: {
    match: PremiumNameMatch;
    value: string;
  };
  availableAt?: {
    from?: number;
    to?: number;
  };
};

type Snapshot = {
  blockNumber: number;
  timestamp: number;
};

type Cursor = Snapshot & {
  version: 2;
  offset: number;
  filters: string;
};

type Registration = {
  id: string;
  labelName: string;
  expiryDate: string;
  domain: {
    labelhash: Hex;
  };
};

type GraphResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

type GraphOrder = "asc" | "desc";

export type PremiumRegistrationSet = {
  registrations: Registration[];
  snapshot: Snapshot;
};

const SNAPSHOT_QUERY = `
  query PremiumNamesSnapshot {
    meta: _meta {
      block {
        number
        timestamp
      }
      hasIndexingErrors
    }
  }
`;

const NAME_FILTER_FIELDS = {
  contains: "labelName_contains_nocase",
  startsWith: "labelName_starts_with_nocase",
  exact: "labelName",
} as const;

export async function getPremiumNames(
  { filters, sort = "ending", limit = 24, after }: GetPremiumNamesProps = {},
  shortestSource?: PremiumRegistrationSet,
): Promise<PremiumNamesPage> {
  const pageSize = validatePageSize(limit);
  const normalizedFilters = normalizeFilters(filters);
  const normalizedSort = validateSort(sort);
  const filterKey = JSON.stringify({ filters: normalizedFilters, sort: normalizedSort });
  const cursor = after ? decodeCursor(after, filterKey) : null;
  const offset = cursor?.offset ?? 0;

  if (normalizedSort === "shortest") {
    const source = await resolveShortestSource(cursor, shortestSource);
    const snapshot = cursor ?? source.snapshot;
    const registrations = source.registrations.filter((registration) =>
      registrationMatchesFilters(registration, normalizedFilters, snapshot),
    );
    const page = registrations.slice(offset, offset + pageSize);
    const hasNextPage = offset + page.length < registrations.length;

    return {
      names: page.map(toPremiumName),
      pageInfo: {
        asOf: snapshot.timestamp,
        blockNumber: snapshot.blockNumber,
        hasNextPage,
        endCursor: hasNextPage
          ? encodeCursor({
              version: 2,
              offset: offset + page.length,
              filters: filterKey,
              blockNumber: snapshot.blockNumber,
              timestamp: snapshot.timestamp,
            })
          : null,
      },
    };
  }

  const snapshot = cursor ?? (await getSnapshot());
  const registrations = await queryRegistrations({
    filters: normalizedFilters,
    order: normalizedSort === "newest" ? "desc" : "asc",
    snapshot,
    first: pageSize + 1,
    skip: offset,
  });
  const hasNextPage = registrations.length > pageSize;
  const page = registrations.slice(0, pageSize);
  const names = page.map(toPremiumName);

  return {
    names,
    pageInfo: {
      asOf: snapshot.timestamp,
      blockNumber: snapshot.blockNumber,
      hasNextPage,
      endCursor: hasNextPage
        ? encodeCursor({
            version: 2,
            offset: offset + names.length,
            filters: filterKey,
            blockNumber: snapshot.blockNumber,
            timestamp: snapshot.timestamp,
          })
        : null,
    },
  };
}

async function resolveShortestSource(
  cursor: Cursor | null,
  cached: PremiumRegistrationSet | undefined,
) {
  if (
    cached &&
    (!cursor ||
      (cursor.blockNumber === cached.snapshot.blockNumber &&
        cursor.timestamp === cached.snapshot.timestamp))
  ) {
    return cached;
  }

  return getPremiumRegistrationSet(cursor ?? undefined);
}

export async function getPremiumRegistrationSet(snapshot?: Snapshot) {
  const resolvedSnapshot = snapshot ?? (await getSnapshot());
  const { from, to } = getPremiumExpiryBounds(resolvedSnapshot);
  const span = to - from + 1;
  const shards = Array.from({ length: FULL_SET_SHARDS }, (_, index) => ({
    from: from + Math.floor((span * index) / FULL_SET_SHARDS),
    to: from + Math.floor((span * (index + 1)) / FULL_SET_SHARDS) - 1,
  }));
  const registrations = (
    await Promise.all(shards.map((expiry) => queryRegistrationShard(resolvedSnapshot, expiry)))
  ).flat();

  return {
    registrations: sortByShortest(registrations),
    snapshot: resolvedSnapshot,
  } satisfies PremiumRegistrationSet;
}

async function queryRegistrationShard(snapshot: Snapshot, expiry: { from: number; to: number }) {
  const registrations: Registration[] = [];
  let cursor = "";

  for (let page = 0; page < FULL_SET_MAX_PAGES_PER_SHARD; page += 1) {
    const query = `
      query PremiumNamesFullSet(
        $first: Int!
        $cursor: String!
        $blockNumber: Int!
        $expiryFrom: BigInt!
        $expiryTo: BigInt!
      ) {
        registrations(
          first: $first
          block: { number: $blockNumber }
          orderBy: id
          orderDirection: asc
          where: {
            id_gt: $cursor
            expiryDate_gte: $expiryFrom
            expiryDate_lte: $expiryTo
            labelName_not: null
          }
        ) {
          id
          labelName
          expiryDate
          domain { labelhash }
        }
      }
    `;
    // eslint-disable-next-line no-await-in-loop -- Each keyset page depends on the previous cursor.
    const data = await requestGraph<{ registrations: Registration[] }>({
      query,
      variables: {
        first: FULL_SET_PAGE_SIZE,
        cursor,
        blockNumber: snapshot.blockNumber,
        expiryFrom: String(expiry.from),
        expiryTo: String(expiry.to),
      },
    });

    registrations.push(...data.registrations);
    if (data.registrations.length < FULL_SET_PAGE_SIZE) return registrations;

    cursor = data.registrations.at(-1)?.id ?? "";
  }

  throw new Error(
    `Premium name shard exceeds the ${FULL_SET_MAX_PAGES_PER_SHARD * FULL_SET_PAGE_SIZE} limit`,
  );
}

export async function getTrendingPremiumNames({
  rankedLabels,
  fallbackSource,
  filters,
  limit,
  after,
}: {
  rankedLabels: string[];
  fallbackSource: PremiumRegistrationSet;
  filters?: PremiumNamesFilters;
  limit: number;
  after?: string | null;
}): Promise<PremiumNamesPage> {
  const pageSize = validatePageSize(limit);
  const normalizedFilters = normalizeFilters(filters);
  const offset = parseTrendingOffset(after);
  const snapshot = fallbackSource.snapshot;
  const data =
    rankedLabels.length > 0
      ? await queryTrendingRegistrations(rankedLabels, snapshot)
      : { registrations: [] };
  const byLabel = new Map(
    data.registrations
      .filter((registration) =>
        registrationMatchesFilters(registration, normalizedFilters, snapshot),
      )
      .map((registration) => [registration.labelName.toLowerCase(), registration]),
  );
  const registrations = rankedLabels.flatMap((label) => {
    const registration = byLabel.get(label.toLowerCase());
    return registration ? [registration] : [];
  });
  const seenLabels = new Set(registrations.map(({ labelName }) => labelName.toLowerCase()));
  const fallbackRegistrations = fallbackSource.registrations.filter((registration) => {
    const label = registration.labelName.toLowerCase();
    if (seenLabels.has(label)) return false;
    return registrationMatchesFilters(registration, normalizedFilters, snapshot);
  });
  const combined = [...registrations, ...fallbackRegistrations];
  const page = combined.slice(offset, offset + pageSize);
  const hasNextPage = offset + page.length < combined.length;

  return {
    names: page.map(toPremiumName),
    pageInfo: {
      asOf: snapshot.timestamp,
      blockNumber: snapshot.blockNumber,
      hasNextPage,
      endCursor: hasNextPage ? String(offset + page.length) : null,
    },
  };
}

async function queryTrendingRegistrations(rankedLabels: string[], snapshot: Snapshot) {
  const { from, to } = getPremiumExpiryBounds(snapshot);

  return requestGraph<{ registrations: Registration[] }>({
    query: `
      query TrendingPremiumNames(
        $labels: [String!]!
        $blockNumber: Int!
        $expiryFrom: BigInt!
        $expiryTo: BigInt!
      ) {
        registrations(
          first: 100
          block: { number: $blockNumber }
          where: {
            labelName_in: $labels
            expiryDate_gte: $expiryFrom
            expiryDate_lte: $expiryTo
            labelName_not: null
          }
        ) {
          id
          labelName
          expiryDate
          domain { labelhash }
        }
      }
    `,
    variables: {
      labels: rankedLabels,
      blockNumber: snapshot.blockNumber,
      expiryFrom: String(from),
      expiryTo: String(to),
    },
  });
}

async function getSnapshot(): Promise<Snapshot> {
  const data = await requestGraph<{
    meta: {
      block: { number: number; timestamp: number };
      hasIndexingErrors: boolean;
    };
  }>({
    query: SNAPSHOT_QUERY,
    variables: {},
  });

  if (data.meta.hasIndexingErrors) {
    throw new Error("ENS subgraph has indexing errors");
  }

  return {
    blockNumber: data.meta.block.number - SNAPSHOT_BLOCK_LAG,
    timestamp: getUnixTime(),
  };
}

async function queryRegistrations({
  filters,
  order,
  snapshot,
  first,
  skip,
}: {
  filters: NormalizedFilters;
  order: GraphOrder;
  snapshot: Snapshot;
  first: number;
  skip: number;
}): Promise<Registration[]> {
  const premiumExpiryFrom = snapshot.timestamp - GRACE_PERIOD_SECONDS - PREMIUM_PERIOD_SECONDS + 1;
  const premiumExpiryTo = snapshot.timestamp - GRACE_PERIOD_SECONDS;
  const expiryFrom = Math.max(
    premiumExpiryFrom,
    filters.availableAt?.from ? filters.availableAt.from - AVAILABLE_AT_OFFSET : premiumExpiryFrom,
  );
  const expiryTo = Math.min(
    premiumExpiryTo,
    filters.availableAt?.to ? filters.availableAt.to - AVAILABLE_AT_OFFSET : premiumExpiryTo,
  );

  if (expiryFrom > expiryTo) return [];

  const nameFilter = filters.name ? `${NAME_FILTER_FIELDS[filters.name.match]}: $name` : "";
  const nameVariable = filters.name ? "$name: String!" : "";
  const query = `
    query PremiumNames(
      $first: Int!
      $skip: Int!
      $blockNumber: Int!
      $expiryFrom: BigInt!
      $expiryTo: BigInt!
      ${nameVariable}
    ) {
      registrations(
        first: $first
        skip: $skip
        block: { number: $blockNumber }
        orderBy: expiryDate
        orderDirection: ${order}
        where: {
          expiryDate_gte: $expiryFrom
          expiryDate_lte: $expiryTo
          labelName_not: null
          ${nameFilter}
        }
      ) {
        id
        labelName
        expiryDate
        domain {
          labelhash
        }
      }
    }
  `;

  const data = await requestGraph<{ registrations: Registration[] }>({
    query,
    variables: {
      first,
      skip,
      blockNumber: snapshot.blockNumber,
      expiryFrom: String(expiryFrom),
      expiryTo: String(expiryTo),
      ...(filters.name ? { name: filters.name.value } : {}),
    },
  });

  return data.registrations;
}

function getPremiumExpiryBounds(snapshot: Snapshot) {
  return {
    from: snapshot.timestamp - GRACE_PERIOD_SECONDS - PREMIUM_PERIOD_SECONDS + 1,
    to: snapshot.timestamp - GRACE_PERIOD_SECONDS,
  };
}

function registrationMatchesFilters(
  registration: Registration,
  filters: NormalizedFilters,
  snapshot: Snapshot,
) {
  const expiry = Number(registration.expiryDate);
  const premiumBounds = getPremiumExpiryBounds(snapshot);
  if (expiry < premiumBounds.from || expiry > premiumBounds.to) return false;

  const availableAt = expiry + AVAILABLE_AT_OFFSET;
  if (filters.availableAt?.from !== undefined && availableAt < filters.availableAt.from) {
    return false;
  }
  if (filters.availableAt?.to !== undefined && availableAt > filters.availableAt.to) return false;
  if (!filters.name) return true;

  const label = registration.labelName.toLocaleLowerCase();
  const value = filters.name.value.toLocaleLowerCase();

  if (filters.name.match === "exact") return label === value;
  if (filters.name.match === "startsWith") return label.startsWith(value);
  return label.includes(value);
}

function sortByShortest(registrations: Registration[]) {
  return registrations
    .flatMap((registration) => {
      try {
        return [{ registration, length: Array.from(normalize(registration.labelName)).length }];
      } catch {
        return [];
      }
    })
    .toSorted(
      (a, b) =>
        a.length - b.length ||
        Number(a.registration.expiryDate) - Number(b.registration.expiryDate) ||
        compareStrings(a.registration.id, b.registration.id),
    )
    .map(({ registration }) => registration);
}

function compareStrings(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

async function requestGraph<T>({
  query,
  variables,
}: {
  query: string;
  variables: Record<string, number | string | string[]>;
}): Promise<T> {
  const url = process.env.SUBGRAPH_URL;
  if (!url) throw new Error("SUBGRAPH_URL is not configured");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    cache: "force-cache",
    next: { revalidate: CACHE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`ENS subgraph request failed with status ${response.status}`);
  }

  const result = (await response.json()) as GraphResponse<T>;
  if (result.errors?.length) {
    throw new Error(`ENS subgraph request failed: ${result.errors[0]?.message ?? "unknown error"}`);
  }
  if (!result.data) throw new Error("ENS subgraph returned no data");

  return result.data;
}

function normalizeFilters(filters?: PremiumNamesFilters): NormalizedFilters {
  const name = filters?.name
    ? {
        match: filters.name.match,
        value: filters.name.value.trim().replace(/\.eth$/iu, ""),
      }
    : undefined;

  if (name && !name.value) {
    throw new TypeError("Name filter value cannot be empty");
  }
  if (name && !Object.hasOwn(NAME_FILTER_FIELDS, name.match)) {
    throw new TypeError("Invalid name filter match");
  }

  const from = filters?.availableAt?.from;
  const to = filters?.availableAt?.to;
  if (from !== undefined) validateTimestamp(from, "availableAt.from");
  if (to !== undefined) validateTimestamp(to, "availableAt.to");
  if (from !== undefined && to !== undefined && from > to) {
    throw new RangeError("availableAt.from cannot be later than availableAt.to");
  }

  return {
    ...(name ? { name } : {}),
    ...(from !== undefined || to !== undefined
      ? {
          availableAt: {
            ...(from !== undefined ? { from } : {}),
            ...(to !== undefined ? { to } : {}),
          },
        }
      : {}),
  };
}

function toPremiumName(registration: Registration): PremiumName {
  const registrationExpiresAt = Number(registration.expiryDate);
  const premiumStartsAt = registrationExpiresAt + GRACE_PERIOD_SECONDS;

  return {
    label: registration.labelName,
    name: `${registration.labelName}.eth`,
    labelhash: registration.domain.labelhash,
    registrationExpiresAt,
    premiumStartsAt,
    availableAt: premiumStartsAt + PREMIUM_PERIOD_SECONDS,
  };
}

function validatePageSize(limit: number): number {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new RangeError(`limit must be an integer between 1 and ${MAX_PAGE_SIZE}`);
  }

  return limit;
}

function validateSort(sort: PremiumNameSort): PremiumNameSort {
  if (sort !== "ending" && sort !== "newest" && sort !== "shortest") {
    throw new TypeError("sort must be ending, newest, or shortest");
  }

  return sort;
}

function validateTimestamp(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${field} must be a positive Unix timestamp`);
  }
}

function parseTrendingOffset(after?: string | null) {
  if (!after) return 0;

  const offset = Number(after);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > MAX_OFFSET) {
    throw new TypeError("Invalid trending names cursor");
  }

  return offset;
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(value: string, filters: string): Cursor {
  try {
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<Cursor>;

    if (
      cursor.version !== 2 ||
      cursor.filters !== filters ||
      !Number.isSafeInteger(cursor.offset) ||
      !Number.isSafeInteger(cursor.blockNumber) ||
      !Number.isSafeInteger(cursor.timestamp) ||
      cursor.offset === undefined ||
      cursor.blockNumber === undefined ||
      cursor.timestamp === undefined ||
      cursor.offset < 0 ||
      cursor.offset > MAX_OFFSET ||
      cursor.blockNumber < 1 ||
      cursor.timestamp < 1
    ) {
      throw new Error("Cursor validation failed");
    }

    return cursor as Cursor;
  } catch {
    throw new TypeError("Invalid premium names cursor");
  }
}
