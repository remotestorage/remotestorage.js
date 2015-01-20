#  Using the AMD build of remotestorage.js 

We provide a build of remotestorage.js that works with AMD. External dependencies must be provided for this build of the library to work.

# Release

For every release we provide an AMD build, this file is located in:

```
releases/<version>/remotestorage.amd.js
releases/<version>/remotestorage-nocache.amd.js
```

The `nocache` build does not include any of the syncing functionality. When a document is saved, or fetched, it is communicating directly with the back-end remotestorage server.

**NOTE** version `0.11.0` of remotestorage.js has a broken AMD build.

# Dependencies

The AMD build of remotestorage.js depends on [Bluebird](https://github.com/petkaantonov/bluebird) for Promise functionality, so you must include a reference to `bluebird` in your AMD init script.

**NOTE** For an up-to-date list of external dependencies, check the `define` statement in the top of the remotestorage AMD file.

