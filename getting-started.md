# Get the code:

    git clone git@github.com:RemoteStorage/remoteStorage.js.git
    cd remoteStorage.js

# Build it:

    # install dependencies
    npm install
    # if you changed any files in assets/
    make compile-assets
    # build & minify (output is in build/latest/)
    make build

# Build the docs:
    sudo apt-get install naturaldocs
    make doc

# Test it:

    # install dependencies
    npm install
    # run tests
    make test

# Try it:

Copy

    build/latest/remoteStorage.min.js

into your app, and do something like:

    example/minimal/index.html

See http://remotestorage.io/ for further documentation.
