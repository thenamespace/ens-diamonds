/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  redirects: async () => [
    // "Watching" was renamed to "Favourites" (heart) — keep old links working.
    { source: "/watching", destination: "/favourites", permanent: true },
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
