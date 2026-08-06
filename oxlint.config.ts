import config from "klarity/oxlint/next";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [config],
  ignorePatterns: ["packages/contracts/lib/**"],
  overrides: [
    {
      files: ["packages/subgraph/**/*.ts"],
      rules: {
        "typescript/consistent-type-imports": "off",
      },
    },
  ],
});
