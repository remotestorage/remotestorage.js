#!/bin/bash
set -euo pipefail
# c8 passes NODE_V8_COVERAGE to both runners and all their child processes.
node_modules/.bin/mocha 'test/unit/**/*.test.mjs' --exit
bash scripts/test-all.sh
