import config from "klarity/oxlint/next";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [config],
  ignorePatterns: ["packages/contracts/lib/**"],
});
