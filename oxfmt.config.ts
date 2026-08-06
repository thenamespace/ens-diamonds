import config from "klarity/oxfmt";

export default {
  ...config,
  ignorePatterns: [
    ...config.ignorePatterns,
    "packages/contracts/lib/**",
    "packages/contracts/ARCHITECTURE.md",
    "apps/web/drizzle/**/snapshot.json",
    "spec.md",
  ],
};
