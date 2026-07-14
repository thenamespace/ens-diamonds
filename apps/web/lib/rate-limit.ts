import { getKv } from "./kv";

type KvLike = { eval(script: string, keys: string[], args: (string | number)[]): Promise<unknown> };

// INCR + EXPIRE-on-first-hit as ONE atomic script. Two separate commands can
// strand a key: if EXPIRE fails after a successful INCR the key never expires
// and that IP+bucket eventually hard-blocks forever.
const WINDOW_SCRIPT =
  "local n = redis.call('INCR', KEYS[1]) if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end return n";

// Fixed-window limiter on Upstash. Fails OPEN on KV errors — availability
// beats strictness for these low-stakes writes (every write route also has
// on-chain or signature verification as the real gate).
export function makeLimiter(kv: KvLike, opts: { max: number; windowSec: number }) {
  return async function limit(id: string, bucket: string): Promise<boolean> {
    try {
      const key = `rl:${bucket}:${id}`;
      const n = Number(await kv.eval(WINDOW_SCRIPT, [key], [opts.windowSec]));
      if (!Number.isFinite(n)) return true; // unexpected reply — fail open
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
