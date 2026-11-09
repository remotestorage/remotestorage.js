# Testing

Install the locked dependencies with `npm ci`. Source code is TypeScript;
Mocha and Jaribu execute the JavaScript compiled into `build/`.

```sh
npm test                         # Compile; run Jaribu together and per suite
npm run test:mocha -- --exit      # Run Mocha against the compiled code
npm run lint:quiet               # ESLint for source
npm run lint:specs:quiet         # ESLint for Mocha specs
```

`npm test` does not run Mocha or lint. Run all the commands above, or use the
combined coverage command for both test runners and run lint separately.

For a single Mocha file, compile first and call the executable directly:

```sh
./node_modules/.bin/tsc
./node_modules/.bin/mocha test/unit/sync-invariants.test.mjs --exit
```

`npm run test:mocha -- --grep 'Sync invariants' --exit` filters by test name.
For a single legacy suite, use
`./node_modules/.bin/jaribu test/unit/cachinglayer-suite.js` after compilation.
New tests should use Mocha/Chai; legacy suites are being ported gradually.

## Coverage

```sh
npm run test:coverage
```

This compiles once, then runs Mocha and the existing Jaribu script under c8.
V8 coverage is collected from both runners and their child processes, including
the legacy suites run individually. Executing a legacy suite more than once
does not count its lines more than once in the coverage percentage.

The `.c8rc.json` configuration includes **all compiled runtime modules**, even
those never imported by a test, and remaps them to `src/*.ts` using TypeScript
source maps. Only `build/interfaces/**` is excluded: these files contain type
interfaces/aliases and compile to empty module stubs. Tests, dependencies, and
bundles are outside the included `build/**/*.js` scope. Keep the `all` option;
removing it can hide completely untested modules. Inclusion/exclusion is applied
before remapping so TypeScript source paths remain in the reports.

Reports are local, ignored build output:

- `coverage/index.html`: navigable source report.
- `coverage/lcov.info`: LCOV for external tools.
- `coverage/coverage-summary.json`: per-file and aggregate percentages.
- `coverage/coverage-final.json`: detailed machine-readable coverage.

Each invocation clears the previous raw coverage. The initial aggregate floors
are 90% lines/statements, 85% branches, and 86% functions. These are modest guards
against substantial regression, not a requirement to preserve every existing
covered branch: inspect per-file reports and add meaningful tests for changes.
Do not exclude a difficult module or add ignore directives just to pass a floor.
V8 statement/line counts and branch counts depend on source maps and the Node
version; compare like-for-like runs. If the command fails, inspect the test
failure and coverage result rather than assuming a threshold is the cause.

### Initial measurement

Using Node 24.19.0 and the same c8 configuration against master at `42095af0`,
before and after adding the storage-boundary and sync-invariant tests:

| Scope | Lines before → after | Branches before → after | Functions before → after |
| --- | --- | --- | --- |
| All runtime modules | 90.17% → 90.45% | 85.48% → 86.02% | 86.84% → 87.75% |
| IndexedDB | 74.90% → 78.59% | 73.46% → 85.00% | 56.25% → 68.75% |
| Sync | 94.62% → 95.25% | 90.05% → 91.02% | 96.72% → 96.72% |

These numbers describe Node tests, not browser coverage. Transaction fixtures
exercise adapter decisions and injected errors; they do not validate a browser's
IndexedDB implementation, crash recovery, or cross-tab isolation. A covered line
also says nothing about all possible interleavings. See [sync invariants and
current limits](./internals/sync-invariants) for the tested cases, known gaps,
and the opt-in command that reproduces two currently failing expectations.

## Continuous integration

GitHub Actions runs `npm run test:coverage`, lint, and the production build on
Node 22, 24, and 26. Test and coverage failures fail the job. Each matrix job
uploads its reports as `coverage-node-<version>` even when a later step fails;
reports may be absent if installation or compilation failed before collection.
The workflow is `.github/workflows/test-and-lint.yml`.

Before adding a stronger sync guarantee, include a deterministic test of the
relevant ordering or failure. Browser tests for two tabs, database abort/reopen,
and reload recovery remain necessary beyond this unit-test measurement.
