import { getKv } from "./kv";

const PRIVATE_SET = "pools:private";

// A pool id is in this set iff it is PRIVATE. Absence = public.
export async function getPrivatePoolIds(): Promise<number[]> {
  const kv = getKv();
  const members = (await kv.smembers(PRIVATE_SET)) as (string | number)[];
  return members.map((m) => Number(m)).filter((n) => Number.isInteger(n));
}

export async function setPoolPrivate(poolId: number, isPrivate: boolean): Promise<void> {
  const kv = getKv();
  if (isPrivate) await kv.sadd(PRIVATE_SET, poolId);
  else await kv.srem(PRIVATE_SET, poolId);
}
