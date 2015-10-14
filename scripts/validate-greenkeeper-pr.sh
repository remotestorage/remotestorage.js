#!/bin/bash
set -e

pr_branch="$(git symbolic-ref HEAD 2>/dev/null | cut -d"/" -f 3-)"

if [[ $pr_branch != greenkeeper* ]]; then
    echo "Not a greenkeeper PR"
    exit
fi

build-scripts() {
    make build build-amd minify build-nocache
    md5sum ./remotestorage*.js > $1
}

build-scripts after
git checkout master

build-scripts before
git checkout "$pr_branch"

# Exits with 1 if differences
diff before after
