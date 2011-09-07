* Start with apps/myfavouritesandwich.org/
* Change index.html and mfs.js to what you want to have
* The other files can stay the same. Here’s a description what each of them do:
 * base64.js: used to manually generate the http basic auth token header, because xhr basic auth is broken for cross-origin in both webkit and gecko.
 * cb.html: receive the oauth token (OAuth2 implicit grant flow)
 * config.js: config
 * davStorage.js: webdav PUT and GET
 * index.html: the interface
 * register.html: not used
 * sjcl.js: encryption layer
 * socket.io.js: not used
 * syncStorage.js: caching layer based on html5 sessionStorage
 * webfinger.js: resolve user address to an unhosted dav end point 

This is all still too much in flux to be a proper documented framework. For now, always make sure you come to our [chat room](http://webchat.freenode.net/?channels=unhosted) whenever you work on an app, so we can all help each other, share the experience, and together form part of the revolution. If you are thinking about writing an app, then that means you are already one of us. Welcome!
