
DOC_BIN=naturaldocs
DOC_DIR=./doc/code
DOC_CONFIG_DIR=./doc/config
SOURCE_DIR=./src

DOC_INPUTS=-i $(SOURCE_DIR) -i ./doc/pages/

NODEJS=node

default: build

build:
	cd build/ && $(NODEJS) build.js

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
push-assets: commit-build commit-docs push-gh-pages

doc:
	mkdir -p $(DOC_DIR) $(DOC_CONFIG_DIR)
	$(DOC_BIN) $(DOC_INPUTS) -o html $(DOC_DIR) -p $(DOC_CONFIG_DIR)

clean-doc:
	rm -rf $(DOC_DIR) $(DOC_CONFIG_DIR)/Data

.PHONY: doc clean-doc build commit-build push-build prepare-gh-pages
