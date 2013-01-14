# Get the code:

    git clone git@github.com:RemoteStorage/remoteStorage.js.git
    cd remoteStorage.js

# Build it:

    npm install requirejs
    sudo apt-get install naturaldocs
    make build
    make compile-assets
    make doc

# Test it:

    npm install teste
    make test

If there is an error about node requiring localStorage, just repeat the command, it sometimes
works the second time.

# Try it:

Copy

    build/latest/remoteStorage.min.js

into your app, and do something like:

    remoteStorage.defineModule('notes', function(privateClient, publicClient) {
      return {
        exports: {
          getNote: function (path) {
            return publicClient.getFile(path);
          }
        }
      };
    });
    remoteStorage.claimAccess({
      notes: 'rw'
    }).then(function() {
      remoteStorage.displayWidget('remotestorage-widget');
      remoteStorage.onWidget('ready', function() {
       notes.getNote('test.txt').then(function(text) {
          document.body.innerHTML += '<div>'+text+'</div>';
        });
      });
    });

See http://remotestorage.io/ for further documentation.
