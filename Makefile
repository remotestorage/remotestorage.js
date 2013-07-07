NODEJS         = node
DOC_BIN        = naturaldocs
DOC_DIR        = ./doc/code
DOC_CONFIG_DIR = ./doc/config
DOC_CUSTOM_CSS = custom-1
SOURCE_DIR     = ./src
ASSETS_DIR     = ./assets
ASSETS_OUT     = $(SOURCE_DIR)/assets.js
DOC_INPUTS     = -i $(SOURCE_DIR)

default: help

help:
	@echo "help           - display this text"
	@echo "build          - build remotestorage.js"
	@echo "minify         - minify remotestorage.js -> remotestorage.min.js"
	@echo "buildserver    - start build server (running on port 8000)"
	@echo "build-all      - download complete build from build server"
	@echo "compile-assets - compile $(ASSETS_DIR)/* into $(ASSETS_OUT)"

buildserver:
	cd build/ && node server.js

build-all:
	curl -X POST -d 'groups=core&groups=widget&groups=baseclient&groups=caching&groups=modules&groups=debug' http://localhost:8000/ -o remotestorage.js

minify:
	uglifyjs remotestorage.js -o remotestorage.min.js --mangle --wrap --export-all

build:
	$(NODEJS) build/do-build.js core widget baseclient caching modules debug

compile-assets: $(ASSETS_DIR)/*
	$(NODEJS) build/compile-assets.js $(ASSETS_DIR) $(ASSETS_OUT)

doc:
	mkdir -p $(DOC_DIR) $(DOC_CONFIG_DIR)
	$(DOC_BIN) $(DOC_INPUTS) -o html $(DOC_DIR) -p $(DOC_CONFIG_DIR) -s Default $(DOC_CUSTOM_CSS)

.PHONY: help buildserver build-all compile-assets minify build doc
