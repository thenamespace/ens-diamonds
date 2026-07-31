import type { Hex } from "viem";

const GRACE_PERIOD_SECONDS = 90 * 24 * 60 * 60;
const PREMIUM_PERIOD_SECONDS = 21 * 24 * 60 * 60;
const SNAPSHOT_BLOCK_LAG = 32;
const ETHEREUM_SLOT_SECONDS = 12;
const MAX_PAGE_SIZE = 100;
const MAX_OFFSET = 100_000;
const SHORTEST_QUERY_PAGE_SIZE = 1_000;
const SHORTEST_QUERY_CONCURRENCY = 5;

export type PremiumNamesSort = "newest" | "trending" | "ending-soon" | "shortest";

export type GetPremiumNamesProps = {
  sort: PremiumNamesSort;
  limit?: number;
  after?: string | null;
};

export type PremiumName = {
  label: string;
  name: `${string}.eth`;
  labelhash: Hex;
  labelLength: number;
  registrationExpiresAt: number;
  premiumStartsAt: number;
  premiumExpiresAt: number;
  subdomainCount: number;
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

type Snapshot = {
  blockNumber: number;
  timestamp: number;
};

type Cursor = Snapshot & {
  version: 1;
  sort: PremiumNamesSort;
  offset: number;
};

type Registration = {
  labelName: string;
  expiryDate: string;
  domain: {
    labelhash: Hex;
    subdomainCount: number;
  };
};

type GraphResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

let shortestSnapshotCache:
  | {
      blockNumber: number;
      registrations: Promise<Registration[]>;
    }
  | undefined;

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

const SHORTEST_SNAPSHOT_QUERY = `
  query ShortestPremiumNamesSnapshot {
    meta: _meta {
      block {
        number
        timestamp
      }
      hasIndexingErrors
    }
  }
`;

const PREMIUM_NAMES_QUERY = `
  query PremiumNames(
    $first: Int!
    $skip: Int!
    $blockNumber: Int!
    $premiumStart: BigInt!
    $premiumEnd: BigInt!
    $orderBy: Registration_orderBy!
    $orderDirection: OrderDirection!
  ) {
    registrations(
      first: $first
      skip: $skip
      block: { number: $blockNumber }
      orderBy: $orderBy
      orderDirection: $orderDirection
      where: {
        expiryDate_lte: $premiumStart
        expiryDate_gt: $premiumEnd
        labelName_not: null
      }
    ) {
      labelName
      expiryDate
      domain {
        labelhash
        subdomainCount
      }
    }
  }
`;

export async function getPremiumNames({
  sort,
  limit = 24,
  after,
}: GetPremiumNamesProps): Promise<PremiumNamesPage> {
  const pageSize = validatePageSize(limit);
  const cursor = after ? decodeCursor(after, sort) : null;
  const snapshot =
    cursor ??
    (await getSnapshot({
      query: sort === "shortest" ? SHORTEST_SNAPSHOT_QUERY : SNAPSHOT_QUERY,
      revalidate: sort === "shortest" ? 3_600 : 60,
    }));
  const offset = cursor?.offset ?? 0;

  const registrations =
    sort === "shortest"
      ? await getShortestRegistrations(snapshot)
      : await getOrderedRegistrations({
          sort,
          snapshot,
          first: pageSize + 1,
          skip: offset,
        });

  const pageRegistrations =
    sort === "shortest" ? registrations.slice(offset, offset + pageSize + 1) : registrations;
  const hasNextPage = pageRegistrations.length > pageSize;
  const names = pageRegistrations
    .slice(0, pageSize)
    .map((registration) => toPremiumName(registration));
  const nextOffset = offset + names.length;

  return {
    names,
    pageInfo: {
      asOf: snapshot.timestamp,
      blockNumber: snapshot.blockNumber,
      hasNextPage,
      endCursor: hasNextPage
        ? encodeCursor({
            version: 1,
            sort,
            offset: nextOffset,
            blockNumber: snapshot.blockNumber,
            timestamp: snapshot.timestamp,
          })
        : null,
    },
  };
}

async function getSnapshot({
  query,
  revalidate,
}: {
  query: string;
  revalidate: number;
}): Promise<Snapshot> {
  const data = await requestGraph<{
    meta: {
      block: { number: number; timestamp: number };
      hasIndexingErrors: boolean;
    };
  }>({ query, variables: {}, revalidate });

  if (data.meta.hasIndexingErrors) {
    throw new Error("ENS subgraph has indexing errors");
  }

  return {
    blockNumber: data.meta.block.number - SNAPSHOT_BLOCK_LAG,
    timestamp: data.meta.block.timestamp - SNAPSHOT_BLOCK_LAG * ETHEREUM_SLOT_SECONDS,
  };
}

async function getOrderedRegistrations({
  sort,
  snapshot,
  first,
  skip,
}: {
  sort: Exclude<PremiumNamesSort, "shortest">;
  snapshot: Snapshot;
  first: number;
  skip: number;
}): Promise<Registration[]> {
  const ordering = {
    newest: {
      orderBy: "expiryDate",
      orderDirection: "desc",
    },
    trending: {
      orderBy: "domain__subdomainCount",
      orderDirection: "desc",
    },
    "ending-soon": {
      orderBy: "expiryDate",
      orderDirection: "asc",
    },
  } as const;

  return queryRegistrations({
    snapshot,
    first,
    skip,
    revalidate: 60,
    ...ordering[sort],
  });
}

async function getShortestRegistrations(snapshot: Snapshot): Promise<Registration[]> {
  if (shortestSnapshotCache?.blockNumber === snapshot.blockNumber) {
    return shortestSnapshotCache.registrations;
  }

  const registrations = getShortestRegistrationBatch(snapshot, 0, []);
  shortestSnapshotCache = {
    blockNumber: snapshot.blockNumber,
    registrations,
  };

  try {
    return await registrations;
  } catch (error) {
    if (shortestSnapshotCache?.registrations === registrations) {
      shortestSnapshotCache = undefined;
    }
    throw error;
  }
}

async function getShortestRegistrationBatch(
  snapshot: Snapshot,
  offset: number,
  registrations: Registration[],
): Promise<Registration[]> {
  if (offset > MAX_OFFSET) {
    throw new Error("Premium name result exceeds the supported shortest-name scan");
  }

  const pages = await Promise.all(
    Array.from({ length: SHORTEST_QUERY_CONCURRENCY }, (_, index) =>
      queryRegistrations({
        snapshot,
        first: SHORTEST_QUERY_PAGE_SIZE,
        skip: offset + index * SHORTEST_QUERY_PAGE_SIZE,
        orderBy: "id",
        orderDirection: "asc",
        revalidate: 3_600,
      }),
    ),
  );

  const nextRegistrations = registrations.concat(...pages);
  if (pages.some((page) => page.length < SHORTEST_QUERY_PAGE_SIZE)) {
    return nextRegistrations.toSorted(compareByLabelLength);
  }

  return getShortestRegistrationBatch(
    snapshot,
    offset + SHORTEST_QUERY_PAGE_SIZE * SHORTEST_QUERY_CONCURRENCY,
    nextRegistrations,
  );
}

async function queryRegistrations({
  snapshot,
  first,
  skip,
  orderBy,
  orderDirection,
  revalidate,
}: {
  snapshot: Snapshot;
  first: number;
  skip: number;
  orderBy: "id" | "expiryDate" | "domain__subdomainCount";
  orderDirection: "asc" | "desc";
  revalidate: number;
}): Promise<Registration[]> {
  const data = await requestGraph<{ registrations: Registration[] }>({
    query: PREMIUM_NAMES_QUERY,
    variables: {
      first,
      skip,
      blockNumber: snapshot.blockNumber,
      premiumStart: String(snapshot.timestamp - GRACE_PERIOD_SECONDS),
      premiumEnd: String(snapshot.timestamp - GRACE_PERIOD_SECONDS - PREMIUM_PERIOD_SECONDS),
      orderBy,
      orderDirection,
    },
    revalidate,
  });

  return data.registrations;
}

async function requestGraph<T>({
  query,
  variables,
  revalidate,
}: {
  query: string;
  variables: Record<string, boolean | number | string>;
  revalidate: number;
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
    next: { revalidate },
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

function toPremiumName(registration: Registration): PremiumName {
  const registrationExpiresAt = Number(registration.expiryDate);
  const premiumStartsAt = registrationExpiresAt + GRACE_PERIOD_SECONDS;

  return {
    label: registration.labelName,
    name: `${registration.labelName}.eth`,
    labelhash: registration.domain.labelhash,
    labelLength: getLabelLength(registration.labelName),
    registrationExpiresAt,
    premiumStartsAt,
    premiumExpiresAt: premiumStartsAt + PREMIUM_PERIOD_SECONDS,
    subdomainCount: registration.domain.subdomainCount,
  };
}

function compareByLabelLength(a: Registration, b: Registration): number {
  return (
    getLabelLength(a.labelName) - getLabelLength(b.labelName) ||
    a.labelName.localeCompare(b.labelName) ||
    a.domain.labelhash.localeCompare(b.domain.labelhash)
  );
}

function getLabelLength(label: string): number {
  return Array.from(label).length;
}

function validatePageSize(limit: number): number {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new RangeError(`limit must be an integer between 1 and ${MAX_PAGE_SIZE}`);
  }

  return limit;
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(value: string, sort: PremiumNamesSort): Cursor {
  try {
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<Cursor>;

    if (
      cursor.version !== 1 ||
      cursor.sort !== sort ||
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
