import { getKv } from "./kv";

// User feedback, newest first, capped so the list can't grow unbounded.
// Server-only — never import from a "use client" file.

const KEY = "feedback:entries";
const MAX_ENTRIES = 500;

export type FeedbackEntry = {
  message: string;
  contact: string | null;
  address: string | null;
  ts: number;
};

export async function recordFeedback(entry: FeedbackEntry): Promise<void> {
  const kv = getKv();
  await kv.lpush(KEY, JSON.stringify(entry));
  await kv.ltrim(KEY, 0, MAX_ENTRIES - 1);
}

export async function listFeedback(limit = 200): Promise<FeedbackEntry[]> {
  const raw = await getKv().lrange<string | FeedbackEntry>(KEY, 0, limit - 1);
  return (raw ?? []).flatMap((r) => {
    try {
      return [typeof r === "string" ? (JSON.parse(r) as FeedbackEntry) : r];
    } catch {
      return [];
    }
  });
}
