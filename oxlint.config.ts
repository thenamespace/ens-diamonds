import config from "klarity/oxlint/react";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [config],
  ignorePatterns: ["apps/web/src/routeTree.gen.ts", "packages/contracts/lib/**"],
});
