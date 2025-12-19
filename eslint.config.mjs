// @ts-check

import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  tseslint.configs.stylistic,
  eslintConfigPrettier,
  {
    ignores: ["dist/**", "node_modules/**", "tsconfig.json"],
  },
  {
    files: ["**/*.ts", "src/**", ["src/*", "**/.ts"], ["src/*", "**/.tsx"]],
    rules: {
      semi: "error",
      "prefer-const": "error",
      "no-console": "error",
      "no-unused-vars": "error",
      "no-unused-expressions": "error",
    },
    languageOptions: {
      parserOptions: {
        sourceType: "module",
        parser: tseslint.parser,
        projectService: true,
      },
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
      reportUnusedInlineConfigs: "error",
    },
  },
);
