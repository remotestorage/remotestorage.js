#!/bin/bash
set -ex

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

difference="$(diff before after)"
rm before after

if [ -n "$difference" ]; then
    echo "$difference"
    exit 1
fi
