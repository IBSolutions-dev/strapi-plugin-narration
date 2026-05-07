const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const globals = require("globals");
const react = require("eslint-plugin-react");
const reactHooks = require("eslint-plugin-react-hooks");
const prettier = require("eslint-config-prettier");

const TS_FILES = ["**/*.{ts,tsx}"];
const JS_FILES = ["**/*.{js,cjs,mjs}"];

/** @type {import("eslint").Linter.FlatConfig[]} */
module.exports = [
  {
    ignores: ["dist/**", "node_modules/**", "vitest.config.ts", "**/*.tgz"],
  },
  js.configs.recommended,
  {
    files: TS_FILES,
    languageOptions: {
      parser: tseslint.parser,
      globals: {
        ...globals.es2021,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      react,
      "react-hooks": reactHooks,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...prettier.rules,

      ...tseslint.configs.recommended.rules,

      "react/react-in-jsx-scope": "off",
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["server/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["admin/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: JS_FILES,
    rules: {
      ...prettier.rules,
    },
  },
];
