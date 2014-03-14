# remoteStorage.js Changelog

All releases can also be found and downloaded on the
[releases page](https://github.com/remotestorage/remotestorage.js/releases) at GitHub.

## 0.10.0 (February 2014)

This release contains a rewrite of the tree-based sync system.

* A new `maxAge` parameter is available in the various baseclient get... functions, where
  you can specify the maximum age of cached results (in ms). This replaces the
  ready-queue from 0.9.0.
* Caching of subtrees can now be configured as ALL, SEEN,
  or FlUSH. The second one means documents that were seen once, will stay synced.
  Check the [caching documentation](http://remotestorage.io/doc/code/files/caching-js.html)
  for details.
 
## 0.9.0 (December 2013)

This release consists of awesome contributions from @skddc, @galfert, @ggrin,
@michielbdejong, @clochix, @silverbucket, @gregkare, and @rakyll - you can participate
in the next release via https://github.com/remotestorage/remotestorage.js/issues!

* Rename the 'root' module to '*' (breaking change)
* Return a map instead of a string per item in getListing (breaking change)
* Support for draft-dejong-remotestorage-02.txt
* Fix multiple overlapping requests on first pageload
* Fix requests going to non-ready cache before initial sync finished
* Better error messages in widget
* Label change events from initial sync as 'local' if they come from local
* Add JSHint config
* Add in-memory storage for when neither IndexedDB nor localStorage are
  available
* Move the example server and example apps to gh:remotestorage/starter-kit
* Add setSyncInterval method
* Add i18n module, enable translation/customization of all content strings
* Fix minor issues in the experimental GoogleDrive backend (in dark launch)

## 0.8.3 (November 2013)

* Make sure to clear auth token after disconnect
* Fix invalid conditional request headers (If-Match & If-None-Match)
* Fix double-encoded paths
* Removed broken example app

## 0.8.2 (October 2013)

* Size reduced by almost 25%, to 34K minified, gzipped
* Fixes issues with non-ASCII characters in item names
* Fixes unnecessary polling of documents whose entry in the parent directory
  did not change
* Widget fixes
* Compatible with [remotestorage-02](https://github.com/remotestorage/spec/blob/master/draft-dejong-remotestorage-head.txt)
  (although nothing needed to change for this)

## 0.8.1 (August 2013)

* Update the example server
* Fix edge case in sync with incoming deletions of entire directories

## 0.8.0 (August 2013)

### Overview:

* Rewritten: RemoteStorage, WireClient, BaseClient, Sync, IndexedDB
* Supports the three latest spec versions:
  - 2012.04 (http://www.w3.org/community/unhosted/wiki/RemoteStorage-2012.04)
  - remotestorage-00 (https://tools.ietf.org/html/draft-dejong-remotestorage-00)
  - remotestorage-01 (https://tools.ietf.org/html/draft-dejong-remotestorage-01)
* The default cache backend changed to indexedDB
* Modularized build (build/components.json lists groups and their dependencies)
* Removed internal use of AMD. Everything is nested below the global RemoteStorage namespace now.
* Added 'inspect' debug widget. If debug support is built in, use remoteStorage.inspect() in your app to try it.

### Changes to the API:

* Global 'remoteStorage' object is now an instance of RemoteStorage
* Caching & Access settings are persisted and survive a redirect
* remoteStorage.claimAccess no longer returns a promise (was deprecated in 0.7.1)
* BaseClient#use/BaseClient#release are deprecated in favor of BaseClient#cache
* Added BaseClient#scope() to get BaseClient instances of paths nested below the module root.
* Made validation schemas global (schemas from other modules can be referred to using: <module-name>/<type-alias>)
* Added 'inspect' debug widget. If debug support is built in, use remoteStorage.inspect() in your app to try it.
* Deprectated the "util" part. It contained a lot of utility functions that bloated the library and are also
  available in the same or similar form from third-party libraries.
  Until the next major release a subset of the "util" object will still be available (see "src/legacy.js" for
  a list of methods that are included).

## 0.7.0 (January 2013)

* Big breaking change!
* Introduces modules, and changes everything completely.
* Nothing is the same as in version 0.6

## 0.6.9

* Make sure token is decoded before passing it as Authorization header
* don't log confusing JSON parse error, if hasn't been stored yet
* Update new webfinger format
* Add read-write-web-00#webdav support
* Add read-write-web-00#simple support

## 0.6.8

* Surfnet hardcoded list update
* Add remoteStorage.createStorageInfo
* Set client_id correctly

## 0.6.7

* Add fontys.nl to hardcoded
* Fix getCollection

## 0.6.6

* Fix wrong error message when user address doesn't parse
* Fix wrong requirement for global 'location' variable in nodejs

## 0.6.5

* Fix tests
* Include surfnet pilot
* Clean up storageInfo format

## 0.6.4

* Fix JRD syntax

## 0.6.3

* No trailing slash after empty base path

## 0.6.2

* Fix legacy detection for OAuth scopes format
* On legacy storage, change all slashes to underscores except for the one between category and item
* Deal with non-string user addresses in getStorageInfo
* Allow hyphens and underscores in user part of user addresses
* Revert all user addresses to lower case
* Correct new rel to https://www.w3.org/community/rww/wiki/simple-00

## 0.6.1

* Fix the tests again
* Add ':rw' or ':r' to OAuth scopes
* DON'T USE: the legacy format detection is broken in this revision

## 0.6.0

* Losen the requirement that the basePath you OAuth to should be a category, so now instead of 'category/key' we use 'basePath/relPath'
* DON'T USE: I later found out that the tests were not being run in this revision, so there are some bugs in it.

## 0.5.6

* Fix missing error handler in ajaxNode(). only affects remoteStorage-node.js

## 0.5.5

* Fix input typeof() checks. no big impact

## 0.5.4

* Fix a problem in xrd parsing. upgrading highly recommended

## 0.5.3

* Added guessStorageInfo fallback
* Added temporary migration code for 160 users who are still on deprecated fakefinger
* Works in combination with http://proxy.unhosted.org/checkIrisCouch
* Added nodejs support
* Added (non-functional) straw man code for IE
* Pushing this version only for temp use in Libre Docs, don't use this at home until we test the new stuff some more

## 0.5.2

* Restructured code to make room for multi-platform

## 0.5.1

* Got rid of fakefinger again, and made webfinger code nicer
* To build, run 'cd build; node build.js'

## 0.5.0

* BREAKING CHANGE in how you include the library: got rid of require.
* To build, run 'sh build.sh'

## 0.4.7

* Added r.js build script

## 0.4.6

* Moved tests to sinonjs, fixed some significant bugs in couch 409 handling
* Added builds/ and downloads/ directories
* Now returning (null, undefined) instead of (404, '') when an item is not found

## 0.4.5

* Switched from useraddress.net/fakefinger to proxy.unhosted.org/lookup
* Fixed CouchDB _rev in DELETE https://github.com/unhosted/remoteStorage.js/issues/39
* Removed dead code relating to single-origin webfinger

## 0.4.4

* Added unit tests

## 0.4.3

* Made requires relative

## 0.4.2

* First public version of this library implementing http://unhosted.org/#developer
