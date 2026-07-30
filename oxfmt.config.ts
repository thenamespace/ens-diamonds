import config from "klarity/oxfmt";

export default {
  ...config,
  ignorePatterns: [...config.ignorePatterns, "packages/contracts/lib/**", "spec.md"],
};
