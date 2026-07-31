import type { Hex } from "viem";

const GRACE_PERIOD_SECONDS = 90 * 24 * 60 * 60;
const PREMIUM_PERIOD_SECONDS = 21 * 24 * 60 * 60;
const AVAILABLE_AT_OFFSET = GRACE_PERIOD_SECONDS + PREMIUM_PERIOD_SECONDS;
const SNAPSHOT_BLOCK_LAG = 32;
const ETHEREUM_SLOT_SECONDS = 12;
const MAX_PAGE_SIZE = 100;
const MAX_OFFSET = 100_000;

export type PremiumNameMatch = "contains" | "startsWith" | "exact";

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
  version: 1;
  offset: number;
  filters: string;
};

type Registration = {
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

export async function getPremiumNames({
  filters,
  limit = 24,
  after,
}: GetPremiumNamesProps = {}): Promise<PremiumNamesPage> {
  const pageSize = validatePageSize(limit);
  const normalizedFilters = normalizeFilters(filters);
  const filterKey = JSON.stringify(normalizedFilters);
  const cursor = after ? decodeCursor(after, filterKey) : null;
  const snapshot = cursor ?? (await getSnapshot());
  const offset = cursor?.offset ?? 0;
  const registrations = await queryRegistrations({
    filters: normalizedFilters,
    snapshot,
    first: pageSize + 1,
    skip: offset,
  });
  const hasNextPage = registrations.length > pageSize;
  const names = registrations.slice(0, pageSize).map(toPremiumName);

  return {
    names,
    pageInfo: {
      asOf: snapshot.timestamp,
      blockNumber: snapshot.blockNumber,
      hasNextPage,
      endCursor: hasNextPage
        ? encodeCursor({
            version: 1,
            offset: offset + names.length,
            filters: filterKey,
            blockNumber: snapshot.blockNumber,
            timestamp: snapshot.timestamp,
          })
        : null,
    },
  };
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
    timestamp: data.meta.block.timestamp - SNAPSHOT_BLOCK_LAG * ETHEREUM_SLOT_SECONDS,
  };
}

async function queryRegistrations({
  filters,
  snapshot,
  first,
  skip,
}: {
  filters: NormalizedFilters;
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
        orderDirection: asc
        where: {
          expiryDate_gte: $expiryFrom
          expiryDate_lte: $expiryTo
          labelName_not: null
          ${nameFilter}
        }
      ) {
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

async function requestGraph<T>({
  query,
  variables,
}: {
  query: string;
  variables: Record<string, number | string>;
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
    next: { revalidate: 60 },
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

function validateTimestamp(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${field} must be a positive Unix timestamp`);
  }
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(value: string, filters: string): Cursor {
  try {
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<Cursor>;

    if (
      cursor.version !== 1 ||
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
