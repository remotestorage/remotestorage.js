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

    example/minimal/index.html

See http://remotestorage.io/ for further documentation.
