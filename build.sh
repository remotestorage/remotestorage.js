cat lib/start.frag lib/ajax.js lib/couch.js lib/dav.js lib/webfinger.js lib/main.js lib/end.frag  > remoteStorage.js
cat remoteStorage.js | uglifyjs > builds/latest/remoteStorage.js
