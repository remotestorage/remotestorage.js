ASSETS_DIR=./assets
ASSETS_OUT=./src/assets.js
NODEJS=node

default: help

help:
	@echo "help           - display this text"
	@echo "buildserver    - start build server (running on port 8000)"
	@echo "build-all      - download complete build from build server"
	@echo "compile-assets - compile $(ASSETS_DIR)/* into $(ASSETS_OUT)"
buildserver:
	cd build/ && node server.js

build-all:
	curl -X POST -d 'groups=core&groups=widget&groups=baseclient&groups=caching&groups=modules&groups=debug' http://localhost:8000/ -o remotestorage.js

minify:
	uglifyjs remotestorage.js -o remotestorage.min.js --mangle --wrap --export-all

compile-assets: $(ASSETS_DIR)/*
	$(NODEJS) build/compile-assets.js $(ASSETS_DIR) $(ASSETS_OUT)


.PHONY: help buildserver build-all minify compile-assets
