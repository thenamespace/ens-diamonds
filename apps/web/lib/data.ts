// Seed data + helpers for the Coffer app.
// NOTE: representative data until the ponder indexer + CofferEscrow reads are
// wired in (Phase 2–4). Shapes mirror what the indexer will serve so screens
// swap to live data without UI changes.

export type PremiumName = {
  label: string;
  letters: number;
  expiredDaysAgo: number;
  premiumUsd: number; // current premium (falls ~50%/day)
  daysLeft: number; // until premium hits $0
  hoursLeft: number;
  poolsForming: number;
  watching: number;
  registrationUsd: number; // base 1yr registration
  cheap?: boolean;
  firstRegistered: string;
  prevOwner: string;
  twitter?: string;
};

export type PoolMemberStatus = "accepted" | "invited" | "withdrew";

export type PoolMember = {
  handle: string; // ENS name or shortened address
  address: string;
  contributionEth: number;
  ownershipBps: number; // of target
  status: PoolMemberStatus;
  via?: "telegram" | "email" | "link";
};

export type PoolStatus = "funding" | "funded" | "finalized" | "expired";

export type Pool = {
  id: string;
  label: string;
  status: PoolStatus;
  targetEth: number;
  depositedEth: number;
  threshold: number;
  maxSigners: number;
  deadlineDays: number;
  safe?: string;
  members: PoolMember[];
  activity: { at: string; text: string }[];
};

export const ETH_USD = 3340;

export function usd(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

export function eth(n: number, dp = 2): string {
  return n.toFixed(dp) + " ETH";
}

export function usdToEth(n: number): number {
  return n / ETH_USD;
}

export const NAMES: PremiumName[] = [
  { label: "defi", letters: 4, expiredDaysAgo: 13, premiumUsd: 12240, daysLeft: 8, hoursLeft: 22, poolsForming: 3, watching: 1204, registrationUsd: 160, firstRegistered: "Jun 2018", prevOwner: "0x8f2c…a3c", twitter: "@defidao" },
  { label: "swap", letters: 4, expiredDaysAgo: 15, premiumUsd: 3120, daysLeft: 6, hoursLeft: 10, poolsForming: 2, watching: 640, registrationUsd: 160, firstRegistered: "Mar 2019", prevOwner: "0x41ab…9f0" },
  { label: "dao", letters: 3, expiredDaysAgo: 10, premiumUsd: 48900, daysLeft: 11, hoursLeft: 4, poolsForming: 6, watching: 2810, registrationUsd: 640, firstRegistered: "Nov 2017", prevOwner: "0x1d77…c2e", twitter: "@daostack" },
  { label: "yield", letters: 5, expiredDaysAgo: 16, premiumUsd: 1780, daysLeft: 5, hoursLeft: 18, poolsForming: 1, watching: 420, registrationUsd: 5, firstRegistered: "Jan 2020", prevOwner: "0x93bc…77a" },
  { label: "vault", letters: 5, expiredDaysAgo: 17, premiumUsd: 920, daysLeft: 4, hoursLeft: 2, poolsForming: 0, watching: 210, registrationUsd: 5, cheap: true, firstRegistered: "Sep 2019", prevOwner: "0x0aa2…31d" },
  { label: "mint", letters: 4, expiredDaysAgo: 12, premiumUsd: 6540, daysLeft: 9, hoursLeft: 13, poolsForming: 4, watching: 980, registrationUsd: 160, firstRegistered: "Jul 2018", prevOwner: "0xbe41…8c9", twitter: "@mint" },
  { label: "stake", letters: 5, expiredDaysAgo: 14, premiumUsd: 2260, daysLeft: 6, hoursLeft: 1, poolsForming: 2, watching: 512, registrationUsd: 5, firstRegistered: "Feb 2020", prevOwner: "0x77de…40b" },
  { label: "zk", letters: 2, expiredDaysAgo: 9, premiumUsd: 88200, daysLeft: 12, hoursLeft: 9, poolsForming: 5, watching: 3450, registrationUsd: 640, firstRegistered: "May 2021", prevOwner: "0xf0c1…2ab", twitter: "@zksync" },
  { label: "bridge", letters: 6, expiredDaysAgo: 18, premiumUsd: 480, daysLeft: 3, hoursLeft: 20, poolsForming: 0, watching: 96, registrationUsd: 5, cheap: true, firstRegistered: "Oct 2019", prevOwner: "0x2c88…d1f" },
];

export function getName(label: string): PremiumName | undefined {
  return NAMES.find((n) => n.label === label.toLowerCase());
}

export const POOLS: Pool[] = [
  {
    id: "defi-eth",
    label: "defi",
    status: "funding",
    targetEth: usdToEth(12418),
    depositedEth: usdToEth(12418) * 0.64,
    threshold: 3,
    maxSigners: 5,
    deadlineDays: 4,
    members: [
      { handle: "you", address: "0x8f2c…a3c", contributionEth: usdToEth(4000), ownershipBps: 3220, status: "accepted", via: "link" },
      { handle: "vitalik.eth", address: "0xd8dA…6045", contributionEth: usdToEth(3000), ownershipBps: 2420, status: "accepted", via: "telegram" },
      { handle: "arb.eth", address: "0x1c3D…9a2", contributionEth: usdToEth(2000), ownershipBps: 1610, status: "accepted", via: "email" },
      { handle: "nick.eth", address: "0xb8c2…7f1", contributionEth: usdToEth(2018), ownershipBps: 1630, status: "invited", via: "telegram" },
    ],
    activity: [
      { at: "2h ago", text: "arb.eth deposited 0.60 ETH" },
      { at: "5h ago", text: "vitalik.eth accepted the invite" },
      { at: "1d ago", text: "Pool created by you · target 3.72 ETH" },
    ],
  },
  {
    id: "dao-eth",
    label: "dao",
    status: "funded",
    targetEth: usdToEth(49540),
    depositedEth: usdToEth(49540),
    threshold: 4,
    maxSigners: 6,
    deadlineDays: 0,
    safe: "0xA71c…9F4",
    members: [
      { handle: "you", address: "0x8f2c…a3c", contributionEth: usdToEth(9000), ownershipBps: 1816, status: "accepted", via: "link" },
      { handle: "punk6529.eth", address: "0x5e34…0b2", contributionEth: usdToEth(12000), ownershipBps: 2422, status: "accepted", via: "telegram" },
      { handle: "cobie.eth", address: "0x77aa…c19", contributionEth: usdToEth(8000), ownershipBps: 1615, status: "accepted", via: "email" },
      { handle: "hasu.eth", address: "0x2b90…4de", contributionEth: usdToEth(10540), ownershipBps: 2127, status: "accepted", via: "telegram" },
      { handle: "0x9f…21", address: "0x9f00…0021", contributionEth: usdToEth(10000), ownershipBps: 2018, status: "accepted", via: "link" },
    ],
    activity: [
      { at: "just now", text: "Target reached — execution window open for 7 days" },
      { at: "3h ago", text: "hasu.eth deposited 3.16 ETH" },
      { at: "2d ago", text: "Pool created by punk6529.eth" },
    ],
  },
];

export function getPool(id: string): Pool | undefined {
  return POOLS.find((p) => p.id === id);
}

export function poolsForLabel(label: string): Pool[] {
  return POOLS.filter((p) => p.label === label.toLowerCase());
}
