cat src/start.frag src/lib/ajax.js src/lib/couch.js src/lib/dav.js src/lib/webfinger.js src/main.js src/end.frag  > build/latest/remoteStorage.js
cat build/latest/remoteStorage.js | uglifyjs > build/minified/latest/remoteStorage.js
