
DOC_BIN=naturaldocs
DOC_DIR=./doc/code
DOC_CONFIG_DIR=./doc/config
DOC_CUSTOM_CSS=custom-1
SOURCE_DIR=./src

ASSETS_DIR=./assets
ASSETS_OUT=$(SOURCE_DIR)/lib/assets.js

DOC_INPUTS=-i $(SOURCE_DIR) -i ./doc/pages/

NODEJS=node

default: debug-only

build:
	cd build/ && $(NODEJS) build.js

debug-only:
	cd build/ && $(NODEJS) build.js debug

prepare-gh-pages:
	git checkout gh-pages
	git merge master

push-gh-pages:
	git push origin gh-pages

commit-build: prepare-gh-pages build
	git add build/
	git commit -m "build: `date -u`"
	git checkout master

commit-docs: prepare-gh-pages doc
	git add $(DOC_DIR) $(DOC_CONFIG_DIR)
	git commit -m "doc build: `date -u`"
	git checkout master

push-build: commit-build push-gh-pages
push-docs: commit-docs push-gh-pages

doc:
	mkdir -p $(DOC_DIR) $(DOC_CONFIG_DIR)
	$(DOC_BIN) $(DOC_INPUTS) -o html $(DOC_DIR) -p $(DOC_CONFIG_DIR) -s Default $(DOC_CUSTOM_CSS)

clean-doc:
	rm -rf $(DOC_DIR) $(DOC_CONFIG_DIR)/Data

$(ASSETS_OUT): assets/*
	$(NODEJS) build/compile-assets.js $(ASSETS_DIR) $(ASSETS_OUT)

compile-assets: $(ASSETS_OUT)

.PHONY: doc clean-doc build commit-build push-build prepare-gh-pages compile-assets
