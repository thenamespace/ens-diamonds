import config from "klarity/oxfmt";

export default {
  ...config,
  ignorePatterns: [
    ...config.ignorePatterns,
    "apps/web/src/routeTree.gen.ts",
    "packages/contracts/lib/**",
    "packages/contracts/ARCHITECTURE.md",
    "spec.md",
  ],
};
