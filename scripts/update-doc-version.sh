#!/bin/bash
set -e

echo "__version__ = '$(node -p "var config = require('./package.json'); config.version")'" > doc/version.py
