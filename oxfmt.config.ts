import config from "klarity/oxfmt";

export default {
  ...config,
  ignorePatterns: [
    ...config.ignorePatterns,
    "packages/contracts/lib/**",
    "packages/contracts/ARCHITECTURE.md",
    "spec.md",
  ],
};
