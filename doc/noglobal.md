
---
Changes made in `feature/949-noglobal` branch:

The main reason of the branch is to simplify usage both from users (developers using the lib) 
and RemoteStorage hackers prospective. The first gloal is achieved reducing the complexity of
includig the lib in new project for every usage case, supporting AMD
and commonjs (to make it easy to use with new js tools like
webpack / browserify / requirejs and in node itself) and old `<script>`
inclusion style, everything with the same build (downloading the same .js or
installing it trought npm). The lib is also behave better in other ecosystems
because it is not polluting the global namespace anymore.
The second step is achieved in cleaning the source code and explicit
requiring dependencies in every module, remove non standard defer Promise feature,
modularize some features (see config / log / syncedgetputdelete) and 
try to clean out where possible.


### Building 
Main diff is in building method:
`webpack` is used due to it's ability to create UMD modules valid in every environment
and to make it easy to modularize code.

It gets an entry point where to start exploring the lib dep tree so
needed modules are automatically included into build (entry point is remotestorage.js)

Little changes in `package.json` to use new building scripts, you can 
use `npm run build` to build a release and `npm run dev` to build a dev
version (this will watch for modification and rebuild in case), 
if you want to dig in, take a look at [config file](../webpack.config.js)


### Refactoring 
Another thing webpack is doing automatically for us is to enclose each
module inside an IIFE so those in original source are not used anymore,
instead of the IIFE we have explicitly declared dependencies (take a
look at [Dropbox](https://github.com/remotestorage/remotestorage.js/pull/951/files#diff-689ccd3fd11bc1e6ca004b57d4d9edc9) module
as an example).
Each internal feature is now exported at the end of file and
imported at beginning of features that needs it.

Another goal is to avoid exporting non public features. In <= 0.14, each feature was exported
inside RemoteStorage namespace (e.g. RemoteStorage.Dropbox) this is not the case anymore
and each public method is exported by RemoteStorage itself (TODO: something missing on this to maintain
retrocompatibility, for instance, `RemoteStorage.Authorize.setLocation`/`getLocation` and all errors),
plase take into account this while writing tests:
you cannot override `RemoteStorage.Feature` anymore, instead you can create a mock
of `Feature` and makes it global if you need.