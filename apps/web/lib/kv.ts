import { Redis } from "@upstash/redis";

// Upstash provisions EITHER the KV_REST_API_* names (Vercel-KV back-compat) or
// the UPSTASH_REDIS_REST_* names, depending on how the store was linked. Read
// both. Construct lazily so a build without KV env still compiles/prerenders.
export function getKv(): Redis {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("KV not configured: set UPSTASH_REDIS_REST_URL/TOKEN (or KV_REST_API_URL/TOKEN)");
  }
  return new Redis({ url, token });
}
