// robots.txt alone does not deindex already-crawled pages; the testnet build
// (and any local/preview build) also sends an explicit noindex header.
const isIndexableBuild = process.env.NEXT_PUBLIC_APP_CHAIN === "mainnet";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The vault social-card images read these font files with fs at runtime;
  // include them in the traced output so deployed functions can find them.
  outputFileTracingIncludes: {
    "/vaults/[id]/opengraph-image": ["./assets/fonts/*.ttf"],
    "/vaults/[id]/twitter-image": ["./assets/fonts/*.ttf"],
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        // The signing UI must never render in an iframe (clickjacking).
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ...(isIndexableBuild ? [] : [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]),
      ],
    },
  ],
  redirects: async () => [
    // "Watching" was renamed to "Favourites" (heart) — keep old links working.
    { source: "/watching", destination: "/favourites", permanent: true },
    // Vault pages moved from /pools to /vaults (UI language is "vault") —
    // keep previously shared links working. API routes stay under /api/pools.
    { source: "/pools", destination: "/vaults", permanent: true },
    { source: "/pools/:path*", destination: "/vaults/:path*", permanent: true },
    // Wallets flag *.vercel.app as a phishing-prone shared platform — always
    // serve from the canonical domain. (Host-matched, so the Sepolia project
    // and preview deployments are unaffected.)
    {
      source: "/:path*",
      has: [{ type: "host", value: "ens-diamonds.vercel.app" }],
      destination: "https://www.ens.diamonds/:path*",
      permanent: true,
    },
  ],
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  webpack: (config) => {
    // Optional native-only dep pulled in by @metamask/sdk via wagmi connectors.
    // Not used in the browser build — stub it to silence the warning.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
    };
    return config;
  },
};

export default nextConfig;
