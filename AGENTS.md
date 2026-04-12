# Scope

- This file applies to the entire repository: `remotestorage/remotestorage.js`.
- Follow these instructions for all code changes, scripts, and tests.

# Build, Lint, Test

- Install dependencies: `npm ci` (CI) or `npm install` (local).
- TypeScript compile: `tsc` or `tsc -w` for auto-compile on changes.
- Development bundle/watch: `npm run dev`.
- Production bundle: `npm run build:release` (webpack production).
- Lint sources: `npm run lint` (verbose) or `npm run lint:quiet`.
- Lint Mocha specs: `npm run lint:specs` or `npm run lint:specs:quiet`.
- Full test suite: `npm test` (runs `tsc` and `scripts/test-all.sh`).
- Mocha unit tests: `npm run test:mocha`.
- Mocha watch: `npm run test:watch`.
- Typedoc docs (CI release step): `typedoc` via `npm run version`.

# Running a Single Test

- Mocha (preferred for new tests):
  - Single file: `npm run test:mocha -- test/unit/<name>.test.mjs`.
  - Single test by grep: `npm run test:mocha -- --grep "pattern"`.
  - Watch a file: `npm run test:watch -- test/unit/<name>.test.mjs`.
- Jaribu (legacy suites while being ported):
  - Single suite: `./node_modules/.bin/jaribu test/unit/<suite>-suite.js`.
  - Notes: Jaribu suites are older `.js` files like `test/unit/inmemorycaching-suite.js`.

# Continuous Integration

- GitHub Actions workflow: `.github/workflows/test-and-lint.yml`.
- Matrix Node versions: `18`, `20`.
- Steps: `npm ci`, `npm test` (Jaribu), `npm run test:mocha -- --exit`, lint tasks, `npm run build:release`.

# Project Overview

- Library entrypoints: TypeScript sources in `src/` compiled/bundled to `release/`.
- Docs: VitePress in `docs/` with Typedoc-generated API pages.
- Tests: Legacy Jaribu suites in `test/unit/*-suite.js`; Mocha/Chai specs in `test/unit/*.test.mjs`.

# Languages and Tooling

- TypeScript (target `es2015`, module `commonjs`), Mocha/Chai, Sinon, ESLint (`@typescript-eslint`), Webpack, Typedoc.
- Formatting: esformatter is only used for `src/sync.js` via `npm run format` (legacy). Prefer ESLint autofix for TS files.

# Code Style Guidelines

## Imports

- Use TypeScript ES module syntax: `import { Thing } from "./path";`.
- Prefer named imports; default imports only when the module exports default.
- Relative paths: keep them short and stable; avoid deep chained `../../..` where possible by reorganizing modules if needed.
- Do not use `require` in TypeScript files (`.ts`). The ESLint config warns for `@typescript-eslint/no-var-requires`.

## Formatting

- Indentation: 2 spaces. ESLint enforces `indent: ["error", 2]`.
- Curly braces required: `curly: 2`.
- Semicolons required: `semi: 2`.
- Arrow function spacing enforced: `arrow-spacing: 2`.
- Block spacing enforced: `block-spacing: 2`.
- No multi-line string literals using `\` concatenations: `no-multi-str: 2`.
- Console: only `console.warn` and `console.error` allowed. `no-console` blocks other methods.
- Bitwise operators not allowed: `no-bitwise: 2`.
- Equality: always use strict `===`/`!==` (`eqeqeq: 2`).

## Types

- Avoid `any` wherever possible (`@typescript-eslint/no-explicit-any: 1`). Prefer precise interfaces and type aliases.
- Prefer explicit return types on exported functions.
- Avoid unused variables and parameters (`@typescript-eslint/no-unused-vars: 1`).
- Avoid using variables before definition (`@typescript-eslint/no-use-before-define: 1`).
- Allow empty interfaces only if necessary (`@typescript-eslint/no-empty-interface: 1`).
- Shadowing is warned (`@typescript-eslint/no-shadow: "warn"`); refactor to avoid.
- Globals: the ESLint config defines browser and node environments. Don’t introduce implicit globals.

## Naming Conventions

- Use `camelCase` for variables, parameters, and functions.
- Use `PascalCase` for classes, types, and enums.
- Constructors/new-cap: ESLint enforces capitalization for constructor-like identifiers; exceptions include `Authorize`, `Discover` in legacy code.
- File names: prefer `kebab-case` or `lowercase` for `.ts` files; keep names descriptive and aligned with exported symbols.
- Constants: UPPER_CASE only for true compile-time constants; otherwise use `camelCase`.

## Error Handling

- Do not use `debugger` (`no-debugger: 2`).
- Fail fast on invalid inputs; validate arguments and throw specific errors.
- Use domain-specific error classes where available (e.g., `UnauthorizedError` in `src/unauthorized-error.ts`, `SyncError` in `src/sync-error.ts`, `SchemaNotFoundError` in `src/schema-not-found-error.ts`).
- Avoid swallowing errors; when catching, either handle or rethrow with context.
- Logging: prefer `console.warn`/`console.error` and keep messages actionable.

## Asynchrony and Side Effects

- Prefer `async/await` over raw Promise chains for readability.
- Make network/storage side effects explicit in function names and docs.
- Avoid shared mutable state; encapsulate in classes/modules.

# Testing Guidelines

- New tests: write Mocha/Chai specs in `test/unit/*.test.mjs`.
- Use `sinon` for stubs/mocks/spies as needed.
- Keep tests deterministic; avoid relying on timers or external services.
- For single-test debugging: use `--grep` or isolate a `describe.only`/`it.only` in local runs (revert before committing).
- Lint specs with `npm run lint:specs`.

# Documentation

- Public APIs should have TSDoc comments; Typedoc generates docs.
- Update `docs/` guides when changing behavior or adding features.
- Docs are built with VitePress: `npm run docs:dev`, `npm run docs:build`, `npm run docs:preview`.
- Follow contributing docs in `docs/contributing/` (GitHub flow, building, testing, release checklist).

# Dependency Management

- Use exact or caret versions as configured. Do not introduce unpinned unstable dependencies.
- Keep `devDependencies` limited to tools needed for building/testing.
- Mac OS postshrinkwrap step adjusts `package-lock.json` URLs to `https` (`postshrinkwrap` script). Do not remove.

# Build Artifacts

- Generated bundles go to `release/`. Do not commit local debug builds.
- Types are emitted to `release/types`. The package `types` field points to `release/types/remotestorage.d.ts`.

# Performance and Complexity

- Keep cyclomatic complexity reasonable (`complexity: warn`).
- Limit function size (`max-statements: ["warn", 15]`). Break up large functions.

# Module Boundaries

- Core domains include: access, caching, clients, discovery, sync, storage backends.
- Place new code in the appropriate domain under `src/` with focused responsibilities.

# Logging and Diagnostics

- Use `src/log.ts` utilities if applicable; avoid ad-hoc logging scattered across modules.

# Browser vs Node

- Code runs in both environments. Guard usage of environment-specific APIs.
- For Node-specific types, see `@types/node` dependency.

# Security

- Avoid `eval` and `Function` constructors (`no-eval: 2`, `no-new-func: 0 but discouraged`).
- Validate external inputs and URLs; do not construct script URLs.

# Release Process

- `npm run preversion`: tests + lint + type build must pass.
- `npm run version`: builds release bundle and regenerates docs; commits `release/` and `docs/api/`.

# Cursor/Copilot Rules

- Cursor: no `.cursor/rules/` or `.cursorrules` found in this repo.
- Copilot: no `.github/copilot-instructions.md` present.
- If such rules are added later, agents must incorporate them into edits and reviews.

# Contributing

- Read `docs/contributing/` for detailed guidelines.
- Follow GitHub Flow: small PRs, clear descriptions, passing CI.

# Contact and Help

- Issues: https://github.com/remotestorage/remotestorage.js/issues
- Docs: https://remotestorage.io/rs.js/docs/
- Community: https://community.remotestorage.io/
- remoteStorage protocol specification: https://datatracker.ietf.org/doc/draft-dejong-remotestorage/

# Agent Notes

- Prefer small, targeted changes respecting existing structure.
- Do not add license headers unless requested.
- Do not commit unless explicitly asked; use local validation.
- Reference files with full paths when communicating changes.

# Assistant Config

- Config file: `opencode.config.json` at repo root.
- Approvals: `on_request` — assistant asks before sensitive actions.
- Sandbox: `workspace_write` filesystem; `restricted` network.
- Prompts: require an explicit user approval for `shell` commands unless the command is in the shell allowlist below.
- Allowlist (shell): npm scripts `dev`, `build:dev`, `build:js`, `test`, `test:mocha`, `test:watch`, `lint`, `lint:quiet`, `lint:specs`, `lint:specs:quiet`, `format`; command `npm install`.
- Behavior: Allowlisted shell commands bypass the extra approval prompt; all other shell commands require explicit user permission before tool use.
- RESTRICTIONS: For ANY shell command not in the allowlist (including `git`, `gh`, `ls`, `rm`, etc.), you MUST explicitly ask the user for permission in the chat BEFORE using the tool.
- GIT/GH POLICY: NEVER run `git commit`, `git push`, or `gh` commands without a direct, explicit request from the user.
