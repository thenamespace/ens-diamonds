import { getKv } from "./kv";

type KvLike = { incr(k: string): Promise<number>; expire(k: string, s: number): Promise<unknown> };

// Fixed-window limiter on Upstash: INCR + EXPIRE on first hit. Fails OPEN on
// KV errors — availability beats strictness for these low-stakes writes (every
// write route also has on-chain or signature verification as the real gate).
export function makeLimiter(kv: KvLike, opts: { max: number; windowSec: number }) {
  return async function limit(id: string, bucket: string): Promise<boolean> {
    try {
      const key = `rl:${bucket}:${id}`;
      const n = await kv.incr(key);
      if (n === 1) await kv.expire(key, opts.windowSec);
      return n <= opts.max;
    } catch {
      return true;
    }
  };
}

// Lazy so importing this module never eagerly constructs the KV client.
let shared: ReturnType<typeof makeLimiter> | null = null;
export function apiLimiter(id: string, bucket: string): Promise<boolean> {
  if (!shared) shared = makeLimiter(getKv(), { max: 30, windowSec: 60 });
  return shared(id, bucket);
}

// Client identity for rate limiting: first hop of x-forwarded-for (set by
// Vercel/proxies), else a shared "unknown" bucket.
export function clientId(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
}
