import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Emitted by `prisma contract emit` — editing these to satisfy a lint rule
    // only lasts until the next emit overwrites them.
    "prisma/schema.d.ts",
    "migrations/snapshots/**",

    // Design references kept in the tree to look at, not to ship: third-party
    // HTML templates with their own minified jquery/bootstrap bundles. Linting
    // them buries this project's own findings under thousands of theirs.
    "vegefoods-1.0.0/**",
    "food-bar-gh-pages/**",

    // Agent skill files synced in by `prisma skills sync` (postinstall). They
    // are vendored copies of someone else's source, not this project's code.
    ".agents/**",
    ".claude/**",
    ".cursor/**",
    ".devin/**",
  ]),
  eslintConfigPrettier, // Prettier must be last to disable conflicting rules
]);

export default eslintConfig;
