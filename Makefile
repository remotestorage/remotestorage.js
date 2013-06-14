
DOC_BIN=naturaldocs
DOC_DIR=./doc/code
DOC_CONFIG_DIR=./doc/config
DOC_CUSTOM_CSS=custom-1
SOURCE_DIR=./src

ASSETS_DIR=./assets
ASSETS_OUT=$(SOURCE_DIR)/lib/assets.js

DOC_INPUTS=-i $(SOURCE_DIR) -i ./doc/pages/

NODEJS=node

VERSION ?= $(shell cat VERSION)

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

compile-assets: $(ASSETS_DIR)/*
	$(NODEJS) build/compile-assets.js $(ASSETS_DIR) $(ASSETS_OUT)

.PHONY: doc clean-doc build commit-build push-build prepare-gh-pages compile-assets release test

test:
	npm test

snapshot:
	make release VERSION=`git log -n1 | head -n1 | sed -r 's/commit (\w{8}).*/\1/'`

release: build
	rm -rf release/$(VERSION)
	cp -r build/latest release/$(VERSION)

	node build/update-version.js bower.json $(VERSION) > bower.json.tmp
	mv bower.json.tmp bower.json
	node build/update-version.js package.json $(VERSION) > package.json.tmp
	mv package.json.tmp package.json

commit-release: release
	git add release/$(VERSION) component.json package.json
	git commit -m "Release build: $(VERSION)"
	git tag v$(VERSION)
