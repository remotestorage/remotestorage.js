NODEJS         = node
NPM            = npm
UGLIFY_BIN     = ./node_modules/.bin/uglifyjs
SOURCE_DIR     = ./src
SOURCES        = ${shell find $(SOURCE_DIR) -name "*.js"}

DEFAULT_COMPONENTS = core baseclient caching modules debug googledrive dropbox
NOCACHE_COMPONENTS = core baseclient modules debug googledrive dropbox

default: help

help:
	@echo "help           - Display this text"
	@echo "build          - Build remotestorage.js"
	@echo "doc            - Generate documentation with Sphinx"
	@echo "clean          - Remove all builds and editor swapfiles"

all: deps build doc

build-all: all
minify: remotestorage.min.js
build: deps remotestorage.js

.PHONY: help buildserver build-all minify build doc clean test

deps:
	npm install

test:
	node_modules/jaribu/bin/jaribu
	set -xe && find test -type f | grep 'suite\.js' | while read f; do \
		node_modules/jaribu/bin/jaribu "$$f"; \
	done

remotestorage.js: $(SOURCES)
	$(NPM) run build

doc:
	cd doc && sphinx-build . _build/html

clean:
	rm -f remotestorage.js remotestorage.min.js remotestorage.amd.js remotestorage-nocache.js remotestorage-nocache.amd.js remotestorage-nocache.min.js ${shell find -name "*~"} ${shell find -name "*.swp"}
