#!/bin/bash
set -e

sed -i.bak -E "s/\"version\": \"(.*)\"/\"version\": \"$(node -p "var config = require('./package.json'); config.version")\"/" bower.json
rm bower.json.bak
