#!/bin/bash

# This script replicates the build process that ReadTheDocs uses, at least as well as it can

# Get script location/path: https://stackoverflow.com/a/246128
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
# Enter repository root
cd "$SCRIPT_DIR/.." || exit 1

# Setup conda environment
conda env create --quiet --name rtd_env --file doc/environment.yml
conda install --yes --quiet --name rtd_env mock pillow sphinx sphinx_rtd_theme
# Store conda bin path for later use
CONDA_BIN=/home/docs/.conda/envs/rtd_env/bin
"$CONDA_BIN/python" -m pip install -U --no-cache-dir recommonmark six readthedocs-sphinx-ext

# Build docs
cd doc || exit 1
"$CONDA_BIN/python" -m sphinx -v -T -E -b html -d _build/doctrees -D language=en . _build/html
