# Adding rs.js to an app

rs.js is distributed as a single `UMD (Universal Module
Definition)`{.interpreted-text role="abbr"} build, which means it should
work with all known JavaScript module systems, as well as without one
(using a global variable).

We recommend adding the library from a JavaScript package manager,
although you may also just download the release build [from
GitHub](https://github.com/remotestorage/remotestorage.js/releases).

The package is available on npm as
[remotestoragejs](https://www.npmjs.com/package/remotestoragejs):

``` console
npm install remotestoragejs
```

## Examples

### ES6 module

``` javascript
import RemoteStorage from 'remotestoragejs';
```

### CommonJS module

``` javascript
var RemoteStorage = require('remotestoragejs');
```

### AMD module

For example with [RequireJS](http://requirejs.org/):

``` javascript
requirejs.config({
  paths: {
    RemoteStorage: './lib/remotestorage'
  }
});

requirejs(['RemoteStorage'], function(RemoteStorage) {
  // Here goes my app
});
```

### No module system

If you just link the build from HTML, it will add `RemoteStorage` as a
global variable to `window`.

``` html
<script type="text/javascript" src="remotestorage.js"></script>
```
