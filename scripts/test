#!/bin/bash
# Run all tests in one process
node_modules/jaribu/bin/jaribu
set -e
# Run suites one by one as different processes
find test -type f -name '*-suite\.js' | while read f; do
  node_modules/jaribu/bin/jaribu "$f";
done
