
DOC_BIN=naturaldocs
DOC_DIR=./doc/code
DOC_CONFIG_DIR=./doc/config
SOURCE_DIR=./src

default:

.PHONY: doc clean-doc

doc:
	mkdir -p $(DOC_DIR) $(DOC_CONFIG_DIR)
	$(DOC_BIN) -i $(SOURCE_DIR) -o html $(DOC_DIR) -p $(DOC_CONFIG_DIR)

clean-doc:
	rm -rf $(DOC_DIR)


