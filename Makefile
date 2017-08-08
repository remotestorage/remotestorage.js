NODEJS         = node
NPM            = npm
DOC_BIN        = naturaldocs
DOC_DIR        = ./doc/code
DOC_CONFIG_DIR = ./doc/config
DOC_CUSTOM_CSS = custom-1
UGLIFY_BIN     = ./node_modules/.bin/uglifyjs
SOURCE_DIR     = ./src
DOC_INPUTS     = -i $(SOURCE_DIR)
SOURCES        = ${shell find $(SOURCE_DIR) -name "*.js"}

DEFAULT_COMPONENTS = core baseclient caching modules debug googledrive dropbox
NOCACHE_COMPONENTS = core baseclient modules debug googledrive dropbox

default: help

help:
	@echo "help           - display this text"
	@echo "build          - build remotestorage.js"
	@echo "doc            - generate documentation via NaturalDocs"
	@echo "clean          - remove all builds and editor swapfiles"


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
	mkdir -p $(DOC_DIR) $(DOC_CONFIG_DIR)
	$(DOC_BIN) $(DOC_INPUTS) -o html $(DOC_DIR) -p $(DOC_CONFIG_DIR) -s Default $(DOC_CUSTOM_CSS)

clean:
	rm -f remotestorage.js remotestorage.min.js remotestorage.amd.js remotestorage-nocache.js remotestorage-nocache.amd.js remotestorage-nocache.min.js ${shell find -name "*~"} ${shell find -name "*.swp"}
