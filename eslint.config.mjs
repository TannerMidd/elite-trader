import globals from "globals";

const restrictedHtmlProperties = [
  {
    property: "innerHTML",
    message: "Use the rendering helpers in ui/src/core/html.js.",
  },
  {
    property: "outerHTML",
    message: "Use the rendering helpers in ui/src/core/html.js.",
  },
  {
    property: "insertAdjacentHTML",
    message: "Use the rendering helpers in ui/src/core/html.js.",
  },
];

export default [
  {
    ignores: [
      "node_modules/**",
      ".venv/**",
      ".npm-cache/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "showcase/**",
      "build/**",
      "dist/**",
      "ui/hb.js",
      "ui/panel-bootstrap.js",
    ],
  },
  {
    files: ["ui/src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      "no-undef": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "max-lines": ["error", { max: 400, skipBlankLines: true, skipComments: true }],
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message: "Use a named API client backed by ui/src/core/http.js.",
        },
      ],
      "no-restricted-properties": ["error", ...restrictedHtmlProperties],
    },
  },
  {
    files: ["ui/src/core/http.js"],
    rules: {
      "no-restricted-globals": "off",
    },
  },
  {
    files: ["ui/src/data/**/*.js"],
    rules: {
      "max-lines": ["error", { max: 550, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ["ui/src/core/html.js"],
    rules: {
      "no-restricted-properties": "off",
    },
  },
  {
    files: ["ui/src/features/**/*.js", "ui/src/shell/**/*.js", "ui/src/bootstrap/**/*.js"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/core/http.js"],
              message: "Use a named domain client from ui/src/api/.",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "tests/ui/**/*.js",
      "tests/unit/**/*.js",
      "tests/e2e/**/*.js",
      "tools/**/*.mjs",
      "*.config.{js,mjs}",
      "eslint.config.mjs",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.nodeBuiltin,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      "no-undef": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      eqeqeq: ["error", "always", { null: "ignore" }],
    },
  },
  {
    files: ["tests/e2e/**/*.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: globals.node,
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      "no-undef": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      eqeqeq: ["error", "always", { null: "ignore" }],
    },
  },
];
