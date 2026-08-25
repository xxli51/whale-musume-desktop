import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", "dist/**", "dist-next/**", "assets/generated/**", "build/**"]
  },
  js.configs.recommended,
  {
    files: ["main.cjs", "preload.cjs", "runtime/**/*.cjs", "tools/**/*.cjs", "test/**/*.mjs"],
    languageOptions: { globals: globals.node },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      "no-empty": ["error", { allowEmptyCatch: true }]
    }
  },
  {
    files: ["renderer/**/*.js", "assets/**/*.js"],
    languageOptions: { sourceType: "script", globals: { ...globals.browser, module: "readonly" } },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      "no-empty": ["error", { allowEmptyCatch: true }]
    }
  },
  {
    files: ["assets/**/*.js"],
    rules: { "no-unused-vars": "off" }
  }
];
