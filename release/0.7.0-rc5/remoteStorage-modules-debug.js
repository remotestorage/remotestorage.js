/* remoteStorage.js 0.7.0-head remoteStoragejs.com, MIT-licensed */
(function() {

/**
 * almond 0.1.4 Copyright (c) 2011, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        aps = [].slice;

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (waiting.hasOwnProperty(name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!defined.hasOwnProperty(name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    function makeMap(name, relName) {
        var prefix, plugin,
            index = name.indexOf('!');

        if (index !== -1) {
            prefix = normalize(name.slice(0, index), relName);
            name = name.slice(index + 1);
            plugin = callDep(prefix);

            //Normalize according
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            p: plugin
        };
    }

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {

            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = makeRequire(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = defined[name] = {};
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = {
                        id: name,
                        uri: '',
                        exports: defined[name],
                        config: makeConfig(name)
                    };
                } else if (defined.hasOwnProperty(depName) || waiting.hasOwnProperty(depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else if (!defining[depName]) {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 15);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        return req;
    };

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        waiting[name] = [name, deps, callback];
    };

    define.amd = {
        jQuery: true
    };
}());

define("../build/lib/almond", function(){});

/*global Buffer */
/*global window */
/*global console */
/*global Uint8Array */
/*global setTimeout */
/*global localStorage */
/*global ArrayBuffer */

define('lib/util',[], function() {

  

  // Namespace: util
  //
  // Utility functions. Mainly logging.
  //

  var loggers = {}, silentLogger = {};

  var knownLoggers = [];

  var logFn = null;

  var logLevels = {
    error: true,
    info: true,
    debug: false
  };

  var atob, btoa;

  // btoa / atob for nodejs implemented here, so util/platform don't form
  // a circular dependency.
  if(typeof(window) === 'undefined') {
    atob = function(str) {
      var buffer = str instanceof Buffer ? str : new Buffer(str, 'base64');
      return buffer.toString('binary');
    };
    btoa = function(str) {
      var buffer = str instanceof Buffer ? str : new Buffer(str, 'binary');
      return buffer.toString('base64');
    };
  } else {
    atob = window.atob;
    btoa = window.btoa;
  }

  var Promise = function(chained) {
    this.result = undefined;
    this.success = undefined;
    this.handlers = {};
    this.__defineSetter__('onsuccess', function(fulfilledHandler) {
      if(typeof(fulfilledHandler) !== 'function') {
        throw "Success callback must be a function!";
      }
      this.handlers.fulfilled = fulfilledHandler;
      if(! this.nextPromise) {
        this.nextPromise = new Promise(true);
      }
    });
    this.__defineSetter__('onerror', function(failedHandler) {
      if(typeof(failedHandler) !== 'function') {
        throw "Error callback must be a function!";
      }
      this.handlers.failed = failedHandler;
      if(! this.nextPromise) {
        this.nextPromise = new Promise(true);
      }
    });

    // //BEGIN-DEBUG
    // if(! chained) {
    //   var _this = this;
    //   var stack;
    //   try { throw new Error(); } catch(exc) { stack = exc.stack; };
    //   this.debugTimer = setTimeout(function() {
    //     if(_this.result) {
    //       // already resolved for some reason, without clearing the timer.
    //       return;
    //     }
    //     if(_this.handlers.fulfilled) { // only care if someone's listening
    //       console.error("WARNING: promise timed out, failing!", stack);
    //       _this.fail();
    //     }
    //   }, 10000);
    // }
    // //END-DEBUG
  };

  Promise.prototype = {
    fulfill: function() {
      if(typeof(this.success) !== 'undefined') {
        console.error("Fulfillment value: ", arguments);
        throw new Error("Can't fulfill promise, already resolved as: " +
                        (this.success ? 'fulfilled' : 'failed'));
      }
      //BEGIN-DEBUG
      clearTimeout(this.debugTimer);
      //END-DEBUG
      this.result = util.toArray(arguments);
      this.success = true;
      if(! this.handlers.fulfilled) {
        return;
      }
      var nextResult;
      try {
        nextResult = this.handlers.fulfilled.apply(this, this.result);
      } catch(exc) {
        if(this.nextPromise) {
          this.nextPromise.fail(exc);
        } else {
          console.error("Uncaught exception: ", exc, exc.getStack());
        }
        return;
      }
      var nextPromise = this.nextPromise;
      if(nextPromise) {
        if(nextResult && typeof(nextResult.then) === 'function') {
          // chain our promise after this one.
          nextResult.then(function() {
            nextPromise.fulfill.apply(nextPromise, arguments);
          }, function() {
            nextPromise.fail.apply(nextPromise, arguments);
          });
        } else {
          nextPromise.fulfill(nextResult);
        }
      }
    },

    fail: function() {
      if(typeof(this.success) !== 'undefined') {
        console.error("Failure value: ", arguments);
        throw new Error("Can't fail promise, already resolved as: " +
                        (this.success ? 'fulfilled' : 'failed'));
      }
      //BEGIN-DEBUG
      clearTimeout(this.debugTimer);
      //END-DEBUG
      this.result = util.toArray(arguments);
      this.success = false;
      if(this.handlers.failed) {
        try {
          this.handlers.failed.apply(this, this.result);
        } catch(exc) {
          if(this.nextPromise) {
            this.nextPromise.fail(exc);
          } else {
            console.error("Uncaught error: ", this.result, (this.result[0] && this.result[0].stack));
          }
        }
      } else if(this.nextPromise) {
        this.nextPromise.fail.apply(this.nextPromise, this.result);
      } else {
        console.error("Uncaught error: ", this.result, (this.result[0] && this.result[0].stack));
      }
    },

    fulfillLater: function() {
      var args = util.toArray(arguments);
      util.nextTick(function() {
        this.fulfill.apply(this, args);
      }.bind(this));
      return this;
    },

    failLater: function() {
      var args = util.toArray(arguments);
      util.nextTick(function() {
        this.fail.apply(this, args);
      }.bind(this));
      return this;
    },

    then: function(fulfilledHandler, errorHandler) {
      this.handlers.fulfilled = fulfilledHandler;
      this.handlers.failed = errorHandler;
      this.nextPromise = new Promise(true);
      return this.nextPromise;
    },

    get: function() {
      var propertyNames = util.toArray(arguments);
      return this.then(function(result) {
        var promise = new Promise();
        var values = [];
        if(typeof(result) !== 'object') {
          promise.failLater(new Error(
            "Can't get properties of non-object (properties: " + 
              propertyNames.join(', ') + ')'
          ));
        } else {
          propertyNames.forEach(function(propertyName) {
            values.push(result[propertyName]);
          });
          promise.fulfillLater.apply(promise, values);
        }
        return promise;
      });
    },

    call: function(methodName) {
      var args = Array.prototype.slice.call(arguments, 1);
      return this.then(function(result) {
        return result[methodName].apply(result, args);
      });
    }
  };


  var util = {

    bufferToRaw: function(buffer) {
      var view = new Uint8Array(buffer);
      var nData = view.length;
      var rawData = '';
      for(var i=0;i<nData;i++) {
        rawData += String.fromCharCode(view[i]);
      }
      return rawData;
    },

    rawToBuffer: function(rawData) {
      var nData = rawData.length;
      var buffer = new ArrayBuffer(nData);
      var view = new Uint8Array(buffer);

      for(var i=0;i<nData;i++) {
        view[i] = rawData.charCodeAt(i);
      }
      return buffer;
    },

    encodeBinary: function(buffer) {
      return btoa(this.bufferToRaw(buffer));
    },

    decodeBinary: function(data) {
      return this.rawToBuffer(atob(data));
    },

    // Method: toArray
    // Convert something into an Array.
    // Example:
    // > function squareAll() {
    // >   return util.toArray(arguments).map(function(arg) {
    // >     return Math.pow(arg, 2);
    // >   });
    // > }
    toArray: function(arrayLike) {
      return Array.prototype.slice.call(arrayLike);
    },

    nextTick: function(action) {
      setTimeout(action, 0);
    },

    // Method: isDir
    // Convenience method to check if given path is a directory.
    isDir: function(path) {
      return path.substr(-1) == '/';
    },

    pathParts: function(path) {
      var parts = ['/'];
      var md;
      while((md = path.match(/^(.*?)([^\/]+\/?)$/))) {
        parts.unshift(md[2]);
        path = md[1];
      }
      return parts;
    },

    extend: function() {
      var result = arguments[0];
      var objs = Array.prototype.slice.call(arguments, 1);
      objs.forEach(function(obj) {
        if(obj) {
          for(var key in obj) {
            result[key] = obj[key];
          }
        }
      });
      return result;
    },

    // Method: containingDir
    // Calculate the parent path of the given path, by stripping the last part.
    //
    // Parameters:
    //   path - any path, absolute or relative.
    //
    // Returns:
    //   the parent path or *null*, if the given path is a root ("" or "/")
    //
    containingDir: function(path) {
      var dir = path.replace(/[^\/]+\/?$/, '');
      return dir == path ? null : dir;
    },

    baseName: function(path) {
      var parts = path.split('/');
      if(util.isDir(path)) {
        return parts[parts.length-2]+'/';
      } else {
        return parts[parts.length-1];
      }
    },

    // Function: bindAll
    // Bind all function properties of given object to it's object.
    //
    // Makes it a lot easier to use methods as callbacks.
    //
    // Example:
    //   (start code)
    //   var o = { foo: function() { return this; } };
    //   util.bindAll(o);
    //    
    //   var f = o.foo; // detach function from object
    //    
    //   f() === o; // -> true, function is still bound to object "o".
    //   (end code)
    //
    bindAll: function(object) {
      for(var key in object) {
        if(typeof(object[key]) === 'function') {
          object[key] = this.bind(object[key], object);
        }
      }
      return object;
    },

    // Function: curry
    // <Curry at http://www.cs.nott.ac.uk/~gmh/faq.html#currying> given function.
    //
    // Example:
    //   (start code)
    //   function f(n, m) {
    //     console.log("N: " + n + ", M: " + m);
    //   }
    //   var f3 = curry(f, 3);
    //   // later:
    //   f3(4);
    //   // prints "N: 3, M: 4";
    //   (end code)
    curry: function(f) {
      if(typeof(f) !== 'function') {
        throw new Error("Can only curry functions!");
      }
      var _a = Array.prototype.slice.call(arguments, 1);
      return function() {
        var a = util.toArray(arguments);
        for(var i=(_a.length-1);i>=0;i--) {
          a.unshift(_a[i]);
        }
        return f.apply(this, a);
      };
    },

    // Function: rcurry
    // Same as <curry>, but append instead of prepend given arguments.
    //
    // Example:
    //   (start code)
    //   function f(n, m) {
    //     console.log("N: " + n + ", M: " + m);
    //   }
    //   var f3 = rcurry(f, 3);
    //   // later:
    //   f3(4);
    //   // prints "N: 4, M: 3";
    //   (end code)
    //
    rcurry: function(f) {
      if(typeof(f) !== 'function') {
        throw new Error("Can only curry functions!");
      }
      var _a = Array.prototype.slice.call(arguments, 1);
      return function() {
        var a = util.toArray(arguments);
        _a.forEach(function(item) {
          a.push(item);
        });
        return f.apply(this, a);
      };
    },

    bind: function(callback, context) {
      if(context) {
        return function() { return callback.apply(context, arguments); };
      } else {
        return callback;
      }
    },

    hostNameFromUri: function(url) {
      var md = url.match(/^https?:\/\/([^\/]+)/);
      return md ? md[1] : '';
    },

    deprecate: function(methodName, replacement) {
      console.log('WARNING: ' + methodName + ' is deprecated, use ' + replacement + ' instead');
    },

    // Function: highestAccess
    // Combine two access modes and return the highest one.
    //
    // Parameters:
    //   a, b - Access modes. Either 'r', 'rw' or undefined.
    //
    // Returns:
    //   'rw' or 'r' or null.
    highestAccess: function(a, b) {
      return (a == 'rw' || b == 'rw') ? 'rw' : (a == 'r' || b == 'r') ? 'r' : null;
    },

    // Method: getEventEmitter
    //
    // Create a new EventEmitter object and return it.
    //
    // It gets all valid events as it's arguments.
    //
    // Example:
    // (start code)
    // var events = util.getEventEmitter('change', 'error');
    // events.on('error', function(what) { alert('something happens: ' + what); });
    // events.emit('error', 'fired!');
    // (end code)
    //
    getEventEmitter: function() {
      var eventNames = util.toArray(arguments);

      function setupHandlers() {
        var handlers = {};
        eventNames.forEach(function(name) {
          handlers[name] = [];
        });
        return handlers;
      }

      function validEvent(eventName) {
        if(! this._handlers[eventName]) {
          throw new Error("Unknown event: " + eventName);
        }
      }

      return this.bindAll({

        _handlers: setupHandlers(),
        //BEGIN-DEBUG
        // Event cache is only used by debug-events at the moment, so
        // doesn't have to be part of regular build.
        _eventCache: {},
        //END-DEBUG

        emit: function(eventName) {
          var handlerArgs = Array.prototype.slice.call(arguments, 1);
          // console.log("EMIT", eventName, handlerArgs);
          validEvent.call(this, eventName);
          if(this.hasHandler(eventName)) {
            this._handlers[eventName].forEach(function(handler) {
              if(handler) {
                handler.apply(null, handlerArgs);
              }
            });
          }
          //BEGIN-DEBUG
          else if(eventName in this._eventCache) {
            this._eventCache[eventName].push(handlerArgs);
          }
          //END-DEBUG
        },

        once: function(eventName, handler) {
          validEvent.call(this, eventName);
          var i = this._handlers[eventName].length;
          if(typeof(handler) !== 'function') {
            throw "Expected function as handler, got: " + typeof(handler);
          }
          this.on(eventName, function() {
            delete this._handlers[eventName][i];
            handler.apply(this, arguments);
          }.bind(this));
        },

        on: function(eventName, handler) {
          validEvent.call(this, eventName);
          if(typeof(handler) !== 'function') {
            throw "Expected function as handler, got: " + typeof(handler);
          }
          this._handlers[eventName].push(handler);
          //BEGIN-DEBUG
          if(this._eventCache[eventName]) {
            this._eventCache[eventName].forEach(function(args) {
              handler.apply(null, args);
            });
            delete this._eventCache[eventName];
          }
          //END-DEBUG
        },

        reset: function() {
          this._handlers = setupHandlers();
        },

        hasHandler: function(eventName) {
          validEvent.call(this, eventName);
          return this._handlers[eventName].length > 0;
        }

        //BEGIN-DEBUG
        ,
        enableEventCache: function() {
          util.toArray(arguments).forEach(util.bind(function(eventName) {
            this._eventCache[eventName] = [];
          }, this));
        }
        //END-DEBUG

      });

    },

    // Method: getLogger
    //
    // Get a logger with a given name.
    // Usually this only happens once per file.
    //
    // Parameters:
    //   name - name of the logger. usually the name of the file this method
    //          is called from.
    //
    // Returns:
    //   A logger object
    //
    getLogger: function(name) {

      if(! loggers[name]) {
        knownLoggers.push(name);
        loggers[name] = {

          info: function() {
            this.log('info', util.toArray(arguments));
          },

          debug: function() {
            this.log('debug', util.toArray(arguments), 'debug');
          },

          error: function() {
            this.log('error', util.toArray(arguments), 'error');
          },

          log: function(level, args, type) {
            if(silentLogger[name] || logLevels[level] === false) {
              return;
            }
            if(logFn) {
              return logFn(name, level, args);
            }

            if(! type) {
              type = 'log';
            }

            args.unshift("[" + name.toUpperCase() + "] -- " + level + " ");

            (console[type] || console.log).apply(console, args);
          }
        };
      }

      return loggers[name];
    },

    // Method: setLogFunction
    //
    // Override the default logger with a custom function.
    // After this, remoteStorage.js will no longer log through the global console object,
    // but instead pass each logger call to the provided function.
    //
    // Log function parameters:
    //   name  - Name of the logger.
    //   level - loglevel, one of 'info', 'debug', 'error'
    //   args  - Array of arguments passed to the logger. can be anything.
    setLogFunction: function(logFunction) {
      logFn = logFunction;
    },

    // Method: silenceLogger
    // Silence all given loggers.
    //
    // So, if you're not interested in seeing all the synchronization logs, you could do:
    // > remoteStorage.util.silenceLogger('sync');
    //
    silenceLogger: function() {
      var names = util.toArray(arguments);
      var numNames = names.length;
      for(var i=0;i<numNames;i++) {
        silentLogger[ names[i] ] = true;
      }
    },

    // Method: silenceLogger
    // Unsilence all given loggers.
    // The opposite of <silenceLogger>
    unsilenceLogger: function() {
      var names = util.toArray(arguments);
      var numNames = names.length;
      for(var i=0;i<numNames;i++) {
        delete silentLogger[ names[i] ];
      }
    },

    // Method: silenceAllLoggers
    // silence all known loggers
    silenceAllLoggers: function() {
      this.silenceLogger.apply(this, knownLoggers);
    },

    // Method: unsilenceAllLoggers
    // opposite of <silenceAllLoggers>
    unsilenceAllLoggers: function() {
      this.unsilenceLogger.apply(this, knownLoggers);
    },

    // Method: setLogLevel
    // Set the maximum log level to use. Messages with
    // a lower log level won't be displayed.
    //
    // Log levels are:
    //   > debug < info < error
    //
    // Example:
    //   (start code)
    //   util.setLogLevel('info');
    //   var logger = util.getLogger('my-logger');
    //   logger.error("something went wrong"); // displayed
    //   logger.info("hey, how's it going?");  // displayed
    //   logger.debug("foo bar baz"); // not displayed
    //   (end code)
    setLogLevel: function(level) {
      if(level == 'debug') {
        logLevels.debug = true;
        logLevels.info = true;
      } else if(level == 'info') {
        logLevels.info = true;
        logLevels.debug = false;
      } else if(level == 'error') {
        logLevels.info = false;
        logLevels.debug = false;
      } else {
        throw "Unknown log level: " + level;
      }
    },

    // Method: grepLocalStorage
    // Find a list of keys that match a given pattern.
    //
    // Iterates over all localStorage keys and calls given 'iter'
    // for each key that matches given 'pattern'.
    //
    // The iter receives the matching key as it's only argument.
    grepLocalStorage: function(pattern, iter) {
      var numLocalStorage = localStorage.length;
      var keys = [];
      for(var i=0;i<numLocalStorage;i++) {
        var key = localStorage.key(i);
        if(pattern.test(key)) {
          keys.push(key);
        }
      }
      keys.forEach(iter);
    },

    getPromise: function() {
      return new Promise();
    },

    // Function: isPromise
    // Tests whether the given Object is a <Promise>.
    //
    // This method only checks for a "then" property, that is a function.
    // That way it can interact with other implementations of Promises/A
    // as well.
    isPromise: function(object) {
      return typeof(object) === 'object' && typeof(object.then) === 'function';
    },

    // Function: makePromise
    // Create a new <Promise> object, and run given function.
    //
    // Returns: the created promise.
    //
    // The given callback function will be run in the future.
    // If the callback throws an exception, that will cause the
    // supplied callback to fail.
    // If the callback returns a promise, that promise will be
    // chained to the returned one.
    //
    // Example:
    //   (start code)
    //   function a() {
    //     return util.makePromise(function(promise) {
    //       // promise will be fulfilled in next tick
    //       promise.fulfill(a + b);
    //     });
    //   }
    //
    //   function b() {
    //     return util.makePromise(function(promise) {
    //       // promise will be fulfilled as soon as the returned promise is fulfilled
    //       return asyncFunctionReturningPromise();
    //     });
    //   }
    //
    //   function c() {
    //     return util.makePromise(function(promise) {
    //       // promise will fail with the thrown exception as it's result value
    //       throw new Error("Something went wrong!");
    //     });
    //   }
    //
    //   a().then(b).then(c).then(function() {
    //     // everything alright (never reached, "c" fails)
    //   }, function(error) {
    //     // one of the above failed.
    //   });
    //   (end code)
    //
    makePromise: function(futureCallback) {
      var promise = new Promise();
      util.nextTick(function() {
        try {
          var result = futureCallback(promise);
          if(result && result.then && typeof(result.then) === 'function') {
            result.then(
              promise.fulfill.bind(promise),
              promise.fail.bind(promise)
            );
          }
        } catch(exc) {
          promise.fail(exc);
        }
      });
      return promise;
    },

    // Function: asyncGroup
    // Run a bunch of asynchronous functions in parallel
    //
    // Returns a <Promise>.
    //
    // All given parameters must be functions. All functions will be
    // run in the given order. The returned promise will be fulfilled,
    // when for all given functions one of the following is true,
    //
    // Either:
    //   The function returned no promise.
    //
    // Or:
    //   The function returned a promise and that promise has been
    //   fulfilled or failed.
    //
    // The promise fill be fulfilled with:
    //   results - An array of return or fulfill values of the given
    //             functions in the same order.
    //   errors  - Array of errors reported by promise-returning
    //             functions.
    //
    // Example:
    //   (start code)
    //   return util.asyncGroup(
    //     function() { // asynchronous function
    //       return util.makePromise(function(p) {
    //         asyncGetSomeNumber(function(number) { p.fulfill(number) });
    //       });
    //     },
    //     function() { // synchronous function
    //       return 50 - 8;
    //     }
    //   ).then(function(numbers, errors) {
    //     numbers[0]; // -> (whatever 'number' was in the async function)
    //     numbers[1]; // -> 42
    //   });
    //   (end code)
    // 
    asyncGroup: function() {
      var functions = util.toArray(arguments);
      var results = [];
      var todo = functions.length;
      var errors = [];
      return util.makePromise(function(promise) {
        //BEGIN-DEBUG
        clearTimeout(promise.debugTimer);
        //END-DEBUG
        if(functions.length === 0) {
          return promise.fulfill([], []);
        }
        function finishOne(result, index) {
          results[index] = result;
          todo--;
          if(todo === 0) {
            promise.fulfill(results, errors);
          }
        }
        function failOne(error) {
          console.error("asyncGroup part failed: ", (error && error.stack) || error);
          errors.push(error);
          finishOne();
        }
        functions.forEach(function(fun, index) {
          if(typeof(fun) !== 'function') {
            throw new Error("asyncGroup got non-function: " + fun);
          }
          var _result = fun();
          if(_result && _result.then && typeof(_result.then) === 'function') {
            _result.then(function(result) {
              finishOne(result, index);
            }, failOne);
          } else {
            finishOne(_result, index);
          }
        });
      });
    },

    // Function: asyncEach
    // Asynchronously iterate over array.
    //
    // Returns a <Promise>.
    //
    // Calls the given iterator function for each element in 'array',
    // passing in the element itself and the index within the array.
    //
    // The iterator function and returned promise are subject to the
    // same semantics as in <util.asyncGroup>.
    //
    asyncEach: function(array, iterator) {
      return util.makePromise(function(promise) {
        util.asyncGroup.apply(
          util, array.map(function(element, index) {
            return util.curry(iterator, element, index);
          })
        ).then(function(results, errors) {
          promise.fulfill(array, errors);
        });
      });
    },

    // Function: asyncMap
    //
    // Asynchronously map an array.
    //
    // Returns a <Promise>.
    //
    // Calls the given "mapper" for each element in the given "array",
    // through <util.asyncGroup>.
    //
    asyncMap: function(array, mapper) {
      return util.asyncGroup.apply(
        util, array.map(function(element) {
          return util.curry(mapper, element);
        })
      );
    },

    asyncSelect: function(array, testFunction) {
      var a = [];
      return util.asyncEach(array, function(element) {
        return testFunction(element).then(function(result) {
          if(result) {
            a.push(element);
          }
        });
      }).then(function() {
        return a;
      });
    },

    getSettingStore: function(prefix) {
      function makeKey(key) {
        return prefix + ':' + key;
      }
      return {
        get: function(key) {
          var data = localStorage.getItem(makeKey(key));
          try { data = JSON.parse(data); } catch(e) {}
          return data;
        },
        set: function(key, value) {
          if(typeof(value) !== 'string') {
            value = JSON.stringify(value);
          }
          return localStorage.setItem(makeKey(key), value);
        },
        remove: function(key) {
          return localStorage.removeItem(makeKey(key));
        },
        clear: function() {
          util.grepLocalStorage(new RegExp('^' + prefix), function(key) {
            localStorage.removeItem(key);
          });
        }
      }
    }
  };

  // Class: Logger
  //
  // Method: info
  // Log to loglevel "info".
  //
  // Method: debug
  // Log to loglevel "debug".
  // Will use the browser's debug logging facility, if available.
  //
  // Method: debug
  // Log to loglevel "error".
  // Will use the browser's error logging facility, if available.
  //

  // Class: EventEmitter
  //
  // Method: emit
  //
  // Fire an event
  //
  // Parameters:
  //   eventName - name of the event. Must have been passed to getEventEmitter.
  //   *rest     - arguments passed to the handler.
  //
  // Method: on
  //
  // Install an event handler
  //
  // Parameters:
  //   eventName - name of the event. Must have been passed to getEventEmitter.
  //   handler   - handler to call when an event is emitted.
  //

  return util;
});


/*global window */
/*global console */
/*global XMLHttpRequest */
/*global XDomainRequest */
/*global Blob */
/*global setTimeout */
/*global clearTimeout */
/*global DOMParser */
/*global Element */
/*global document */

if(typeof(global) !== 'undefined' && typeof(nodeRequire) === 'undefined') {
  var nodeRequire = require;
}

define('lib/platform',['./util'], function(util) {

  

  // Namespace: platform
  //
  // Platform specific implementations of common things to do.
  //
  // Method: ajax
  //
  // Set off an HTTP request.
  // Uses CORS, if available on the platform.
  //
  // Parameters:
  //   (given as an *Object*)
  //
  //   url     - URL to send the request to
  //   success - callback function to call when request succeeded
  //   error   - callback function to call when request failed
  //   method  - (optional) HTTP request method to use (default: GET)
  //   headers - (optional) object containing request headers to set
  //   timeout - (optional) milliseconds until request is given up and error
  //             callback is called. If omitted, the request never times out.
  //
  // Example:
  //   (start code)
  //   platform.ajax({
  //     url: "http://en.wikipedia.org/wiki/AJAX",
  //     success: function(responseText, responseHeaders) {
  //       console.log("Here's the page: ", responseText);
  //     },
  //     error: function(errorMessage) {
  //       console.error("Something went wrong: ", errorMessage);
  //     },
  //     timeout: 3000
  //   });
  //   (end code)
  //
  // Platform support:
  //   web browser - YES (if browser <supports CORS at http://caniuse.com/#feat=cors>)
  //   IE - Partially, no support for setting headers.
  //   node - YES, CORS not an issue at all
  //
  //
  // Method: parseXml
  //
  // Parse given XML source.
  //
  // Platform support:
  //   browser - yes, if DOMParser is available
  //   node - yes, if xml2js is available
  //

  var logger = util.getLogger('platform');

  // downcase all header keys
  function normalizeHeaders(headers) {
    var h = {};
    for(var key in headers) {
      h[key.toLowerCase()] = headers[key];
    }
    return h;
  }

  function browserParseHeaders(rawHeaders) {
    if(! rawHeaders) {
      // firefox bug. workaround in ajaxBrowser.
      return null;
    }
    var headers = {};
    var lines = rawHeaders.split(/\r?\n/);
    var lastKey = null, md, key, value;
    var numLines = lines.length;
    for(var i=0;i<numLines;i++) {
      if(lines[i].length === 0) {
        // empty line. obviously.
        continue;
      } else if((md = lines[i].match(/^([^:]+):\s*(.+)$/))) {
        // The escaped colon in the following (previously added) comment is
        // necessary, to prevent NaturalDocs from generating a toplevel
        // document called "value line" to the documentation. True story.

        // key\: value line
        key = md[1], value = md[2];
        headers[key] = value;
        lastKey = key;
      } else if((md = lines[i].match(/^\s+(.+)$/))) {
        // continued line (if previous line exceeded 80 bytes
        key = lastKey, value= md[1];
        headers[key] = headers[key] + value;
      } else {
        // nothing we recognize.
        logger.error("Failed to parse header line: " + lines[i]);
      }
    }
    return normalizeHeaders(headers);
  }

  var successStates = { 200:true, 201:true, 204:true, 207:true };

  function isSuccessful(xhr) {
    return !! successStates[xhr.status];
  }

  function ajaxBrowser(params) {
    return util.makePromise(function(promise) {
      var timedOut = false;
      var timer;
      var xhr = new XMLHttpRequest();
      if(params.timeout) {
        timer = window.setTimeout(function() {
          timedOut = true;
          xhr.abort();
          promise.fail('timeout');
        }, params.timeout);
      }

      if(!params.method) {
        params.method = 'GET';
      }

      xhr.open(params.method, params.url, true);

      if(params.headers) {
        for(var header in params.headers) {
          xhr.setRequestHeader(header, params.headers[header]);
        }
      }

      xhr.onreadystatechange = function() {
        if((xhr.readyState == 4)) {
          if(timer) {
            window.clearTimeout(timer);
          }
          if(isSuccessful(xhr)) {
            logger.debug("REQUEST SUCCESSFUL", params.url, xhr.responseText);
            var headers = browserParseHeaders(xhr.getAllResponseHeaders());
            if(! headers) {
              // Firefox' getAllResponseHeaders is broken for CORS requests since forever.
              // https://bugzilla.mozilla.org/show_bug.cgi?id=608735
              // Any additional headers that are needed by other code, should be added here.
              headers = {
                'content-type': xhr.getResponseHeader('Content-Type')
              };
            }
            promise.fulfill(xhr.responseText, headers);
          } else {
            logger.debug("REQUEST FAILED", xhr.status, params.url);
            promise.fail(xhr.status || 'network error');
          }
        }
      };

      xhr.send(params.data);
    });
  }

  function ajaxExplorer(params) {
    // this won't work, because we have no way of sending
    // the Authorization header. It might work for GET to
    // the 'public' category, though.
    var promise = util.getPromise();
    var xdr = new XDomainRequest();
    xdr.timeout = params.timeout || 3000;//is this milliseconds? documentation doesn't say
    xdr.open(params.method, params.url);
    xdr.onload = function() {
      if(xdr.status == 200 || xdr.status == 201 || xdr.status == 204) {
        promise.fulfill(xdr.responseText);
      } else {
        params.fail(xdr.status);
      }
    };
    xdr.onerror = function() {
      // See http://msdn.microsoft.com/en-us/library/ms536930%28v=vs.85%29.aspx
      promise.fail('network error');
    };
    xdr.ontimeout = function() {
      promise.fail('timeout');
    };
    if(params.data) {
      xdr.send(params.data);
    } else {
      xdr.send();
    }
  }

  function ajaxNode(params) {

    return util.makePromise(function(promise) {

      if(typeof(params.data) === 'object' && params.data instanceof Blob) {
        throw new Error("Sending binary data not yet implemented for nodejs");
      }

      var http=nodeRequire('http'),
      https=nodeRequire('https'),
      url=nodeRequire('url');
      if(!params.method) {
        params.method='GET';
      }
      if(params.data) {
        params.headers['content-length'] = params.data.length;
      } else {
        params.data = null;
      }
      var urlObj = url.parse(params.url);
      var options = {
        method: params.method,
        host: urlObj.hostname,
        path: urlObj.path,
        port: (urlObj.port ? urlObj.port : (urlObj.protocol=='https:'?443:80)),
        headers: params.headers
      };
      var timer, timedOut;

      if(params.timeout) {
        timer = setTimeout(function() {
          promise.fail('timeout');
          timedOut=true;
        }, params.timeout);
      }

      var lib = (urlObj.protocol=='https:'?https:http);
      var request = lib.request(options, function(response) {
        var str='';
        response.setEncoding('utf8');
        response.on('data', function(chunk) {
          str+=chunk;
        });
        response.on('end', function() {
          if(timer) {
            clearTimeout(timer);
          }
          if(!timedOut) {
            if(response.statusCode==200 || response.statusCode==201 || response.statusCode==204) {
              promise.fulfill(str, normalizeHeaders(response.headers));
            } else {
              promise.fail(response.statusCode);
            }
          }
        });
      });
      request.on('error', function(e) {
        if(timer) {
          clearTimeout(timer);
        }
        promise.fail(e.message);
      });
      if(params.data) {
        request.end(params.data);
      } else {
        request.end();
      }
    });
  }

  function parseXmlBrowser(str, cb) {
    var tree=(new DOMParser()).parseFromString(str, 'text/xml');
    var nodes=tree.getElementsByTagName('Link');
    var obj={
      Link: []
    };
    for(var i=0; i<nodes.length; i++) {
      var link={};
      if(nodes[i].attributes) {
        for(var j=0; j<nodes[i].attributes.length;j++) {
          link[nodes[i].attributes[j].name]=nodes[i].attributes[j].value;
        }
      }
      var props = nodes[i].getElementsByTagName('Property');
      link.properties = {};
      for(var k=0; k<props.length;k++) {
        link.properties[
          props[k].getAttribute('type')
        ] = props[k].childNodes[0].nodeValue;
      }
      if(link.rel) {
        obj.Link.push({
          '@': link
        });
      }
    }
    cb(null, obj);
  }

  function parseXmlNode(str, cb) {
    var xml2js=nodeRequire('xml2js');
    new xml2js.Parser().parseString(str, cb);
  }

  var platform;

  if(typeof(window) === 'undefined') {
    platform = {
      ajax: ajaxNode,
      parseXml: parseXmlNode
    };
  } else {
    if(window.XDomainRequest) {
      platform = {
        ajax: ajaxExplorer,
        parseXml: parseXmlBrowser
      };
    } else {
      platform = {
        ajax: ajaxBrowser,
        parseXml: parseXmlBrowser
      };
    }
  }

  return platform;
});

define('lib/webfinger',
  ['./platform', './util'],
  function (platform, util) {

    

    // Namespace: webfinger
    //
    // Webfinger discovery.
    // Supports XRD, JRD and the <"resource" parameter at http://tools.ietf.org/html/draft-jones-appsawg-webfinger-06#section-5.2>
    //
    // remoteStorage.js tries the following things to discover a user's profile:
    //   * via HTTPS to /.well-known/host-meta.json
    //   * via HTTPS to /.well-known/host-meta
    //   * via HTTP to /.well-known/host-meta.json
    //   * via HTTP to /.well-known/host-meta
    //
    //   All those requests carry the "resource" query parameter.
    //
    // So in order for a discovery to work most quickly, a server should
    // respond to HTTPS requests like:
    //
    //   > /.well-known/host-meta.json?resource=acct%3Abob%40example.com
    // And return a JSON representation of the profile, such as this:
    //
    //   (start code)
    //
    //   {
    //     links:[{
    //       href: 'https://example.com/storage/bob',
    //       rel: "remoteStorage",
    //       type: "https://www.w3.org/community/rww/wiki/read-write-web-00#simple",
    //       properties: {
    //         'auth-method': "https://tools.ietf.org/html/draft-ietf-oauth-v2-26#section-4.2",
    //         'auth-endpoint': 'https://example.com/auth/bob'
    //       }
    //     }]
    //   }
    //
    //   (end code)
    //

    var logger = util.getLogger('webfinger');

      ///////////////
     // Webfinger //
    ///////////////

    // PARSE

    // parse user address
    function extractHostname(userAddress) {
      var parts = userAddress.toLowerCase().split('@');
      var error;
      if(parts.length < 2) {
        error = 'no-at';
      } else if(parts.length > 2) {
        error = 'multiple-at';
      } else {
        if(!(/^[\.0-9a-z\-\_]+$/.test(parts[0]))) {
          error = 'non-dotalphanum';
        } else if(!(/^[\.0-9a-z\-]+$/.test(parts[1]))) {
          error = 'non-dotalphanum';
        }
      }
      if(error) {
        throw error;
      }
      return parts[1];
    }

    function parseXRD(str) {
      var promise = util.getPromise();
      platform.parseXml(str, function(err, obj) {
        if(err) {
          promise.fail(err);
        } else {
          if(obj && obj.Link) {
            var links = {};
            if(obj.Link && obj.Link['@']) {//obj.Link is one element
              if(obj.Link['@'].rel) {
                links[obj.Link['@'].rel]=obj.Link['@'];
              }
            } else {//obj.Link is an array
              for(var i=0; i<obj.Link.length; i++) {
                if(obj.Link[i]['@'] && obj.Link[i]['@'].rel) {
                  links[obj.Link[i]['@'].rel]=obj.Link[i]['@'];
                }
              }
            }
            promise.fulfill(links);
          } else {
            promise.fail('invalid-xml');
          }
        }
      });
      return promise;
    }

    function parseJRD(data) {
      var object = JSON.parse(data);
      if(! object.links) {
        throw 'invalid-jrd';
      }
      var links = {};
      object.links.forEach(function(link) {
        // just take the first one of each rel:
        if(link.rel && (! links[link.rel])) {
          links[link.rel] = link;
        }
      });
      return links;
    }

    // request a single profile
    function fetchProfile(address, timeout) {
      console.log('fetch profile', address, timeout);
      return platform.ajax({
        url: address,
        timeout: timeout
      }).then(function(body, headers) {
        var mimeType = headers && headers['content-type'] && headers['content-type'].split(';')[0];
        console.log('fetched', body, mimeType);
        if(mimeType && mimeType.match(/^application\/json/)) {
          return parseJRD(body);
        } else {
          return util.makePromise(function(jrdPromise) {
            parseXRD(body).then(
              function(xrd) {
                jrdPromise.fulfill(xrd);
              }, function(error) {
                jrdPromise.fulfill(parseJRD(body));
              });
          });
        }
      });
    }

    // fetch profile from all given addresses and yield the first one that
    // succeeds.
    function fetchHostMeta(addresses, timeout) {
      console.log('fetch host meta', addresses, timeout);
      return util.asyncMap(addresses, util.rcurry(fetchProfile, timeout, true)).
        then(function(profiles, errors) {
          console.log('host meta mapped', profiles);
          for(var i=0;i<profiles.length;i++) {
            if(profiles[i]) {
              return profiles[i];
            }
          }
          throw 'requests-failed';
        });
    }

    function extractRemoteStorageLink(links) {
      console.log('extract remoteStorage link', links);
      var remoteStorageLink = links.remoteStorage || links.remotestorage;
      var lrddLink;
      if(remoteStorageLink) {
        console.log('remoteStorageLink', remoteStorageLink);
        if(remoteStorageLink.href &&
           remoteStorageLink.type &&
           remoteStorageLink.properties &&
           remoteStorageLink.properties['auth-endpoint']) {
          return remoteStorageLink;
        } else {
          throw new Error("Invalid remoteStorage link. Required properties are:" +
                          "href, type, properties, properties.auth-endpoint. " +
                          JSON.stringify(remoteStorageLink));
        }
      } else if(lrddLink = links.lrdd) {
        return fetchProfile(
          lrddLink.template.replace('{uri}', 'acct:' + userAddress)
        ).then(extractRemoteStorageLink);
      } else {
        throw 'not-supported';
      }
    }

    // method: getStorageInfo
    // Get the storage information of a given user address.
    //
    // Parameters:
    //   userAddress - a string in the form user@host
    //   options     - see below
    //   callback    - to receive the discovered storage info
    //
    // Options:
    //   timeout     - time in milliseconds, until resulting in a 'timeout' error.
    //
    // Callback parameters:
    //   err         - either an error message or null if discovery succeeded
    //   storageInfo - the format is equivalent to that of the JSON representation of the remotestorage link (see above)
    //
    function getStorageInfo(userAddress, options) {

      /*

        - validate userAddres
        - fetch host-meta
        - parse host-meta
        - (optionally) fetch lrdd
        - (optionally) parse lrdd
        - extract links

       */

      try {
        var hostname = extractHostname(userAddress)
      } catch(error) {
        if(error) {
          return util.getPromise().failLater(error);
        }
      }
      var query = '?resource=acct:' + encodeURIComponent(userAddress);
      var addresses = [
        'https://' + hostname + '/.well-known/webfinger' + query,
        'http://'  + hostname + '/.well-known/webfinger' + query,
        'https://' + hostname + '/.well-known/host-meta.json' + query,
        'https://' + hostname + '/.well-known/host-meta' + query,
        'http://'  + hostname + '/.well-known/host-meta.json' + query,
        'http://'  + hostname + '/.well-known/host-meta' + query
      ];

      return fetchHostMeta(addresses, (options && options.timeout) || 10000).
        then(extractRemoteStorageLink);
    }

    return {
      getStorageInfo: getStorageInfo
    };
});

define('lib/getputdelete',
  ['./platform', './util'],
  function (platform, util) {

    

    var logger = util.getLogger('getputdelete');

    var defaultContentType = 'application/octet-stream';

    function realDoCall(method, url, body, mimeType, token) {
      return util.makePromise(function(promise) {
        logger.debug(method, url);
        var platformObj = {
          url: url,
          method: method,
          timeout: 10000,
          headers: {}
        };

        if(token) {
          platformObj.headers['Authorization'] = 'Bearer ' + token;
        }
        if(mimeType) {
          if(typeof(body) == 'object' && body instanceof ArrayBuffer) {
            mimeType += '; charset=binary';
          }
          platformObj.headers['Content-Type'] = mimeType;
        }

        platformObj.fields = {withCredentials: 'true'};
        if(method != 'GET') {
          platformObj.data = body;
        }

        platform.ajax(platformObj).
          then(function(data, headers) {
            var contentType = headers['content-type'] || defaultContentType;
            var mimeType = contentType.split(';')[0]

            if(contentType.match(/charset=binary/)) {
              data = util.rawToBuffer(data);
            } else if(mimeType === 'application/json') {
              try {
                data = JSON.parse(data);
              } catch(exc) {
                // ignore invalid JSON
              }
            }

            promise.fulfill(data, mimeType);            
          }, function(error) {
            if(error === 404) {
              return promise.fulfill(undefined);
            } else if(error === 401) {
              error = 'unauthorized';
            };
            promise.fail(error);
          });
      });
    }

    var inProgress = 0;
    var maxInProgress = 10;
    var pendingQueue = [];

    function doCall() {
      var args = util.toArray(arguments);
      function finishOne() {
        inProgress--;
        if(pendingQueue.length > 0) {
          var c = pendingQueue.shift();
          doCall.apply(this, c.a).then(c.p.fulfill.bind(c.p), c.p.fail.bind(c.p));
        } else {
        }
      }
      if(inProgress < maxInProgress) {
        inProgress++;
        return realDoCall.apply(this, arguments).then(function(data, mimeType) {
          finishOne();
          return util.makePromise(function(p) { p.fulfill(data, mimeType); });
        }, function(error) {
          finishOne();
          throw error;
        });
      } else {
        return util.makePromise(function(p) {
          pendingQueue.push({
            a: args,
            p: p
          });
        });
      }
    }

    function get(url, token) {
      return doCall('GET', url, null, null, token);
    }

    function put(url, value, mimeType, token) {
      if(! (typeof(value) === 'string' || (typeof(value) === 'object' &&
                                           value instanceof ArrayBuffer))) {
        cb(new Error("invalid value given to PUT, only strings or ArrayBuffers allowed, got "
                     + typeof(value)));
      }
      return doCall('PUT', url, value, mimeType, token);
    }

    function set(url, valueStr, mimeType, token) {
      if(typeof(valueStr) == 'undefined') {
        return doCall('DELETE', url, null, null, token);
      } else {
        return put(url, valueStr, mimeType, token);
      }
    }

    // Namespace: getputdelete
    return {
      //
      // Method: get
      //
      // Send a GET request to a given path.
      //
      // Parameters:
      //   url      - url to send request to
      //   token    - bearer token used to authorize the request
      //   callback - callback called to signal success or failure
      //
      // Callback parameters:
      //   err      - error message(s). if no error occured, err is null.
      //   data     - raw response data
      //   mimeType - value of the response's Content-Type header. If none was returned, this defaults to application/octet-stream.
      get:    get,

      //
      // Method: set
      //
      // Send a PUT or DELETE request to given path.
      //
      // Parameters:
      //   url      - url to send request to
      //   data     - optional data to send. if data is undefined (not null!), a DELETE request is used.
      //   mimeType - MIME type to set for the data via the Content-Type header. Only relevant for PUT.
      //   token    - bearer token used to authorize the request
      //   callback - callback called to signal success or failure
      //
      // Callback parameters:
      //   err      - error message(s). if no error occured, err is null.
      //   data     - raw response data
      //   mimeType - value of the response's Content-Type header. If none was returned, this defaults to application/octet-stream.
      //
      set:    set
    };
});

/*global localStorage */
/*global ArrayBuffer */

define('lib/wireClient',['./getputdelete', './util'], function (getputdelete, util) {

  

  var prefix = 'remote_storage_wire_';

  var events = util.getEventEmitter('connected', 'disconnected', 'error');

  var state = 'anonymous';

  var settings = util.getSettingStore('remotestorage_wire');

  function setSetting(key, value) {
    settings.set(key, value);

    calcState();
  }

  function removeSetting(key) {
    settings.remove(key);
  }

  function getSetting(key) {
    return settings.get(key);
  }

  function disconnectRemote() {
    settings.clear();
    calcState();
  }

  function getState() {
    return state;
  }

  function calcState() {
    var oldState = state;

    if(getSetting('storageType') && getSetting('storageHref')) {
      if(getSetting('bearerToken')) {
        state = 'connected';
      } else {
        state = 'authing';
      }
    } else {
      state = 'anonymous';
    }

    if(state === 'connected') {
      events.emit('connected');
    } else if(state === 'anonymous' && oldState === 'connected') {
      events.emit('disconnected');
    }
    return state;
  }

  function resolveKey(path) {
    var storageHref = getSetting('storageHref');
    return storageHref + path;
  }

  var foreignKeyRE = /^([^\/][^:]+):(\/.*)$/;

  function isForeign(path) {
    return foreignKeyRE.test(path);
  }

  // Namespace: wireClient
  //
  // The wireClient stores the user's storage information and controls getputdelete accordingly.
  //
  // Event: connected
  //
  // Fired once everything is configured.

  // Method: get
  //
  // Get data from given path from remotestorage
  //
  // Parameters:
  //   path     - absolute path (starting from storage root)
  //
  function get(path) {
    if(isForeign(path)) {
      return getForeign(path);
    } else if(state != 'connected') {
      throw new Error('not-connected');
    }
    return getputdelete.get(
      resolveKey(path),
      getSetting('bearerToken')
    );
  }

  function getForeign(fullPath) {
    var md = fullPath.match(foreignKeyRE);
    var userAddress = md[1];
    var path = md[2];
    var base = getStorageHrefForUser(userAddress);
    return getputdelete.get(base + path, null);
  }

  // Method: set
  //
  // Write data to given path in remotestorage
  //
  // Parameters:
  //   path     - absolute path (starting from storage root)
  //   valueStr - raw data to write
  //   mimeType - MIME type to set as Content-Type header
  //   callback - see <getputdelete.set> for details on the callback parameters.
  function set(path, valueStr, mimeType, cb) {
    if(isForeign(path)) {
      throw new Error("Foreign storage is read-only");
    } else if(state != 'connected') {
      throw new Error('not-connected');
    }
    var token = getSetting('bearerToken');
    if(typeof(path) != 'string') {
      throw new Error('argument "path" should be a string');
    } else {
      if(valueStr && typeof(valueStr) != 'string' &&
         !(typeof(valueStr) == 'object' && valueStr instanceof ArrayBuffer)) {
        valueStr = JSON.stringify(valueStr);
      }
      return getputdelete.set(resolveKey(path), valueStr, mimeType, token);
    }
  }

  // Method: remove
  //
  // Remove data at given path from remotestorage
  //
  // Parameters:
  //   path     - absolute path (starting from storage root)
  //   callback - see <getputdelete.set> for details on the callback parameters.
  function remove(path, cb) {
    if(isForeign(path)) {
      return cb(new Error("Foreign storage is read-only"));
    }
    var token = getSetting('bearerToken');
    return getputdelete.set(resolveKey(path), undefined, undefined, token, cb);
  }

  function getStorageHrefForUser(userAddress) {
    var info = getSetting('storageInfo:' + userAddress);
    if(! info) {
      throw new Error("userAddress unknown to wireClient: " + userAddress);
    }
    return info.href;
  }

  function addStorageInfo(userAddress, storageInfo) {
    setSetting('storageInfo:' + userAddress, storageInfo);
  }

  function hasStorageInfo(userAddress) {
    return !! getSetting('storageInfo:' + userAddress);
  }

  return util.extend(events, {

    get: get,
    set: set,
    remove: remove,

    // Method: setStorageInfo
    //
    // Configure wireClient.
    //
    // Storage info object:
    //   type - the storage type (see specification)
    //   href - base URL of the storage server
    //
    // Fires:
    //   configured - if wireClient is now fully configured
    //
    setStorageInfo   : function(info) {
      setSetting('storageType', info.type);
      setSetting('storageHref', info.href);
      return info;
    },

    // Method: getStorageHref
    //
    // Get base URL of the user's remotestorage.
    getStorageHref   : function() {
      return getSetting('storageHref');
    },
    
    // Method: SetBearerToken
    //
    // Set the bearer token for authorization
    //
    // Parameters:
    //   bearerToken - token to use
    //
    // Fires:
    //   configured - if wireClient is now fully configured.
    //
    setBearerToken   : function(bearerToken) {
      setSetting('bearerToken', bearerToken);
    },

    getBearerToken   : function(bearerToken) {
      return getSetting('bearerToken');
    },

    // Method: addStorageInfo
    //
    // Add another user's storage info.
    // After calling this, keys in the form userAddress:path can be resolved.
    //
    // Parameters:
    //   userAddress - a user address in the form user@host
    //   storageInfo - an object, with at least an 'href' attribute
    addStorageInfo: addStorageInfo,

    // Method: hasStorageInfo
    //
    // Find out if the wireClient has cached storageInfo for the given userAddress.
    //
    // Parameters:
    //   userAddress - a user address to look up
    hasStorageInfo: hasStorageInfo,

    // Method: disconnectRemote
    //
    // Clear the wireClient configuration
    disconnectRemote : disconnectRemote,

    // Method: on
    //
    // Install an event handler
    //
    // 

    // Method: getState
    //
    // Get current state.
    //
    // Possible states are:
    //   anonymous - no information set
    //   authing   - storage's type & href set, but no token received yet
    //   connected - all information present.
    getState         : getState,
    calcState: calcState
  });
});

define('lib/store/syncTransaction',['../util'], function(util) {

  // Namespace: syncTranscation
  //
  // Shared transaction implementation for synchronous storage backends (memory, localStorage).
  // Takes a 'store' (methods: get, set, remove) and a logger.
  // Makes sure that only one transaction runs at the same time.

  // Method: syncTransaction
  // Returns a new syncTransactionAdapter.
  //
  // You can extend it with your own stuff (to create a proper storageAdapter you
  // at least need 'forgetAll' and 'on')
  //
  // Parameters:
  //   store  - actual store implementation (get, set, remove)
  //   logger - a logger, to log begin / end of transaction and implicit commits.
  return function(store, logger) {

    var errorStub = function() { throw new Error("Transaction already committed!"); };
    var staleStore = { get: errorStub, set: errorStub, remove: errorStub, commit: errorStub };

    var tid = 0;

    function makeTransaction(write, body) {
      var promise = util.getPromise();
      var transaction = util.extend({
        id: ++tid,
        commit: function() {
          finish();
        }
      }, store);

      if(! write) {
        delete transaction.set;
        delete transaction.remove;
      }

      function finish(implicit) {
        logger.debug(transaction.id, 'FINISH Transaction (', write ? 'read-write' : 'read-only', ')');
        busy = false;
        util.extend(transaction, staleStore);
        promise.fulfill();
        runIfReady();
      }

      return {
        run: function() {
          busy = true;
          logger.debug(transaction.id, 'BEGIN Transaction (', write ? 'read-write' : 'read-only', ')');
          var result = body(transaction);
          if(! write) {
            logger.debug(transaction.id, 'schedule implicit commit (read-only transaction)');
            finish(true);
          }
        },
        promise: promise
      };
    }

    var busy = false;
    var transactions = [];

    function runIfReady() {
      if(! busy) {
        var transaction = transactions.shift();
        if(transaction) {
          logger.debug('SHIFT TRANSACTION', transactions.length, 'left');
          transaction.run();
        }
      }
    }

    return {

      // Object: syncTransactionAdapter

      // Method: transaction
      //
      // Parameters:
      //   write - boolean. whether this is a write or read-only transaction.
      //   body  - method to call with the actual transaction object
      transaction: function(write, body) {
        var transaction = makeTransaction(write, body);
        transactions.push(transaction);
        util.nextTick(runIfReady);
        return transaction.promise;
      },

      // Method: get
      // Forwarded from store (to simplify transaction-less 'get's in tests).
      get: store.get,
    };
  };
});

define('lib/store/memory',['../util', './syncTransaction'], function(util, syncTransactionAdapter) {

  // Namespace: store.memory
  // <StorageAdapter> implementation that keeps data in memory.

  var logger = util.getLogger('store::memory');

  return function() {
    var nodes = {};

    var store = {
      get: function(path) {
        logger.info('get', path);
        return util.getPromise().fulfillLater(nodes[path]);
      },

      set: function(path, node) {
        logger.info('set', path, node.data);
        nodes[path] = node;
        return util.getPromise().fulfillLater();
      },

      remove: function(path) {
        logger.info('remove', path);
        delete nodes[path];
        return util.getPromise().fulfillLater();
      }
    };

    return util.extend({

      _nodes: nodes,

      on: function() {},

      forgetAll: function() {
        logger.info('forgetAll');
        this._nodes = nodes = {};
        return util.getPromise().fulfillLater();
      },

      hasKey: function(path) {
        return !! nodes[path];
      },

      // wireClient STUB

      getState: function() {
        return 'connected';
      },

      // TESTS & DEBUGGING

      printTree: function() {
        var printOne = function(path, indent) {
          return this.get(path).
            then(function(node) {
              if(! node) {
                throw "No node for path: " + path;
              }
              if(util.isDir(path)) {
                console.log(indent + '+ ' + util.baseName(path));
                return util.asyncEach(Object.keys(node.data), function(key) {
                  return printOne(path + key, indent + '| ');
                });
              } else {
                console.log(indent + util.baseName(path) + ' ' +
                            node.data.length + ' bytes, ' +
                            node.mimeType);
              }
            });
        }.bind(this);

        return printOne('/', '');
      },

      // FIXME: implement through 'set' and move to common.
      init: function(dataTree, mimeType, timestamp, access) {
        this.forgetAll();
        var initNode = function (path, tree) {
          var node = {
            startAccess: Object.keys(access).reduce(function(a, k) {
              return (k === path) ? access[k] : a;
            }, null),
            startForce: null,
            startForceTree: null,
            timestamp: timestamp,
            lastUpdatedAt: timestamp
          };
          if(typeof(tree) == 'object') {
            node.mimeType = 'application/json';
            node.data = Object.keys(tree).reduce(function(listing, _key) {
              var key = _key;
              if(typeof(tree[_key]) === 'object') {
                key += '/';
              }
              initNode(path + key, tree[_key]);
              listing[key] = timestamp;
              return listing;
            }, {});
            node.diff = {};
          } else {
            node.mimeType = mimeType;
            node.data = tree;
          }
          nodes[path] = node;
        }.bind(this);

        initNode('/', dataTree);
      }

    }, store, syncTransactionAdapter(store, logger));
  };
});

define('lib/store/common',['../util'], function(util) {

  return {
    packData: function(node) {
      node = util.extend({}, node);
      if(typeof(node.data) === 'object' && node.data instanceof ArrayBuffer) {
        node.binary = true;
        node.data = util.encodeBinary(node.data);
      } else {
        node.binary = false;
        if(node.mimeType === 'application/json' && typeof(node.data) === 'object') {
          node.data = JSON.stringify(node.data);
        } else {
          node.data = node.data;
        }
      }
      return node;
    },

    unpackData: function(node) {
      node = util.extend({}, node);
      if(node.mimeType === 'application/json' && node.data && typeof(node.data) !== 'object') {
        try {
          node.data = JSON.parse(node.data);
        } catch(exc) {
          throw new Error("Failed to parse JSON data: " + node.data + " (Error was: " + exc.message + ')');
        };
      } else if(node.binary) {
        node.data = util.decodeBinary(node.data);
      }
      return node;
    }
  };

});
define('lib/store/localStorage',['../util', './common', './syncTransaction'], function(util, common, syncTransactionAdapter) {

  // Namespace: store.localStorage
  // <StorageAdapter> implementation that keeps data localStorage.

  var localStorage;

  var logger = util.getLogger('store::localStorage');

  var events = util.getEventEmitter('change', 'debug');

  //BEGIN-DEBUG
  function debugEvent(method, path) {
    events.emit('debug', {
      method: method,
      path: path,
      timestamp: new Date()
    });
  }
  
  events.enableEventCache('debug');
  //END-DEBUG

  // node metadata key prefix
  var prefixNodes = 'remote_storage_nodes:';
  // note payload data key prefix
  var prefixNodesData = 'remote_storage_node_data:';

  function isMetadataKey(key) {
    return key.substring(0, prefixNodes.length) == prefixNodes;
  }

  function prefixNode(path) {
    return prefixNodes + path;
  }

  function prefixData(path) {
    return prefixNodesData + path;
  }

  // forward events from other tabs
  if(typeof(window) !== 'undefined') {
    window.addEventListener('storage', function(event) {
      if(isMetadataKey(event.key)) {
        event.path = event.key.replace(new RegExp('^' + prefixNodes), '');
        events.emit('change', event);
      }
    });
  }

  return function(_localStorage) {
    localStorage = _localStorage || (typeof(window) !== 'undefined' && window.localStorage);

    if(! localStorage) {
      throw new Error("Not supported: localStorage not found.");
    }

    var store = {
      get: function(path) {
        //BEGIN-DEBUG
        debugEvent('GET', path);
        //END-DEBUG
        logger.debug('GET', path);
        return util.makePromise(function(promise) {
          var rawMetadata = localStorage.getItem(prefixNode(path));
          if(! rawMetadata) {
            promise.fulfill(undefined);
            return;
          }
          var payload = localStorage.getItem(prefixData(path));
          var node;
          try {
            node = JSON.parse(rawMetadata);
          } catch(exc) {
          }
          if(node) {
            node.data = payload;
          }
          promise.fulfill(common.unpackData(node));
        });
      },

      set: function(path, node) {
        //BEGIN-DEBUG
        debugEvent('SET', path);
        //END-DEBUG
        logger.debug('SET', path, node);
        return util.makePromise(function(promise) {
          var metadata = common.packData(node);
          var rawData = metadata.data;
          delete metadata.data;
          var rawMetadata = JSON.stringify(metadata);
          localStorage.setItem(prefixNode(path), rawMetadata);
          if(rawData) {
            localStorage.setItem(prefixData(path), rawData);
          }
          promise.fulfill();
        });
      },

      remove: function(path) {
        //BEGIN-DEBUG
        debugEvent('REMOVE', path);
        //END-DEBUG
        logger.debug('SET', path);
        return util.makePromise(function(promise) {
          localStorage.removeItem(prefixNode(path));
          localStorage.removeItem(prefixData(path));
          promise.fulfill();
        });
      }
    };

    return util.extend({

      on: events.on,

      forgetAll: function() {
        return util.makePromise(function(promise) {
          var numLocalStorage = localStorage.length;
          var keys = [];
          for(var i=0; i<numLocalStorage; i++) {
            if(localStorage.key(i).substr(0, prefixNodes.length) == prefixNodes ||
               localStorage.key(i).substr(0, prefixNodesData.length) == prefixNodesData) {
              keys.push(localStorage.key(i));
            }
          }

          keys.forEach(function(key) {
            localStorage.removeItem(key);
          });

          promise.fulfill();
        });
      }
    }, syncTransactionAdapter(store, logger));
  };
});


define('lib/store/pending',['../util'], function(util) {

  var logger = util.getLogger('store::pending');

  return function() {
    var requestQueue = [];

    function queueRequest(name, args, dontPromise) {
      logger.debug(name, args[0]);
      if(! dontPromise) {
        return util.makePromise(function(promise) {
          requestQueue.push({
            method: name,
            args: args,
            promise: promise
          });
        });
      } else {
        requestQueue.push({
          method: name,
          args: args
        });
      }
    }

    var pendingAdapter = {
      transaction: function(write, body) {
        return queueRequest('transaction', [write, body]);
      },
      on: function(eventName, handler) {
        return queueRequest('on', [eventName, handler], true);
      },
      get: function(key) {
        return queueRequest('get', [key]);
      },
      put: function(key, value) {
        return queueRequest('put', [key, value]);
      },
      remove: function(key) {
        return queueRequest('remove', [key]);
      },
      forgetAll: function(key) {
        return queueRequest('forgetAll', []);
      },
      flush: function(adapter) {
        requestQueue.forEach(function(request) {
          logger.debug('QUEUE FLUSH', request.method, request.args[0]);
          if(request.promise) {
            adapter[request.method].apply(adapter, request.args).
              then(request.promise.fulfill.bind(request.promise),
                   request.promise.fail.bind(request.promise));
          } else {
            adapter[request.method].apply(adapter, request.args);
          }
        });
        requestQueue = [];
      },
      replaceWith: function(adapter) {
        pendingAdapter.flush(adapter);
        util.extend(pendingAdapter, adapter);
        delete pendingAdapter.flush;
        delete pendingAdapter.replaceWith;
      }
    };

    return pendingAdapter;
  };

});

/*global window */
/*global console */

define('lib/store',[
  './util',
  './platform',
  './store/memory',
  './store/localStorage',
  './store/pending'
], function (util, platform, memoryAdapter, localStorageAdapter, pendingAdapter) {

  

  // Namespace: store
  //
  // The store stores data locally. It treats all data as raw nodes, that have *metadata* and *payload*.
  // Where the actual data is stored is determined by the <StorageAdapter> that is being used.


  var logger = util.getLogger('store');

  // foreign nodes are prefixed with a user address
  var userAddressRE = /^[^@]+@[^:]+:\//;

  var events = util.getEventEmitter('error', 'change', 'foreign-change');

  var dataStore;

  // Method: setAdapter
  // Set the storage adapter. See <StorageAdapter> for a description of
  // the required interface.
  function setAdapter(adapter) {
    dataStore = adapter;
    // forward changes from data store (e.g. made in other tabs)
    dataStore.on('change', function(event) {
      if(! util.isDir(event.path)) {
        fireChange('device', event.path, event.oldValue);
      }
    });
  }

  // (function() {
  //   if(typeof(window) !== 'undefined') {
  //     var idb = indexedDbAdapter.detect();
  //     if(idb) {
  //       setAdapter(indexedDbAdapter(idb));
  //     } else if(typeof(window.openDatabase) !== 'undefined') {
  //       setAdapter(webSqlAdapter());
  //     } else if(typeof(window.localStorage) !== 'undefined') {
  //       setAdapter(localStorageAdapter(window.localStorage));
  //     } else {
  //       throw "Running in browser, but no storage adapter supported!";
  //     }
  //   } else {
  //     console.error("WARNING: falling back to in-memory storage");
  //     setAdapter(memoryAdapter());
  //   }
  // })();

  if(typeof(window) !== 'undefined') {
    setAdapter(localStorageAdapter(window.localStorage));
  } else {
    console.error("WARNING: falling back to in-memory storage");
    setAdapter(memoryAdapter());
  }

  //
  // Type: Node
  //
  // Represents a node within the local store.
  //
  // Properties:
  //   startAccess    - either "r" or "rw". Flag means, that this node has been claimed access on (see <remoteStorage.claimAccess>) (default: null)
  //   startForce     - boolean flag to indicate that this node shall always be synced. (see <BaseClient.use> and <BaseClient.release>) (default: null)
  //   startForceTree - boolean flag that all directory children of this node shall be synced.
  //   timestamp      - last time this node was (apparently) updated (default: 0)
  //   lastUpdatedAt  - Last time this node was upated from remotestorage
  //   mimeType       - MIME media type
  //   diff           - (directories only) marks children that have been modified.
  //   data           - Actual data of the node. A String, a JSON-Object or an ArrayBuffer.
  //   binary         - boolean indicating if this node is binary. If true, 'data' is an ArrayBuffer.
  //

  // Event: change
  // See <BaseClient.Events>

  function fireChange(origin, path, oldValue) {
    return getNode(path).
      get('data', 'timestamp').
      then(function(newValue, timestamp) {
        events.emit('change', {
          path: path,
          origin: origin,
          oldValue: oldValue,
          newValue: newValue,
          timestamp: timestamp
        });
      });
  }

  // Event: foreign-change
  // Fired when a foreign node is updated.

  function fireForeignChange(path, oldValue) {
    return getNode(path).
      get('data', 'timestamp').
      then(function(newValue, timestamp) {
        events.emit('foreign-change', {
          path: path,
          oldValue: oldValue,
          newValue: newValue,
          timestamp: timestamp
        });
      });
  }

  //
  // Event: error
  // See <BaseClient.Events>

  //
  // Method: on
  //
  // Install an event handler
  // See <util.EventEmitter.on> for documentation.

  // Method: getNode
  // Get a node.
  //
  // Parameters:
  //   path - absolute path
  //
  // Returns:
  //   a node object. If no node is found at the given path, a new empty
  //   node object is constructed instead.
  function getNode(path) {
    logger.info('getNode', path);
    if(! path) {
      // FIXME: fail returned promise instead.
      throw new Error("No path given!");
    }
    validPath(path);
    return dataStore.get(path).then(function(node) {
      if(! node) {
        node = {//this is what an empty node looks like
          startAccess: null,
          startForce: null,
          startForceTree: null,
          timestamp: 0,
          lastUpdatedAt: 0,
          mimeType: "application/json"
        };
        if(util.isDir(path)) {
          node.diff = {};
          node.data = {};
        }
      }

      return node;
    });
  }


  // Method: forgetAll
  // Forget all data stored by <store>.
  //
  function forgetAll() {
    return dataStore.forgetAll();
  }

  // Function: setNodeData
  //
  // update a node's payload
  //
  // Parameters:
  //   path      - absolute path from the storage root
  //   data      - node data to set, or undefined to delete the node
  //   outgoing  - boolean, whether this update is to be propagated
  //   timestamp - timestamp to set for the update
  //   mimeType  - MIME media type of the node's data
  //
  // Fires:
  //   change w/ origin=remote - unless this is an outgoing change
  //
  function setNodeData(path, data, outgoing, timestamp, mimeType) {
    logger.debug('PUT', path, { data: data, mimeType: mimeType });
    return getNode(path).then(function(node) {

      var oldValue = node.data;

      node.data = data;

      if(! outgoing) {
        if(typeof(timestamp) !== 'number') {
          throw "Attempted to set non-number timestamp in incoming change: " + timestamp + ' (' + typeof(timestamp) + ') at path ' + path;
        }
        node.lastUpdatedAt = timestamp;

        delete node.error;
      }

      if(! mimeType) {
        mimeType = 'application/json';
      }
      node.mimeType = mimeType;

      // FIXME: only set this when incoming data is set?
      delete node.pending;

      return updateNode(path, (node.data ? node : undefined), outgoing, false, timestamp, oldValue);
    });
  }

  function setLastSynced(path, timestamp) {
    logger.info('setLastSynced', path, 'requested');
    return dataStore.transaction(true, function(transaction) {
      logger.info('setLastSynced', path, 'started');
      return getNode(path, transaction).then(function(node) {
        node.lastUpdatedAt = timestamp;
        return updateNode(path, node, false, true, undefined, undefined, transaction).
          then(function() {
            logger.info('setLastSynced', path, 'done', timestamp);
            transaction.commit();
          });
      });
    });
  }

  function removeNode(path, timestamp) {
    return setNodeData(path, undefined, false, timestamp || getCurrTimestamp());
  }

  function updateMetadata(path, attributes, node) {
    function doUpdate(node) {
      util.extend(node, attributes);
      return updateNode(path, node, false, true);
    }
    if(node) {
      return doUpdate(node);
    } else {
      return getNode(path).then(doUpdate);
    }
  }

  // Method: setNodeAccess
  //
  // Set startAccess flag on a node.
  //
  // Parameters:
  //   path  - absolute path to the node
  //   claim - claim to set. Either "r" or "rw"
  //
  function setNodeAccess(path, claim) {
    logger.debug('setNodeAccess', path, claim);
    return getNode(path).then(function(node) {
      if((claim !== node.startAccess) &&
         (claim === 'rw' || node.startAccess === null)) {
        return updateMetadata(path, {
          startAccess: claim
        }, node);
      }
    });
  }

  function setNodeError(path, error) {
    logger.debug('setNodeError', path, error);
    return updateMetadata(path, {
      error: error
    });
  }

  // Method: setNodeForce
  //
  // Set startForce and startForceTree flags on a node.
  //
  // Parameters:
  //   path      - absolute path to the node
  //   dataFlag  - whether to sync data
  //   treeFlag  - whether to sync the tree
  //
  function setNodeForce(path, dataFlag, treeFlag) {
    logger.debug('setNodeForce', path, dataFlag, treeFlag);
    return updateMetadata(path, {
      startForce: dataFlag,
      startForceTree: treeFlag
    });
  }

  // Method: clearDiff
  //
  // Clear diff flag of given node on it's parent.
  //
  // Recurses upwards, when the parent's diff becomes empty.
  //
  // Clearing the diff is usually done, once the changes have been
  // propagated through sync.
  //
  // Parameters:
  //   path      - absolute path to the node
  //   timestamp - new timestamp (received from remote) to set on the node.
  //
  function clearDiff(path, timestamp) {
    logger.debug('clearDiff', path);
    return getNode(path).then(function(node) {

      function clearDiffOnParent() {
        var parentPath = util.containingDir(path);
        if(parentPath) {
          var baseName = util.baseName(path);
          return getNode(parentPath).then(function(parent) {
            delete parent.diff[baseName];
            if(Object.keys(parent.diff).length === 0) {
              parent.lastUpdatedAt = parent.timestamp;
            }
            return updateNode(parentPath, parent, false, true).then(function() {
              if(Object.keys(parent.diff).length === 0) {
                return clearDiff(parentPath, timestamp);
              }
            });
          });
        }
      }

      if(util.isDir(path) && Object.keys(node.data).length === 0 &&
         !(node.startAccess || node.startForce || node.startForceTree)) {
        // remove empty dir
        return updateNode(path, undefined, false, false).then(clearDiffOnParent);
      } else if(timestamp) {
        // set last updated
        node.timestamp = node.lastUpdatedAt = timestamp;
        return updateNode(path, node, false, true).then(clearDiffOnParent);
      } else {
        return clearDiffOnParent();
      }
    });
  }

  // Method: fireInitialEvents
  //
  // Fire a change event with origin=device for each node present in store.
  //
  // This is so apps don't need to add event handlers *and* initially request
  // listings to fill their views.
  //
  function fireInitialEvents() {
    logger.info('fire initial events');

    function iter(path) {
      if(util.isDir(path)) {
        return getNode(path).then(function(node) {
          if(node.data) {
            var keys = Object.keys(node.data);
            var next = function() {
              if(keys.length > 0) {
                return iter(path + keys.shift()).then(next);
              }
            };
            return next();
          }
        });
      } else {
        return fireChange('device', path);
      }
    }

    return iter('/');
  }

  function getFileName(path) {
    var parts = path.split('/');
    if(util.isDir(path)) {
      return parts[parts.length-2]+'/';
    } else {
      return parts[parts.length-1];
    }
  }

  function getCurrTimestamp() {
    return new Date().getTime();
  }

  function validPath(path) {
    if(! (path[0] == '/' || userAddressRE.test(path))) {
      throw new Error("Invalid path: " + path);
    }
  }

  function isForeign(path) {
    return path[0] != '/';
  }

  function determineDirTimestamp(path, transaction) {
    return getNode(path, transaction).
      get('data').then(function(data) {
        var t = 0;
        if(data) {
          for(var key in data) {
            if(data[key] > t) {
              t = data[key];
            }
          }
        }
        return t > 0 ? t : getCurrTimestamp();
      });
  }

  function touchNode(path) {
    return dataStore.transaction(true, function(transaction) {
      logger.info("touchNode", path);
      return getNode(path, transaction).
        then(function(node) {
          if(typeof(node.data) === 'undefined') {
            node.pending = true;
          }
          return updateNode(path, node, false, true, undefined, undefined, transaction).
            then(transaction.commit);
        });
    });
  }

  // FIXME: this argument list is getting too long!!!
  function updateNode(path, node, outgoing, meta, timestamp, oldValue,
                      transaction) {
    logger.debug('updateNode', path, node, outgoing, meta, timestamp);

    validPath(path);

    function adjustTimestamp(transaction) {
      logger.debug('updateNode.adjustTimestamp', path);
      return util.makePromise(function(promise) {
        function setTimestamp(t) {
          if(t) { timestamp = t; }
          if(node && typeof(timestamp) == 'number') {
            node.timestamp = timestamp;
          }
          promise.fulfill();
        }
        if((!meta) && (! timestamp)) {
          if(outgoing) {
            timestamp = getCurrTimestamp();
            setTimestamp();
          } else if(util.isDir(path)) {
            determineDirTimestamp(path, transaction).then(setTimestamp);
          } else {
            throw new Error('no timestamp given for node ' + path);
          }
        } else {
          setTimestamp();
        }
      });
    }

    function storeNode(transaction) {
      logger.debug('updateNode.storeNode', path, node);
      if(node) {
        return transaction.set(path, node);
      } else {
        return transaction.remove(path);
      }
    }

    function updateParent(transaction) {
      var parentPath = util.containingDir(path);
      var baseName = util.baseName(path);
      if(parentPath) {
        return getNode(parentPath, transaction).
          then(function(parent) {
            if(meta) { // META
              if(! parent.data[baseName]) {
                logger.debug('-> meta, create');
                parent.data[baseName] = 0;
                return updateNode(parentPath, parent, false, true, timestamp, undefined, transaction);
              }
            } else if(outgoing) { // OUTGOING
              if(node) {
                logger.debug('-> outgoing, set');
                parent.data[baseName] = timestamp;
              } else {
                logger.debug('-> outgoing, remove');
                delete parent.data[baseName];
              }
              parent.diff[baseName] = timestamp;
              logger.debug('-> diff, update');
              return updateNode(parentPath, parent, true, false, timestamp, undefined, transaction);
            } else { // INCOMING
              if(node) { // add or change
                if((! parent.data[baseName]) || parent.data[baseName] < timestamp) {
                  logger.debug('-> incoming, set');
                  parent.data[baseName] = timestamp;
                  delete parent.diff[baseName];
                  return updateNode(parentPath, parent, false, false, timestamp, undefined, transaction);
                }
              } else { // deletion
                logger.debug('-> incoming, remove');
                delete parent.data[baseName];
                delete parent.diff[baseName];
                return updateNode(parentPath, parent, false, false, timestamp, undefined, transaction);
              }
            }
          });
      }
    }

    function fireEvents() {
      if((! outgoing) && (! util.isDir(path))) {
        // fire changes
        if(isForeign(path)) {
          return fireForeignChange(path, oldValue);
        } else {
          return fireChange('remote', path, oldValue);
        }
      }
    }

    function doUpdate(transaction, dontCommit) {
      return adjustTimestamp(transaction).
        then(util.curry(storeNode, transaction)).
        then(util.curry(updateParent, transaction)).
        then(function() {
          if(! dontCommit) {
            transaction.commit();
          }
        }).
        then(fireEvents);
    }

    if(transaction) {
      return doUpdate(transaction, true);
    } else {
      return dataStore.transaction(true, doUpdate);
    }
  }

  return {

    memory: memoryAdapter,
    localStorage: localStorageAdapter,
    pending: pendingAdapter,

    events: events,

    // method         , local              , used by

    getNode           : getNode,          // sync
    setNodeData       : setNodeData,      // sync
    clearDiff         : clearDiff,        // sync
    removeNode        : removeNode,       // sync
    setLastSynced     : setLastSynced,    // sync

    on                : events.on,
    setNodeAccess     : setNodeAccess,
    setNodeForce      : setNodeForce,
    setNodeError      : setNodeError,
    touchNode         : touchNode,

    forgetAll         : forgetAll,        // widget
    fireInitialEvents : fireInitialEvents,// widget

    setAdapter        : setAdapter,
    getAdapter        : function() { return dataStore; }
  };

  // Interface: StorageAdapter
  //
  // Backend for the <store>.
  //
  // Currently supported:
  // * memory
  // * localStorage
  // * indexedDB
  //
  // Planned:
  // * WebSQL
  //
  // Method: get(path)
  // Get node from given path
  // Returns a promise.
  //
  // Method: set(path, node)
  // Create / update node at given path. See <store.Node> for a reference on how nodes look.
  // Returns a promise.
  //
  // Method: remove(path)
  // Remove node from given path
  // Returns a promise.
  //
  // Method: forgetAll()
  // Remove all data.
  // Returns a promise.
  //
  // Method: on(eventName)
  // Install an event handler.
  //
  // Event: change
  // Fired when the store changes from another source (such as another tab / window).
  //

});

define('lib/store/remoteCache',[
  '../util', '../wireClient', './memory'
], function(util, wireClient, memoryAdapter) {

  var logger = util.getLogger('store::remote_cache');

  var remoteClient = wireClient;

  return function() {
    var cache = memoryAdapter();

    function determineTimestamp(path) {
      return util.makePromise(function(promise) {
        var parentPath = util.containingDir(path);
        if(parentPath && cache.hasKey(parentPath)) {
          var baseName = util.baseName(path)
          cache.get(parentPath).
            then(function(parentNode) {
              promise.fulfill(parentNode.data[baseName] || 0);
            }, function(error) {
              if(typeof(error) === 'undefined') {
                promise.fulfill(new Date().getTime());
              } else {
                promise.fail(error);
              }
            });
        } else {
          promise.fulfill(new Date().getTime());
        }
      });
    }

    return {
      get: function(path) {
        if(cache.hasKey(path)) {
          logger.debug('GET HIT', path);
          return cache.get(path);
        } else {
          logger.debug('GET MISS', path);
          var node = {};
          return wireClient.get(path).
            // build node
            then(function(data, mimeType) {
              node.data = data;
              node.mimeType = mimeType;
              node.binary = data instanceof ArrayBuffer;
              if(typeof(data) === 'undefined') {
                node.deleted = true;
                return undefined;
              } else {
                node.deleted = false;
                return determineTimestamp(path);
              }
            }).then(function(timestamp) {
              node.timestamp = timestamp;
              return cache.set(path, node);
            }).then(function() {
              return node;
            });
        }
      },

      set: function(path, node) {
        logger.debug('SET', path);
        return cache.set(path, node).
          then(util.curry(wireClient.set, path, node.data, node.mimeType));
      },

      remove: function(path) {
        logger.debug('REMOVE', path);
        return cache.remove(path).
          then(util.curry(wireClient.remove, path));
      },

      getState: function() {
        return wireClient.getState();
      },

      expireKey: function(path) {
        logger.debug('EXPIRE', path);
        return cache.remove(path);
      },

      clearCache: function() {
        return cache.forgetAll();
      }
    };
  };
});

/*global localStorage */

define('lib/sync',[
  './util', './store', './store/remoteCache'
], function(util, store, remoteCacheAdapter) {

  

  var remoteAdapter = remoteCacheAdapter();

  var events = util.getEventEmitter('error', 'conflict', 'state', 'busy', 'ready', 'timeout', 'debug');
  var logger = util.getLogger('sync');

  //BEGIN-DEBUG
  events.enableEventCache('debug');
  //END-DEBUG

  /*******************/
  /* Namespace: sync */
  /*******************/

  // Settings. Trivial.

  var settings = util.getSettingStore('remotestorage_sync');


  // Section: How to configure sync
  //
  // remotestorageJS takes care of all the synchronization of remote and local data.
  //
  // As an app developer you need to do three things, to make it work:
  // * claim access on the root of the tree in question (see <remoteStorage.claimAccess>)
  // * state which branches you wish to have synced
  // * release paths you no longer need from the sync plan, so they won't impact performance
  //
  // Now suppose you have a data tree like this:
  //   (start code)
  //
  //         A
  //        / \
  //       B   C
  //      / \   \
  //     d   E   f
  //        / \
  //       g   h
  //
  //   (end code)
  //
  // Let's consider *A* to be our root node (it may be a module root, doesn't
  // really matter for this example), and let's say we have a <BaseClient>
  // instance called *client*, that treats paths relative to *A*.
  //
  // The simplest thing we can do, is request everything:
  //   > client.use('');
  // Now as soon as sync is triggered (usually this happens when connecting
  // through the widget), the entire tree, with all it's nodes, including data
  // nodes (files) will be synchronized and cached to localStorage.
  //
  // If we previously set up a 'change' handler, it will now be called for each
  // data node, as it has been synchronized.
  //
  // At this point, we can use the synchronous versions of the <BaseClient>
  // methods for getting data. These methods will only hit the local cache (they
  // may trigger <syncOne>, but we'll get to that later).
  //   > client.getListing('B/'); // -> ['d', 'E/']
  //   > client.getObject('B/d'); // -> { ... }
  //
  // That was the simplest usecase. Let's look at another one:
  //
  // Suppose that all the data files within our tree contain a lot of data. They
  // could be music, videos, large images etc. Given that, it would be very
  // impractical to transfer all of them, even though we don't know at this point
  // if the user even wants to use them in the current session.
  // So one option we have, is to tell remoteStorage only to synchronize the
  // *directory tree*, but not the content of files.
  //   > client.use('', true);
  // The second argument given is called *treeOnly*.
  //
  // When we now (after the 'ready' event has been fired) use *getListing*, we
  // still get a listing of all known paths:
  //   > client.getListing(''); // -> ['B/', 'C/']
  //   > client.getListing('B/'); // -> ['d', 'E/']
  //
  // Getting an object on the other hand, will not return anything.
  //   > client.getObject('B/d'); // -> undefined
  //
  // We can use this scenario, to display a *tree of available data* to the user.
  // As soon as the user chooses one of the items, we can retrieve it, by passing
  // a callback to getObject:
  //   > client.getObject('B/d', function(object) {
  //   >   console.log("received object is: ", object);
  //   > });
  //

  function needsSync(path) {
    if(! path) {
      path = '/';
    }
    if(! util.isDir(path)) {
      return util.getPromise().fulfillLater(false);
    }
    return store.getNode(path).then(function(root) {
      if(Object.keys(root.diff).length > 0) {
        return true;
      }
      var keys = Object.keys(root.data);
      function next() {
        var key = keys.shift();
        if(! key) {
          return false;
        }
        return needsSync(path + key).then(function(value) {
          if(value) {
            return true;
          } else {
            return next();
          }
        });
      }
      return next();
    });
  }

  var disabled = false;

  function disable() {
    disabled = true;
    events.emit('ready');
  }

  function enable() {
    enabled = true;
  }

  /**************************************/

  // Section: High-level sync functions
  //
  // These are the functions that are usually called from outside this
  // file to initiate some synchronization task.
  //
  //

  // Function: fullSync
  //
  // Perform a full sync cycle.
  //
  // Will update local and remote data as needed.
  //
  // Calls it's callback once the cycle is complete.
  //
  // Fires:
  //   ready    - when the sync queue is empty afterwards
  //   conflict - when there are two incompatible versions of the same node
  //   change   - when the local store is updated
  //
  function fullSync(pushOnly) {
    return util.makePromise(function(promise) {
      if(disabled) {
        promise.fulfillLater()
        return;
      }
      if(! isConnected()) {
        promise.fail('not-connected');
        return;
      }

      logger.info("full " + (pushOnly ? "push" : "sync") + " started");

      findRoots().then(function(roots) {
        logger.debug("SYNCING ROOTS", roots);
        var synced = 0;

        function rootCb(path) {
          return function() {
            logger.debug("SYNCED ROOT", path);
            synced++;
            if(synced == roots.length) {
              sync.lastSyncAt = new Date();
              promise.fulfill();
            }
          };
        }

        if(roots.length === 0) {
          return promise.fail(new Error("No access claimed!"));
        }

        roots.forEach(function(root) {
          enqueueTask(function() {
            return traverseTree(root, processNode, {
              pushOnly: pushOnly
            });
          }, rootCb(root));
        });
      });
    });
  }

  // Function: fullPush
  //
  // Perform a full sync cycle, but only update remote data.
  //
  // Used before disconnecting, to clear local diffs.
  //
  // Fires:
  //   ready    - when the sync queue is empty afterwards
  //   conflict - when there are two incompatible versions of the same node
  //   change   - when the local store is updated
  //
  function fullPush(callback) {
    return fullSync(callback, true);
  }

  // Function: partialSync
  //
  // Sync a partial tree, starting at given path.
  //
  // Parameters:
  //   startPath - path to start at. Must be a directory path.
  //   depth     - maximum depth of directories to traverse. null for infinite depth.
  //   callback  - callback to call when done. receives no parameters.
  //
  // Fires:
  //   ready    - when the sync queue is empty afterwards
  //   conflict - when there are two incompatible versions of the same node
  //   change   - when the local store is updated
  //
  function partialSync(startPath, depth) {
    return util.makePromise(function(promise) {
      if(! isConnected()) {
        return promise.fulfill();
      }

      validatePath(startPath);
      logger.info("partial sync requested: " + startPath);
      enqueueTask(function() {
        logger.info("partial sync started from: " + startPath);
        return traverseTree(startPath, processNode, {
          depth: depth,
          force: true
        });
      }, promise.fulfill.bind(promise));
    });
  }


  /**************************************/

  // Section: Scheduling and state
  //
  // Scheduling happens using three variables:
  //
  //   ready state - a boolean, set to false when any task is in progress
  //
  //   task queue  - a queue of procedures to call when 'ready' is fired.
  //                 All <High-level sync functions> enqueue their task here,
  //                 when the the ready state is currently false.
  //
  //   deferred iteration queue - a queue of spawnQueue tasks to start, when the
  //                 'ready' event *would* be fired. Enqueued from spawnQueue,
  //                 when it's called with ready state set to false.
  //


  var ready = true;

  // queue of spawnQueue calls
  // (for queueing *within* a sync cycle)
  var deferredIterationQueue = [];
  // queue of sync tasks
  // (if requested, while not ready)
  var taskQueue = [];

  // function to call when current task is done, before next task is popped from taskQueue.
  var currentFinalizer = null;

  function beginTask() {
    setBusy();
    var task = taskQueue.shift();
    if(! task) {
      throw new Error("Can't begin task, queue is empty");
    }
    currentFinalizer = task.finalizer;
    var result = task.run();
    if(util.isPromise(result)) {
      result.then(finishTask, function(error) {
        logger.error("TASK FAILED", (error && error.stack) || error);
        finishTask();
        fireError(null, error);
      });
    }
  }

  function finishTask() {
    remoteAdapter.clearCache();
    if(currentFinalizer) {
      currentFinalizer();
    }
    if(taskQueue.length > 0) {
      beginTask();
    } else {
      setReady();
    }
  }

  function enqueueTask(callback, finalizer) {
    taskQueue.push({
      run: callback,
      finalizer: finalizer
    });
    if(ready) {
      beginTask();
    } else {
      logger.info('not ready, enqueued task');
    }
  }

  function setBusy() {
    ready = false;
    events.emit('state', 'busy');
    events.emit('busy');
  }
  function setReady() {
    ready = true;
    events.emit('state', 'connected');
    events.emit('ready');
  }

  // Function: getState
  // Get the current ready state of synchronization. Either 'connected' or 'busy'.
  function getState() {
    return disabled ? 'disabled' : (ready ? 'connected' : 'busy');
  }

  // Section: Events

  // Event: ready
  //
  // Fired when sync becomes ready. This means the current sync cycle has ended.
  //
  // Shouldn't be used from application code, as the state may move back to 'busy'
  // immediately afterwards, in case tasks have been enqueued by the high-level
  // sync functions.

  // Event: conflict
  //
  // Both local and remote data of a node has been modified.
  // You need to specify a resolution.
  //
  // Properties:
  //   path        - path of the conflicting node
  //   localValue  - locally cached (and modified) value
  //   remoteValue - new value seen on the remote server
  //   localTime   - Date object, representing last local update
  //   remoteTime  - Date object, representing last remote update
  //   lastUpdate  - Date object, representing last synchronization of this node
  //   resolve     - Function to call, in order to specify a resolution
  //   type        - type of conflict, either "delete" or "merge"
  //
  // Example:
  //   (start code)
  //
  //   client.on('conflict', function(event) {
  //
  //     console.log(event.type, ' conflict at ', event.path,
  //                 event.localTime, 'vs', event.remoteTime,
  //                 '(last seen: ', event.lastUpdate, ')');
  //
  //     event.resolve('local'); // overwrite remote version
  //     // OR
  //     event.resolve('remote'); // overwrite local version
  //   });
  //
  //   (end code)
  //

  function fireConflict(type, path, local, remote) {
    events.emit('conflict', {
      type: type,
      path: path,
      localValue: local.data,
      remoteValue: remote.data,
      localTime: new Date(local.timestamp),
      remoteTime: new Date(remote.timestamp),
      lastUpdate: new Date(local.lastUpdatedAt),
      resolve: makeConflictResolver(path, local, remote)
    });
  }

  // Event: error
  //
  // Fired when either one of the underlying layers propagates an error,
  // or an exception is called within a sync callback.
  //
  // Properties:
  //   path  - path that is associated with this error. May be null.
  //   error - Either an error message (string) or a Error object.
  //   stack - If this was an error and the browser supports the error.stack
  //           property, this holds the stack as an array of lines.


  function fireError(path, error) {
    var event = { path: path, source: 'sync' };
    if(typeof(error) == 'object') {
      event.stack = error.stack;
      if(typeof(event.stack) == 'string') {
        event.stack = event.stack.split('\n');
      }
      event.message = error.message;
      event.exception = error;
    } else if(error == 'timeout') {
      events.emit('timeout');
      return;
    } else {
      event.message = error;
    }
    events.emit('error', event);
  }

  // Section: Update functions

  // Function: deleteLocal
  //
  // remove local data at path.
  // Fires: change
  function deleteLocal(path, local, remote) {
    logger.info('DELETE', path, 'REMOTE -> LOCAL');
    return store.removeNode(path, remote.timestamp);
  }

  // Function: deleteRemote
  //
  // remove remote data, then clear local diff.
  // Fires: error
  function deleteRemote(path, local, remote) {
    logger.info('DELETE', path, 'LOCAL -> REMOTE');
    return remoteAdapter.
      remove(path).
      then(function() {
        store.clearDiff(path);
      });
  }

  // Function: updateLocal
  //
  // update local data at path.
  function updateLocal(path, local, remote) {
    logger.info('UPDATE', path, 'REMOTE -> LOCAL');
    return store.setNodeData(path, remote.data, false, remote.timestamp, remote.mimeType);
  }

  // Function: updateRemote
  //
  // update remote data at path, then clear local diff.
  // Fires: error
  function updateRemote(path, local, remote) {
    logger.info('UPDATE', path, 'LOCAL -> REMOTE');
    var parentPath = util.containingDir(path);
    var baseName = util.baseName(path);
    return remoteAdapter.set(path, local).
      then(util.curry(remoteAdapter.expireKey, parentPath)).
      then(util.curry(remoteAdapter.get, parentPath)).
      then(function(remoteNode) {
        return store.clearDiff(
          path, remoteNode ? remoteNode.data[baseName] : undefined
        );
      });
  }

  // Function: processNode
  //
  // Decides which action to perform on the node in order to synchronize it.
  //
  // Used as a callback for <traverseTree>.
  function processNode(path, local, remote) {

    //BEGIN-DEBUG
    function debugEvent(message) {
      events.emit('debug', {
        path: path,
        method: 'processNode',
        message: message,
        timestamp: new Date()
      });
    }
    //END-DEBUG

    if(! path) {
      throw new Error("Can't process node without a path!");
    }

    if(util.isDir(path)) {
      throw new Error("Attempt to process directory node: " + path);
    }

    var action = null;

    if(local.deleted) {
      // outgoing delete!
      //BEGIN-DEBUG
      debugEvent('outgoing delete');
      //END-DEBUG
      action = deleteRemote;

    } else if(remote.deleted && local.lastUpdatedAt > 0) {
      if(local.timestamp == local.lastUpdatedAt) {
        // incoming delete!
        //BEGIN-DEBUG
        debugEvent('incoming delete');
        //END-DEBUG
        action = deleteLocal;

      } else {
        // deletion conflict!
        //BEGIN-DEBUG
        debugEvent('deletion conflict', 'remote', remote, 'local', local);
        //END-DEBUG
        action = util.curry(fireConflict, 'delete');

      }
    } else if(local.timestamp == remote.timestamp) {
      // no action today!
      //BEGIN-DEBUG
      debugEvent('no action today', 'remote', remote, 'local', local);
      //END-DEBUG
      return;

    } else if((!remote.timestamp) || local.timestamp > remote.timestamp) {
      // local updated happpened before remote update
      if((!remote.timestamp) || local.lastUpdatedAt == remote.timestamp) {
        // outgoing update!
        //BEGIN-DEBUG
        debugEvent('outgoing update');
        //END-DEBUG
        action = updateRemote;

      } else {
        // merge conflict!
        //BEGIN-DEBUG
        debugEvent('merge conflict (local > remote)', 'remote', remote, 'local', local);
        //END-DEBUG
        action = util.curry(fireConflict, 'merge');

      }
    } else if(local.timestamp < remote.timestamp) {
      // remote updated happened before local update
      if(local.lastUpdatedAt == local.timestamp) {
        // incoming update!
        //BEGIN-DEBUG
        debugEvent('incoming update');
        //END-DEBUG
        action = updateLocal;

      } else {
        // merge conflict!
        //BEGIN-DEBUG
        debugEvent('merge conflict (local < remote)', 'remote', remote, 'local', local);
        //END-DEBUG
        action = util.curry(fireConflict, 'merge');

      }
    }

    if(! action) {
      console.error("NO ACTION DETERMINED!!!", path, local, 'vs', remote);
      var exc = new Error("Something went terribly wrong.");
      exc.path = path;
      exc.localNode = local;
      exc.remoteNode = remote;
      throw exc;
    }

    return action(path, local, remote);
  }

  /**************************************/

  // Function: fetchLocalNode
  //
  // Fetch a local node at given path.
  //
  // Loads a <store.Node> and extends it with the following:
  //   data - data of the node, as received from <store.getNodeData>
  //   deleted - whether this node is considered deleted.
  function fetchLocalNode(path, isDeleted) {
    return store.getNode(path).
      then(function(localNode) {
        logger.info("fetch local", path, localNode);

        if(isForeignPath(path)) {
          // can't modify foreign data locally
          isDeleted = false;
        }

        function yieldNode(node) {
          localNode.deleted = isDeleted;
          return localNode;
        }

        if(typeof(isDeleted) === 'undefined') {
          // in some contexts we don't have the parent present already to check.
          var parentPath = util.containingDir(path);
          var baseName = util.baseName(path);
          if(parentPath) {
            return store.getNode(parentPath).
              then(function(parent) {
                isDeleted = (! parent.data[baseName]) && parent.diff[baseName];
                return yieldNode();
              });
          } else {
            // root node can't be deleted.
            isDeleted = false;
          }
        }
        return yieldNode();
      });
  }

  // Function: fetchRemoteNode
  //
  // Fetch node at given path from remote.
  //
  // Constructs a node like this:
  //   timestamp - last update of the node, if known. Otherwise 0.
  //   data - data of the node received from remotestorage, or undefined
  //   deleted - whether remotestorage knows this node.
  //   mimeType - MIME type of the node
  //
  function fetchRemoteNode(path, isDeleted) {
    logger.info("fetch remote", path);
    return remoteAdapter.get(path).
      then(function(node) {
        return node || {};
      });
  }

  // Section: Trivial helpers

  function isConnected() {
    return remoteAdapter.getState() === 'connected';
  }

  function makeSet(a, b) {
    var o = {};
    var al = a.length, bl = b.length;
    for(var i=0;i<al;i++) { o[a[i]] = true; }
    for(var j=0;j<bl;j++) { o[b[j]] = true; }
    return Object.keys(o);
  }

  var foreignPathRE = /^[^\/][^:]+:\//;
  var ownPathRE = /^\//;

  function isOwnPath(path) {
    return ownPathRE.test(path);
  }

  function isForeignPath(path) {
    return foreignPathRE.test(path);
  }

  function validPath(path, foreignOk) {
    return isOwnPath(path) || (foreignOk ? isForeignPath(path) : false);
  }

  function validatePath(path, foreignOk) {
    if(! validPath(path, foreignOk)) {
      throw new Error("Invalid path: " + path);
    }
  }

  function findRoots() {
    return store.getNode('/').then(function(root) {
      if(root.startAccess) {
        return ['/'];
      } else {
        return store.getNode('/public/').then(function(publicRoot) {
          var paths = [];
          for(var key in root.data) {
            paths.push('/' + key);
          }
          for(var publicKey in publicRoot.data) {
            paths.push('/public/' + publicKey);
          }
          return util.asyncSelect(paths, function(path) {
            return store.getNode(path).then(function(node) {
              return !! node.startAccess;
            });
          });
        });
      }
    }).then(function(roots) {
      return roots;
    });
  }

  function findAccess(path) {
    if(! path) {
      return null;
    } else {
      return store.getNode(path).
        then(function(node) {
          if(node.startAccess) {
            return node.startAccess;
          } else {
            return findAccess(util.containingDir(path));
          }
        });
    }
  }

  function findNextForceRoots(path, cachedNode) {
    logger.debug('findNextForceRoots', path);
    var roots = [];
    function checkChildren(node) {
      return util.asyncEach(Object.keys(node.data), function(key) {
        return store.getNode(path + key).then(function(childNode) {
          logger.debug('findNextForceRoots check', path + key, childNode);
          if(childNode.startForce || childNode.startForceTree) {
            roots.push(path + key);
          } else {
            return findNextForceRoots(path + key, childNode).
              then(function(innerRoots) {
                innerRoots.forEach(function(innerRoot) {
                  roots.push(innerRoot);
                });
              });
          }
        });
      }).then(function() {
        logger.debug('findNextForceRoots return', roots);
        return roots;
      });
    }
    return (
      cachedNode ? checkChildren(cachedNode) :
        store.getNode(path).then(checkChildren)
    );
  }

  // Function: traverseTree
  //
  // Traverse the full tree of nodes, passing each visited data node to the callback for processing.
  //
  // Parameters:
  //   root     - Path to the root to start traversal at.
  //   callback - callback called for each node. see below.
  //   options  - (optional) Object with options. see below.
  //
  // Callback parameters:
  //   The callback is called for each node, that is present either
  //   locally or remote (or both).
  //
  //   path       - path to current node
  //   localNode  - local node at current path. See <fetchLocalNode> for a description.
  //   remoteNode - remote node at current path. See <fetchRemoteNode> for a description.
  //
  // Options:
  //   depth - When given, a positive number, setting the maximum depth of traversal.
  //           Depth will be decremented in each recursion
  function traverseTree(root, callback, opts) {
    logger.info('traverse', root, opts, 'callback?', !!callback);

    if(! util.isDir(root)) {
      throw "Can't traverse data node: " + root;
    }

    if(! opts) { opts = {}; }

    if(opts.depth || opts.depth === 0) {
      logger.debug("traverse depth", opts.depth, root);
    }

    //BEGIN-DEBUG
    function debugEvent(path, message) {
      events.emit('debug', {
        path: path,
        method: 'traverseTree',
        message: message,
        timestamp: new Date()
      });
    }
    //END-DEBUG

    function determineLocalInterest(node, options) {
      logger.debug('traverseNode.determineLocalInterest', node, options);
      return util.makePromise(function(promise) {
        options.access = util.highestAccess(options.access, node.startAccess);
        options.force = opts.force || node.startForce;
        options.forceTree = opts.forceTree || node.startForceTree;

        function determineForce() {
          logger.debug('determineForce', options);
          var force = (options.force || options.forceTree);
          if((! force) && options.path == '/' || options.path == '/public/') {
            findNextForceRoots(options.path).
              then(function(roots) {
                logger.debug('local interest', options.path, node, false, 'next: ', roots);
                promise.fulfill(node, false, roots);
              });
          } else {
            logger.debug('local interest', options.path, node, force);
            promise.fulfill(node, force);
          }
        }

        if(! options.access) {
          // in case of a partial sync, we have not been informed about
          // access inherited from the parent.
          findAccess(util.containingDir(root)).
            then(function(access) {
              options.access = access;
            }).then(determineForce);
        } else {
          determineForce();
        }
      });
    }

    function mergeDataNode(path, localNode, remoteNode, options) {
      //BEGIN-DEBUG
      debugEvent(path, 'mergeDataNode');
      //END-DEBUG
      logger.debug("traverseTree.mergeDataNode", path);
      if(util.isDir(path)) {
        throw new Error("Not a data node: " + path);
      }
      return callback(path, localNode, remoteNode);
    }

    function mergeDirectory(path, localNode, remoteNode, options) {
      //BEGIN-DEBUG
      debugEvent(path, 'mergeDirectory');
      //END-DEBUG
      logger.debug("traverseTree.mergeDirectory", path, localNode, options);
      var fullListing = makeSet(
        Object.keys(localNode.data),
        Object.keys(remoteNode.data)
      );
      return util.asyncEach(fullListing, function(key) {
        var childPath = path + key;
        var remoteVersion = remoteNode.data[key];
        var localVersion = localNode.data[key];
        logger.debug("traverseTree.mergeDirectory[" + childPath + "]", remoteVersion, 'vs', localVersion);
        if(remoteVersion !== localVersion) {
          if(util.isDir(childPath)) {
            if(options.forceTree && options.depth !== 0) {
              var childOptions = util.extend({}, options);
              if(childOptions.depth) {
                childOptions.depth--;
              }
              return mergeTree(childPath, childOptions);
            }
          } else if(options.force) {
            return util.asyncGroup(
              util.curry(fetchLocalNode, childPath),
              util.curry(fetchRemoteNode, childPath)
            ).then(function(nodes, errors) {
              if(errors.length > 0) {
                logger.error("Failed to sync node", childPath, errors);
                return store.setNodeError(childPath, errors);
              } else {
                return mergeDataNode(childPath, nodes[0], nodes[1], options);
              }
            });
          } else {
            store.touchNode(childPath);
          }
        }
      });
    }

    function mergeTree(path, options) {
      //BEGIN-DEBUG
      debugEvent(path, 'mergeTree');
      //END-DEBUG
      logger.debug("traverseTree.mergeTree", path);
      options.path = path;
      return fetchLocalNode(path).
        then(util.rcurry(determineLocalInterest, options)).
        then(function(localNode, localInterest, nextRoots) {
          if(localInterest) {
            return fetchRemoteNode(path).
              then(function(remoteNode) {
                return mergeDirectory(path, localNode, remoteNode, options).
                  then(function() {
                    logger.debug('mergeDirectory done');
                    return store.setLastSynced(path, remoteNode.timestamp);
                  });
              });
          } else if(nextRoots) {
            for(var key in nextRoots) {
              return util.asyncEach(nextRoots, function(root) {
                return mergeTree(root, options);
              });
            }
          } else {
            logger.debug("NO INTEREST & NO NEXT ROOTS", path);
          }
        });
    }

    return mergeTree(root, opts);
  }

  // Section: Meta helpers

  // Function: makeConflictResolver
  // returns a function that can be called to resolve the conflict
  // at the given path.
  function makeConflictResolver(path, local, remote) {
    return function(solution, newData) {
      if(solution == 'local') {
        // outgoing update!
        if(newData) {
          local.data = newData;
          // a hack to also update local data, when the resolution specifies new data
          updateLocal(path, local, local);
        }
        updateRemote(path, local, remote);
      } else if(solution == 'remote') {
        // incoming update!
        updateLocal(path, local, remote);
      } else {
        throw "Invalid conflict resolution: " + solution;
      }
    };
  }


  events.on('error', function(error) {
    logger.error("Sync Error: ", error);
  });


  var sync = util.extend(events, {

    enable: enable,
    disable: disable,

    getQueue: function() { return taskQueue; },

    lastSyncAt: null,

    // Section: exported functions

    // Method: on
    // Install an event handler.

    // Method: fullSync
    // <fullSync>
    fullSync: fullSync,

    forceSync: fullSync,
    // Method: fullPush
    // <fullPush>
    fullPush: fullPush,
    // Method: partialSync
    // <partialSync>
    partialSync: partialSync,

    // Method: needsSync
    // Returns true, if there are local changes that have not been synced.
    needsSync: needsSync,

    // Method: getState
    // <getState>
    getState: getState,

    // Method: clearSettings
    // Clear all data from localStorage that this file put there.
    clearSettings: settings.clear,

    // FOR TESTING INTERNALS ONLY!!!
    getInternal: function(symbol) {
      return eval(symbol);
    },

    setRemoteAdapter: function(adapter) {
      remoteAdapter = adapter;
    }

  });

  return sync;

  /*
    Section: Notes

    Some example I made up to visualize some of the situations that can happen.

    Legend:
      L - has local modifications
      R - has remote modifications
      D - modification is a delete

    Suppose a tree like this:

      >    /
      >    /messages/
      >    /messages/pool/
      >    /messages/pool/1
      >    /messages/pool/2
      > L  /messages/pool/3
      > R  /messages/pool/4
      >    /messages/index/read/true/1
      > L  /messages/index/read/true/3
      >    /messages/index/read/false/2
      > LD /messages/index/read/false/3
      > R  /messages/index/read/false/4


    Now a sync cycle for /messages/ begins:

      > GET /messages/
      >   -> mark remote diff for pool/ and index/
      > GET /messages/index/
      >   -> mark local and remote diff for read/
      > GET /messages/index/read/
      >   -> mark remote diff for false/
      > GET /messages/index/read/false/
      >   -> mark remote diff for 4
      > DELETE /messages/index/read/false/3
      >   -> clear local diff for 3
      > GET /messages/index/read/false/4
      >   -> update local node 4
      >   -> clear remote diff for 4
      >   (pop back to /messages/index/read/)
      >   -> clear remote and local diff for false/
      > GET /messages/index/read/true/
      > PUT /messages/index/read/true/3
      >   -> clear local diff for 3
      >   (pop back to /messages/index/read/)
      >   -> clear local diff for true/)
      >   (pop back to /messages/index/)
      >   -> clear local and remote diff for read/
      >   (pop back to /messages/)
      > GET /messages/pool/
      >   -> mark remote diff for 4
      > PUT /messages/pool/3
      >   -> clear local diff for 3
      > GET /messages/pool/4
      >   -> update local node 4
      >   -> clear remote diff for 4
      >   (pop back to /messages/)
      >   -> clear local and remote diff for pool/
      >   (pop back to /)
      >   -> clear local and remote diff for messages/

    Sync cycle all done.

   */

});

define('lib/schedule',['./util', './sync'], function(util, sync) {

  var logger = util.getLogger('schedule');

  var watchedPaths = {};
  var lastPathSync = {};
  var runInterval = 5000;
  var enabled = false;
  var timer = null;

  function scheduleNextRun() {
    timer = setTimeout(run, runInterval);
  }

  function run() {
    if(! enabled) {
      return;
    }
    if(timer) {
      clearTimeout(timer);
    }

    logger.info('check');

    var syncNow = [];
    var syncedCount = 0;

    var now = new Date().getTime();

    // assemble list of paths that need action
    for(var p in watchedPaths) {
      var lastSync = lastPathSync[p];
      if((! lastSync) || (lastSync + watchedPaths[p]) <= now) {
        syncNow.push(p);
      }
    }

    if(syncNow.length === 0) {
      scheduleNextRun();
      return;
    }

    logger.info("Paths to refresh: ", syncNow);

    // request a sync for each path
    var numSyncNow = syncNow.length;
    for(var i=0;i<numSyncNow;i++) {
      var path = syncNow[i];
      var syncer = path === '/' ? sync.fullSync : sync.partialSync;
      syncer(path).then(function() {
        lastPathSync[path] = new Date().getTime();

        syncedCount++;

        logger.debug('now synced', syncedCount, 'of', numSyncNow);

        if(syncedCount == numSyncNow) {
          scheduleNextRun();
        }
      });
    }
  }

  return {

    get: function(path) {
      if(path) {
        return watchedPaths[path];
      } else {
        return watchedPaths;
      }
    },

    enable: function() {
      enabled = true;
      logger.info('enabled');
      scheduleNextRun();
    },

    disable: function() {
      enabled = false;
      logger.info('disabled');
    },

    isEnabled: function() {
      return enabled;
    },

    watch: function(path, interval) {
      logger.info("Schedule sync of", path, "every", interval / 1000.0, "seconds");
      watchedPaths[path] = interval;
      if(! lastPathSync[path]) {
        // mark path as synced now, so it won't get synced on the next scheduler
        // cycle, but instead when it's interval has passed.
        lastPathSync[path] = new Date().getTime();
      }
    },

    unwatch: function(path) {
      delete watchedPaths[path];
      delete lastPathSync[path];
    },

    reset: function() {
      watchedPaths = {};
      lastPathSync = {};
      if(timer) {
        clearTimeout(timer);
        timer = null;
      }
    }

  };

});

/**
 * JSONSchema Validator - Validates JavaScript objects using JSON Schemas
 *	(http://www.json.com/json-schema-proposal/)
 *
 * Copyright (c) 2007 Kris Zyp SitePen (www.sitepen.com)
 * Licensed under the MIT (MIT-LICENSE.txt) license.
To use the validator call the validate function with an instance object and an optional schema object.
If a schema is provided, it will be used to validate. If the instance object refers to a schema (self-validating),
that schema will be used to validate and the schema parameter is not necessary (if both exist,
both validations will occur).
The validate method will return an array of validation errors. If there are no errors, then an
empty list will be returned. A validation error will have two properties:
"property" which indicates which property had the error
"message" which indicates what the error was
 */
//({define:typeof define!="undefined"?define:function(deps, factory){module.exports = factory();}}).
define('vendor/validate',[], function(){
var exports = validate;
// setup primitive classes to be JSON Schema types
exports.Integer = {type:"integer"};
var primitiveConstructors = {
	String: String,
	Boolean: Boolean,
	Number: Number,
	Object: Object,
	Array: Array,
	Date: Date
}
exports.validate = validate;
function validate(/*Any*/instance,/*Object*/schema) {
		// Summary:
		//  	To use the validator call JSONSchema.validate with an instance object and an optional schema object.
		// 		If a schema is provided, it will be used to validate. If the instance object refers to a schema (self-validating),
		// 		that schema will be used to validate and the schema parameter is not necessary (if both exist,
		// 		both validations will occur).
		// 		The validate method will return an object with two properties:
		// 			valid: A boolean indicating if the instance is valid by the schema
		// 			errors: An array of validation errors. If there are no errors, then an
		// 					empty list will be returned. A validation error will have two properties:
		// 						property: which indicates which property had the error
		// 						message: which indicates what the error was
		//
		return validate(instance, schema, {changing: false});//, coerce: false, existingOnly: false});
	};
exports.checkPropertyChange = function(/*Any*/value,/*Object*/schema, /*String*/property) {
		// Summary:
		// 		The checkPropertyChange method will check to see if an value can legally be in property with the given schema
		// 		This is slightly different than the validate method in that it will fail if the schema is readonly and it will
		// 		not check for self-validation, it is assumed that the passed in value is already internally valid.
		// 		The checkPropertyChange method will return the same object type as validate, see JSONSchema.validate for
		// 		information.
		//
		return validate(value, schema, {changing: property || "property"});
	};
var validate = exports._validate = function(/*Any*/instance,/*Object*/schema,/*Object*/options) {

	if (!options) options = {};
	var _changing = options.changing;

	function getType(schema){
		return schema.type || (primitiveConstructors[schema.name] == schema && schema.name.toLowerCase());
	}
	var errors = [];
	// validate a value against a property definition
	function checkProp(value, schema, path,i){

		var l;
		path += path ? typeof i == 'number' ? '[' + i + ']' : typeof i == 'undefined' ? '' : '.' + i : i;
		function addError(message){
			errors.push({property:path,message:message});
		}

		if((typeof schema != 'object' || schema instanceof Array) && (path || typeof schema != 'function') && !(schema && getType(schema))){
			if(typeof schema == 'function'){
				if(!(value instanceof schema)){
					addError("is not an instance of the class/constructor " + schema.name);
				}
			}else if(schema){
				addError("Invalid schema/property definition " + schema);
			}
			return null;
		}
		if(_changing && schema.readonly){
			addError("is a readonly field, it can not be changed");
		}
		if(schema['extends']){ // if it extends another schema, it must pass that schema as well
			checkProp(value,schema['extends'],path,i);
		}
		// validate a value against a type definition
		function checkType(type,value){
			if(type){
				if(typeof type == 'string' && type != 'any' &&
						(type == 'null' ? value !== null : typeof value != type) &&
						!(value instanceof Array && type == 'array') &&
						!(value instanceof Date && type == 'date') &&
						!(type == 'integer' && value%1===0)){
					return [{property:path,message:(typeof value) + " value found, but a " + type + " is required"}];
				}
				if(type instanceof Array){
					var unionErrors=[];
					for(var j = 0; j < type.length; j++){ // a union type
						if(!(unionErrors=checkType(type[j],value)).length){
							break;
						}
					}
					if(unionErrors.length){
						return unionErrors;
					}
				}else if(typeof type == 'object'){
					var priorErrors = errors;
					errors = [];
					checkProp(value,type,path);
					var theseErrors = errors;
					errors = priorErrors;
					return theseErrors;
				}
			}
			return [];
		}
		if(value === undefined){
			if(schema.required){
				addError("is missing and it is required");
			}
		}else{
			errors = errors.concat(checkType(getType(schema),value));
			if(schema.disallow && !checkType(schema.disallow,value).length){
				addError(" disallowed value was matched");
			}
			if(value !== null){
				if(value instanceof Array){
					if(schema.items){
						var itemsIsArray = schema.items instanceof Array;
						var propDef = schema.items;
						for (i = 0, l = value.length; i < l; i += 1) {
							if (itemsIsArray)
								propDef = schema.items[i];
							if (options.coerce)
								value[i] = options.coerce(value[i], propDef);
							errors.concat(checkProp(value[i],propDef,path,i));
						}
					}
					if(schema.minItems && value.length < schema.minItems){
						addError("There must be a minimum of " + schema.minItems + " in the array");
					}
					if(schema.maxItems && value.length > schema.maxItems){
						addError("There must be a maximum of " + schema.maxItems + " in the array");
					}
				}else if(schema.properties || schema.additionalProperties){
					errors.concat(checkObj(value, schema.properties, path, schema.additionalProperties));
				}
				if(schema.pattern && typeof value == 'string' && !value.match(schema.pattern)){
					addError("does not match the regex pattern " + schema.pattern);
				}
				if(schema.maxLength && typeof value == 'string' && value.length > schema.maxLength){
					addError("may only be " + schema.maxLength + " characters long");
				}
				if(schema.minLength && typeof value == 'string' && value.length < schema.minLength){
					addError("must be at least " + schema.minLength + " characters long");
				}
				if(typeof schema.minimum !== undefined && typeof value == typeof schema.minimum &&
						schema.minimum > value){
					addError("must have a minimum value of " + schema.minimum);
				}
				if(typeof schema.maximum !== undefined && typeof value == typeof schema.maximum &&
						schema.maximum < value){
					addError("must have a maximum value of " + schema.maximum);
				}
				if(schema['enum']){
					var enumer = schema['enum'];
					l = enumer.length;
					var found;
					for(var j = 0; j < l; j++){
						if(enumer[j]===value){
							found=1;
							break;
						}
					}
					if(!found){
						addError("does not have a value in the enumeration " + enumer.join(", "));
					}
				}
				if(typeof schema.maxDecimal == 'number' &&
					(value.toString().match(new RegExp("\\.[0-9]{" + (schema.maxDecimal + 1) + ",}")))){
					addError("may only have " + schema.maxDecimal + " digits of decimal places");
				}
			}
		}
		return null;
	}
	// validate an object against a schema
	function checkObj(instance,objTypeDef,path,additionalProp){

		if(typeof objTypeDef =='object'){
			if(typeof instance != 'object' || instance instanceof Array){
				errors.push({property:path,message:"an object is required"});
			}
			
			for(var i in objTypeDef){ 
				if(objTypeDef.hasOwnProperty(i)){
					var value = instance[i];
					// skip _not_ specified properties
					if (value === undefined && options.existingOnly) continue;
					var propDef = objTypeDef[i];
					// set default
					if(value === undefined && propDef["default"]){
						value = instance[i] = propDef["default"];
					}
					if(options.coerce && i in instance){
						value = instance[i] = options.coerce(value, propDef);
					}
					checkProp(value,propDef,path,i);
				}
			}
		}
		for(i in instance){
			if(instance.hasOwnProperty(i) && !(i.charAt(0) == '_' && i.charAt(1) == '_') && objTypeDef && !objTypeDef[i] && additionalProp===false){
				if (options.filter) {
					delete instance[i];
					continue;
				} else {
					errors.push({property:path,message:(typeof value) + "The property " + i +
						" is not defined in the schema and the schema does not allow additional properties"});
				}
			}
			var requires = objTypeDef && objTypeDef[i] && objTypeDef[i].requires;
			if(requires && !(requires in instance)){
				errors.push({property:path,message:"the presence of the property " + i + " requires that " + requires + " also be present"});
			}
			value = instance[i];
			if(additionalProp && (!(objTypeDef && typeof objTypeDef == 'object') || !(i in objTypeDef))){
				if(options.coerce){
					value = instance[i] = options.coerce(value, additionalProp);
				}
				checkProp(value,additionalProp,path,i);
			}
			if(!_changing && value && value.$schema){
				errors = errors.concat(checkProp(value,value.$schema,path,i));
			}
		}
		return errors;
	}
	if(schema){
		checkProp(instance,schema,'',_changing || '');
	}
	if(!_changing && instance && instance.$schema){
		checkProp(instance,instance.$schema,'','');
	}
	return {valid:!errors.length,errors:errors};
};
exports.mustBeValid = function(result){
	//	summary:
	//		This checks to ensure that the result is valid and will throw an appropriate error message if it is not
	// result: the result returned from checkPropertyChange or validate
	if(!result.valid){
		throw new TypeError(result.errors.map(function(error){return "for property " + error.property + ': ' + error.message;}).join(", \n"));
	}
}

return exports;
});

/*!
  Math.uuid.js (v1.4)
  http://www.broofa.com
  mailto:robert@broofa.com

  Copyright (c) 2010 Robert Kieffer
  Dual licensed under the MIT and GPL licenses.

  ********

  Changes within remoteStorage.js:
  2012-10-31:
  - added AMD wrapper <niklas@unhosted.org>
  - moved extensions for Math object into exported object.
*/

/*
 * Generate a random uuid.
 *
 * USAGE: Math.uuid(length, radix)
 *   length - the desired number of characters
 *   radix  - the number of allowable values for each character.
 *
 * EXAMPLES:
 *   // No arguments  - returns RFC4122, version 4 ID
 *   >>> Math.uuid()
 *   "92329D39-6F5C-4520-ABFC-AAB64544E172"
 *
 *   // One argument - returns ID of the specified length
 *   >>> Math.uuid(15)     // 15 character ID (default base=62)
 *   "VcydxgltxrVZSTV"
 *
 *   // Two arguments - returns ID of the specified length, and radix. (Radix must be <= 62)
 *   >>> Math.uuid(8, 2)  // 8 character ID (base=2)
 *   "01001010"
 *   >>> Math.uuid(8, 10) // 8 character ID (base=10)
 *   "47473046"
 *   >>> Math.uuid(8, 16) // 8 character ID (base=16)
 *   "098F4D35"
 */
define('vendor/Math.uuid',[], function() {
  // Private array of chars to use
  var CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');

  return {
    uuid: function (len, radix) {
      var chars = CHARS, uuid = [], i;
      radix = radix || chars.length;

      if (len) {
        // Compact form
        for (i = 0; i < len; i++) uuid[i] = chars[0 | Math.random()*radix];
      } else {
        // rfc4122, version 4 form
        var r;

        // rfc4122 requires these characters
        uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
        uuid[14] = '4';

        // Fill in random data.  At i==19 set the high bits of clock sequence as
        // per rfc4122, sec. 4.1.5
        for (i = 0; i < 36; i++) {
          if (!uuid[i]) {
            r = 0 | Math.random()*16;
            uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
          }
        }
      }

      return uuid.join('');
    },

    // A more performant, but slightly bulkier, RFC4122v4 solution.  We boost performance
    // by minimizing calls to random()
    uuidFast: function() {
      var chars = CHARS, uuid = new Array(36), rnd=0, r;
      for (var i = 0; i < 36; i++) {
        if (i==8 || i==13 ||  i==18 || i==23) {
          uuid[i] = '-';
        } else if (i==14) {
          uuid[i] = '4';
        } else {
          if (rnd <= 0x02) rnd = 0x2000000 + (Math.random()*0x1000000)|0;
          r = rnd & 0xf;
          rnd = rnd >> 4;
          uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
        }
      }
      return uuid.join('');
    },

    // A more compact, but less performant, RFC4122v4 solution:
    uuidCompact: function() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
      });
    }
  };

});

define('lib/baseClient',[
  './util',
  './store',
  './wireClient',
  './sync',
  '../vendor/validate',
  '../vendor/Math.uuid'
], function(util, store, wireClient, sync, validate, MathUUID) {

  

  var logger = util.getLogger('baseClient');
  var globalEvents = util.getEventEmitter('error');
  var moduleEvents = {};

  function extractModuleName(path) {
    if (path && typeof(path) == 'string') {
      var parts = path.split('/');
      if(parts.length > 3 && parts[1] == 'public') {
        return parts[2];
      } else if(parts.length > 2){
        return parts[1];
      } else if(parts.length == 2) {
        return 'root';
      }
    }
  }

  var isPublicRE = /^\/public\//;

  function fireModuleEvent(eventName, moduleName, eventObj) {
    var isPublic = isPublicRE.test(eventObj.path);
    var events;
    if(moduleEvents[moduleName] &&
       (events = moduleEvents[moduleName][isPublic])) {

      if(moduleName !== 'root' && eventObj.path) {
        eventObj.relativePath = eventObj.path.replace(
          (isPublic ? '/public/' : '/') + moduleName + '/', ''
        );
      }

      events.emit(eventName, eventObj);
    }
  }

  function fireError(absPath, error) {
    var isPublic = isPublicRE.test(absPath);
    var moduleName = extractModuleName(absPath);
    var modEvents = moduleEvents[moduleName];
    if(! (modEvents && modEvents[isPublic])) {
      moduleEvents.root[isPublic].emit('error', error);
    } else {
      modEvents[isPublic].emit('error', error);
    }

    globalEvents.emit('error', error);
  }

  store.on('change', function(event) {
    var moduleName = extractModuleName(event.path);
    // remote-based changes get fired from the store.
    fireModuleEvent('change', moduleName, event);
    // root module gets everything
    fireModuleEvent('change', 'root', event);
  });

  sync.on('conflict', function(event) {
    var moduleName = extractModuleName(event.path);
    var isPublic = isPublicRE.test(event.path);
    var eventEmitter = moduleEvents[moduleName] && moduleEvents[moduleName][isPublic];
    var rootEmitter = moduleEvents.root && moduleEvents.root[isPublic];
    if(eventEmitter && eventEmitter.hasHandler('conflict')) {
      fireModuleEvent('conflict', moduleName, event);
      fireModuleEvent('conflict', 'root', event);
    } else if(rootEmitter && rootEmitter.hasHandler('conflict')) {
      fireModuleEvent('conflict', 'root', event);
    } else {
      event.resolve('remote');
    }
  });

  function failedPromise(error) {
    return util.getPromise().failLater(error);
  }

  function set(moduleName, path, absPath, value, mimeType) {
    if(util.isDir(absPath)) {
      return failedPromise(new Error('attempt to set a value to a directory ' + absPath));
    }
    var changeEvent;
    return store.getNode(absPath).
      then(function(node) {
        changeEvent = {
          origin: 'window',
          oldValue: node.data,
          newValue: value,
          path: absPath
        };
        return store.setNodeData(absPath, value, true, undefined, mimeType);
      }).then(function() {
        fireModuleEvent('change', moduleName, changeEvent);
        fireModuleEvent('change', 'root', changeEvent);
      });
  }

  var ValidationError = function(object, errors) {
    Error.call(this, "Validation failed!");
    this.object = object;
    this.errors = errors;
  };

  /** FROM HERE ON PUBLIC INTERFACE **/

  var BaseClient = function(moduleName, isPublic) {
    if(! moduleName) {
      throw new Error("moduleName is required");
    }
    this.moduleName = moduleName, this.isPublic = isPublic;
    if(! moduleEvents[moduleName]) {
      moduleEvents[moduleName] = {};
    }
    this.events = util.getEventEmitter('change', 'conflict', 'error');
    moduleEvents[moduleName][isPublic] = this.events;
    util.bindAll(this);
  };

  // Class: BaseClient
  //
  // A BaseClient allows you to get, set or remove data. It is the basic
  // interface for building "modules".
  //
  // See <remoteStorage.defineModule> for details.
  //
  //
  // Most methods here return promises. See the guide for and introduction: <Promises>
  //
  BaseClient.prototype = {

    // Event: error
    //
    // Fired when an error occurs.
    //
    // The event object is either a string or an array of error messages.
    //
    // Example:
    //   > client.on('error', function(err) {
    //   >   console.error('something went wrong:', err);
    //   > });
    //
    //
    // Event: change
    //
    // Fired when data concerning this module is updated.
    //
    // Properties:
    //   path         - path to the node that changed
    //   newValue     - new value of the node. if the node has been removed, this is undefined.
    //   oldValue     - previous value of the node. if the node has been newly created, this is undefined.
    //   origin       - either "tab", "device" or "remote". Elaborated below.
    //   relativePath - path relative to the module root (*not* present in the root module. Use path there instead)
    //
    // Change origins:
    //   Change events can come from different origins. In order for your app to
    //   update it's state appropriately, every change event knows about it's origin.
    //
    //   The following origins are defined,
    //
    //   tab - this event was generated from the same *browser tab* or window that received the event
    //   device - this event was generated from the same *app*, but a differnent tab or window
    //   remote - this event came from the *remotestorage server*. that means another app or the same app on another device caused the event.
    //
    // Example:
    //   (start code)
    //   client.on('change', function(event) {
    //     if(event.newValue && event.oldValue) {
    //       console.log(event.origin + ' updated ' + event.path + ':', event.oldValue, '->', event.newValue);
    //     } else if(event.newValue) {
    //       console.log(event.origin + ' created ' + event.path + ':', undefined, '->', event.newValue);
    //     } else {
    //       console.log(event.origin + ' removed ' + event.path + ':', event.oldValue, '->', undefined);
    //     }
    //   });
    //   (end code)
    //

    makePath: function(path) {
      var base = (this.moduleName == 'root' ?
                  (path[0] === '/' ? '' : '/') :
                  '/' + this.moduleName + '/');
      return (this.isPublic ? '/public' + base : base) + path;
    },

    nodeGivesAccess: function(path, mode) {
      return store.getNode(path).then(function(node) {
        var access = (new RegExp(mode)).test(node.startAccess);
        if(access) {
          return true;
        } else if(path.length > 0) {
          return this.nodeGivesAccess(path.replace(/[^\/]+\/?$/, ''));
        }
      }.bind(this));
    },

    ensureAccess: function(mode) {
      var path = this.makePath(this.moduleName == 'root' ? '/' : '');

      return this.nodeGivesAccess(path, mode).then(function(access) {
        if(! access) {
          throw "Not sufficient access claimed for node at " + path;
        }
      });
    },

    // Method: lastUpdateOf
    // Get the time a node was last updated.
    //
    // Parameters:
    //   path - Relative path from the module root
    //
    // Returns:
    //   a promise for a timestamp, which is either
    //   a Number - when the node exists OR
    //   null - when the node doesn't exist
    //
    // The timestamp is represented as Number of milliseconds.
    // Use this snippet to get a Date object from it
    //   (start code)
    //   client.lastUpdateOf('path/to/node').
    //     then(function(timestamp) {
    //       // (normally you should check that 'timestamp' isn't null now)
    //       console.log('last update: ', new Date(timestamp));
    //     });
    //   (end code)
    //
    lastUpdateOf: function(path) {
      var absPath = this.makePath(path);
      var node = store.getNode(absPath);
      return node ? node.timestamp : null;
    },

    //
    // Method: on
    //
    // Install an event handler for the given type.
    //
    // Parameters:
    //   eventType - type of event, either "change" or "error"
    //   handler   - event handler function
    //   context   - (optional) context to bind handler to
    //
    on: function(eventType, handler, context) {
      this.events.on(eventType, util.bind(handler, context));
    },

    //
    // Method: getObject
    //
    // Get a JSON object from given path.
    //
    // Parameters:
    //   path     - relative path from the module root (without leading slash)
    //
    // Returns:
    //   A promise for the object.
    //
    // Example:
    //   (start code)
    //   client.getObject('/path/to/object').
    //     then(function(object) {
    //       // object is either an object or null
    //     });
    //   (end code)
    //
    getObject: function(path) {
      return this.ensureAccess('r').
        then(util.curry(store.getNode, this.makePath(path))).
        get('data');
    },

    //
    // Method: getListing
    //
    // Get a list of child nodes below a given path.
    //
    // The callback semantics of getListing are identical to those of getObject.
    //
    // Parameters:
    //   path     - The path to query. It MUST end with a forward slash.
    //
    // Returns:
    //   A promise for an Array of keys, representing child nodes.
    //   Those keys ending in a forward slash, represent *directory nodes*, all
    //   other keys represent *data nodes*.
    //
    // Example:
    //   (start code)
    //   client.getListing('').then(function(listing) {
    //     listing.forEach(function(item) {
    //       console.log('- ' + item);
    //     });
    //   });
    //   (end code)
    //
    getListing: function(path) {
      if(! (util.isDir(path) || path === '')) {
        return util.getPromise().failLater(
          new Error("Not a directory: " + path)
        );
      }
      return this.ensureAccess('r').
        then(util.curry(store.getNode, this.makePath(path))).
        get('data').then(function(listing) {
          return listing ? Object.keys(listing) : [];
        });
    },

    //
    // Method: getAll
    //
    // Get all objects directly below a given path.
    //
    // Parameters:
    //   path      - path to the direcotry
    //   typeAlias - (optional) local type-alias to filter for
    //
    // Returns:
    //   a promise for an object in the form { path : object, ... }
    //
    // Example:
    //   (start code)
    //   client.getAll('').then(function(objects) {
    //     for(var key in objects) {
    //       console.log('- ' + key + ': ', objects[key]);
    //     }
    //   });
    //   (end code)
    //
    getAll: function(path, typeAlias) {

      function filterByType(objectMap) {
        if(typeAlias) {
          var type = this.resolveTypeAlias(typeAlias);
          for(var key in objectMap) {
            if(objectMap[key]['@type'] !== type) {
              delete objectMap[key];
            }
          }
        } else {
          return objectMap;
        }
      }

      function retrieveObjects(listing) {
        var promise = util.getPromise();

        var objectMap = {};

        var _this = this;

        function retrieveOne() {
          var key = listing.shift();
          if(key) {
            var itemPath = path + key;
            _this.getObject(itemPath).
              then(function(object) {
                objectMap[itemPath] = object;
                retrieveOne();
              }, promise.fail.bind(promise));
          } else {
            promise.fulfill(objectMap);
          }
        }

        retrieveOne();

        return promise;
      }

      return this.getListing(path).
        then(retrieveObjects.bind(this)).
        then(filterByType.bind(this));
    },

    //
    // Method: getFile
    //
    // Get the file at the given path. A file is raw data, as opposed to
    // a JSON object (use <getObject> for that).
    //
    // Except for the return value structure, getFile works exactly like
    // getObject.
    //
    // Parameters:
    //   path     - see getObject
    //
    // Returns:
    //   A promise for an object:
    //
    //   mimeType - String representing the MIME Type of the document.
    //   data     - Raw data of the document (either a string or an ArrayBuffer)
    //
    // Example:
    //   (start code)
    //   // Display an image:
    //   client.getFile('path/to/some/image').then(function(file) {
    //     var blob = new Blob([file.data], { type: file.mimeType });
    //     var targetElement = document.findElementById('my-image-element');
    //     targetElement.src = window.URL.createObjectURL(blob);
    //   });
    //   (end code)
    getFile: function(path) {
      return this.ensureAccess('r').
        then(util.curry(store.getNode, this.makePath(path))).
        then(function(node) {
          return {
            mimeType: node.mimeType,
            data: node.data
          };
        });
    },

    // Method: getDocument
    //
    // DEPRECATED in favor of <getFile>
    getDocument: function() {
      util.deprecate('getDocument', 'getFile');
      return this.getFile.apply(this, arguments);
    },

    //
    // Method: remove
    //
    // Remove node at given path from storage. Triggers synchronization.
    //
    // Parameters:
    //   path     - Path relative to the module root.
    //
    remove: function(path) {
      var absPath = this.makePath(path);
      return this.ensureAccess('w').
        then(util.curry(set, this.moduleName, path, absPath, undefined)).
        then(util.curry(sync.partialSync, util.containingDir(absPath), 1));
    },

    // Method: saveObject
    //
    // Save a typed JSON object.
    // This only works for objects with a @type attribute corresponding to a schema
    // that has been declared via <declareType> and a ID attribute declared within
    // that schema.
    //
    // For details on using saveObject and typed JSON objects,
    // see <Working with schemas>.
    //
    // Parameters:
    //   object - a typed JSON object
    //
    //
    saveObject: function(object) {
      var type = object['@type'];
      var alias = this.resolveTypeAlias(type);
      var idKey = this.resolveIdKey(type);
      if(! idKey) {
        return failedPromise("Invalid typed JSON object! ID attribute could not be resolved.");
      }
      if(! object[idKey]) {
        object[idKey] = this.uuid();
      }
      return this.storeObject(alias, object[idKey], object);
    },

    //
    // Method: storeObject
    //
    // Store object at given path. Triggers synchronization.
    //
    // Parameters:
    //
    //   type     - unique type of this object within this module. See description below.
    //   path     - path relative to the module root.
    //   object   - an object to be saved to the given node. It must be serializable as JSON.
    //
    // Returns:
    //   A promise to store the object. The promise fails with a ValidationError, when validations fail.
    //
    //
    // What about the type?:
    //
    //   A great thing about having data on the web, is to be able to link to
    //   it and rearrange it to fit the current circumstances. To facilitate
    //   that, eventually you need to know how the data at hand is structured.
    //   For documents on the web, this is usually done via a MIME type. The
    //   MIME type of JSON objects however, is always application/json.
    //   To add that extra layer of "knowing what this object is", remotestorage
    //   aims to use <JSON-LD at http://json-ld.org/>.
    //   A first step in that direction, is to add a *@type attribute* to all
    //   JSON data put into remotestorage.
    //   Now that is what the *type* is for.
    //
    //   Within remoteStorage.js, @type values are built using three components:
    //     https://remotestoragejs.com/spec/modules/ - A prefix to guarantee unqiueness
    //     the module name     - module names should be unique as well
    //     the type given here - naming this particular kind of object within this module
    //
    //   In retrospect that means, that whenever you introduce a new "type" in calls to
    //   storeObject, you should make sure that once your code is in the wild, future
    //   versions of the code are compatible with the same JSON structure.
    //
    // How to define types?:
    //
    //   See <declareType> or the calendar module (src/modules/calendar.js) for examples.
    //
    storeObject: function(typeAlias, path, obj) {
      if(typeof(path) !== 'string') {
        return failedPromise(new Error("given path must be a string (got: " + typeof(path) + ")"));
      }
      if(typeof(obj) !== 'object') {
        return failedPromise(new Error("given object must be an object (got: " + typeof(obj) + ")"));
      }
      if(util.isDir(path)) {
        return failedPromise(new Error("Can't store directory node"));
      }

      var absPath = this.makePath(path);

      return this.ensureAccess('w').
        then(function() {
          obj['@type'] = this.resolveType(typeAlias);
          var errors = this.validateObject(obj);
          if(errors) {
            throw new ValidationError(obj, errors);
          }
          return set(this.moduleName, path, absPath, obj, 'application/json')
        }.bind(this)).
        then(util.curry(sync.partialSync, util.containingDir(absPath), 1));
    },

    //
    // Method: storeFile
    //
    // Store raw data at a given path. Triggers synchronization.
    //
    // Parameters:
    //   mimeType - MIME media type of the data being stored
    //   path     - path relative to the module root. MAY NOT end in a forward slash.
    //   data     - string or ArrayBuffer of raw data to store
    //
    // The given mimeType will later be returned, when retrieving the data
    // using <getFile>.
    //
    // Example (UTF-8 data):
    //   (start code)
    //   client.storeFile('text/html', 'index.html', '<h1>Hello World!</h1>');
    //   (end code)
    //
    // Example (Binary data):
    //   (start code)
    //   // MARKUP:
    //   <input type="file" id="file-input">
    //   // CODE:
    //   var input = document.getElementById('file-input');
    //   var file = input.files[0];
    //   var fileReader = new FileReader();
    //
    //   fileReader.onload = function() {
    //     client.storeFile(file.type, file.name, fileReader.result);
    //   };
    //
    //   fileReader.readAsArrayBuffer(file);
    //   (end code)
    //
    storeFile: function(mimeType, path, data) {
      if(util.isDir(path)) {
        return failedPromise(new Error("Can't store directory node"));
      }
      if(typeof(data) !== 'string' && !(data instanceof ArrayBuffer)) {
        return failedPromise(new Error("storeFile received " + typeof(data) + ", but expected a string or an ArrayBuffer!"));
      }
      var absPath = this.makePath(path);
      return this.ensureAccess('w').
        then(util.curry(set, this.moduleName, path, absPath, data, mimeType)).
        then(util.curry(sync.partialSync, util.containingDir(absPath), 1));
    },

    // Method: storeDocument
    //
    // DEPRECATED in favor of <storeFile>
    storeDocument: function() {
      util.deprecate('storeDocument', 'storeFile');
      return this.storeFile.apply(this, arguments);
    },

    getStorageHref: function() {
      return wireClient.getStorageHref();
    },

    //
    // Method: getItemURL
    //
    // Get the full URL of the item at given path. This will only
    // work, if the user is connected to a remotestorage account.
    //
    // Parameter:
    //   path - path relative to the module root
    //
    // Returns:
    //   a String - when currently connected
    //   null - when currently disconnected
    getItemURL: function(path) {
      var base = this.getStorageHref();
      if(! base) {
        return null;
      }
      return base + this.makePath(path);
    },

    syncOnce: function(path, callback) {
      var previousTreeForce = store.getNode(path).startForceTree;
      this.use(path, false);
      return sync.partialSync(path, 1).
        then(function() {
          if(previousTreeForce) {
            this.use(path, true);
          } else {
            this.release(path);
          }
          if(callback) {
            callback();
          }
        }.bind(this));

    },

    //
    // Method: use
    //
    // Set force flags on given path.
    //
    // See <sync> for details.
    //
    // Parameters:
    //   path      - path relative to the module root
    //   treeOnly  - boolean value, whether only the tree should be synced.
    //
    use: function(path, treeOnly) {
      var absPath = this.makePath(path);
      return store.setNodeForce(absPath, !treeOnly, true);
    },

    // Method: release
    //
    // Remove force flags from given node.
    //
    // See <sync> for details.
    //
    release: function(path) {
      var absPath = this.makePath(path);
      return store.setNodeForce(absPath, false, false);
    },

    // Method: hasDiff
    //
    // Yields true if the node at the given path has a diff set.
    // Having a "diff" means, that the node or one of it's descendants
    // has been updated since it was last pulled from remotestorage.
    hasDiff: function(path) {
      var absPath = this.makePath(path);
      var item = null;
      if(! util.isDir(absPath)) {
        item = util.baseName(absPath);
        absPath = util.containingDir(absPath);
      }
      return store.getNode(absPath).get('diff').
        then(function(diff) {
          if(item) {
            return !! diff[item];
          } else {
            return Object.keys(diff).length > 0;
          }
        });
    },

    /**** TYPE HANDLING ****/

    types: {},
    typeAliases: {},
    schemas: {},
    typeIdKeys: {},

    resolveType: function(alias) {
      var type = this.types[alias];
      if(! type) {
        // FIXME: support custom namespace. don't fall back to remotestoragejs.com.
        type = 'https://remotestoragejs.com/spec/modules/' + this.moduleName + '/' + alias;
        logger.error("WARNING: type alias not declared: " + alias, '(have:', this.types, this.schemas, ')');
      }
      return type;
    },

    resolveTypeAlias: function(type) {
      return this.typeAliases[type];
    },

    resolveSchema: function(type) {
      var schema = this.schemas[type];
      if(! schema) {
        schema = {};
        logger.error("WARNING: can't find schema for type: ", type);
      }
      return schema;
    },

    resolveIdKey: function(type) {
      return this.typeIdKeys[type];
    },

    // Method: buildObject
    //
    // Build an object of the designated type.
    //
    // Parameters:
    //   alias - a type alias, registered via <declareType>
    //
    // If the associated schema specifies a top-level attribute with "format":"id",
    // and the given attributes don't contain that key, a UUID is generated for
    // that column.
    //
    // Example:
    //   (start code)
    //   var drink = client.buildObject('drink');
    //   client.validateObject(drink); // validates against schema declared for "drink"
    //   (end code)
    //
    buildObject: function(alias, attributes) {
      var object = {};
      var type = this.resolveType(alias);
      var idKey = this.resolveIdKey(type);
      if(! attributes) {
        attributes = {};
      }

      object['@type'] = type;
      if(idKey && ! attributes[idKey]) {
        object[idKey] = this.uuid();
      }
      return util.extend(object, attributes || {});
    },

    // Method: declareType
    //
    // Declare a type and assign it a schema.
    // Once a type has a schema set, all data that is stored with that type will be validated before saving it.
    //
    // Parameters:
    //   alias  - an alias to refer to the type. Must be unique within one scope / module.
    //   type   - (optional) full type-identifier to identify the type. used as @type attribute.
    //   schema - an object containing the schema for this new type.
    //
    // if "type" is ommitted, it will be generated based on the module name.
    //
    // Example:
    //   (start code)
    //   client.declareType('drink', {
    //     "description": "A representation of a drink",
    //     "type": "object",
    //     "properties": {
    //       "name": {
    //         "type": "string",
    //         "description": "Human readable name of the drink",
    //         "required": true
    //       }
    //     }
    //   });
    //
    //   client.storeObject('drink', 'foo', {}).
    //     then(function() {
    //       // object saved
    //     }, function(error) {
    //       // error.errors holds validation errors:
    //       // [{ "property": "name",
    //       //    "message": "is missing and it is required" }]
    //       //
    //       // error.object holds a copy of the object
    //     });
    //   (end code)
    //
    declareType: function(alias, type, schema) {
      if(this.types[alias]) {
        logger.error("WARNING: re-declaring already declared alias " + alias);
      }
      if(! schema) {
        schema = type;
        type = 'https://remotestoragejs.com/spec/modules/' + this.moduleName + '/' + alias;
      }
      if(schema['extends']) {
        var extendedType = this.types[ schema['extends'] ];
        if(! extendedType) {
          logger.error("Type '" + alias + "' tries to extend unknown schema '" + schema['extends'] + "'");
          return;
        }
        schema['extends'] = this.schemas[extendedType];
      }

      if(schema.properties) {
        for(var key in schema.properties) {
          if(schema.properties[key].format == 'id') {
            this.typeIdKeys[type] = key;
            break;
          }
        }
      }

      this.types[alias] = type;
      this.typeAliases[type] = alias;
      this.schemas[type] = schema;
    },

    // Method: validateObject
    //
    // Validate an object with it's schema.
    //
    // Parameters:
    //   object - the object to validate
    //   alias  - (optional) the type-alias to use, in case the object doesn't have a @type attribute.
    //
    // Returns:
    //   null   - when the object is valid
    //   array of errors - when validation fails.
    //
    // The errors are objects of the form:
    // (start code)
    // { "property": "foo", "message": "is named badly" }
    // (end code)
    //
    validateObject: function(object, alias) {
      var type = object['@type'];
      if(! type) {
        if(alias) {
          type = this.resolveType(alias);
        } else {
          return [{"property":"@type","message":"missing"}];
        }
      }
      var schema = this.resolveSchema(type);
      var result = validate(object, schema);

      return result.valid ? null : result.errors;
    },

    // Method: uuid
    //
    // Generates a Universally Unique IDentifuer and returns it.
    //
    // The UUID is prefixed with the string 'uuid:', to become a valid URI.
    uuid: function() {
      return 'uuid:' + MathUUID.uuid();
    }

  };

  util.extend(BaseClient, globalEvents);

  return BaseClient;

});

/** THIS FILE WAS GENERATED BY build/compile-assets.js. DO NOT CHANGE IT MANUALLY, BUT INSTEAD CHANGE THE ASSETS IN assets/. **/
define('lib/assets',[], function() {
  return {
    remotestorageIcon: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhLS0gQ3JlYXRlZCB3aXRoIElua3NjYXBlIChodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy8pIC0tPgoKPHN2ZwogICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgIHhtbG5zOmNjPSJodHRwOi8vY3JlYXRpdmVjb21tb25zLm9yZy9ucyMiCiAgIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyIKICAgeG1sbnM6c3ZnPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogICB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIKICAgeG1sbnM6c29kaXBvZGk9Imh0dHA6Ly9zb2RpcG9kaS5zb3VyY2Vmb3JnZS5uZXQvRFREL3NvZGlwb2RpLTAuZHRkIgogICB4bWxuczppbmtzY2FwZT0iaHR0cDovL3d3dy5pbmtzY2FwZS5vcmcvbmFtZXNwYWNlcy9pbmtzY2FwZSIKICAgd2lkdGg9IjMyIgogICBoZWlnaHQ9IjMyIgogICBpZD0ic3ZnMiIKICAgdmVyc2lvbj0iMS4xIgogICBpbmtzY2FwZTp2ZXJzaW9uPSIwLjQ4LjIgcjk4MTkiCiAgIHNvZGlwb2RpOmRvY25hbWU9InJlbW90ZVN0b3JhZ2UtaWNvbi5zdmciCiAgIGlua3NjYXBlOmV4cG9ydC1maWxlbmFtZT0iL2hvbWUvdXNlci93ZWJzaXRlL2ltZy9yZW1vdGVTdG9yYWdlLWljb24ucG5nIgogICBpbmtzY2FwZTpleHBvcnQteGRwaT0iOTAiCiAgIGlua3NjYXBlOmV4cG9ydC15ZHBpPSI5MCI+CiAgPGRlZnMKICAgICBpZD0iZGVmczQiPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDMzIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2UyMjFiNztzdG9wLW9wYWNpdHk6MC43NDYxNTM4MzsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDM1IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZTIyMWI3O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDQwMzciIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTc1Ij4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0NTc3IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMwMDAwMDA7c3RvcC1vcGFjaXR5OjAuNzM4NDYxNTU7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzkiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzAwMDAwMDtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDQwODgiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDQ0Ij4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmOTEwMDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojYzQ2ZjAwO3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzciIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGlua3NjYXBlOnBlcnNwZWN0aXZlCiAgICAgICBzb2RpcG9kaTp0eXBlPSJpbmtzY2FwZTpwZXJzcDNkIgogICAgICAgaW5rc2NhcGU6dnBfeD0iMCA6IDUyNi4xODEwOSA6IDEiCiAgICAgICBpbmtzY2FwZTp2cF95PSIwIDogMTAwMCA6IDAiCiAgICAgICBpbmtzY2FwZTp2cF96PSI3NDQuMDk0NDggOiA1MjYuMTgxMDkgOiAxIgogICAgICAgaW5rc2NhcGU6cGVyc3AzZC1vcmlnaW49IjM3Mi4wNDcyNCA6IDM1MC43ODczOSA6IDEiCiAgICAgICBpZD0icGVyc3BlY3RpdmUyOTg1IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY5MTAwO3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2M0NmYwMDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTciIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICB5Mj0iMCIKICAgICAgIHgyPSIxMjgiCiAgICAgICB5MT0iMTI4IgogICAgICAgeDE9IjEyOCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50Mzg5MCIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMSIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODM5LTAtMiIKICAgICAgIHgxPSIxMjgiCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEyOCIKICAgICAgIHkyPSIwIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC43NjE1Mzg0NTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOCIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS03IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzOS0wLTgiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjExMiIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMzIiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDMyLDc5Ni4zNjIxOCkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS03Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmOTEwMDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctMyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2M0NmYwMDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMiIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTIiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODM5LTAtMyIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwzMiw3OTYuMzYyMTgpIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC0yIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmOTMwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC0xIiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY5MzA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTAiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LC0wLjU5NTM5MjQ3LDAuODY2MDI1NCwtMC41LDY1LjE0ODc0OCwxMDcxLjUwMDYpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDI1LTUiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTMiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMyI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0Ni00IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMwNDhiZmY7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtNyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMDQ4YmZmO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODM5LTAtODkiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMzIsNzk2LjM2MjE4KSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtNSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtMiIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC0yIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC05Ij4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTMiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC04IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA4NC03Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTYiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC01IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQxNTkiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuNjg3NSwwLDAsLTEsMjI0LDEwMjAuMzYyMikiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC05IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE2MSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LDAuNTk1MzkyNDcsLTAuODY2MDI1NCwwLjUsMTkwLjg1MTI1LDc0NS4yMjM3NikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQxNjMiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsMC41OTUzOTI0NywwLjg2NjAyNTQsMC41LDY1LjE0ODc1LDc0NS4yMjM3NikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE3MCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMzIsNzk2LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE3MiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSw2NS4xNDg3NDgsMTA3MS41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQxNzQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMTkwLjg1MTI1LDEwNzEuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTUiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMiI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0Ni03IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtNCIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQxNzQtMiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwxOTAuODUxMjUsMTA3MS41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA4NC02Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTAiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC05IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1My05IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwxNzYsODI4LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTUtMiIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03LTQiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItOSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTUtNyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSwyMDkuMTQ4NzUsMTEwMy41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC0yLTkiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtNy03IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtNC01IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC02LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjU3LTQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQtNi01Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTAtOSIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3A0MDg4LTktMyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIHkyPSItMC45OTQ4NTY0MiIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzMTciCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNSIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzNTgiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDE3Niw4MjguMzYyMTgpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzNjAiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMjA5LjE0ODc1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzNjIiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzNTgtNyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMTc2LDgyOC4zNjIxOCkiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtNC02Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC01LTkiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNy0wIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTgiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MzYwLTQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMjA5LjE0ODc1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMi04Ij4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTctMyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ4LTQtNiIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi02IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDM2Mi00IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDMzNC44NTEyNSwxMTAzLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0LTYtNiI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDA4Ni0wLTAiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC05LTgiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTMtOS02IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwxNzYsODI4LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNS0yLTciIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNy00LTMiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItOS0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1NS03LTEiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMjA5LjE0ODc1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMi05LTMiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtNy03LTUiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC00LTUtMyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIHkyPSItMC45OTQ4NTY0MiIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzMTctOCIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi01LTUiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQtNi01LTUiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDQwODYtMC05LTYiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC05LTMtMyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIHkyPSItMC45OTQ4NTY0MiIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ0MzQiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNS01IgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1MDgiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsNzAyLjg1MTI1LDEwNzEuNTAwNSkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMi04IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUxMSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSw1NzcuMTQ4NzUsMTA3MS41MDA1KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC02IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUxNCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsNTQ0LC02ZS01KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTYiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTE3IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSw1ODQsNzk2LjM2MjEyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNS01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUyMCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwwLjU5NTM5MjQ3LDAuODY2MDI1NCwwLjUsNTc3LjE0ODc1LDc3Ny4yMjM4KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTktMyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1MjMiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwwLjU5NTM5MjQ3LC0wLjg2NjAyNTQsMC41LDcwMi44NTEyNSw3NzcuMjIzOCkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUyNiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC42ODc1LDAsMCwtMSw3MzYsMjU2LjAwMDAyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1MjkiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuNjg3NSwwLDAsLTEsNzc2LDEwNTIuMzYyMikiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC02IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUzMiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsNTY0LDc5Ni4zNjIxMikiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTkiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTM0IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjY4NzUsMCwwLC0xLDc1NiwyNTYuMDAwMDIpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05IgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUzOSIKICAgICAgIGN4PSI2NjAiCiAgICAgICBjeT0iMTI4IgogICAgICAgZng9IjY2MCIKICAgICAgIGZ5PSIxMjgiCiAgICAgICByPSIxMTIiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEsMCwwLDEuMTQyODU3MSw2MCw3MTAuMDc2NTIpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05LTgiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTM5LTciCiAgICAgICBjeD0iNjYwIgogICAgICAgY3k9IjEyOCIKICAgICAgIGZ4PSI2NjAiCiAgICAgICBmeT0iMTI4IgogICAgICAgcj0iMTEyIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwxLjE0Mjg1NzEsLTIwLDc3OC4wNzY0NykiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTktOCI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNS0yLTctOSIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03LTQtMy04IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgcj0iMTEyIgogICAgICAgZnk9IjEyOCIKICAgICAgIGZ4PSI2NjAiCiAgICAgICBjeT0iMTI4IgogICAgICAgY3g9IjY2MCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsMS4xNDI4NTcxLDE2LDMzMC4wNzY1MikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1NTYiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0NTc1IgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOS0xIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUzOS0wIgogICAgICAgY3g9IjY2MCIKICAgICAgIGN5PSIxMjgiCiAgICAgICBmeD0iNjYwIgogICAgICAgZnk9IjEyOCIKICAgICAgIHI9IjExMiIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsMS4xNDI4NTcxLC0yMCw3NzguMDc2NDcpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05LTEiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTUtMi03LTYiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNy00LTMtMCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIHI9IjExMiIKICAgICAgIGZ5PSIxMjgiCiAgICAgICBmeD0iNjYwIgogICAgICAgY3k9IjEyOCIKICAgICAgIGN4PSI2NjAiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMTI0OTk5OTksMCwwLDAuMTQyODU3MTMsNzk3LjUsNjc4LjA3NjUyKSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDU1Ni0zIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDU3NS0yIgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTc1LTIiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzctNiIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojODE4MTgxO3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0NTc5LTQiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzcwNzA3MDtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICByPSIxMTIiCiAgICAgICBmeT0iMTI4IgogICAgICAgZng9IjY2MCIKICAgICAgIGN5PSIxMjgiCiAgICAgICBjeD0iNjYwIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjEyNDk5OTk5LDAsMCwwLjE0Mjg1NzEzLDczMy41MDAwMSw2NzguMDc2NTIpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NjAxIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTktMSIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgcj0iMTEyIgogICAgICAgZnk9IjEyOCIKICAgICAgIGZ4PSI2NjAiCiAgICAgICBjeT0iMTI4IgogICAgICAgY3g9IjY2MCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsMS4xNDI4NTcxLDIzNiw3NzguMDc2NDcpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTU2LTUiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0NTc1LTMiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1NzUtMyI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDU3Ny05IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM4MTgxODE7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzktOCIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzA3MDcwO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIHI9IjExMiIKICAgICAgIGZ5PSIxMjgiCiAgICAgICBmeD0iNjYwIgogICAgICAgY3k9IjEyOCIKICAgICAgIGN4PSI2NjAiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMTI0OTk5OTksMCwwLDAuMTQyODU3MTMsODI5LjUwMDAxLDY3OC4wNzY1MikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ2NDUiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0NTc1LTMiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIHI9IjExMiIKICAgICAgIGZ5PSIxMjgiCiAgICAgICBmeD0iNjYwIgogICAgICAgY3k9IjEyOCIKICAgICAgIGN4PSI2NjAiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEsMCwwLDEuMTQyODU3MSwyMzYsNzc4LjA3NjQ3KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDU1Ni04IgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDU3NS0xIgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTc1LTEiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzctMiIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMDAwMDAwO3N0b3Atb3BhY2l0eTowLjczODQ2MTU1OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0NTc5LTIiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzAwMDAwMDtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwMTciCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDMyLDc5Ni4zNjIxOCkiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwMTkiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsNjUuMTQ4NzQ4LDEwNzEuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDIxIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDE5MC44NTEyNSwxMDcxLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTU5IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDM1OC0zIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwxNzYsODI4LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC00LTU5Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC01LTYiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNy01IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MzYwLTYiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMjA5LjE0ODc1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMi0zIj4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTctMCIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ4LTQtMiIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi03IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDM2Mi0wIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDMzNC44NTEyNSwxMTAzLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0LTYtNyI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDA4Ni0wLTQiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC05LTciIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtMCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTMtOS0zIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwxNzYsODI4LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtMCI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNS0yLTEiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNy00LTYiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItOS01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1NS03LTciCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMjA5LjE0ODc1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMi05LTUiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtNy03LTciCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC00LTUtOCIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIHkyPSItMC45OTQ4NTY0MiIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzMTctODkiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNS0wIgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0LTYtNS0wIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTAtOS03IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDQwODgtOS0zLTgiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC0zIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC43NDUwOTgwNTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC0xMCIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC0zIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC03Ij4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTMyIgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuNzQ1MDk4MDU7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtMiIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQtNSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjAuNzQ1MDk4MDU7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDA4Ni0zIiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDQwODgtMyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTUtMiI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM1OTA0ZmY7c3RvcC1vcGFjaXR5OjAuNzQ1MDk4MDU7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtMi04IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNTkwNGZmO3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTItNSIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtOS0wIj4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTMtOCIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ4LTgtNiIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNy0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE2My05IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LDAuNTk1MzkyNDcsMC44NjYwMjU0LDAuNSw2NS4xNDg3NSw3NDUuMjIzNzYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0LTctMyI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNkMmRkMjY7c3RvcC1vcGFjaXR5OjAuNzQ1MDk4MDU7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDA4Ni02LTMiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNkMmRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC01LTciIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyMzUiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsNTI2Ljg1MTI1LDEyOTEuNTAwNykiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMi0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDIzOCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSw0MDEuMTQ4NzUsMTI5MS41MDA3KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01OSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNDEiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDM1Miw0MDMuOTk5OTkpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNTkiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjQ0IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSw0NjgsMTAxNi4zNjIyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNS0wIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI0NyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwwLjU5NTM5MjQ3LDAuODY2MDI1NCwwLjUsNDAxLjE0ODc1LDk5Ny4yMjM5KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTktNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTAiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwwLjU5NTM5MjQ3LC0wLjg2NjAyNTQsMC41LDUyNi44NTEyNSw5OTcuMjIzOSkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS0wIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1MyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC42ODc1LDAsMCwtMSw1NDQsNjYwLjAwMDA5KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTciCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsMC41OTUzOTI0NywwLjg2NjAyNTQsMC41LDQwMS4xNDg3NSw3MDkuMjIzOSkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMi05IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI2MCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LDAuNTk1MzkyNDcsLTAuODY2MDI1NCwwLjUsNTI2Ljg1MTI1LDcwOS4yMjM5KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI2MyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC42ODc1LDAsMCwtMSw1NjAsOTg0LjM2MjMyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC01MiIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQzODctNyIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEuMTY2NjY2OSwwLDAsMS4zNDcyNTAxLC0yNDQuOTUzMzksODYuNTA1MDM1KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC01MiI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuNzYxNTM4NDU7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC00IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtMzMiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjc2MTUzODQ1OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTQiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNiIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00IgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUyMCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLjE2NjY2NjksMCwwLDEuMzQ3MjUwMSwtMjQ0Ljk1MzM5LDg2LjUwNTAzNSkiCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgcj0iOTUuOTk5OTc3IiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC0zMyIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1MjIiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMS4xNjY2NjY5LDAsMCwxLjM0NzI1MDEsMTM5LjA0NjYsLTM2MC4xNDk5NykiCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgcj0iOTUuOTk5OTc3IiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC01MiIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1MjQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4xNDQzMjY3MywwLDAsMC4xNjY2NjY0Miw5MDcuMTAyMjMsODk3LjEyNjU2KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTMzIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUzMiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLjE2NjY2NjksMCwwLDEuMzQ3MjUwMSwxMzkuMDQ2NiwtMzYwLjE0OTk3KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNy0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzI1NyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwwLjU5NTM5MjQ3LDAuODY2MDI1NCwwLjUsMTQ1LjE0ODc1LDk5Ny4yMjM4MSkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwMzMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzMjYwIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsMC41OTUzOTI0NywtMC44NjYwMjU0LDAuNSwyNzAuODUxMjUsOTk3LjIyMzgxKSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNS0yIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzI2MyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC42ODc1LDAsMCwtMSwzMDQsMTI3Mi4zNjIzKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA1OCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsLTEwOCwxMDE2LjM2MjIpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtNyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNjAiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsLTc0Ljg1MTI1MiwxMjkxLjUwMDcpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDYyIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDUwLjg1MTI1LDEyOTEuNTAwNykiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNjUiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMjcwLjg1MTI1LDEyOTEuNTAwNykiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtNyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNjgiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMTQ1LjE0ODc1LDEyOTEuNTAwNykiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDcxIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwxMTIsMTAxNi4zNjIyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC0yMCIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1MjAtNCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLjE2NjY2NjksMCwwLDEuMzQ3MjUwMSwtMjQ0Ljk1MzM5LDg2LjUwNTAzNSkiCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgcj0iOTUuOTk5OTc3IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC0yMCI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuNzYxNTM4NDU7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtOSIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03NyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIHI9Ijk1Ljk5OTk3NyIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICBmeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEuMTY2NjY2OSwwLDAsMS4zNDcyNTAxLC0yNDQuOTUzMzksODYuNTA1MDM1KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDIwOCIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTIwIgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNCIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDM2MTQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMS4xNjY2NjY5LDAsMCwxLjM0NzI1MDEsMjE5LjA0NjYxLDg5LjE2Nzc1NykiCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgcj0iOTUuOTk5OTc3IiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNCIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDM2MjUiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMS4xNjY2NjY5LDAsMCwxLjM0NzI1MDEsMjE5LjA0NjYxLDg5LjE2Nzc1NykiCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgcj0iOTUuOTk5OTc3IiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNCIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDMyMDkiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4xNDQzMjY5OSwwLDAsMC4xNjY2NjY3MywxMjAxLjUzNTgsODc3LjExNDg4KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgPC9kZWZzPgogIDxzb2RpcG9kaTpuYW1lZHZpZXcKICAgICBpZD0iYmFzZSIKICAgICBwYWdlY29sb3I9IiNmZmZmZmYiCiAgICAgYm9yZGVyY29sb3I9IiM2NjY2NjYiCiAgICAgYm9yZGVyb3BhY2l0eT0iMS4wIgogICAgIGlua3NjYXBlOnBhZ2VvcGFjaXR5PSIwLjAiCiAgICAgaW5rc2NhcGU6cGFnZXNoYWRvdz0iMiIKICAgICBpbmtzY2FwZTp6b29tPSIxNiIKICAgICBpbmtzY2FwZTpjeD0iMTYuMzA2MTY1IgogICAgIGlua3NjYXBlOmN5PSIxNi4yMzcyMjUiCiAgICAgaW5rc2NhcGU6ZG9jdW1lbnQtdW5pdHM9InB4IgogICAgIGlua3NjYXBlOmN1cnJlbnQtbGF5ZXI9ImxheWVyMSIKICAgICBzaG93Z3JpZD0idHJ1ZSIKICAgICBpbmtzY2FwZTp3aW5kb3ctd2lkdGg9IjEyODAiCiAgICAgaW5rc2NhcGU6d2luZG93LWhlaWdodD0iNzk5IgogICAgIGlua3NjYXBlOndpbmRvdy14PSIwIgogICAgIGlua3NjYXBlOndpbmRvdy15PSIxIgogICAgIGlua3NjYXBlOndpbmRvdy1tYXhpbWl6ZWQ9IjEiCiAgICAgZml0LW1hcmdpbi10b3A9IjAiCiAgICAgZml0LW1hcmdpbi1sZWZ0PSIwIgogICAgIGZpdC1tYXJnaW4tcmlnaHQ9IjAiCiAgICAgZml0LW1hcmdpbi1ib3R0b209IjAiCiAgICAgaW5rc2NhcGU6c25hcC1wYWdlPSJ0cnVlIgogICAgIGlua3NjYXBlOnNuYXAtbm9kZXM9InRydWUiCiAgICAgZ3JpZHRvbGVyYW5jZT0iMTAiCiAgICAgc2hvd2JvcmRlcj0idHJ1ZSIKICAgICBzaG93Z3VpZGVzPSJ0cnVlIgogICAgIGlua3NjYXBlOmd1aWRlLWJib3g9InRydWUiPgogICAgPGlua3NjYXBlOmdyaWQKICAgICAgIHR5cGU9Inh5Z3JpZCIKICAgICAgIGlkPSJncmlkMzAyMSIKICAgICAgIGVtcHNwYWNpbmc9IjQiCiAgICAgICB2aXNpYmxlPSJ0cnVlIgogICAgICAgZW5hYmxlZD0idHJ1ZSIKICAgICAgIHNuYXB2aXNpYmxlZ3JpZGxpbmVzb25seT0idHJ1ZSIKICAgICAgIHNwYWNpbmd4PSIxNnB4IgogICAgICAgc3BhY2luZ3k9IjE2cHgiCiAgICAgICBkb3R0ZWQ9InRydWUiIC8+CiAgPC9zb2RpcG9kaTpuYW1lZHZpZXc+CiAgPG1ldGFkYXRhCiAgICAgaWQ9Im1ldGFkYXRhNyI+CiAgICA8cmRmOlJERj4KICAgICAgPGNjOldvcmsKICAgICAgICAgcmRmOmFib3V0PSIiPgogICAgICAgIDxkYzpmb3JtYXQ+aW1hZ2Uvc3ZnK3htbDwvZGM6Zm9ybWF0PgogICAgICAgIDxkYzp0eXBlCiAgICAgICAgICAgcmRmOnJlc291cmNlPSJodHRwOi8vcHVybC5vcmcvZGMvZGNtaXR5cGUvU3RpbGxJbWFnZSIgLz4KICAgICAgICA8ZGM6dGl0bGU+PC9kYzp0aXRsZT4KICAgICAgPC9jYzpXb3JrPgogICAgPC9yZGY6UkRGPgogIDwvbWV0YWRhdGE+CiAgPGcKICAgICBpbmtzY2FwZTpsYWJlbD0iTGF5ZXIgMSIKICAgICBpbmtzY2FwZTpncm91cG1vZGU9ImxheWVyIgogICAgIGlkPSJsYXllcjEiCiAgICAgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTEzMzYuNTc4NSwtOTU2LjM1MTg5KSI+CiAgICA8cGF0aAogICAgICAgc3R5bGU9ImNvbG9yOiMwMDAwMDA7ZmlsbDp1cmwoI3JhZGlhbEdyYWRpZW50MzIwOSk7ZmlsbC1vcGFjaXR5OjE7ZmlsbC1ydWxlOm5vbnplcm87c3Ryb2tlOm5vbmU7bWFya2VyOm5vbmU7dmlzaWJpbGl0eTp2aXNpYmxlO2Rpc3BsYXk6aW5saW5lO292ZXJmbG93OnZpc2libGU7ZW5hYmxlLWJhY2tncm91bmQ6YWNjdW11bGF0ZSIKICAgICAgIGQ9Im0gMTM1Mi41Nzg1LDk1Ni4zNTE4OSAwLjI4ODYsMTUuMTM2MjkgMTMuNTY2OCwtNy4xMzUxNiAtMTMuODU1NCwtOC4wMDExMyB6IG0gMCwwIC0xMy44NTU0LDguMDAxMTMgMTMuNTY2Nyw3LjEzNTE2IDAuMjg4NywtMTUuMTM2MjkgeiBtIC0xMy44NTU0LDguMDAxMTMgMCwxNS45OTc3NCAxMi45NTc5LC03LjgxNjIxIC0xMi45NTc5LC04LjE4MTUzIHogbSAwLDE1Ljk5Nzc0IDEzLjg1NTQsOC4wMDExMyAtMC42MDg5LC0xNS4zMTY3IC0xMy4yNDY1LDcuMzE1NTcgeiBtIDEzLjg1NTQsOC4wMDExMyAxMy44NTU0LC04LjAwMTEzIC0xMy4yNTEsLTcuMzE1NTcgLTAuNjA0NCwxNS4zMTY3IHogbSAxMy44NTU0LC04LjAwMTEzIDAsLTE1Ljk5Nzc0IC0xMi45NjI0LDguMTgxNTMgMTIuOTYyNCw3LjgxNjIxIHoiCiAgICAgICBpZD0icGF0aDQwMTYtMy04LTYiCiAgICAgICBpbmtzY2FwZTpjb25uZWN0b3ItY3VydmF0dXJlPSIwIiAvPgogIDwvZz4KPC9zdmc+Cg==',
    remotestorageIconError: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhLS0gQ3JlYXRlZCB3aXRoIElua3NjYXBlIChodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy8pIC0tPgoKPHN2ZwogICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgIHhtbG5zOmNjPSJodHRwOi8vY3JlYXRpdmVjb21tb25zLm9yZy9ucyMiCiAgIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyIKICAgeG1sbnM6c3ZnPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogICB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIKICAgeG1sbnM6c29kaXBvZGk9Imh0dHA6Ly9zb2RpcG9kaS5zb3VyY2Vmb3JnZS5uZXQvRFREL3NvZGlwb2RpLTAuZHRkIgogICB4bWxuczppbmtzY2FwZT0iaHR0cDovL3d3dy5pbmtzY2FwZS5vcmcvbmFtZXNwYWNlcy9pbmtzY2FwZSIKICAgd2lkdGg9IjMyIgogICBoZWlnaHQ9IjMyIgogICBpZD0ic3ZnMiIKICAgdmVyc2lvbj0iMS4xIgogICBpbmtzY2FwZTp2ZXJzaW9uPSIwLjQ4LjMuMSByOTg4NiIKICAgc29kaXBvZGk6ZG9jbmFtZT0icmVtb3Rlc3RvcmFnZS1pY29uLWVycm9yLnN2ZyIKICAgaW5rc2NhcGU6ZXhwb3J0LWZpbGVuYW1lPSIvaG9tZS91c2VyL3JlbW90ZXN0b3JhZ2UtaWNvbi1lcnJvci5wbmciCiAgIGlua3NjYXBlOmV4cG9ydC14ZHBpPSI5MCIKICAgaW5rc2NhcGU6ZXhwb3J0LXlkcGk9IjkwIj4KICA8ZGVmcwogICAgIGlkPSJkZWZzNCI+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwMzMiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZTIyMWI3O3N0b3Atb3BhY2l0eTowLjc0NjE1MzgzOyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDQwMzUiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNlMjIxYjc7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDAzNyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1NzUiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzciCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzAwMDAwMDtzdG9wLW9wYWNpdHk6MC43Mzg0NjE1NTsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDU3OSIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMDAwMDAwO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDQwODYiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OCIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY5MTAwO3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNjNDZmMDA7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8aW5rc2NhcGU6cGVyc3BlY3RpdmUKICAgICAgIHNvZGlwb2RpOnR5cGU9Imlua3NjYXBlOnBlcnNwM2QiCiAgICAgICBpbmtzY2FwZTp2cF94PSIwIDogNTI2LjE4MTA5IDogMSIKICAgICAgIGlua3NjYXBlOnZwX3k9IjAgOiAxMDAwIDogMCIKICAgICAgIGlua3NjYXBlOnZwX3o9Ijc0NC4wOTQ0OCA6IDUyNi4xODEwOSA6IDEiCiAgICAgICBpbmtzY2FwZTpwZXJzcDNkLW9yaWdpbj0iMzcyLjA0NzI0IDogMzUwLjc4NzM5IDogMSIKICAgICAgIGlkPSJwZXJzcGVjdGl2ZTI5ODUiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjkxMDA7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojYzQ2ZjAwO3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIHkyPSIwIgogICAgICAgeDI9IjEyOCIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4MT0iMTI4IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODkwIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xIgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzktMC0yIgogICAgICAgeDE9IjEyOCIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTI4IgogICAgICAgeTI9IjAiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmYwNDA0O3N0b3Atb3BhY2l0eTowLjc2MTUzODQ1OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmYwNDA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTciCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODM5LTAtOCIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTEyIgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIzMiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMzIsNzk2LjM2MjE4KSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTciPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY5MTAwO3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy0zIiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojYzQ2ZjAwO3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0yIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtMiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzktMC0zIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDMyLDc5Ni4zNjIxOCkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTIiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY5MzA0O3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTEiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjkzMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtMCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsNjUuMTQ4NzQ4LDEwNzEuNTAwNikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwMjUtNSIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMyIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC0zIj4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTQiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzA0OGJmZjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC03IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMwNDhiZmY7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzktMC04OSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwzMiw3OTYuMzYyMTgpIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC01Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC0yIiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTIiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDQ0LTkiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtMyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ4LTgiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0LTciPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDQwODYtNiIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3A0MDg4LTUiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE1OSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC42ODc1LDAsMCwtMSwyMjQsMTAyMC4zNjIyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTkiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MTYxIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsMC41OTUzOTI0NywtMC44NjYwMjU0LDAuNSwxOTAuODUxMjUsNzQ1LjIyMzc2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC03IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE2MyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwwLjU5NTM5MjQ3LDAuODY2MDI1NCwwLjUsNjUuMTQ4NzUsNzQ1LjIyMzc2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MTcwIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwzMiw3OTYuMzYyMTgpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MTcyIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LC0wLjU5NTM5MjQ3LDAuODY2MDI1NCwtMC41LDY1LjE0ODc0OCwxMDcxLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE3NCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwxOTAuODUxMjUsMTA3MS41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtNCI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNSIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC0yIj4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTciCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC00IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC02IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE3NC0yIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDE5MC44NTEyNSwxMDcxLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0LTYiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDQwODYtMCIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3A0MDg4LTkiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjUzLTkiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDE3Niw4MjguMzYyMTgpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNS0yIiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTctNCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMi05IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1NS03IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LC0wLjU5NTM5MjQ3LDAuODY2MDI1NCwtMC41LDIwOS4xNDg3NSwxMTAzLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDQ0LTItOSI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0Ni03LTciCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC00LTUiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTctNCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwzMzQuODUxMjUsMTEwMy41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA4NC02LTUiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDQwODYtMC05IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDQwODgtOS0zIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgeTI9Ii0wLjk5NDg1NjQyIgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwzMzQuODUxMjUsMTEwMy41MDA2KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDMxNyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi01IgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDM1OCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMTc2LDgyOC4zNjIxOCkiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDM2MCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSwyMDkuMTQ4NzUsMTEwMy41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC02IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDM2MiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwzMzQuODUxMjUsMTEwMy41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC02IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDM1OC03IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwxNzYsODI4LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC00LTYiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTUtOSIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03LTAiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItOCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzNjAtNCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSwyMDkuMTQ4NzUsMTEwMy41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC0yLTgiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtNy0zIgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtNC02IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC02LTYiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MzYyLTQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQtNi02Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTAtMCIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3A0MDg4LTktOCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1My05LTYiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDE3Niw4MjguMzYyMTgpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC01LTItNyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03LTQtMyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMi05LTMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjU1LTctMSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSwyMDkuMTQ4NzUsMTEwMy41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC0yLTktMyI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0Ni03LTctNSIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ4LTQtNS0zIgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgeTI9Ii0wLjk5NDg1NjQyIgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwzMzQuODUxMjUsMTEwMy41MDA2KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDMxNy04IgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC02LTUtNSIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA4NC02LTUtNSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDA4Ni0wLTktNiIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3A0MDg4LTktMy0zIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgeTI9Ii0wLjk5NDg1NjQyIgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwzMzQuODUxMjUsMTEwMy41MDA2KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDQzNCIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi01LTUiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi02IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUwOCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSw3MDIuODUxMjUsMTA3MS41MDA1KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTgiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTExIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LC0wLjU5NTM5MjQ3LDAuODY2MDI1NCwtMC41LDU3Ny4xNDg3NSwxMDcxLjUwMDUpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTYiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTE0IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSw1NDQsLTZlLTUpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1MTciCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDU4NCw3OTYuMzYyMTIpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi01LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTIwIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LDAuNTk1MzkyNDcsMC44NjYwMjU0LDAuNSw1NzcuMTQ4NzUsNzc3LjIyMzgpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItOS0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUyMyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LDAuNTk1MzkyNDcsLTAuODY2MDI1NCwwLjUsNzAyLjg1MTI1LDc3Ny4yMjM4KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTkiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTI2IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjY4NzUsMCwwLC0xLDczNiwyNTYuMDAwMDIpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUyOSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC42ODc1LDAsMCwtMSw3NzYsMTA1Mi4zNjIyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTYiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTMyIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSw1NjQsNzk2LjM2MjEyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1MzQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuNjg3NSwwLDAsLTEsNzU2LDI1Ni4wMDAwMikiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTkiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTM5IgogICAgICAgY3g9IjY2MCIKICAgICAgIGN5PSIxMjgiCiAgICAgICBmeD0iNjYwIgogICAgICAgZnk9IjEyOCIKICAgICAgIHI9IjExMiIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsMS4xNDI4NTcxLDYwLDcxMC4wNzY1MikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgLz4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTktOCIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1MzktNyIKICAgICAgIGN4PSI2NjAiCiAgICAgICBjeT0iMTI4IgogICAgICAgZng9IjY2MCIKICAgICAgIGZ5PSIxMjgiCiAgICAgICByPSIxMTIiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEsMCwwLDEuMTQyODU3MSwtMjAsNzc4LjA3NjQ3KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOS04Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC01LTItNy05IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTctNC0zLTgiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICByPSIxMTIiCiAgICAgICBmeT0iMTI4IgogICAgICAgZng9IjY2MCIKICAgICAgIGN5PSIxMjgiCiAgICAgICBjeD0iNjYwIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwxLjE0Mjg1NzEsMTYsMzMwLjA3NjUyKSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDU1NiIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQ1NzUiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05LTEiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTM5LTAiCiAgICAgICBjeD0iNjYwIgogICAgICAgY3k9IjEyOCIKICAgICAgIGZ4PSI2NjAiCiAgICAgICBmeT0iMTI4IgogICAgICAgcj0iMTEyIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwxLjE0Mjg1NzEsLTIwLDc3OC4wNzY0NykiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTktMSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNS0yLTctNiIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03LTQtMy0wIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgcj0iMTEyIgogICAgICAgZnk9IjEyOCIKICAgICAgIGZ4PSI2NjAiCiAgICAgICBjeT0iMTI4IgogICAgICAgY3g9IjY2MCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4xMjQ5OTk5OSwwLDAsMC4xNDI4NTcxMyw3OTcuNSw2NzguMDc2NTIpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTU2LTMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0NTc1LTIiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1NzUtMiI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDU3Ny02IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM4MTgxODE7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzktNCIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzA3MDcwO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIHI9IjExMiIKICAgICAgIGZ5PSIxMjgiCiAgICAgICBmeD0iNjYwIgogICAgICAgY3k9IjEyOCIKICAgICAgIGN4PSI2NjAiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMTI0OTk5OTksMCwwLDAuMTQyODU3MTMsNzMzLjUwMDAxLDY3OC4wNzY1MikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ2MDEiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOS0xIgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICByPSIxMTIiCiAgICAgICBmeT0iMTI4IgogICAgICAgZng9IjY2MCIKICAgICAgIGN5PSIxMjgiCiAgICAgICBjeD0iNjYwIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwxLjE0Mjg1NzEsMjM2LDc3OC4wNzY0NykiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1NTYtNSIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQ1NzUtMyIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDU3NS0zIj4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0NTc3LTkiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzgxODE4MTtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDU3OS04IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3MDcwNzA7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgcj0iMTEyIgogICAgICAgZnk9IjEyOCIKICAgICAgIGZ4PSI2NjAiCiAgICAgICBjeT0iMTI4IgogICAgICAgY3g9IjY2MCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4xMjQ5OTk5OSwwLDAsMC4xNDI4NTcxMyw4MjkuNTAwMDEsNjc4LjA3NjUyKSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDY0NSIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQ1NzUtMyIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgcj0iMTEyIgogICAgICAgZnk9IjEyOCIKICAgICAgIGZ4PSI2NjAiCiAgICAgICBjeT0iMTI4IgogICAgICAgY3g9IjY2MCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsMS4xNDI4NTcxLDIzNiw3NzguMDc2NDcpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTU2LTgiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0NTc1LTEiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1NzUtMSI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDU3Ny0yIgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMwMDAwMDA7c3RvcC1vcGFjaXR5OjAuNzM4NDYxNTU7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzktMiIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMDAwMDAwO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDAxNyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMzIsNzk2LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDAxOSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSw2NS4xNDg3NDgsMTA3MS41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwMjEiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMTkwLjg1MTI1LDEwNzEuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNTkiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MzU4LTMiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDE3Niw4MjguMzYyMTgpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNTkiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTUtNiIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03LTUiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItMyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzNjAtNiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSwyMDkuMTQ4NzUsMTEwMy41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC0yLTMiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtNy0wIgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtNC0yIgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC02LTciCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MzYyLTAiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQtNi03Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTAtNCIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3A0MDg4LTktNyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS0wIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1My05LTMiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDE3Niw4MjguMzYyMTgpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS0wIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC01LTItMSIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03LTQtNiIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMi05LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjU1LTctNyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSwyMDkuMTQ4NzUsMTEwMy41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC0yLTktNSI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0Ni03LTctNyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ4LTQtNS04IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgeTI9Ii0wLjk5NDg1NjQyIgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwzMzQuODUxMjUsMTEwMy41MDA2KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDMxNy04OSIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi01LTAiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQtNi01LTAiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDQwODYtMC05LTciIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC05LTMtOCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTMiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjc0NTA5ODA1OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTEwIiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTMiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDQ0LTciPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtMzIiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC43NDUwOTgwNTsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC0yIgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA4NC01Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC43NDUwOTgwNTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTMiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC0zIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtNS0yIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzU5MDRmZjtzdG9wLW9wYWNpdHk6MC43NDUwOTgwNTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC0yLTgiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM1OTA0ZmY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtMi01IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC05LTAiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtMy04IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtOC02IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC03LTMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MTYzLTkiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsMC41OTUzOTI0NywwLjg2NjAyNTQsMC41LDY1LjE0ODc1LDc0NS4yMjM3NikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQtNy0zIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2QyZGQyNjtzdG9wLW9wYWNpdHk6MC43NDUwOTgwNTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTYtMyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2QyZGQyNjtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3A0MDg4LTUtNyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi03IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDIzNSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSw1MjYuODUxMjUsMTI5MS41MDA3KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjM4IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LC0wLjU5NTM5MjQ3LDAuODY2MDI1NCwtMC41LDQwMS4xNDg3NSwxMjkxLjUwMDcpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTU5IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI0MSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMzUyLDQwMy45OTk5OSkiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01OSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNDQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDQ2OCwxMDE2LjM2MjIpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi01LTAiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjQ3IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LDAuNTk1MzkyNDcsMC44NjYwMjU0LDAuNSw0MDEuMTQ4NzUsOTk3LjIyMzkpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItOS01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1MCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LDAuNTk1MzkyNDcsLTAuODY2MDI1NCwwLjUsNTI2Ljg1MTI1LDk5Ny4yMjM5KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTAiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjUzIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjY4NzUsMCwwLC0xLDU0NCw2NjAuMDAwMDkpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1NyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwwLjU5NTM5MjQ3LDAuODY2MDI1NCwwLjUsNDAxLjE0ODc1LDcwOS4yMjM5KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTkiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjYwIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsMC41OTUzOTI0NywtMC44NjYwMjU0LDAuNSw1MjYuODUxMjUsNzA5LjIyMzkpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjYzIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjY4NzUsMCwwLC0xLDU2MCw5ODQuMzYyMzIpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTUyIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDM4Ny03IgogICAgICAgY3g9IjEwNDYuNTMxMiIKICAgICAgIGN5PSI1NzEuNDIxODgiCiAgICAgICBmeD0iMTA0Ni41MzEyIgogICAgICAgZnk9IjU3MS40MjE4OCIKICAgICAgIHI9Ijk1Ljk5OTk3NyIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMS4xNjY2NjY5LDAsMCwxLjM0NzI1MDEsLTI0NC45NTMzOSw4Ni41MDUwMzUpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTUyIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC43NjE1Mzg0NTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC03IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTQiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC0zMyI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuNzYxNTM4NDU7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNCIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC02IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTIwIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEuMTY2NjY2OSwwLDAsMS4zNDcyNTAxLC0yNDQuOTUzMzksODYuNTA1MDM1KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTMzIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUyMiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLjE2NjY2NjksMCwwLDEuMzQ3MjUwMSwxMzkuMDQ2NiwtMzYwLjE0OTk3KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTUyIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUyNCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjE0NDMyNjczLDAsMCwwLjE2NjY2NjQyLDkwNy4xMDIyMyw4OTcuMTI2NTYpIgogICAgICAgY3g9IjEwNDYuNTMxMiIKICAgICAgIGN5PSI1NzEuNDIxODgiCiAgICAgICBmeD0iMTA0Ni41MzEyIgogICAgICAgZnk9IjU3MS40MjE4OCIKICAgICAgIHI9Ijk1Ljk5OTk3NyIgLz4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtMzMiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTMyIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEuMTY2NjY2OSwwLDAsMS4zNDcyNTAxLDEzOS4wNDY2LC0zNjAuMTQ5OTcpIgogICAgICAgY3g9IjEwNDYuNTMxMiIKICAgICAgIGN5PSI1NzEuNDIxODgiCiAgICAgICBmeD0iMTA0Ni41MzEyIgogICAgICAgZnk9IjU3MS40MjE4OCIKICAgICAgIHI9Ijk1Ljk5OTk3NyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC03LTMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzMjU3IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LDAuNTk1MzkyNDcsMC44NjYwMjU0LDAuNSwxNDUuMTQ4NzUsOTk3LjIyMzgxKSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDAzMyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDMyNjAiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwwLjU5NTM5MjQ3LC0wLjg2NjAyNTQsMC41LDI3MC44NTEyNSw5OTcuMjIzODEpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC01LTIiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzMjYzIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjY4NzUsMCwwLC0xLDMwNCwxMjcyLjM2MjMpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDU4IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwtMTA4LDEwMTYuMzYyMikiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC03IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA2MCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSwtNzQuODUxMjUyLDEyOTEuNTAwNykiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNjIiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsNTAuODUxMjUsMTI5MS41MDA3KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA2NSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwyNzAuODUxMjUsMTI5MS41MDA3KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC03IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA2OCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSwxNDUuMTQ4NzUsMTI5MS41MDA3KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtMyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNzEiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDExMiwxMDE2LjM2MjIpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTIwIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUyMC00IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEuMTY2NjY2OSwwLDAsMS4zNDcyNTAxLC0yNDQuOTUzMzksODYuNTA1MDM1KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTIwIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC43NjE1Mzg0NTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC05IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTc3IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgcj0iOTUuOTk5OTc3IgogICAgICAgZnk9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgY3g9IjEwNDYuNTMxMiIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMS4xNjY2NjY5LDAsMCwxLjM0NzI1MDEsLTI0NC45NTMzOSw4Ni41MDUwMzUpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0MjA4IgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtMjAiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00IgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50MzYxNCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLjE2NjY2NjksMCwwLDEuMzQ3MjUwMSwyMTkuMDQ2NjEsODkuMTY3NzU3KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00IgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50MzYyNSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLjE2NjY2NjksMCwwLDEuMzQ3MjUwMSwyMTkuMDQ2NjEsODkuMTY3NzU3KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00IgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50MzIwOSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjE0NDMyNjk5LDAsMCwwLjE2NjY2NjczLDEyMDEuNTM1OCw4NzcuMTE0ODgpIgogICAgICAgY3g9IjEwNDYuNTMxMiIKICAgICAgIGN5PSI1NzEuNDIxODgiCiAgICAgICBmeD0iMTA0Ni41MzEyIgogICAgICAgZnk9IjU3MS40MjE4OCIKICAgICAgIHI9Ijk1Ljk5OTk3NyIgLz4KICA8L2RlZnM+CiAgPHNvZGlwb2RpOm5hbWVkdmlldwogICAgIGlkPSJiYXNlIgogICAgIHBhZ2Vjb2xvcj0iI2ZmZmZmZiIKICAgICBib3JkZXJjb2xvcj0iIzY2NjY2NiIKICAgICBib3JkZXJvcGFjaXR5PSIxLjAiCiAgICAgaW5rc2NhcGU6cGFnZW9wYWNpdHk9IjAuMCIKICAgICBpbmtzY2FwZTpwYWdlc2hhZG93PSIyIgogICAgIGlua3NjYXBlOnpvb209IjE2IgogICAgIGlua3NjYXBlOmN4PSI1LjkzMTE2NSIKICAgICBpbmtzY2FwZTpjeT0iMTYuMjM3MjI1IgogICAgIGlua3NjYXBlOmRvY3VtZW50LXVuaXRzPSJweCIKICAgICBpbmtzY2FwZTpjdXJyZW50LWxheWVyPSJsYXllcjEiCiAgICAgc2hvd2dyaWQ9InRydWUiCiAgICAgaW5rc2NhcGU6d2luZG93LXdpZHRoPSIxMjgwIgogICAgIGlua3NjYXBlOndpbmRvdy1oZWlnaHQ9IjgwMCIKICAgICBpbmtzY2FwZTp3aW5kb3cteD0iMCIKICAgICBpbmtzY2FwZTp3aW5kb3cteT0iLTMxIgogICAgIGlua3NjYXBlOndpbmRvdy1tYXhpbWl6ZWQ9IjEiCiAgICAgZml0LW1hcmdpbi10b3A9IjAiCiAgICAgZml0LW1hcmdpbi1sZWZ0PSIwIgogICAgIGZpdC1tYXJnaW4tcmlnaHQ9IjAiCiAgICAgZml0LW1hcmdpbi1ib3R0b209IjAiCiAgICAgaW5rc2NhcGU6c25hcC1wYWdlPSJ0cnVlIgogICAgIGlua3NjYXBlOnNuYXAtbm9kZXM9InRydWUiCiAgICAgZ3JpZHRvbGVyYW5jZT0iMTAiCiAgICAgc2hvd2JvcmRlcj0idHJ1ZSIKICAgICBzaG93Z3VpZGVzPSJ0cnVlIgogICAgIGlua3NjYXBlOmd1aWRlLWJib3g9InRydWUiPgogICAgPGlua3NjYXBlOmdyaWQKICAgICAgIHR5cGU9Inh5Z3JpZCIKICAgICAgIGlkPSJncmlkMzAyMSIKICAgICAgIGVtcHNwYWNpbmc9IjQiCiAgICAgICB2aXNpYmxlPSJ0cnVlIgogICAgICAgZW5hYmxlZD0idHJ1ZSIKICAgICAgIHNuYXB2aXNpYmxlZ3JpZGxpbmVzb25seT0idHJ1ZSIKICAgICAgIHNwYWNpbmd4PSIxNnB4IgogICAgICAgc3BhY2luZ3k9IjE2cHgiCiAgICAgICBkb3R0ZWQ9InRydWUiIC8+CiAgPC9zb2RpcG9kaTpuYW1lZHZpZXc+CiAgPG1ldGFkYXRhCiAgICAgaWQ9Im1ldGFkYXRhNyI+CiAgICA8cmRmOlJERj4KICAgICAgPGNjOldvcmsKICAgICAgICAgcmRmOmFib3V0PSIiPgogICAgICAgIDxkYzpmb3JtYXQ+aW1hZ2Uvc3ZnK3htbDwvZGM6Zm9ybWF0PgogICAgICAgIDxkYzp0eXBlCiAgICAgICAgICAgcmRmOnJlc291cmNlPSJodHRwOi8vcHVybC5vcmcvZGMvZGNtaXR5cGUvU3RpbGxJbWFnZSIgLz4KICAgICAgICA8ZGM6dGl0bGU+PC9kYzp0aXRsZT4KICAgICAgPC9jYzpXb3JrPgogICAgPC9yZGY6UkRGPgogIDwvbWV0YWRhdGE+CiAgPGcKICAgICBpbmtzY2FwZTpsYWJlbD0iTGF5ZXIgMSIKICAgICBpbmtzY2FwZTpncm91cG1vZGU9ImxheWVyIgogICAgIGlkPSJsYXllcjEiCiAgICAgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTEzMzYuNTc4NSwtOTU2LjM1MTg5KSI+CiAgICA8cGF0aAogICAgICAgc3R5bGU9ImNvbG9yOiMwMDAwMDA7ZmlsbDp1cmwoI3JhZGlhbEdyYWRpZW50MzIwOSk7ZmlsbC1vcGFjaXR5OjE7ZmlsbC1ydWxlOm5vbnplcm87c3Ryb2tlOm5vbmU7bWFya2VyOm5vbmU7dmlzaWJpbGl0eTp2aXNpYmxlO2Rpc3BsYXk6aW5saW5lO292ZXJmbG93OnZpc2libGU7ZW5hYmxlLWJhY2tncm91bmQ6YWNjdW11bGF0ZSIKICAgICAgIGQ9Im0gMTM1Mi41Nzg1LDk1Ni4zNTE4OSAwLjI4ODYsMTUuMTM2MjkgMTMuNTY2OCwtNy4xMzUxNiAtMTMuODU1NCwtOC4wMDExMyB6IG0gMCwwIC0xMy44NTU0LDguMDAxMTMgMTMuNTY2Nyw3LjEzNTE2IDAuMjg4NywtMTUuMTM2MjkgeiBtIC0xMy44NTU0LDguMDAxMTMgMCwxNS45OTc3NCAxMi45NTc5LC03LjgxNjIxIC0xMi45NTc5LC04LjE4MTUzIHogbSAwLDE1Ljk5Nzc0IDEzLjg1NTQsOC4wMDExMyAtMC42MDg5LC0xNS4zMTY3IC0xMy4yNDY1LDcuMzE1NTcgeiBtIDEzLjg1NTQsOC4wMDExMyAxMy44NTU0LC04LjAwMTEzIC0xMy4yNTEsLTcuMzE1NTcgLTAuNjA0NCwxNS4zMTY3IHogbSAxMy44NTU0LC04LjAwMTEzIDAsLTE1Ljk5Nzc0IC0xMi45NjI0LDguMTgxNTMgMTIuOTYyNCw3LjgxNjIxIHoiCiAgICAgICBpZD0icGF0aDQwMTYtMy04LTYiCiAgICAgICBpbmtzY2FwZTpjb25uZWN0b3ItY3VydmF0dXJlPSIwIiAvPgogIDwvZz4KPC9zdmc+Cg==',
    remotestorageIconOffline: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhLS0gQ3JlYXRlZCB3aXRoIElua3NjYXBlIChodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy8pIC0tPgoKPHN2ZwogICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgIHhtbG5zOmNjPSJodHRwOi8vY3JlYXRpdmVjb21tb25zLm9yZy9ucyMiCiAgIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyIKICAgeG1sbnM6c3ZnPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogICB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIKICAgeG1sbnM6c29kaXBvZGk9Imh0dHA6Ly9zb2RpcG9kaS5zb3VyY2Vmb3JnZS5uZXQvRFREL3NvZGlwb2RpLTAuZHRkIgogICB4bWxuczppbmtzY2FwZT0iaHR0cDovL3d3dy5pbmtzY2FwZS5vcmcvbmFtZXNwYWNlcy9pbmtzY2FwZSIKICAgd2lkdGg9IjMyIgogICBoZWlnaHQ9IjMyIgogICBpZD0ic3ZnMiIKICAgdmVyc2lvbj0iMS4xIgogICBpbmtzY2FwZTp2ZXJzaW9uPSIwLjQ4LjEgcjk3NjAiCiAgIHNvZGlwb2RpOmRvY25hbWU9InJlbW90ZXN0b3JhZ2VJY29uT2ZmbGluZS5zdmciCiAgIGlua3NjYXBlOmV4cG9ydC1maWxlbmFtZT0iL2hvbWUvdXNlci93ZWJzaXRlL2ltZy9yZW1vdGVTdG9yYWdlLWljb24ucG5nIgogICBpbmtzY2FwZTpleHBvcnQteGRwaT0iOTAiCiAgIGlua3NjYXBlOmV4cG9ydC15ZHBpPSI5MCI+CiAgPGRlZnMKICAgICBpZD0iZGVmczQiPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDMzIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2UyMjFiNztzdG9wLW9wYWNpdHk6MC43NDYxNTM4MzsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDM1IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZTIyMWI3O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDQwMzciIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTc1Ij4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0NTc3IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMwMDAwMDA7c3RvcC1vcGFjaXR5OjAuNzM4NDYxNTU7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzkiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzAwMDAwMDtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDQwODgiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDQ0Ij4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmOTEwMDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojYzQ2ZjAwO3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzciIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGlua3NjYXBlOnBlcnNwZWN0aXZlCiAgICAgICBzb2RpcG9kaTp0eXBlPSJpbmtzY2FwZTpwZXJzcDNkIgogICAgICAgaW5rc2NhcGU6dnBfeD0iMCA6IDUyNi4xODEwOSA6IDEiCiAgICAgICBpbmtzY2FwZTp2cF95PSIwIDogMTAwMCA6IDAiCiAgICAgICBpbmtzY2FwZTp2cF96PSI3NDQuMDk0NDggOiA1MjYuMTgxMDkgOiAxIgogICAgICAgaW5rc2NhcGU6cGVyc3AzZC1vcmlnaW49IjM3Mi4wNDcyNCA6IDM1MC43ODczOSA6IDEiCiAgICAgICBpZD0icGVyc3BlY3RpdmUyOTg1IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY5MTAwO3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2M0NmYwMDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTciIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICB5Mj0iMCIKICAgICAgIHgyPSIxMjgiCiAgICAgICB5MT0iMTI4IgogICAgICAgeDE9IjEyOCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50Mzg5MCIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMSIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODM5LTAtMiIKICAgICAgIHgxPSIxMjgiCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEyOCIKICAgICAgIHkyPSIwIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzY5Njk2OTtzdG9wLW9wYWNpdHk6MC43NjE1Mzg0NTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOCIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzY3Njc2NztzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS03IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzOS0wLTgiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjExMiIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMzIiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDMyLDc5Ni4zNjIxOCkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS03Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmOTEwMDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctMyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2M0NmYwMDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMiIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTIiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODM5LTAtMyIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwzMiw3OTYuMzYyMTgpIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC0yIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmOTMwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC0xIiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY5MzA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTAiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LC0wLjU5NTM5MjQ3LDAuODY2MDI1NCwtMC41LDY1LjE0ODc0OCwxMDcxLjUwMDYpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDI1LTUiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTMiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMyI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0Ni00IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMwNDhiZmY7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtNyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMDQ4YmZmO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODM5LTAtODkiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMzIsNzk2LjM2MjE4KSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtNSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtMiIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC0yIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC05Ij4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTMiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC04IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA4NC03Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTYiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC01IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQxNTkiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuNjg3NSwwLDAsLTEsMjI0LDEwMjAuMzYyMikiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC05IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE2MSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LDAuNTk1MzkyNDcsLTAuODY2MDI1NCwwLjUsMTkwLjg1MTI1LDc0NS4yMjM3NikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQxNjMiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsMC41OTUzOTI0NywwLjg2NjAyNTQsMC41LDY1LjE0ODc1LDc0NS4yMjM3NikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE3MCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMzIsNzk2LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE3MiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSw2NS4xNDg3NDgsMTA3MS41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQxNzQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMTkwLjg1MTI1LDEwNzEuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTUiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMiI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0Ni03IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtNCIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQxNzQtMiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwxOTAuODUxMjUsMTA3MS41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA4NC02Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTAiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC05IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1My05IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwxNzYsODI4LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTUtMiIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03LTQiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItOSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTUtNyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSwyMDkuMTQ4NzUsMTEwMy41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC0yLTkiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtNy03IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtNC01IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC02LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjU3LTQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQtNi01Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTAtOSIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3A0MDg4LTktMyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIHkyPSItMC45OTQ4NTY0MiIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzMTciCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNSIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzNTgiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDE3Niw4MjguMzYyMTgpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzNjAiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMjA5LjE0ODc1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzNjIiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzNTgtNyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMTc2LDgyOC4zNjIxOCkiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtNC02Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC01LTkiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNy0wIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTgiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MzYwLTQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMjA5LjE0ODc1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMi04Ij4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTctMyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ4LTQtNiIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi02IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDM2Mi00IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDMzNC44NTEyNSwxMTAzLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0LTYtNiI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDA4Ni0wLTAiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC05LTgiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTMtOS02IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwxNzYsODI4LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNS0yLTciIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNy00LTMiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItOS0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1NS03LTEiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMjA5LjE0ODc1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMi05LTMiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtNy03LTUiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC00LTUtMyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIHkyPSItMC45OTQ4NTY0MiIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzMTctOCIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi01LTUiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQtNi01LTUiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDQwODYtMC05LTYiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC05LTMtMyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIHkyPSItMC45OTQ4NTY0MiIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ0MzQiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNS01IgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1MDgiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsNzAyLjg1MTI1LDEwNzEuNTAwNSkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMi04IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUxMSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSw1NzcuMTQ4NzUsMTA3MS41MDA1KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC02IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUxNCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsNTQ0LC02ZS01KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTYiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTE3IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSw1ODQsNzk2LjM2MjEyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNS01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUyMCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwwLjU5NTM5MjQ3LDAuODY2MDI1NCwwLjUsNTc3LjE0ODc1LDc3Ny4yMjM4KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTktMyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1MjMiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwwLjU5NTM5MjQ3LC0wLjg2NjAyNTQsMC41LDcwMi44NTEyNSw3NzcuMjIzOCkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUyNiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC42ODc1LDAsMCwtMSw3MzYsMjU2LjAwMDAyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1MjkiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuNjg3NSwwLDAsLTEsNzc2LDEwNTIuMzYyMikiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC02IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUzMiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsNTY0LDc5Ni4zNjIxMikiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTkiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTM0IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjY4NzUsMCwwLC0xLDc1NiwyNTYuMDAwMDIpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05IgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUzOSIKICAgICAgIGN4PSI2NjAiCiAgICAgICBjeT0iMTI4IgogICAgICAgZng9IjY2MCIKICAgICAgIGZ5PSIxMjgiCiAgICAgICByPSIxMTIiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEsMCwwLDEuMTQyODU3MSw2MCw3MTAuMDc2NTIpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05LTgiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTM5LTciCiAgICAgICBjeD0iNjYwIgogICAgICAgY3k9IjEyOCIKICAgICAgIGZ4PSI2NjAiCiAgICAgICBmeT0iMTI4IgogICAgICAgcj0iMTEyIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwxLjE0Mjg1NzEsLTIwLDc3OC4wNzY0NykiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTktOCI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNS0yLTctOSIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03LTQtMy04IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgcj0iMTEyIgogICAgICAgZnk9IjEyOCIKICAgICAgIGZ4PSI2NjAiCiAgICAgICBjeT0iMTI4IgogICAgICAgY3g9IjY2MCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsMS4xNDI4NTcxLDE2LDMzMC4wNzY1MikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1NTYiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0NTc1IgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOS0xIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUzOS0wIgogICAgICAgY3g9IjY2MCIKICAgICAgIGN5PSIxMjgiCiAgICAgICBmeD0iNjYwIgogICAgICAgZnk9IjEyOCIKICAgICAgIHI9IjExMiIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsMS4xNDI4NTcxLC0yMCw3NzguMDc2NDcpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05LTEiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTUtMi03LTYiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNy00LTMtMCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIHI9IjExMiIKICAgICAgIGZ5PSIxMjgiCiAgICAgICBmeD0iNjYwIgogICAgICAgY3k9IjEyOCIKICAgICAgIGN4PSI2NjAiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMTI0OTk5OTksMCwwLDAuMTQyODU3MTMsNzk3LjUsNjc4LjA3NjUyKSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDU1Ni0zIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDU3NS0yIgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTc1LTIiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzctNiIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojODE4MTgxO3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0NTc5LTQiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzcwNzA3MDtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICByPSIxMTIiCiAgICAgICBmeT0iMTI4IgogICAgICAgZng9IjY2MCIKICAgICAgIGN5PSIxMjgiCiAgICAgICBjeD0iNjYwIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjEyNDk5OTk5LDAsMCwwLjE0Mjg1NzEzLDczMy41MDAwMSw2NzguMDc2NTIpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NjAxIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTktMSIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgcj0iMTEyIgogICAgICAgZnk9IjEyOCIKICAgICAgIGZ4PSI2NjAiCiAgICAgICBjeT0iMTI4IgogICAgICAgY3g9IjY2MCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsMS4xNDI4NTcxLDIzNiw3NzguMDc2NDcpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTU2LTUiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0NTc1LTMiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1NzUtMyI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDU3Ny05IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM4MTgxODE7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzktOCIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzA3MDcwO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIHI9IjExMiIKICAgICAgIGZ5PSIxMjgiCiAgICAgICBmeD0iNjYwIgogICAgICAgY3k9IjEyOCIKICAgICAgIGN4PSI2NjAiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMTI0OTk5OTksMCwwLDAuMTQyODU3MTMsODI5LjUwMDAxLDY3OC4wNzY1MikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ2NDUiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0NTc1LTMiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIHI9IjExMiIKICAgICAgIGZ5PSIxMjgiCiAgICAgICBmeD0iNjYwIgogICAgICAgY3k9IjEyOCIKICAgICAgIGN4PSI2NjAiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEsMCwwLDEuMTQyODU3MSwyMzYsNzc4LjA3NjQ3KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDU1Ni04IgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDU3NS0xIgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTc1LTEiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzctMiIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMDAwMDAwO3N0b3Atb3BhY2l0eTowLjczODQ2MTU1OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0NTc5LTIiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzAwMDAwMDtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwMTciCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDMyLDc5Ni4zNjIxOCkiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwMTkiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsNjUuMTQ4NzQ4LDEwNzEuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDIxIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDE5MC44NTEyNSwxMDcxLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTU5IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDM1OC0zIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwxNzYsODI4LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC00LTU5Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC01LTYiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNy01IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MzYwLTYiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMjA5LjE0ODc1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMi0zIj4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTctMCIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ4LTQtMiIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi03IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDM2Mi0wIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDMzNC44NTEyNSwxMTAzLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0LTYtNyI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDA4Ni0wLTQiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC05LTciIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtMCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTMtOS0zIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwxNzYsODI4LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtMCI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNS0yLTEiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNy00LTYiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItOS01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1NS03LTciCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMjA5LjE0ODc1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMi05LTUiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtNy03LTciCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC00LTUtOCIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIHkyPSItMC45OTQ4NTY0MiIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzMTctODkiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNS0wIgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0LTYtNS0wIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTAtOS03IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDQwODgtOS0zLTgiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC0zIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC43NDUwOTgwNTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC0xMCIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC0zIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC03Ij4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTMyIgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuNzQ1MDk4MDU7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtMiIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQtNSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjAuNzQ1MDk4MDU7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDA4Ni0zIiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDQwODgtMyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTUtMiI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM1OTA0ZmY7c3RvcC1vcGFjaXR5OjAuNzQ1MDk4MDU7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtMi04IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNTkwNGZmO3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTItNSIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtOS0wIj4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTMtOCIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ4LTgtNiIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNy0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE2My05IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LDAuNTk1MzkyNDcsMC44NjYwMjU0LDAuNSw2NS4xNDg3NSw3NDUuMjIzNzYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0LTctMyI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNkMmRkMjY7c3RvcC1vcGFjaXR5OjAuNzQ1MDk4MDU7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDA4Ni02LTMiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNkMmRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC01LTciIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyMzUiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsNTI2Ljg1MTI1LDEyOTEuNTAwNykiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMi0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDIzOCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSw0MDEuMTQ4NzUsMTI5MS41MDA3KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01OSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNDEiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDM1Miw0MDMuOTk5OTkpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNTkiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjQ0IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSw0NjgsMTAxNi4zNjIyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNS0wIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI0NyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwwLjU5NTM5MjQ3LDAuODY2MDI1NCwwLjUsNDAxLjE0ODc1LDk5Ny4yMjM5KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTktNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTAiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwwLjU5NTM5MjQ3LC0wLjg2NjAyNTQsMC41LDUyNi44NTEyNSw5OTcuMjIzOSkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS0wIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1MyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC42ODc1LDAsMCwtMSw1NDQsNjYwLjAwMDA5KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTciCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsMC41OTUzOTI0NywwLjg2NjAyNTQsMC41LDQwMS4xNDg3NSw3MDkuMjIzOSkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMi05IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI2MCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LDAuNTk1MzkyNDcsLTAuODY2MDI1NCwwLjUsNTI2Ljg1MTI1LDcwOS4yMjM5KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI2MyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC42ODc1LDAsMCwtMSw1NjAsOTg0LjM2MjMyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC01MiIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQzODctNyIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEuMTY2NjY2OSwwLDAsMS4zNDcyNTAxLC0yNDQuOTUzMzksODYuNTA1MDM1KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC01MiI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuNzYxNTM4NDU7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC00IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtMzMiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjc2MTUzODQ1OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTQiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNiIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00IgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUyMCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLjE2NjY2NjksMCwwLDEuMzQ3MjUwMSwtMjQ0Ljk1MzM5LDg2LjUwNTAzNSkiCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgcj0iOTUuOTk5OTc3IiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC0zMyIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1MjIiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMS4xNjY2NjY5LDAsMCwxLjM0NzI1MDEsMTM5LjA0NjYsLTM2MC4xNDk5NykiCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgcj0iOTUuOTk5OTc3IiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC01MiIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1MjQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4xNDQzMjY3MywwLDAsMC4xNjY2NjY0Miw5MDcuMTAyMjMsODk3LjEyNjU2KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTMzIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUzMiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLjE2NjY2NjksMCwwLDEuMzQ3MjUwMSwxMzkuMDQ2NiwtMzYwLjE0OTk3KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNy0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzI1NyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwwLjU5NTM5MjQ3LDAuODY2MDI1NCwwLjUsMTQ1LjE0ODc1LDk5Ny4yMjM4MSkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwMzMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzMjYwIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsMC41OTUzOTI0NywtMC44NjYwMjU0LDAuNSwyNzAuODUxMjUsOTk3LjIyMzgxKSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNS0yIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzI2MyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC42ODc1LDAsMCwtMSwzMDQsMTI3Mi4zNjIzKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA1OCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsLTEwOCwxMDE2LjM2MjIpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtNyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNjAiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsLTc0Ljg1MTI1MiwxMjkxLjUwMDcpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDYyIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDUwLjg1MTI1LDEyOTEuNTAwNykiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNjUiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMjcwLjg1MTI1LDEyOTEuNTAwNykiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtNyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNjgiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMTQ1LjE0ODc1LDEyOTEuNTAwNykiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDcxIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwxMTIsMTAxNi4zNjIyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC0yMCIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1MjAtNCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLjE2NjY2NjksMCwwLDEuMzQ3MjUwMSwtMjQ0Ljk1MzM5LDg2LjUwNTAzNSkiCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgcj0iOTUuOTk5OTc3IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC0yMCI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuNzYxNTM4NDU7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtOSIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03NyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIHI9Ijk1Ljk5OTk3NyIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICBmeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEuMTY2NjY2OSwwLDAsMS4zNDcyNTAxLC0yNDQuOTUzMzksODYuNTA1MDM1KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDIwOCIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTIwIgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNCIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDM2MTQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMS4xNjY2NjY5LDAsMCwxLjM0NzI1MDEsMjE5LjA0NjYxLDg5LjE2Nzc1NykiCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgcj0iOTUuOTk5OTc3IiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNCIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDM2MjUiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMS4xNjY2NjY5LDAsMCwxLjM0NzI1MDEsMjE5LjA0NjYxLDg5LjE2Nzc1NykiCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgcj0iOTUuOTk5OTc3IiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNCIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDMyMDkiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4xNDQzMjY5OSwwLDAsMC4xNjY2NjY3MywxMjAxLjUzNTgsODc3LjExNDg4KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgPC9kZWZzPgogIDxzb2RpcG9kaTpuYW1lZHZpZXcKICAgICBpZD0iYmFzZSIKICAgICBwYWdlY29sb3I9IiNmZmZmZmYiCiAgICAgYm9yZGVyY29sb3I9IiM2NjY2NjYiCiAgICAgYm9yZGVyb3BhY2l0eT0iMS4wIgogICAgIGlua3NjYXBlOnBhZ2VvcGFjaXR5PSIwLjAiCiAgICAgaW5rc2NhcGU6cGFnZXNoYWRvdz0iMiIKICAgICBpbmtzY2FwZTp6b29tPSIxNiIKICAgICBpbmtzY2FwZTpjeD0iLTUuMTAwMDg1IgogICAgIGlua3NjYXBlOmN5PSIxNi4yMzcyMjUiCiAgICAgaW5rc2NhcGU6ZG9jdW1lbnQtdW5pdHM9InB4IgogICAgIGlua3NjYXBlOmN1cnJlbnQtbGF5ZXI9ImxheWVyMSIKICAgICBzaG93Z3JpZD0idHJ1ZSIKICAgICBpbmtzY2FwZTp3aW5kb3ctd2lkdGg9IjEzOTYiCiAgICAgaW5rc2NhcGU6d2luZG93LWhlaWdodD0iMTAyNyIKICAgICBpbmtzY2FwZTp3aW5kb3cteD0iMCIKICAgICBpbmtzY2FwZTp3aW5kb3cteT0iMTkiCiAgICAgaW5rc2NhcGU6d2luZG93LW1heGltaXplZD0iMSIKICAgICBmaXQtbWFyZ2luLXRvcD0iMCIKICAgICBmaXQtbWFyZ2luLWxlZnQ9IjAiCiAgICAgZml0LW1hcmdpbi1yaWdodD0iMCIKICAgICBmaXQtbWFyZ2luLWJvdHRvbT0iMCIKICAgICBpbmtzY2FwZTpzbmFwLXBhZ2U9InRydWUiCiAgICAgaW5rc2NhcGU6c25hcC1ub2Rlcz0idHJ1ZSIKICAgICBncmlkdG9sZXJhbmNlPSIxMCIKICAgICBzaG93Ym9yZGVyPSJ0cnVlIgogICAgIHNob3dndWlkZXM9InRydWUiCiAgICAgaW5rc2NhcGU6Z3VpZGUtYmJveD0idHJ1ZSI+CiAgICA8aW5rc2NhcGU6Z3JpZAogICAgICAgdHlwZT0ieHlncmlkIgogICAgICAgaWQ9ImdyaWQzMDIxIgogICAgICAgZW1wc3BhY2luZz0iNCIKICAgICAgIHZpc2libGU9InRydWUiCiAgICAgICBlbmFibGVkPSJ0cnVlIgogICAgICAgc25hcHZpc2libGVncmlkbGluZXNvbmx5PSJ0cnVlIgogICAgICAgc3BhY2luZ3g9IjE2cHgiCiAgICAgICBzcGFjaW5neT0iMTZweCIKICAgICAgIGRvdHRlZD0idHJ1ZSIgLz4KICA8L3NvZGlwb2RpOm5hbWVkdmlldz4KICA8bWV0YWRhdGEKICAgICBpZD0ibWV0YWRhdGE3Ij4KICAgIDxyZGY6UkRGPgogICAgICA8Y2M6V29yawogICAgICAgICByZGY6YWJvdXQ9IiI+CiAgICAgICAgPGRjOmZvcm1hdD5pbWFnZS9zdmcreG1sPC9kYzpmb3JtYXQ+CiAgICAgICAgPGRjOnR5cGUKICAgICAgICAgICByZGY6cmVzb3VyY2U9Imh0dHA6Ly9wdXJsLm9yZy9kYy9kY21pdHlwZS9TdGlsbEltYWdlIiAvPgogICAgICAgIDxkYzp0aXRsZT48L2RjOnRpdGxlPgogICAgICA8L2NjOldvcms+CiAgICA8L3JkZjpSREY+CiAgPC9tZXRhZGF0YT4KICA8ZwogICAgIGlua3NjYXBlOmxhYmVsPSJMYXllciAxIgogICAgIGlua3NjYXBlOmdyb3VwbW9kZT0ibGF5ZXIiCiAgICAgaWQ9ImxheWVyMSIKICAgICB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtMTMzNi41Nzg1LC05NTYuMzUxODkpIj4KICAgIDxwYXRoCiAgICAgICBzdHlsZT0iY29sb3I6IzAwMDAwMDtmaWxsOnVybCgjcmFkaWFsR3JhZGllbnQzMjA5KTtmaWxsLW9wYWNpdHk6MTtmaWxsLXJ1bGU6bm9uemVybztzdHJva2U6bm9uZTttYXJrZXI6bm9uZTt2aXNpYmlsaXR5OnZpc2libGU7ZGlzcGxheTppbmxpbmU7b3ZlcmZsb3c6dmlzaWJsZTtlbmFibGUtYmFja2dyb3VuZDphY2N1bXVsYXRlIgogICAgICAgZD0ibSAxMzUyLjU3ODUsOTU2LjM1MTg5IDAuMjg4NiwxNS4xMzYyOSAxMy41NjY4LC03LjEzNTE2IC0xMy44NTU0LC04LjAwMTEzIHogbSAwLDAgLTEzLjg1NTQsOC4wMDExMyAxMy41NjY3LDcuMTM1MTYgMC4yODg3LC0xNS4xMzYyOSB6IG0gLTEzLjg1NTQsOC4wMDExMyAwLDE1Ljk5Nzc0IDEyLjk1NzksLTcuODE2MjEgLTEyLjk1NzksLTguMTgxNTMgeiBtIDAsMTUuOTk3NzQgMTMuODU1NCw4LjAwMTEzIC0wLjYwODksLTE1LjMxNjcgLTEzLjI0NjUsNy4zMTU1NyB6IG0gMTMuODU1NCw4LjAwMTEzIDEzLjg1NTQsLTguMDAxMTMgLTEzLjI1MSwtNy4zMTU1NyAtMC42MDQ0LDE1LjMxNjcgeiBtIDEzLjg1NTQsLTguMDAxMTMgMCwtMTUuOTk3NzQgLTEyLjk2MjQsOC4xODE1MyAxMi45NjI0LDcuODE2MjEgeiIKICAgICAgIGlkPSJwYXRoNDAxNi0zLTgtNiIKICAgICAgIGlua3NjYXBlOmNvbm5lY3Rvci1jdXJ2YXR1cmU9IjAiIC8+CiAgPC9nPgo8L3N2Zz4K',
    widgetCss: '/** encoding:utf-8 **/ #remotestorage-widget, #remotestorage-widget *{-moz-box-sizing:border-box;box-sizing:border-box;}#remotestorage-widget{position:absolute;right:10px;top:10px;font:normal 16px/100% sans-serif;user-select:none;-webkit-user-select:none;-moz-user-select:-moz-none;cursor:default;z-index:10000;}#remotestorage-widget .bubble{background:rgba(80, 80, 80, .7);border-radius:5px 15px 5px 5px;color:white;font-size:0.8em;padding:5px;position:absolute;right:3px;top:9px;min-height:24px;white-space:nowrap;text-decoration:none;}#remotestorage-widget .bubble-text{padding-right:32px;}#remotestorage-widget .bubble.one-line{padding-bottom:2px;}#remotestorage-widget .bubble.hidden{display:none;}#remotestorage-widget:hover .bubble.hidden{display:block;}#remotestorage-widget .action{cursor:pointer;}#remotestorage-widget .cube{position:absolute;top:5px;right:0;}#remotestorage-widget .cube.spinning{-webkit-animation-name:remotestorage-loading;-webkit-animation-duration:2s;-webkit-animation-iteration-count:infinite;-webkit-animation-timing-function:linear;-moz-animation-name:remotestorage-loading;-moz-animation-duration:2s;-moz-animation-iteration-count:infinite;-moz-animation-timing-function:linear;-o-animation-name:remotestorage-loading;-o-animation-duration:2s;-o-animation-iteration-count:infinite;-o-animation-timing-function:linear;-ms-animation-name:remotestorage-loading;-ms-animation-duration:2s;-ms-animation-iteration-count:infinite;-ms-animation-timing-function:linear;}@-webkit-keyframes remotestorage-loading{from{-webkit-transform:rotate(0deg)}to{-webkit-transform:rotate(360deg)}}@-moz-keyframes remotestorage-loading{from{-moz-transform:rotate(0deg)}to{-moz-transform:rotate(360deg)}}@-o-keyframes remotestorage-loading{from{-o-transform:rotate(0deg)}to{-o-transform:rotate(360deg)}}@-ms-keyframes remotestorage-loading{from{-ms-transform:rotate(0deg)}to{-ms-transform:rotate(360deg)}}#remotestorage-widget a{text-decoration:underline;color:inherit;}#remotestorage-widget form{margin-top:0.7em;}#remotestorage-widget form input{display:table-cell;vertical-align:top;border:none;border-radius:6px;font-weight:bold;color:white;outline:none;line-height:1.5em;height:2em;}#remotestorage-widget form input:disabled{color:#999;background:#444 !important;cursor:default !important;}#remotestorage-widget form input[type=email]{background:#000;width:16em;padding:0 5px;margin-right:5px;}#remotestorage-widget button:focus, #remotestorage-widget input:focus{box-shadow:0 0 4px #ccc;}#remotestorage-widget form input[type=email]::-webkit-input-placeholder{color:#999;}#remotestorage-widget form input[type=email]:-moz-placeholder{color:#999;}#remotestorage-widget form input[type=email]::-moz-placeholder{color:#999;}#remotestorage-widget form input[type=email]:-ms-input-placeholder{color:#999;}#remotestorage-widget form input[type=submit]{background:#000;cursor:pointer;padding:0 5px;}#remotestorage-widget form input[type=submit]:hover{background:#333;}#remotestorage-widget .info{font-size:10px;color:#ddd;margin-top:0.7em;white-space:normal;}#remotestorage-widget .info.last-synced-message{white-space:nowrap;margin-bottom:.7em}#remotestorage-widget .info.error{font-weight:bold;color:#f92;}#remotestorage-widget .info a:hover, #remotestorage-widget .info a:active{color:#fff;}#remotestorage-widget .bubble button{border:none;border-radius:6px;font-weight:bold;color:white;outline:none;line-height:1.5em;height:2em;background:#000;cursor:pointer;margin:0;padding:0 5px;}#remotestorage-widget .bubble button:hover{background:#333;}#remotestorage-widget .bubble button.sync{margin-right:5px;}#remotestorage-widget pre{user-select:initial;-webkit-user-select:initial;-moz-user-select:text;max-width:27em;margin-top:1em;overflow:auto;}'
}
});

define('lib/i18n/locales/en',[], function() {
  return {
    strings: {
      widget: {
        // Bubble text in initial state
        'connect-remotestorage': 'Connect <strong>remotestorage</strong>',
        // Connect button label
        'connect': 'connect',
        'sync': 'sync',
        'disconnect': 'disconnect',
        'permissions': 'Permissions',
        'all-data': 'All data',
        'synchronizing': 'Synchronizing <strong>{userAddress}</strong>',
        'connecting': 'Connecting <strong>{userAddress}</strong>...',
        'offline': '<strong>{userAddress}</strong> (offline)',
        'unauthorized': 'Unauthorized! Click to reconnect.',
        'redirecting': 'Redirecting to <strong>{hostName}</strong>...',
        'typing-hint': 'This app allows you to use your own storage! Find more info on <a href="http://remotestorage.io/">remotestorage.io</a>',
        'last-synced': '<strong>Last synced:</strong> {t}',
        'webfinger-failed': "Failed to connect to storage server: {message}",
        'webfinger-error-no-at': "there is no @-sign in the user address.",
        'webfinger-error-multiple-at': "there is more than one @-sign in the user address.",
        'webfinger-error-non-dotalphanum': "there is more than one @-sign in the user address.",
        'webfinger-error-invalid-xml': "the XML returned by the server is invalid",
        'webfinger-error-invalid-jrd': "the JRD returned by the server is invalid",
        'webfinger-error-requests-failed': "failed to contact the storage server",
        'webfinger-error-not-supported': "server doesn't support remotestorage",
        'error': 'Sorry! An error occurred.'
      }
    },

    helpers: {
      timeAgo: function(usec) {
        function format(time, unit) {
          time = Math.round(time);
          if(time != 1) {
            unit += 's';
          }
          return time + ' ' + unit + ' ago';
        }
        var sec = usec / 1000;
        if(sec > 3600) {
          return  format(sec / 3600, 'hour')
        } else if(sec > 60) {
          return format(sec / 60, 'minute');
        } else {
          return format(sec, 'second');
        }
      }
    }
  };
});

define('lib/i18n/locales/de',[], function() {
  return {
    strings: {
      widget: {
        'connect-remotestorage': 'Verbinde <strong>remotestorage</strong>',
        'connect': 'Verbinden',
        'sync': 'Sync',
        'disconnect': 'Verbindung trennen',
        'permissions': "Zugriffsrechte",
        'all-data': "Alle Daten",
        'synchronizing': 'Synchronisiere <strong>{userAddress}</strong>',
        'connecting': 'Verbinde <strong>{userAddress}</strong>...',
        'offline': '<strong>{userAddress}</strong> (offline)',
        'unauthorized': 'Zugriff fehlgeschlagen. Klicke um neu zu verbinden.',
        'redirecting': 'Leite weiter zu <strong>{hostName}</strong>...',
        'typing-hint': 'Du kannst diese App mit deinem eigenen Cloud-Storage verbinden! Mehr Infos auf <a href="http://remotestorage.io/">remotestorage.io</a>',
        'last-synced': '<strong>Zuletzt synchronisiert:</strong> {t}',
        'webfinger-failed': 'Konnte deinen storage nicht finden. Bist du sicher, dass die Adresse stimmt?'
      }
    },

    helpers: {
      timeAgo: function(usec) {
        function format(time, unit) {
          time = Math.round(time);
          if(time != 1) {
            unit += 'n';
          }
          return 'vor ' + time + ' ' + unit;
        }
        var sec = usec / 1000;
        if(sec > 3600) {
          return format(sec / 2600, 'Stunde'); 
        } else if(sec > 60) {
          return format(sec / 60, 'Minute');
        } else {
          return format(sec, 'Sekunde');
        }
      }
    }
  };
});

define('lib/i18n/locales',[
  './locales/en',
  './locales/de'
], function(en, de) {
  return {
    translations: {
      en: en.strings,
      de: de.strings
    },

    helpers: {
      en: en.helpers,
      de: de.helpers
    }
  }
});
define('lib/i18n',[
  './util',
  './i18n/locales'
], function(util, locales) {

  // Namespace: i18n
  //
  // Internationalization & Localization for remoteStorage.js
  //

  var settings = util.getSettingStore('remotestorage_i18n');

  var translations = locales.translations;
  var helpers = locales.helpers;

  var defaultLocale = 'en';
  var storedLocale = settings.get('locale');

  var currentTable = translations[storedLocale || defaultLocale];

  var NotFound = function(keyPath) {
    this.message = "Translation not found: " + keyPath.join(', ');
  };

  var UndefinedLocale = function(locale) {
    Error.apply(this, ["Locale not defined: " + locale]);
  };
  UndefinedLocale.prototype = Error.prototype;

  return {

    // Property: helpers
    // Object of helpers for i18n/l10n.
    // Do not cache or extend this property, it gets replaced when the locale
    // changes.
    //
    // Methods:
    //   timeAgo(usec) - Example: timeAgo(3000); // -> "3 seconds ago"
    //
    helpers: helpers[storedLocale || defaultLocale],

    // Property: defaultLocale
    // Default locale to use when detection fails.
    // Initially set to 'en'.
    defaultLocale: defaultLocale,

    // Property: locales
    // Array of available locales.
    locales: Object.keys(translations),

    // Method: getLocale
    // Get currently used locale.
    getLocale: function() {
      return settings.get('locale') || this.defaultLocale;
    },

    // Method: setLocale
    // Set locale.
    //
    // Parameters:
    //   locale - A string. Must be included in <locales>.
    //
    // Throws <UndefinedLocale> when the locale is unknown.
    setLocale: function(locale) {
      if(! (locale in translations)) {
        throw new Error("Locale not found: " + locale);
      }
      currentTable = translations[locale];
      this.helpers = helpers[locale];
      settings.set('locale', locale);
    },

    // Method: autoDetect
    // Automatically determines and sets locale.
    // This won't overwrite a stored locale.
    autoDetect: function() {
      var locale;
      ( storedLocale || (
        (locale = this.detectLocale()) &&
          (locale in translations) &&
          this.setLocale(locale) ) );
    },

    // Method: detectLocale
    //
    // Detects current locale from environment.
    //
    // Sources:
    //   (nodejs)  - process.env.LANG
    //   (browser) - navigator.language
    //
    // Returns:
    //   a locale string or undefined.
    detectLocale: function() {
      var key;
      if(typeof(navigator) !== 'undefined') {
        key = navigator.language.split('-')[0];
      } else if(typeof(process) !== 'undefined') {
        var lang = process.env.LANG;
        if(lang) {
          key = lang.split('_')[0];
        }
      }
      return key;
    },

    // Method: t
    // Look up a translation.
    //
    // Parameters:
    //   (any number of strings) - list of keys to follow in translation tree
    //   variables - (optional) Object, containing variables to replae.
    //
    // Example:
    //   (start code)
    //   // given the translations are as follows:
    //   {
    //     "a": {
    //       "b": {
    //         "c": "Hello {who}!"
    //       }
    //     }
    //   }
    //
    //   // Then the following call:
    //   i18n.t('a', 'b', 'c', { who: 'World' });
    //
    //   // returns:
    //   "Hello World!"
    //
    //
    t: function() {
      try {
        var keys = util.toArray(arguments);
        var last = keys.slice(-1)[0];
        var replacements;
        if(typeof(last) === 'object') {
          replacements = last;
          keys = keys.slice(0, -1);
        }
        var result = currentTable;
        keys.forEach(function(key, index) {
          result = result[key];
          if(! result) {
            console.log("Translation not found in ", result, '(', currentTable, ')', keys, key, index);
            throw new NotFound(keys.slice(0, index + 1));
          }
        });
        if(replacements) {
          for(var k in replacements) {
            var re = new RegExp('\\{' + k + '\\}');
            result = result.replace(re, replacements[k]);
          }
        }
        return result;
      } catch(exception) {
        if(exception instanceof NotFound) {
          return exception.message;
        } else {
          throw exception;
        }
      }
    },

    // Method: clearSettings
    // Clear cached locale settings.
    // Doesn't reset the current in-memory state
    // (i.e. current locale and default locale)
    clearSettings: settings.clear,

    // Exception: UndefinedLocale
    // Thrown when trying to set a locale that isn't defined.
    //
    // Own properties:
    //   locale - the locale string as passed to <setLocale>
    UndefinedLocale: UndefinedLocale
  };
});

define('lib/widget/default',['../util', '../assets', '../i18n'], function(util, assets, i18n) {

  if(typeof(document) === 'undefined') {
    return { display: function() { throw "Widget not supported"; } };
  }

  /*

    Interface: WidgetView

      A stateful view providing interaction with remotestorage.

    States:
      initial      - not connected
      authing      - in auth flow
      connected    - connected to remotestorage, not syncing at the moment
      busy         - connected, syncing at the moment
      offline      - connected, but no network connectivity
      error        - connected, but sync error happened
      unauthorized - connected, but request returned 401


    Event: connect
      Fired when the "connect" action is caused by the user.
    
    Parameters:
      userAddress - The user address to connect to


    Event: disconnect
      Fired when "disconnect" action is requested.


    Event: sync
      Fired when "sync" action is requested


    Event: reconnect
      Fired when reconnect is requested in 'unauthorized' state.


    Method: display
      Display the widget in "initial" state
    
    Parameters:
      domId   - String, id attribute of element to place the widget in (FIXME: put this in the options)
      options - Object, see below.

    Options:
      locale - locale to use. only present when provided by app.


    Method: setState
      Set widget state to given value.

    Parameters:
      state - a string. one of the states listed above.

    Method: redirectTo
      Navigate to given url.

    Parameters:
      url - a string representing https URL to redirect to.

   */

  var gEl = util.bind(document.getElementById, document);
  var cEl = util.bind(document.createElement, document);

  var t = util.curry(i18n.t, 'widget');

  var events = util.getEventEmitter('connect', 'disconnect', 'sync', 'reconnect');

  var browserEvents = [];

  var widgetOptions = {};

  function escape(s) {
    return s.replace(/>/, '&gt;').replace(/</, '&lt;');
  }

  function addEvent(element, eventName, handler) {
    browserEvents.push([element, eventName, handler]);
    element.addEventListener(eventName, handler);
  }

  function clearEvents() {
    browserEvents.forEach(function(event) {
      event[0].removeEventListener(event[1], event[2]);
    });
    browserEvents = [];
  }

  var userAddress = '';

  var currentState = 'initial';

  var elements = {};

  var cubeStateIcons = {
    connected: assets.remotestorageIcon,
    error: assets.remotestorageIconError,
    offline: assets.remotestorageIconOffline
  };

  var stateViews = {

    initial: function() {
      userAddress = '';

      addClass(elements.bubble, 'one-line');

      setBubbleText(t('connect-remotestorage'));
      setBubbleAction(jumpAction('typing'));

      setCubeState('connected');
      setCubeAction(jumpAction('typing'));
    },

    typing: function(connectionError) {
      elements.connectForm.userAddress.setAttribute('value', userAddress);
      setBubbleText(t('connect-remotestorage'));
      elements.bubble.appendChild(elements.connectForm);
      addEvent(elements.connectForm, 'submit', function(event) {
        event.preventDefault();
        userAddress = elements.connectForm.userAddress.value;
        events.emit('connect', userAddress);
      });

      if(connectionError) {
        // error bubbled from webfinger
        setCubeState('error');
        addClass(
          addBubbleHint(t('webfinger-failed', { message: t('webfinger-error-' + connectionError) })),
          'error'
        );
      } else {
        setCubeState('connected');
        addBubbleHint(t('typing-hint'));
      }

      setCubeAction(jumpAction('initial'));

      elements.connectForm.userAddress.focus();
    },

    authing: function() {
      setBubbleText(t('connecting', { userAddress: userAddress }));
      elements.bubble.appendChild(elements.connectForm);
      elements.connectForm.userAddress.setAttribute('disabled', 'disabled');
      elements.connectForm.connect.setAttribute('disabled', 'disabled');
      elements.connectForm.userAddress.setAttribute('value', userAddress);
      setCubeState('connected');
      addClass(elements.cube, 'spinning');
    },

    connected: function() {
      if(widgetOptions.syncShortcut !== false) {
        addEvent(window, 'keydown', function(evt) {
          if(evt.ctrlKey && evt.which == 83) {
            evt.preventDefault();
            events.emit('sync');
            return false;
          }
        });
      }
      addClass(elements.bubble, 'hidden');

      setCubeState('connected');

      setBubbleText('<strong class="userAddress">' + userAddress + '</strong>');

      var content = cEl('div');
      addClass(content, 'content');

      var hint = cEl('div');
      addClass(hint, 'info last-synced-message');

      function updateLastSynced() {
        hint.innerHTML = t('last-synced', { t: i18n.helpers.timeAgo(
          new Date().getTime() - widgetOptions.getLastSyncAt()
        ) });
      }
      addEvent(elements.bubble, 'mouseover', updateLastSynced);

      updateLastSynced();

      content.appendChild(hint);

      content.appendChild(elements.syncButton);
      content.appendChild(elements.disconnectButton);
      addEvent(elements.syncButton, 'click', function() {
        events.emit('sync');
      });
      addEvent(elements.disconnectButton, 'click', disconnectAction);

      elements.bubble.appendChild(content);

      var visible = false;
      setCubeAction(function() {
        if(visible) {
          addClass(elements.bubble, 'hidden');
        } else {
          removeClass(elements.bubble, 'hidden');
        }
        visible = !visible;
      });
    },

    busy: function(initialSync) {
      setCubeState('connected');
      addClass(elements.cube, 'spinning');
      addClass(elements.bubble, 'one-line');
      if(initialSync) {
        setBubbleText(t('connecting', { userAddress: userAddress }));
      } else {
        addClass(elements.bubble, 'hidden');
        setBubbleText(t('synchronizing', { userAddress: userAddress }));
      }
    },

    error: function(error) {
      setCubeState('error');
      setBubbleText(t('error'));
      var trace = cEl('pre');
      elements.bubble.appendChild(trace);
      if(error instanceof Error) {
        trace.innerHTML = '<strong>' + escape(error.message) + '</strong>' +
          "\n" + escape(error.stack);
      } else if(typeof(error) === 'object') {
        trace.innerHTML = JSON.stringify(error, null, 2);
      } else {
        trace.innerHTML = error;
      }
    },

    offline: function(error) {
      setCubeState('offline');
      addClass(elements.bubble, 'one-line hidden');
      var visible = false;
      setCubeAction(function() {
        if(visible) {
          addClass(elements.bubble, 'hidden');
        } else {
          removeClass(elements.bubble, 'hidden');
        }
        visible = !visible;
      });
      setBubbleText(t('offline', { userAddress: userAddress }));
    },

    unauthorized: function() {
      setCubeState('error');
      setBubbleText('<strong>' + userAddress + '</strong><br>' + t('unauthorized') + '<br>');
      setCubeAction(util.curry(events.emit, 'reconnect'));
      setBubbleAction(util.curry(events.emit, 'reconnect'));
      elements.bubble.appendChild(elements.disconnectButton);
      addEvent(elements.disconnectButton, 'click', disconnectAction);
    }

  };

  function disconnectAction(event) {
    event.preventDefault();
    events.emit('disconnect');
    if(currentState === 'error') {
      setState('initial');
    }
    return false;
  }

  function getClassNameMap(element) {
    var classNames = (element.getAttribute('class') || '').split(/\s+/);
    var nameMap = {};
    classNames.forEach(function(name) {
      nameMap[name] = true;
    });    
    return nameMap;
  }

  function setClassNameMap(element, nameMap) {
    element.setAttribute('class', Object.keys(nameMap).join(' '));
  }

  function addClass(element, className) {
    var nameMap = getClassNameMap(element);
    nameMap[className] = true;
    setClassNameMap(element, nameMap);
  }

  function removeClass(element, className) {
    var nameMap = getClassNameMap(element);
    delete nameMap[className];
    setClassNameMap(element, nameMap);
  }

  function resetElementState() {
    elements.cube.setAttribute('class', 'cube');
    elements.bubble.setAttribute('class', 'bubble');
    elements.connectForm.userAddress.setAttribute('value', '');

    elements.connectForm.userAddress.removeAttribute('disabled');
    elements.connectForm.connect.removeAttribute('disabled');

    elements.connectForm.connect.value = t('connect');
    elements.syncButton.innerHTML = t('sync');
    elements.disconnectButton.innerHTML = t('disconnect');
  }
  
  function prepareWidget() {
    elements.style = cEl('style');
    elements.style.innerHTML = assets.widgetCss;
    // #remotestorage-widget
    elements.widget = cEl('div');
    elements.widget.setAttribute('id', 'remotestorage-widget');
    // .cube
    elements.cube = cEl('img');
    // .bubble
    elements.bubble = cEl('div');

    elements.widget.appendChild(elements.bubble);
    elements.widget.appendChild(elements.cube);

    // form.connect
    elements.connectForm = cEl('form');
    elements.connectForm.setAttribute('novalidate', '');
    elements.connectForm.innerHTML = [
      '<input type="email" placeholder="user@host" name="userAddress" novalidate>',
      '<input type="submit" value="" name="connect">'
    ].join('');
    // button.sync
    elements.syncButton = cEl('button');
    elements.syncButton.setAttribute('class', 'sync');
    // button.disconnect
    elements.disconnectButton = cEl('button');
    elements.disconnectButton.setAttribute('class', 'disconnect');

    resetElementState();
  }

  function clearWidget() {
    Array.prototype.forEach.call(elements.bubble.children, function(child) {
      elements.bubble.removeChild(child);
    });
    clearEvents();
    resetElementState();
  }

  function updateWidget() {
    var stateView = stateViews[currentState];
    if(stateView) {
      clearWidget();
      stateView.apply(this, arguments);
    }
  }

  function addBubbleHint(text) {
    var hint = cEl('div');
    addClass(hint, 'info');
    hint.innerHTML = text;
    elements.bubble.appendChild(hint);
    return hint;
  }

  function setBubbleText(text) {
    elements.bubble.innerHTML = '<div class="bubble-text">' + text + '</div>';
  }

  function setBubbleAction(action) {
    addClass(elements.bubble, 'action');
    addEvent(elements.bubble, 'click', action);
  }

  function setCubeAction(action) {
    addClass(elements.cube, 'action');
    addEvent(elements.cube, 'click', action);
  }

  function setCubeState(state) {
    var icon = cubeStateIcons[state];
    if(! icon) {
      throw "Unknown cube state: " + state;
    }
    elements.cube.setAttribute('src', icon);
  }

  function jumpAction(state) {
    return function(event) {
      if(event) {
        event.preventDefault();
      }
      setState(state);
      return false;
    };
  }

  // PUBLIC

  function display(domId, options) {
    if(! options) {
      options = {};
    }
    widgetOptions = options;

    i18n.setLocale('en');

    prepareWidget();
    gEl(domId).appendChild(elements.style);
    gEl(domId).appendChild(elements.widget);
    updateWidget();
  }

  function setState(state) {
    var args = Array.prototype.slice.call(arguments, 1);
    currentState = state;
    util.nextTick(function() {
      updateWidget.apply(undefined, args);
    });
  }

  function redirectTo(url) {
    setBubbleText(t('redirecting', { hostName: util.hostNameFromUri(url) }));
    addClass(elements.bubble, 'one-line');
    setTimeout(function() {
      document.location = url;
    }, 500);
  }

  function setUserAddress(addr) {
    userAddress = addr;
    elements.connectForm.userAddress.setAttribute('value', addr);
  }

  function getLocation() {
    return document.location.href;
  }

  function setLocation(url) {
    document.location = url;
  }

  return util.extend({

    display: display,
    setState: setState,
    redirectTo: redirectTo,
    setUserAddress: setUserAddress,
    getLocation: getLocation,
    setLocation: setLocation

  }, events);

});

define('lib/widget',[
  './util',
  './webfinger',
  './wireClient',
  './sync',
  './schedule',
  './baseClient',
  './platform',
  './getputdelete',
  './widget/default'
], function(util, webfinger, wireClient, sync, schedule, BaseClient,
            platform, getputdelete, defaultView) {

  // Namespace: widget
  //
  // The remotestorage widget.
  //
  // See <remoteStorage.displayWidget>
  //

  

  var settings = util.getSettingStore('remotestorage_widget');
  var events = util.getEventEmitter('ready', 'state');
  var logger = util.getLogger('widget');

  // the view.
  var view = defaultView;
  // options passed to displayWidget
  var widgetOptions = {};
  // passed to display() to avoid circular deps
  var remoteStorage;

  var reconnectInterval = 10000;

  var offlineTimer = null;

  var viewState;

  var stateActions = {
    offline: function() {
      if(! offlineTimer) {
        offlineTimer = setTimeout(function() {
          offlineTimer = null;
          sync.fullSync();
        }, reconnectInterval);
      }
    },
    connected: function() {
      if(offlineTimer) {
        clearTimeout(offlineTimer);
        offlineTimer = null;
      }
    }
  };
  

  function setState(state) {
    if(state === viewState) {
      return;
    }
    viewState = state;
    var action = stateActions[state];
    if(action) {
      action.apply(null, arguments);
    }
    view.setState.apply(view, arguments);
    events.emit('state', state);    
  }

  function buildScopeRequest() {
    var scopes = remoteStorage.claimedModules;
    return Object.keys(remoteStorage.claimedModules).map(function(module) {
      return (module === 'root' ? '' : module) + ':' + scopes[module];
    }).join(' ');
  }

  function requestToken(authEndpoint) {
    logger.info('requestToken', authEndpoint);
    var redirectUri = view.getLocation().split('#')[0];
    var clientId = util.hostNameFromUri(redirectUri);
    authEndpoint += authEndpoint.indexOf('?') > 0 ? '&' : '?';
    authEndpoint += [
      ['redirect_uri', redirectUri],
      ['client_id', clientId],
      ['scope', buildScopeRequest()],
      ['response_type', 'token']
    ].map(function(kv) {
      return kv[0] + '=' + encodeURIComponent(kv[1]);
    }).join('&');
    return view.redirectTo(authEndpoint);
  }

  function connectStorage(userAddress) {
    settings.set('userAddress', userAddress);
    setState('authing');
    return webfinger.getStorageInfo(userAddress).
      then(wireClient.setStorageInfo, util.curry(setState, 'typing')).
      get('properties').get('auth-endpoint').
      then(requestToken).
      then(schedule.enable, util.curry(setState, 'error'));
  }

  function reconnectStorage() {
    connectStorage(settings.get('userAddress'));
  }

  function disconnectStorage() {
    schedule.disable();
    remoteStorage.flushLocal();
    events.emit('state', 'disconnected');
  }

  // destructively parse query string from URI fragment
  function parseParams() {
    var md = view.getLocation().match(/^(.*?)#(.*)$/);
    var result = {};
    if(md) {
      var hash = md[2];
      hash.split('&').forEach(function(param) {
        var kv = param.split('=');
        if(kv[1]) {
          result[kv[0]] = decodeURIComponent(kv[1]);
        }
      });
      if(Object.keys(result).length > 0) {
        view.setLocation(md[1] + '#');
      }
    }
    return result; 
  }

  function processParams() {
    var params = parseParams();

    // Query parameter: access_token
    if(params.access_token) {
      wireClient.setBearerToken(params.access_token);
    }
    // Query parameter: storage_root, storage_api
    if(params.storage_root && params.storage_api) {
      wireClient.setStorageInfo({
        type: params.storage_api,
        href: params.storage_root
      });
    }
    // Query parameter: authorize_endpoint
    if(params.authorize_endpoint) {
      requestToken(params.authorize_endpoint);
    }
    // Query parameter: user_address
    if(params.user_address) {
      view.setUserAddress(params.user_address);
    } else {
      var userAddress = settings.get('userAddress');
      if(userAddress) {
        view.setUserAddress(userAddress);
      }
    }
  }

  function handleSyncError(error) {
    if(error.message === 'unauthorized') {
      setState('unauthorized');
    } else if(error.message === 'network error') {
      setState('offline', error);
    } else {
      setState('error', error);
    }
  }

  function handleSyncTimeout() {
    schedule.disable();
    setState('offline');
  }

  function initialSync() {
    setState('busy', true);
    sync.forceSync().then(function() {
      schedule.enable();
      events.emit('ready');
    }, handleSyncError);
  }

  function display(_remoteStorage, domId, options) {
    remoteStorage = _remoteStorage;
    widgetOptions = options;
    if(! options) {
      options = {};
    }

    options.getLastSyncAt = function() {
      return sync.lastSyncAt && sync.lastSyncAt.getTime();
    };

    schedule.watch('/', 30000);

    view.display(domId, options);

    view.on('sync', sync.forceSync);
    view.on('connect', connectStorage);
    view.on('disconnect', disconnectStorage);
    view.on('reconnect', reconnectStorage);

    sync.on('busy', util.curry(setState, 'busy'));
    sync.on('ready', util.curry(setState, 'connected'));
    wireClient.on('connected', function() {
      setState('connected');
      initialSync();
    });
    wireClient.on('disconnected', util.curry(setState, 'initial'));

    BaseClient.on('error', util.curry(setState, 'error'));
    sync.on('error', handleSyncError);
    sync.on('timeout', handleSyncTimeout);

    processParams();

    wireClient.calcState();
  }
  
  return util.extend({
    display : display,

    clearSettings: settings.clear,

    setView: function(_view) {
      view = _view;
    }
  }, events);
});

/*global console */

define('lib/nodeConnect',['./wireClient', './webfinger'], function(wireClient, webfinger) {

  

  // Namespace: nodeConnect
  //
  // Exposes some internals of remoteStorage.js to allow using it from nodejs.
  //
  // Example:
  //   (start code)
  //
  //   remoteStorage.nodeConnect.setUserAddress('bob@example.com', function(err) {
  //     if(! err) {
  //       remoteStorage.nodeConnect.setBearerToken("my-crazy-token");
  //
  //       console.log("Connected!");
  //
  //       // it's your responsibility to make sure the token given above
  //       // actually allows gives you that access. this line is just to
  //       // inform remoteStorage.js about it:
  //       remoteStorage.claimAccess('contacts', 'r');
  //
  //       console.log("My Contacts: ",
  //         remoteStorage.contacts.list().map(function(c) {
  //           return c.fn }));
  //     }
  //   });
  //
  //   (end code)

  return {

    // Method: setUserAddress
    //
    // Set user address and discover storage info.
    //
    // Parameters:
    //   userAddress - the user address as a string
    //   callback    - callback to call once finished
    //
    // As soon as the callback is called, the storage info has been discovered or an error has happened.
    // It receives a single argument, the error. If it's null or undefined, everything is ok.
    setUserAddress: function(userAddress, callback) {
      webfinger.getStorageInfo(userAddress, { timeout: 3000 }, function(err, data) {
        if(err) {
          console.error("Failed to look up storage info for user " + userAddress + ": ", err);
        } else {
          wireClient.setStorageInfo(data.type, data.href);
        }

        callback(err);
      });
    },

    // Method: setStorageInfo
    //
    // Set storage info directly.
    //
    // This can be used, if your storage provider doesn't support Webfinger or you
    // simply don't want the extra overhead of discovery.
    //
    // Parameters:
    //   type - type of storage. If your storage supports remotestorage 2012.04, this is "https://www.w3.org/community/rww/wiki/read-write-web-00#simple"
    //   href - base URL of your storage
    //   
    setStorageInfo: wireClient.setStorageInfo,

    // Method: setBearerToken
    //
    // Set bearer token directly.
    //
    setBearerToken: wireClient.setBearerToken

  };

});
define('lib/foreignClient',['./util', './baseClient', './getputdelete', './store'], function(util, BaseClient, getputdelete, store) {

  var logger = util.getLogger('foreignClient');

  var knownClients = {};

  store.on('foreign-change', function(event) {
    var userAddress = event.path.split(':')[0];
    var client = knownClients[userAddress];
    if(client) {
      client.events.emit('change', event);
    }
  });

  /*
    Class: ForeignClient
    
    A modified <BaseClient>, to query other people's storage.
   */

  // Constructor: ForeignClient
  //
  // Parameters:
  //   userAddress - A userAddress string in the form user@host.
  //
  // The userAddress must be known to wireClient.
  //
  var ForeignClient = function(userAddress) {
    this.userAddress = userAddress;
    this.pathPrefix = userAddress + ':';

    this.moduleName = 'root', this.isPublic = true;
    this.events = util.getEventEmitter('change', 'error');
    knownClients[userAddress] = this;
    util.bindAll(this);
  };
  
  ForeignClient.prototype = {

    // Method: getPublished
    //
    // Get the 'publishedItems' object for the given module.
    //
    // publishedItems is an object of the form { path : timestamp, ... }.
    //
    // Parameters:
    //   moduleName - (optional) module name to get the publishedItems object for
    //   callback   - callback to call with the result
    //
    // Example:
    //   (start code)
    //   remoteStorage.getForeignClient('user@host', function(client) {
    //     client.getPublished(object, function(publishedItems) {
    //       for(var key in publishedItems) {
    //         console.log("Item: ", key, " published at: ", publishedItems[key]);
    //       }
    //     });
    //   });
    //   (end code)
    getPublished: function(moduleName, callback) {
      var fullPath;
      if(typeof(moduleName) == 'function') {
        callback = moduleName;
        fullPath = '/publishedItems';
      } else {
        fullPath = '/' + moduleName + '/publishedItems';
      }
      this.getObject(fullPath, function(data) {
        if(data) { delete data['@type']; }
        callback(data || {});
      });
    },

    getPublishedObjects: function(moduleName, callback) {
      this.getPublished(moduleName, function(list) {
        var paths = Object.keys(list);
        var i = 0;
        var objects = {};
        function loadOne() {
          if(i < paths.length) {
            var key = paths[i++];
            var path = '/' + moduleName + '/' + key;
            this.getObject(path, function(object) {
              objects[path] = object;
                
              loadOne.call(this);
            }.bind(this));
          } else {
            callback(objects);
          }
        }

        loadOne.call(this);
      }.bind(this));
    },

    makePath: function(path) {
      return this.pathPrefix + BaseClient.prototype.makePath.call(this, path);
    },

    nodeGivesAccess: function(path, mode) {
      return mode == 'r';
    },

    on: function(eventName, handler) {
      this.events.on(eventName, handler);
    }

  };

  var methodBlacklist = {
    makePath: true,
    getListing: true,
    getAll: true,
    storeDocument: true,
    storeObject: true,
    remove: true,
    nodeGivesAccess: true,
    fetchNow: true,
    syncNow: true,
    on: true
  };

  // inherit some stuff from BaseClient

  for(var key in BaseClient.prototype) {
    if(! methodBlacklist[key]) {
      ForeignClient.prototype[key] = BaseClient.prototype[key];
    }
  }

  return {
    getClient: function(userAddress) {
      var client = knownClients[userAddress];
      return client || new ForeignClient(userAddress);
    }
  };

});

define('remoteStorage',[
  'require',
  './lib/widget',
  './lib/store',
  './lib/sync',
  './lib/wireClient',
  './lib/nodeConnect',
  './lib/util',
  './lib/webfinger',
  './lib/foreignClient',
  './lib/baseClient',
  './lib/schedule',
  './lib/i18n'
], function(require, widget, store, sync, wireClient, nodeConnect, util, webfinger, foreignClient, BaseClient, schedule, i18n) {

  

  var claimedModules = {}, modules = {}, moduleNameRE = /^[a-z\-]+$/;

  var logger = util.getLogger('base');

  // Namespace: remoteStorage
  var remoteStorage =  {

    //
    // Method: defineModule
    //
    // Define a new module, with given name.
    // Module names MUST be unique. The given builder will be called
    // immediately, with two arguments, which are both instances of
    // <BaseClient>. The first accesses the private section of a modules
    // storage space, the second the public one. The public area can
    // be read by any client (not just an authenticated one), while
    // it can only be written by an authenticated client with read-write
    // access claimed on it.
    //
    // The builder is expected to return an object, as described under
    // <getModuleInfo>.
    //
    // Parameter:
    //   moduleName - Name of the module to define. MUST be a-z and all lowercase.
    //   builder    - Builder function that holds the module definition.
    //
    // Example:
    //   (start code)
    //
    //   remoteStorage.defineModule('beers', function(privateClient, publicClient) {
    //
    //     function nameToKey(name) {
    //       return name.replace(/\s/, '-');
    //     }
    //
    //     return {
    //       exports: {
    //
    //         addBeer: function(name) {
    //           privateClient.storeObject('beer', nameToKey(name), {
    //             name: name,
    //             drinkCount: 0
    //           });
    //         },
    //
    //         logDrink: function(name) {
    //           var key = nameToKey(name);
    //           var beer = privateClient.getObject(key);
    //           beer.drinkCount++;
    //           privateClient.storeObject('beer', key, beer);
    //         },
    //
    //         publishBeer: function(name) {
    //           var key = nameToKey(name);
    //           var beer = privateClient.getObject(key);
    //           publicClient.storeObject('beer', key, beer);
    //         }
    //
    //       }
    //     }
    //   });
    //
    //   // to use that code from an app, you need to add:
    //
    //   remoteStorage.claimAccess('beers', 'rw');
    //
    //   remoteStorage.displayWidget(/* see documentation */)
    //
    //   remoteStorage.addBeer('<replace-with-favourite-beer-kind>');
    //
    //   (end code)
    //
    // See also:
    //   <BaseClient>
    //
    defineModule: function(moduleName, builder) {

      if(! moduleNameRE.test(moduleName)) {
        throw 'Invalid moduleName: "'+moduleName+'", only a-z lowercase allowed.';
      }

      var module = builder(
        // private client:
        new BaseClient(moduleName, false),
        // public client:
        new BaseClient(moduleName, true)
      );
      modules[moduleName] = module;
      this[moduleName] = module.exports;
    },

    claimedModules: claimedModules,

    //
    // Method: getModuleList
    //
    // list known module names
    //
    // Returns:
    //   Array of module names.
    //
    getModuleList: function() {
      return Object.keys(modules);
    },


    // Method: getClaimedModuleList
    //
    // list of modules currently claimed access on
    //
    // Returns:
    //   Array of module names.
    //
    getClaimedModuleList: function() {
      return Object.keys(claimedModules);
    },

    //
    // Method: getModuleInfo
    //
    // Retrieve meta-information about a given module.
    //
    // If the module doesn't exist, the result will be undefined.
    //
    // Parameters:
    //   moduleName - name of the module
    //
    // Returns:
    //   An object, usually containing the following keys,
    //   * exports - don't ever use this. it's basically the module's instance.
    //   * name - the name of the module, but you knew that already.
    //   * dataHints - an object, describing internas about the module.
    //
    //
    //   Some of the dataHints used are:
    //
    //     objectType <type> - description of an object
    //                         type implemented by the module
    //     "objectType message" - (example)
    //
    //     <attributeType> <objectType>#<attribute> - description of an attribute
    //
    //     "string message#subject" - (example)
    //
    //     directory <path> - description of a path's purpose
    //
    //     "directory documents/notes/" - (example)
    //
    //     item <path> - description of a specific item
    //
    //     "item documents/notes/calendar" - (example)
    //
    //   Hope this helps.
    //
    getModuleInfo: function(moduleName) {
      return modules[moduleName];
    },

    //
    // Method: claimAccess
    //
    // Either:
    //   <claimAccess(moduleName, claim)>
    //
    // Or:
    //   <claimAccess(moduleClaimMap)>
    //
    //
    //
    // Method: claimAccess(moduleName, claim)
    //
    // Claim access on a single module
    //
    // You need to claim access to a module before you can
    // access data from it.
    //
    // Parameters:
    //   moduleName - name of the module. For a list of defined modules, use <getModuleList>
    //   claim      - permission to claim, either *r* (read-only) or *rw* (read-write)
    //
    // Example:
    //   > remoteStorage.claimAccess('contacts', 'r');
    //
    //
    //
    // Method: claimAccess(moduleClaimMap)
    //
    // Claim access to multiple modules.
    //
    // Parameters:
    //   moduleClaimMap - a JSON object with module names as keys and claims as values.
    //
    // Example:
    //   > remoteStorage.claimAccess({
    //   >   contacts: 'r',
    //   >   documents: 'rw',
    //   >   money: 'r'
    //   > });
    //
    claimAccess: function(moduleName, mode) {

      var modeTestRegex = /^rw?$/;
      function testMode(moduleName, mode) {
        if(!modeTestRegex.test(mode)) {
          throw "Claimed access to module '" + moduleName + "' but mode not correctly specified ('" + mode + "').";
        }
      }

      var moduleObj;
      if(typeof moduleName === 'object') {
        moduleObj = moduleName;
      } else {
        testMode(moduleName, mode);
        moduleObj = {};
        moduleObj[moduleName] = mode;
      }

      return util.asyncEach(Object.keys(moduleObj), function(_moduleName) {
        var _mode = moduleObj[_moduleName];
        testMode(_moduleName, _mode);
        return this.claimModuleAccess(_moduleName, _mode);
      }.bind(this));
    },

    // PRIVATE
    claimModuleAccess: function(moduleName, mode) {
      logger.debug('claimModuleAccess', moduleName, mode);
      if(!(moduleName in modules)) {
        throw "Module not defined: " + moduleName;
      }

      if(moduleName in claimedModules) {
        return;
      }

      claimedModules[moduleName] = mode;

      if(moduleName === 'root') {
        moduleName = '';
        return store.setNodeAccess('/', mode).
          then(util.curry(store.setNodeForce, '/', true, true));
      } else {
        var privPath = '/'+moduleName+'/';
        var pubPath = '/public/'+moduleName+'/';
        return store.setNodeAccess(privPath, mode).
          then(util.curry(store.setNodeForce, privPath, true, true)).
          then(util.curry(store.setNodeAccess, pubPath, mode)).
          then(util.curry(store.setNodeForce, pubPath, true, true));
      }
    },

    // PRIVATE
    setBearerToken: function(bearerToken, claimedScopes) {
      wireClient.setBearerToken(bearerToken);
    },

    getBearerToken: function() {
      return wireClient.getBearerToken();
    },

    disconnectRemote : wireClient.disconnectRemote,

    //
    // Method: flushLocal()
    //
    // Forget this ever happened.
    //
    // Delete all locally stored data.
    // This doesn't clear localStorage, just removes everything
    // remoteStorage.js saved there. Other data your app might
    // have put into localStorage stays there.
    //
    // Call this method to implement "logout".
    //
    // If you are using the widget (which you should!), you don't need this.
    //
    // Example:
    //   > remoteStorage.flushLocal();
    //
    flushLocal       : function() {
      return util.makePromise(function(promise) {
        logger.info('flushLocal');
        store.forgetAll().then(promise.fulfill.bind(promise));
        sync.clearSettings();
        widget.clearSettings();
        schedule.reset();
        wireClient.disconnectRemote();
        i18n.clearSettings();
        claimedModules = {};
      });
    },

    //
    // Method: fullSync
    //
    // Synchronize local <-> remote storage.
    //
    // Syncing starts at the access roots (the once you claimed using claimAccess)
    // and moves down the directory tree.
    // Only nodes with a 'force' flag on themselves or one of their ancestors will
    // be synchronized. Use <BaseClient.use> and <BaseClient.release> to set / unset
    // force flags.
    // The actual changes to either local or remote storage happen in the
    // future, so you should attach change handlers on the modules you're
    // interested in.
    //
    // Parameters:
    //   callback - (optional) callback to be notified when synchronization has finished or failed.
    //
    // Example:
    //   >
    //   > remoteStorage.claimAccess('money', 'rw');
    //   >
    //   > remoteStorage.money.on('change', function(changeEvent) {
    //   >   // handle change event (update UI etc)
    //   > });
    //   >
    //   > remoteStorage.fullSync(function(errors) {
    //   >   // handle errors, if any.
    //   > });
    //
    // Yields:
    //   Array of error messages - when errors occured. When fullSync is called and the user is not connected, this is also considered an error.
    //   null - no error occured, synchronization finished gracefully.
    //
    fullSync: sync.fullSync,

    setWidgetView: widget.setView,

    //
    // Method: displayWidget
    //
    // Add the remotestorage widget to the page.
    //
    // Parameters:
    //   domID - DOM ID of element to attach widget elements to
    //   options - Options, as described below.
    //   options.authDialog - Strategy to display OAuth dialog. Either 'redirect', 'popup' or a function. Defaults to 'redirect'. If this is a function, that function will receive the URL of the auth dialog. The OAuth dance will redirect back to the current location, with an access token, so that must be possible.
    //   options.syncShortcut - Whether to setup CTRL+S as a shortcut for immediate sync. Default is true.
    //   options.locale - Locale to use for the widget. Currently ignored.
    //
    // Minimal Example:
    //
    //    *in HTML <body>*
    //    > <div id="remotestorage-connect"></div>
    //
    //    *in the app's JS*
    //    > remoteStorage.displayWidget('remotestorage-connect');
    //
    //    Once you're connected, press CTRL+S to observe the spinning cube :)
    //
    //    *Note* that in real life you would have to call <claimAccess> before calling displayWidget. Otherwise you can't access any actual data.
    //
    // Popup Example:
    //
    //    (using the same markup as above)
    //
    //    > remoteStorage.displayWidget('remotestorage-connect', { authDialog: 'popup' });
    //
    displayWidget: function(domId, options) {
      widget.display(remoteStorage, domId, util.extend({}, options));
    },

    //
    // Method: onWidget
    //
    // Add event handler to the widget.
    // See <widget.Events> for available Events.
    //
    // Parameters:
    //   eventType - type of event to add handler to
    //   handler   - handler function
    //
    onWidget: widget.on,

    // Method: getWidgetState
    //
    // Get the widget state, reflecting the general connection state.
    //
    // Defined widget states are:
    //   anonymous    - initial state
    //   typing       - userAddress input visible, user typing her address.
    //   connecting   - pre-authentication, webfinger discovery.
    //   authing      - about to redirect to the auth endpoint (if authDialog=popup,
    //                  means the popup is open)
    //   connected    - Discovery & Auth done, connected to remotestorage.
    //   busy         - Currently exchaning data. (spinning cube)
    //   disconnected - fired, when user clicks 'disconnect'. use this to clear your
    //                  app's views of the data. immediately transitions to 'anonymous'
    //                  afterwards.
    //
    getWidgetState: widget.getState,

    //
    getSyncState: sync.getState,
    //
    setStorageInfo: wireClient.setStorageInfo,

    getStorageHref: wireClient.getStorageHref,

    disableSyncThrottling: sync.disableThrottling,

    nodeConnect: nodeConnect,

    util: util,

    // Method: getForeignClient
    //
    // Get a <ForeignClient> instance for a given user.
    //
    // Parameters:
    //   userAddress - a user address in the form user@host
    //   callback - a callback to receive the client
    //
    // If there is no storageInfo cached for this userAddress, this will trigger
    // a webfinger discovery and when that succeeded, return the client through
    // the callback.
    //
    // Example:
    //   (start code)
    //   var client = remoteStorage.getForeignClient('alice@wonderland.lit', function(error, client) {
    //     if(error) {
    //       console.error("Discovery failed: ", error);
    //     } else {
    //       client.getPublishedObjects(function(objects) {
    //         console.log('public stuff', objects);
    //       });
    //     }
    //   });
    //   (end code)
    getForeignClient: function(userAddress, callback) {
      var client = foreignClient.getClient(userAddress);
      if(wireClient.hasStorageInfo(userAddress)) {
        callback(null, client);
      } else {
        webfinger.getStorageInfo(
          userAddress, { timeout: 5000 }, function(err, storageInfo) {
            if(err) {
              callback(err);
            } else {
              wireClient.addStorageInfo(userAddress, storageInfo);
              callback(null, client);
            }
          }
        );
      }
    },

    getClient: function(scope) {
      return new BaseClient(scope);
    },

    // Property: store
    // Public access to <store>
    store: store,

    sync: sync,
    widget: widget,

    i18n: i18n,

    schedule: schedule

  };

  return remoteStorage;
});

define('modules/root',['../remoteStorage'], function(remoteStorage) {

  remoteStorage.defineModule('public', function(client) {
    function getPublicItems() {
      return client.getObject("publishedItems");
    }

    return {
      exports: {
        getPublicItems: getPublicItems,
        getObject: client.getObject
      }
    };
  });

  remoteStorage.defineModule('root', function(myPrivateBaseClient, myPublicBaseClient) {
    // function setOnChange(cb) {
    //   myPrivateBaseClient.on('change', cb);
    //   myPublicBaseClient.on('change', cb);
    // }

    // function addToPublicItems(path) {
    //   var data = myPublicBaseClient.getObject("publishedItems");
    //   if(path[0] == "/")
    //     path = path.substr(1);

    //   if(data) {
    //     if(data.indexOf(path) == -1)
    //     {
    //       data.unshift(path);
    //     }
    //   } else {
    //     data = [];
    //     data.push(path);
    //   }
    //   myPublicBaseClient.storeObject('array', "publishedItems", data);
    // }

    // function removeFromPublicItems(path) {
    //   var data = myPublicBaseClient.getObject("publishedItems");
    //   if(path[0] == "/")
    //     path = path.substr(1);
    //   if(data) {
    //     if(data.indexOf(path) != -1) {
    //       data.pop(path);
    //     }
    //   } else {
    //     data = [];
    //   }
    //   myPublicBaseClient.storeObject('array', "publishedItems", data);
    // }

    // function publishObject(path) {
    //   if(pathIsPublic(path))
    //     return 'Object has already been made public';

    //   var data = myPrivateBaseClient.getObject(path);
    //   var publicPath = "/public" + path;
    //   addToPublicItems(publicPath);
    //   myPrivateBaseClient.remove(path);
    //   myPrivateBaseClient.storeObject(data['@type'], publicPath, data);

    //   return "Object " + path + " has been published to " + publicPath;
    // }

    // function archiveObject(path) {
    //   if(!pathIsPublic(path))
    //     return 'Object has already been made private';

    //   var data = myPrivateBaseClient.getObject(path);
    //   var privatePath = path.substring(7, path.length);
    //   removeFromPublicItems(path);
    //   myPrivateBaseClient.remove(path);
    //   myPrivateBaseClient.storeObject(data['@type'], privatePath, data);

    //   return "Object " + path + " has been archived to " + privatePath;
    // }

    // function pathIsPublic(path) {
    //   if(path.substring(0, 8) == "/public/")
    //     return true;
    //   return false;
    // }

    // function getClient(path) {
    //   if(!pathIsPublic(path))
    //     return myPrivateBaseClient;
    //   return myPublicBaseClient;
    // }

    // function hasDiff(path) {
    //   var client = getClient(path);
    //   return client.hasDiff(path);
    // }

    // /** getObject(path, [callback, [context]]) - get the object at given path
    //  **
    //  ** If the callback is NOT given, getObject returns the object at the given
    //  ** path from local cache:
    //  **
    //  **   remoteStorage.root.getObject('/todo/today')
    //  **   // -> { items: ['sit in the sun', 'watch the clouds', ...], ... }
    //  **
    //  ** If the callback IS given, getObject returns undefined and will at some
    //  ** point in the future, when the object's data has been pulled, call
    //  ** call the given callback.
    //  **
    //  **   remoteStorage.root.getObject('/todo/tomorrow', function(list) {
    //  **     // do something
    //  **   });
    //  ** 
    //  ** If both callback and context are given, the callback will be bound to
    //  ** the given context object:
    //  **
    //  **  remoteStorage.root.getObject('/todo/next-months', function(list) {
    //  **      for(var i=0;i<list.items.length;i++) {
    //  **        this.addToBacklog(list.items[i]);
    //  **      }// ^^ context 
    //  **    },
    //  **    this // < context.
    //  **  );
    //  **
    //  **/
    // function getObject(path, cb, context) {
    //   return myPrivateBaseClient.getObject(path, cb, context);
    // }

    // function getDocument(path, cb, context) {
    //   return myPrivateBaseClient.getDocument(path, cb, context);
    // }

    // function setDocument(mimeType, path, data, cb, context) {
    //   return myPrivateBaseClient.storeDocument(mimeType, path, data, cb, context);
    // }

    // /** setObject(type, path, object) - store the given object at the given path.
    //  **
    //  ** The given type should be a string and is used to build a JSON-LD @type
    //  ** URI to store along with the given object.
    //  **
    //  **/
    // function setObject(type, path, obj) {
    //   if(typeof(obj) === 'object') {
    //     myPrivateBaseClient.storeObject(type, path, obj);
    //   } else {
    //     myPrivateBaseClient.storeDocument(type, path, obj);
    //   }
    // }

    // /** removeObject(path) - remove node at given path
    //  **/
    // function removeObject(path) {
    //   myPrivateBaseClient.remove(path);
    // }

    // /** getListing(path, [callback, [context]]) - get a listing of the given
    //  **                                           path's child nodes.
    //  **
    //  ** Callback and return semantics are the same as for getObject.
    //  **/
    // function getListing(path, cb, context) {
    //   if(! path) {
    //     throw "Path is required"
    //   }
    //   return myPrivateBaseClient.getListing(path, cb, context);
    // }

    // function on(eventName, callback) {
    //   myPrivateBaseClient.on(eventName, callback);
    //   myPublicBaseClient.on(eventName, callback);
    // }

    // return {
    //   exports: {
    //     on: on,
    //     use: function() {
    //       myPrivateBaseClient.use.apply(myPrivateBaseClient, arguments);
    //     },
    //     release: function() {
    //       myPrivateBaseClient.release.apply(myPrivateBaseClient, arguments);
    //     },
    //     getListing: getListing,
    //     getObject: getObject,
    //     setObject: setObject,
    //     getDocument: getDocument,
    //     setDocument: setDocument,
    //     removeObject: removeObject,
    //     archiveObject: archiveObject,
    //     publishObject: publishObject,
    //     setOnChange: setOnChange,
    //     hasDiff: hasDiff,
    //     syncOnce: myPrivateBaseClient.syncOnce.bind(myPrivateBaseClient)
    //   }
    // }

    return { exports: myPrivateBaseClient };
  });

  return remoteStorage.root;

});

define('modules/calendar',['../remoteStorage'], function(remoteStorage) {

  var moduleName = 'calendar';

  remoteStorage.defineModule(moduleName, function(client) {

    client.declareType('event', 'http://json-schema.org/calendar', {
      "description": "A representation of an event",
      "type": "object",
      "properties": {
        "id": {
          "format": "id",
          "type": "string",
          "description": "Unique identifier for this event"
        },
        "dtstart": {
          "format": "date-time",
          "type": "string",
          "description": "Event starting time",
          "required": true
        },
        "dtend": {
          "format": "date-time",
          "type": "string",
          "description": "Event ending time"
        },
        "summary": { "type": "string", "required": true },
        "location": { "type": "string" },
        "url": { "type": "string", "format": "uri" },
        "duration": {
          "format": "time",
          "type": "string",
          "description": "Event duration"
        },
        "rdate": {
          "format": "date-time",
          "type": "string",
          "description": "Recurrence date"
        },
        "rrule": {
          "type": "string",
          "description": "Recurrence rule"
        },
        "category": { "type": "string" },
        "description": { "type": "string" },
        "geo": { "$ref": "http: //json-schema.org/geo" }
      }
    });

    //client.use('');

    function getEventsForDay(day) {
      var ids = client.getListing(day+'/');
      var list = [];
      for(var i=0; i<ids.length; i++) {
        var obj = client.getObject(day+'/'+ids[i]);
        list.push({'itemId': ids[i], 'itemValue': obj.summary});
      }
      return list;
    }

    function addEvent(itemId, day, value) {
      var mdy = day.split('_');
      client.storeObject('event', day+'/'+itemId, {
        summary: value,
        dtstart: new Date(mdy[2], mdy[0], mdy[1]).toISOString()
      });
    }
    function removeEvent(itemId, day) {
      client.remove(day+'/'+itemId);
    }
    return {
      exports: {
        getEventsForDay: getEventsForDay,
        addEvent: addEvent,
        removeEvent: removeEvent
      }
    };
  });

  return remoteStorage[moduleName];

});

/**
 ** VCF - Parser for the vcard format.
 **
 ** This is purely a vCard 4.0 implementation, as described in RFC 6350.
 **
 ** The generated VCard object roughly corresponds to the JSON representation
 ** of a hCard, as described here: http://microformats.org/wiki/jcard
 ** (Retrieved May 17, 2012)
 **
 ** (c) 2012 Niklas Cathor <niklas@unhosted.org> https://github.com/nilclass
 ** Available under MIT License terms, for details see LICENSE file.
 **
 **/

define('modules/deps/vcf',[], function() {

  var VCF;

  var multivaluedKeys = {
    email: true,
    tel: true,
    geo: true,
    title: true,
    role: true,
    logo: true,
    org: true,
    member: true,
    related: true,
    categories: true,
    note: true
  };

  function addAttribute(vcard, key, value) {
    if(! value) {
      return;
    }
    if(multivaluedKeys[key]) {
      if(vcard[key]) {
        vcard[key].push(value)
      } else {
        vcard[key] = [value];
      }
    } else {
      vcard[key] = value;
    }
  }

  VCF = {

    simpleKeys: [
      'VERSION',
      'FN', // 6.2.1
      'PHOTO', // 6.2.4 (we don't care about URIs [yet])
      'GEO', // 6.5.2 (SHOULD also b a URI)
      'TITLE', // 6.6.1
      'ROLE', // 6.6.2
      'LOGO', // 6.6.3 (also [possibly data:] URI)
      'MEMBER', // 6.6.5
      'NOTE', // 6.7.2
      'PRODID', // 6.7.3
      'SOUND', // 6.7.5
      'UID', // 6.7.6
    ],
    csvKeys: [
      'NICKNAME', // 6.2.3
      'CATEGORIES', // 6.7.1
    ],
    dateAndOrTimeKeys: [
      'BDAY',        // 6.2.5
      'ANNIVERSARY', // 6.2.6
      'REV', // 6.7.4
    ],

    // parses the given input, constructing VCard objects.
    // if the input contains multiple (properly seperated) vcards,
    // the callback may be called multiple times, with one vcard given
    // each time.
    // The third argument specifies the context in which to evaluate
    // the given callback.
    parse: function(input, callback, context) {
      var vcard = null;

      if(! context) {
        context = this;
      }

      this.lex(input, function(key, value, attrs) {
        function setAttr(val) {
          if(vcard) {
            addAttribute(vcard, key.toLowerCase(), val);
          }
        }
        if(key == 'BEGIN') {
          vcard = {};
        } else if(key == 'END') {
          if(vcard) {
            callback.apply(context, [vcard]);
            vcard = null;
          }

        } else if(this.simpleKeys.indexOf(key) != -1) {
          setAttr(value);

        } else if(this.csvKeys.indexOf(key) != -1) {
          setAttr(value.split(','));

        } else if(this.dateAndOrTimeKeys.indexOf(key) != -1) {
          if(attrs.VALUE == 'text') {
            // times can be expressed as "text" as well,
            // e.g. "ca 1800", "next week", ...
            setAttr(value);
          } else if(attrs.CALSCALE && attrs.CALSCALE != 'gregorian') {
            // gregorian calendar is the only calscale mentioned
            // in RFC 6350. I do not intend to support anything else
            // (yet).
          } else {
            // FIXME: handle TZ attribute.
            setAttr(this.parseDateAndOrTime(value));
          }

        } else if(key == 'N') { // 6.2.2
          setAttr(this.parseName(value));

        } else if(key == 'GENDER') { // 6.2.7
          setAttr(this.parseGender(value));

        } else if(key == 'TEL') { // 6.4.1
          setAttr({
            type: (attrs.TYPE || 'voice'),
            pref: attrs.PREF,
            value: value
          });

        } else if(key == 'EMAIL') { // 6.4.2
          setAttr({
            type: attrs.TYPE,
            pref: attrs.PREF,
            value: value
          });

        } else if(key == 'IMPP') { // 6.4.3
          // RFC 6350 doesn't define TYPEs for IMPP addresses.
          // It just seems odd to me to have multiple email addresses and phone numbers,
          // but not multiple IMPP addresses.
          setAttr({ value: value });

        } else if(key == 'LANG') { // 6.4.4
          setAttr({
            type: attrs.TYPE,
            pref: attrs.PREF,
            value: value
          });

        } else if(key == 'TZ') { // 6.5.1
          // neither hCard nor jCard mention anything about the TZ
          // property, except that it's singular (which it is *not* in
          // RFC 6350).
          // using compound representation.
          if(attrs.VALUE == 'utc-offset') {
            setAttr({ 'utc-offset': this.parseTimezone(value) });
          } else {
            setAttr({ name: value });
          }

        } else if(key == 'ORG') { // 6.6.4
          var parts = value.split(';');
          setAttr({
            'organization-name': parts[0],
            'organization-unit': parts[1]
          });

        } else if(key == 'RELATED') { // 6.6.6
          setAttr({
            type: attrs.TYPE,
            pref: attrs.PREF,
            value: attrs.VALUE
          });

        } else {
          console.log('WARNING: unhandled key: ', key);
        }
      });
    },
    
    nameParts: [
      'family-name', 'given-name', 'additional-name',
      'honorific-prefix', 'honorific-suffix'
    ],

    parseName: function(name) { // 6.2.2
      var parts = name.split(';');
      var n = {};
      for(var i in parts) {
        if(parts[i]) {
          n[this.nameParts[i]] = parts[i].split(',');
        }
      }
      return n;
    },

    /**
     * The representation of gender for hCards (and hence their JSON
     * representation) is undefined, as hCard is based on RFC 2436, which
     * doesn't define the GENDER attribute.
     * This method uses a compound representation.
     *
     * Examples:
     *   "GENDER:M"              -> {"sex":"male"}
     *   "GENDER:M;man"          -> {"sex":"male","identity":"man"}
     *   "GENDER:F;girl"         -> {"sex":"female","identity":"girl"}
     *   "GENDER:M;girl"         -> {"sex":"male","identity":"girl"}
     *   "GENDER:F;boy"          -> {"sex":"female","identity":"boy"}
     *   "GENDER:N;woman"        -> {"identity":"woman"}
     *   "GENDER:O;potted plant" -> {"sex":"other","identity":"potted plant"}
     */
    parseGender: function(value) { // 6.2.7
      var gender = {};
      var parts = value.split(';');
      switch(parts[0]) {
      case 'M':
        gender.sex = 'male';
        break;
      case 'F':
        gender.sex = 'female';
        break;
      case 'O':
        gender.sex = 'other';
      }
      if(parts[1]) {
        gender.identity = parts[1];
      }
      return gender;
    },

    /** Date/Time parser.
     * 
     * This implements only the parts of ISO 8601, that are
     * allowed by RFC 6350.
     * Paranthesized examples all represent (parts of):
     *   31st of January 1970, 23 Hours, 59 Minutes, 30 Seconds
     **/

    /** DATE **/

    // [ISO.8601.2004], 4.1.2.2, basic format:
    dateRE: /^(\d{4})(\d{2})(\d{2})$/, // (19700131)

    // [ISO.8601.2004], 4.1.2.3 a), basic format:
    dateReducedARE: /^(\d{4})\-(\d{2})$/, // (1970-01)

    // [ISO.8601.2004], 4.1.2.3 b), basic format:
    dateReducedBRE: /^(\d{4})$/, // (1970)

    // truncated representation from [ISO.8601.2000], 5.3.1.4.
    // I don't have access to that document, so relying on examples
    // from RFC 6350:
    dateTruncatedMDRE: /^\-{2}(\d{2})(\d{2})$/, // (--0131)
    dateTruncatedDRE: /^\-{3}(\d{2})$/, // (---31)

    /** TIME **/

    // (Note: it is unclear to me which of these are supposed to support
    //        timezones. Allowing them for all. If timezones are ommitted,
    //        defaulting to UTC)

    // [ISO.8601.2004, 4.2.2.2, basic format:
    timeRE: /^(\d{2})(\d{2})(\d{2})([+\-]\d+|Z|)$/, // (235930)
    // [ISO.8601.2004, 4.2.2.3 a), basic format:
    timeReducedARE: /^(\d{2})(\d{2})([+\-]\d+|Z|)$/, // (2359)
    // [ISO.8601.2004, 4.2.2.3 b), basic format:
    timeReducedBRE: /^(\d{2})([+\-]\d+|Z|)$/, // (23)
    // truncated representation from [ISO.8601.2000], see above.
    timeTruncatedMSRE: /^\-{2}(\d{2})(\d{2})([+\-]\d+|Z|)$/, // (--5930)
    timeTruncatedSRE: /^\-{3}(\d{2})([+\-]\d+|Z|)$/, // (---30)

    parseDate: function(data) {
      var md;
      var y, m, d;
      if((md = data.match(this.dateRE))) {
        y = md[1]; m = md[2]; d = md[3];
      } else if((md = data.match(this.dateReducedARE))) {
        y = md[1]; m = md[2];
      } else if((md = data.match(this.dateReducedBRE))) {
        y = md[1];
      } else if((md = data.match(this.dateTruncatedMDRE))) {
        m = md[1]; d = md[2];
      } else if((md = data.match(this.dateTruncatedDRE))) {
        d = md[1];
      } else {
        console.error("WARNING: failed to parse date: ", data);
        return null;
      }
      var dt = new Date(0);
      if(typeof(y) != 'undefined') { dt.setUTCFullYear(y); }
      if(typeof(m) != 'undefined') { dt.setUTCMonth(m - 1); }
      if(typeof(d) != 'undefined') { dt.setUTCDate(d); }
      return dt;
    },

    parseTime: function(data) {
      var md;
      var h, m, s, tz;
      if((md = data.match(this.timeRE))) {
        h = md[1]; m = md[2]; s = md[3];
        tz = md[4];
      } else if((md = data.match(this.timeReducedARE))) {
        h = md[1]; m = md[2];
        tz = md[3];
      } else if((md = data.match(this.timeReducedBRE))) {
        h = md[1];
        tz = md[2];
      } else if((md = data.match(this.timeTruncatedMSRE))) {
        m = md[1]; s = md[2];
        tz = md[3];
      } else if((md = data.match(this.timeTruncatedSRE))) {
        s = md[1];
        tz = md[2];
      } else {
        console.error("WARNING: failed to parse time: ", data);
        return null;
      }

      var dt = new Date(0);
      if(typeof(h) != 'undefined') { dt.setUTCHours(h); }
      if(typeof(m) != 'undefined') { dt.setUTCMinutes(m); }           
      if(typeof(s) != 'undefined') { dt.setUTCSeconds(s); }

      if(tz) {
        dt = this.applyTimezone(dt, tz);
      }

      return dt;
    },

    // add two dates. if addSub is false, substract instead of add.
    addDates: function(aDate, bDate, addSub) {
      if(typeof(addSub) == 'undefined') { addSub = true };
      if(! aDate) { return bDate; }
      if(! bDate) { return aDate; }
      var a = Number(aDate);
      var b = Number(bDate);
      var c = addSub ? a + b : a - b;
      return new Date(c);
    },

    parseTimezone: function(tz) {
      var md;
      if((md = tz.match(/^([+\-])(\d{2})(\d{2})?/))) {
        var offset = new Date(0);
        offset.setUTCHours(md[2]);
        offset.setUTCMinutes(md[3] || 0);
        return Number(offset) * (md[1] == '+' ? +1 : -1);
      } else {
        return null;
      }
    },

    applyTimezone: function(date, tz) {
      var offset = this.parseTimezone(tz);
      if(offset) {
        return new Date(Number(date) + offset);
      } else {
        return date;
      }
    },

    parseDateTime: function(data) {
      var parts = data.split('T');
      var t = this.parseDate(parts[0]);
      var d = this.parseTime(parts[1]);
      return this.addDates(t, d);
    },

    parseDateAndOrTime: function(data) {
      switch(data.indexOf('T')) {
      case 0:
        return this.parseTime(data.slice(1));
      case -1:
        return this.parseDate(data);
      default:
        return this.parseDateTime(data);
      }
    },

    lineRE: /^([^\s].*)(?:\r?\n|$)/, // spec wants CRLF, but we're on the internet. reality is chaos.
    foldedLineRE:/^\s(.+)(?:\r?\n|$)/,

    // lex the given input, calling the callback for each line, with
    // the following arguments:
    //   * key - key of the statement, such as 'BEGIN', 'FN', 'N', ...
    //   * value - value of the statement, i.e. everything after the first ':'
    //   * attrs - object containing attributes, such as {"TYPE":"work"}
    lex: function(input, callback) {

      var md, line = null, length = 0;

      for(;;) {
        if((md = input.match(this.lineRE))) {
          if(line) {
            this.lexLine(line, callback);
          }
          line = md[1];
          length = md[0].length;
        } else if((md = input.match(this.foldedLineRE))) {
          if(line) {
            line += md[1];
            length = md[0].length;
          } else {
            // ignore folded junk.
          }
        } else {
          console.error("Unmatched line: " + line);
        }

        input = input.slice(length);

        if(! input) {
          break;
        }
      }

      if(line) {
        // last line.
        this.lexLine(line, callback);
      }

      line = null;
    },

    lexLine: function(line, callback) {
      var tmp = '';
      var key = null, attrs = {}, value = null, attrKey = null;

      function finalizeKeyOrAttr() {
        if(key) {
          if(attrKey) {
            attrs[attrKey] = tmp;
          } else {
            console.error("Invalid attribute: ", tmp, 'Line dropped.');
            return;
          }
        } else {
          key = tmp;
        }
      }

      for(var i in line) {
        var c = line[i];

        switch(c) {
        case ':':
          finalizeKeyOrAttr();
          value = line.slice(Number(i) + 1);
          callback.apply(
            this,
            [key, value, attrs]
          );
          return;
        case ';':
          finalizeKeyOrAttr();
          tmp = '';
          break;
        case '=':
          attrKey = tmp;
          tmp = '';
          break;
        default:
          tmp += c;
        }
      }
    }

  };

  return VCF;
});

/**
 ** Skeleton for new modules
 **/

define('modules/contacts',[
  '../remoteStorage',
  '../modules/deps/vcf'
], function(remoteStorage, VCF) {

  // Namespace: remoteStorage.contacts
  //
  // Section: Tutorial
  //
  //   > // TODO!
  //
  // Section: Data Format
  //
  // The contacts module deals with information about people and connections between people.
  //
  // Data is stored as vcards, in a JSON representation.
  //
  // Here's an example:
  //
  //   (start code)
  //   {
  //     // FN stands for "formatted name". it's required.
  //     "fn": "Hagbard Celine",
  //     // N is an (optional) detailed representation of the name
  //     "n": {
  //       "first-name": "Hagbard"
  //       "last-name": "Celine"
  //     },
  //     // a vcard can have multiple email addresses, so it's stored as an array.
  //     "email" : [{
  //       "type": "work",
  //       "value": "hagbard@leifericson.no"
  //     }]
  //   }
  //   (end code)
  //

  var moduleName = "contacts";

  remoteStorage.defineModule(moduleName, function(base) {

    base.declareType('vcard', {

      "description": "a vcard",

      "type": "object",

      "properties": {
        "version": {
          "type": "string"
        },

        "fn": {
          "type": "string",
          "description": "formatted name",
          "required": true
        },

        "uid": {
          "description": "unique identifier",
          "type": "string",
          "format": "uri"
        },

        "n": {
          "type": "object",
          "description": "structured name",
          "properties": {
            "family-name": { "type": "array", "items": { "type": "string" } },
            "given-name": { "type": "array", "items": { "type": "string" } },
            "additional-name": { "type": "array", "items": { "type": "string" } },
            "horifific-prefix": { "type": "array", "items": { "type": "string" } },
            "honorific-suffix": { "type": "array", "items": { "type": "string" } }
          }
        },

        "nickname": {
          "type": "string"
        },

        "photo": {
          "type": "string",
          "format": "uri"
        },

        "logo": {
          "type": "string",
          "format": "uri"
        },

        "title": {
          "type": "string"
        },

        "org": {
          "type": "string",
          "description": "Name of an organization"
        },

        "role": {
          "type": "string",
          "description": "role of a person within an organization"
        },

        "kind": {
          "type": "string",
          "enum": ["individual", "group", "event"],
          "description": "nature of the thing being described by this vcard"
        },

        "email": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "description": "type of this email address. common values are 'work', 'home'",
                "required": true
              },
              "value": {
                "type": "string",
                "description": "the actual email address",
                "required": true
              }
            }
          }
        },

        "tel": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "description": "type of this telephone number, such as text, voice, fax, cell, video, pager, textphone",
                "required": true
              },
              "value": {
                "type": "string",
                "regex": "^[\\d+-\\s]+$"
              }
            }
          }
        },

        "related": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "description": "nature of this relation",
                "required": true
              },
              "value": {
                "type": "string",
                "description": "URI pointing to related thing",
                "format": "uri",
                "required": true
              }
            }
          }
        },

        "member": {
          "type": "array",
          "description": "members of a group",
          "items": {
            "type": "string",
            "description": "URI pointing to member thing",
            "format": "uri"
          }
        },
        "geo": {
          "type": "string",
          "description": "geographical coordinates associated with this thing"
        },
        "rev": {
          "type": "string",
          "description": "revision of this object."
        }
      }
    });

    function searchMatch(item, filter, filterKeys) {
      if(! filterKeys) {
        filterKeys = Object.keys(filter);
      }

      var check = function(value, ref) {
        if(value instanceof Array) {
          // multiples, such as MEMBER, EMAIL, TEL
          for(var i=0;i<value.length;i++) {
            check(value[i], ref);
          }
        } else if(typeof value === 'object' && value.value) {
          // compounds, such as EMAIL, TEL, IMPP
          check(value.value, ref);
        } else {
          if(typeof(ref) === 'string' && ref.length === 0) {
            return true; // the empty string always matches
          } else if(ref instanceof RegExp) {
            if(! ref.test(value)) {
              return false;
            }
          } else if(value !== ref) {
            // equality is fallback.
            return false;
          }
        }
      };
      for(var key in filterKeys) {
        if(! check(item[key], filterKeys[key])) {
          return false;
        }
      }
      return true;
    }

    remoteStorage.util.extend(base, {

      buildVCard: function(attributes) {
        var vcard = buildObject('vcard', attributes);
        if(! vcard.uid) {
          vcard.uid = base.uuid();
        }
        return vcard;
      },

      filter: function(cb) {
        var items = base.getAll('');
        var results = [];
        for(var key in items) {
          var item = items[key];
          if(cb(item)) {
            results.push(item);
          }
        }
        return results;
      },

      search: function(filter) {
        var keys = Object.keys(filter);

        var results = base.filter(function(item) {
          return searchMatch(item, filter, keys);
        });
        console.log("SEARCH", filter, results);
        return results;
      },

      addVCards: function(fileList) {
        for(var i=0;i<fileList.length;i++) {
          var reader = new FileReader();
          var file = fileList[i];
          reader.onload = function() {
            VCF.parse(reader.result, function(vcard) {
              if(! vcard.uid) {
                vcard.uid = base.uuid();
              }
              base.storeObject('vcard', vcard.uid, vcard);
            });
          };
          reader.readAsText(file);
        }
      }

    });

    return { exports: base };

    // var DEBUG = true, contacts = {};

    // // Copy over all properties from source to destination.
    // // Return destination.
    // function extend() {
    //   var destination = arguments[0], source;
    //   for(var i=1;i<arguments.length;i++) {
    //     source = arguments[i];
    //     var keys = Object.keys(source);
    //     for(var j=0;j<keys.length;j++) {
    //       var key = keys[j];
    //       destination[key] = source[key];
    //     }
    //   }
    //   return destination;
    // }


    // var bindContext = (
    //   ( (typeof (function() {}).bind === 'function') ?
    //     // native version
    //     function(cb, context) { return cb.bind(context); } :
    //     // custom version
    //     function(cb, context) {
    //       return function() { return cb.apply(context, arguments); }
    //     } )
    // );

    // var debug = DEBUG ? bindContext(console.log, console) : function() {};

    // // VCard subtypes:

    // var Contact = function() {
    //   VCard.apply(this, arguments);
    //   this.setAttribute('kind', 'individual');
    // }

    // function makeVcardInstance(data) {
    //   var type = (data.kind == 'individual' ? Contact :
    //               (data.kind == 'group' ? Group : VCard));
    //   return new type(data);
    // }

    // var Group = function(name) {
    //   VCard.apply(this, arguments);
    //   this.setAttribute('kind', 'group');
    // }

    // var groupMembers = {

    //   getMembers: function() {
    //     var members = [];
    //     for(var i=0;i<this.member.length;i++) {
    //       members.push(this.lookupMember(member[i]));
    //     }
    //     return members;
    //   },

    //   // resolve a URI to a contact an return it.
    //   lookupMember: function(uri) {
    //     var md = uri.match(/^([^:]):(.*)$/), scheme = md[1], rest = md[2];
    //     var key;
    //     switch(scheme) {
    //       // URN and UUID directly resolve to the contact's key.
    //       // if they don't, there is nothing we can do about it.
    //     case 'urn':
    //     case 'uuid':
    //       return contacts.get(uri);
    //     case 'mailto':
    //     case 'xmpp':
    //     case 'sip':
    //     case 'tel':
    //       var query = {};
    //       query[{
    //         mailto: 'email',
    //         xmpp: 'impp',
    //         sip: 'impp',
    //         tel: 'tel'
    //       }[scheme]] = rest;
    //       var results = contacts.search(query);
    //       if(results.length > 0) {
    //         return results[0];
    //       }
    //       if(scheme == 'tel') {
    //         break; // no fallback for TEL
    //       }
    //       // fallback for MAILTO, XMPP, SIP schems is webfinger:
    //     case 'acct':
    //       console.error("FIXME: implement contact-lookup via webfinger!");
    //       break;
    //       // HTTP could resolve to a foaf profile, a vcard, a jcard...
    //     case 'http':
    //       console.error("FIXME: implement contact-lookup via HTTP!");
    //       break;
    //     default:
    //       console.error("FIXME: unknown URI scheme " + scheme);
    //     }
    //     return undefined;
    //   }

    // };

    // // Namespace: exports

    // extend(contacts, {

    //   // Property: Contact
    //   // A VCard constructor for contacts (kind: "individual")
    //   Contact: Contact,

    //   // Property: Group
    //   // A VCard constructor for groups (kind: "group")
    //   //
    //   Group: Group,

    //   //
    //   // Method: on
    //   //
    //   // Install an event handler.
    //   //
    //   // "change" events will be altered, so the newValue and oldValue attributes contain VCard instances.
    //   //
    //   // For documentation on events see <BaseClient> and <BaseClient.on>.
    //   on: function(eventType, callback) {
    //     base.on(eventType, function(event) {
    //       if(event.oldValue) {
    //         event.oldValue = contacts._wrap(event.oldValue);
    //       }
    //       if(event.newValue) {
    //         event.newValue = contacts._wrap(event.newValue);
    //       }
    //       callback(event);
    //     });
    //   },

    //   //
    //   // Method: use
    //   //
    //   // Set the "force sync" flag for all contacts.
    //   //
    //   // This causes the complete data to be synced, next time <syncNow> is called on either /contacts/ or /.
    //   //
    //   use: function() {
    //     debug("contacts.sync()");
    //     base.use('');
    //   },

    //   //
    //   // Method: list
    //   //
    //   // Get a list of contact objects.
    //   //
    //   // Parameters:
    //   //   limit - (optional) maximum number of objects to return
    //   //   offset - (optional) index to start at.
    //   //
    //   //   you can use limit / offset to implement pagination or load-on-scroll flows.
    //   //
    //   // Returns:
    //   //   An Array of VCard objects (or descendants)
    //   //
    //   // Example:
    //   //   > remoteStorage.contacts.list().forEach(function(contact) {
    //   //   >   console.log(contact.getAttribute('fn'));
    //   //   > });
    //   //
    //   list: function(limit, offset) {
    //     var list = base.getListing('');
    //     if(! offset) {
    //       offset = 0;
    //     }
    //     if(! limit) {
    //       limit = list.length - offset;
    //     }
    //     for(var i=0;i<limit;i++) {
    //       if(list[i + offset]) {
    //         list[i + offset] = this.get(list[i + offset]);
    //       }
    //     }
    //     return list;
    //   },

    //   //
    //   // Method: get
    //   //
    //   // Retrieve a single contact.
    //   //
    //   // Parameters:
    //   //   uid - UID of the contact
    //   //   callback - (optional)
    //   //   context - (optional)
    //   //
    //   // The callbacks follow the semantics described in <BaseClient.getObject>
    //   //
    //   get: function(uid, cb, context) {
    //     if(cb) {
    //       base.getObject(uid, function(data) {
    //         bindContext(cb, context)(this._wrap(data));
    //       }, this);
    //     } else {
    //       return this._wrap(base.getObject(uid));
    //     }
    //   },

    //   //
    //   // Method: build
    //   //
    //   // Build a new (unsaved) contact object.
    //   //
    //   // If you want to store the object later, use <put>.
    //   //
    //   // Parameters:
    //   //   attributes - (optional) initial attributes to add
    //   //
    //   build: function(attributes) {
    //     return this._wrap(attributes);
    //   },

    //   //
    //   // Method: put
    //   //
    //   // Update or create a contact.
    //   //
    //   // Parameters:
    //   //   contact - a VCard object
    //   //
    //   // Returns:
    //   //   the (possibly altered) VCard object
    //   //
    //   // Sets UID and REV attributes as needed.
    //   //
    //   //
    //   // Example:
    //   //   (start code)
    //   //   var contact = remoteStorage.contacts.build({ "kind":"individual" });
    //   //   contact.fn = "Donald Duck";
    //   //   // (at this point you could contact.validate(), to check if everything is in order)
    //   //   remoteStorage.contacts.put(contact);
    //   //   // contact now persisted.
    //   //   (end code)
    //   //
    //   put: function(contact) {
    //     var contact = this.build(contact);
    //     contact.validate();
    //     // TODO: do something with the errors!
    //     base.storeObject('vcard+' + (contact.kind || 'individual'), contact.uid, contact.attributes);
    //     return contact;
    //   },

    //   filter: function(cb, context) {
    //     // this is highly ineffective. go fix it!
    //     var list = this.list();
    //     var results = [];
    //     var item;
    //     for(var i=0;i<list.length;i++) {
    //       item = bindContext(cb, context)(list[i]);
    //       if(item) {
    //         results.push(item)
    //       }
    //     }
    //     return results;
    //   },

    //   search: function(filter) {
    //     var keys = Object.keys(filter);

    //     return this.filter(function(item) {
    //       return this.searchMatch(item, filter, keys);
    //     }, this);
    //   },

    //   searchMatch: function(item, filter, filterKeys) {
    //     if(! filterKeys) {
    //       filterKeys = Object.keys(filter);
    //     }

    //     var check = function(value, ref) {
    //       if(value instanceof Array) {
    //         // multiples, such as MEMBER, EMAIL, TEL
    //         for(var i=0;i<value.length;i++) {
    //           check(value[i], ref);
    //         }
    //       } else if(typeof value === 'object' && value.value) {
    //         // compounds, such as EMAIL, TEL, IMPP
    //         check(value.value, ref);
    //       } else {
    //         if(typeof(ref) === 'string' && ref.length === 0) {
    //           return true; // the empty string always matches
    //         } else if(ref instanceof RegExp) {
    //           if(! ref.test(value)) {
    //             return false;
    //           }
    //         } else if(value !== ref) {
    //           // equality is fallback.
    //           return false;
    //         }
    //       }
    //     }

    //     return this.filter(function(item) {
    //       for(var i=0;i<keys.length;i++) {
    //         var k = keys[i], v = filter[k];
    //         if(! check(item[k], v)) {
    //           return false;
    //         }
    //       }
    //       debug('success');
    //       return item;
    //     });
    //   },

    //   _wrap: function(data) {
    //     return(data instanceof VCard ? data : makeVcardInstance(data));
    //   }

    // });


    // return {
    //   name: moduleName,

    //   dataHints: {
    //   },

    //   exports: contacts
    // }
  });


  return remoteStorage[moduleName];

});



define('modules/documents',['../remoteStorage'], function(remoteStorage) {

  var moduleName = 'documents';

  remoteStorage.defineModule(moduleName, function(myBaseClient) {
    var errorHandlers=[];
    function fire(eventType, eventObj) {
      if(eventType == 'error') {
        for(var i=0; i<errorHandlers.length; i++) {
          errorHandlers[i](eventObj);
        }
      }
    }
    function getUuid() {
      var uuid = '',
      i,
      random;

      for ( i = 0; i < 32; i++ ) {
        random = Math.random() * 16 | 0;
        if ( i === 8 || i === 12 || i === 16 || i === 20 ) {
          uuid += '-';
        }
        uuid += ( i === 12 ? 4 : (i === 16 ? (random & 3 | 8) : random) ).toString( 16 );
      }
      return uuid;
    }
    function getPrivateList(listName) {
      myBaseClient.use(listName+'/');
      function getIds() {
        return myBaseClient.getListing(listName+'/');
      }
      function getContent(id) {
        var obj = myBaseClient.getObject(listName+'/'+id);
        if(obj) {
          return obj.content;
        } else {
          return '';
        }
      }
      function getTitle(id) {
        return getContent(id).slice(0, 50);
      }
      function setContent(id, content) {
        if(content === '') {
          myBaseClient.remove(listName+'/'+id);
        } else {
          myBaseClient.storeObject('text', listName+'/'+id, {
            content: content
          });
        }
      }
      function add(content) {
        var id = getUuid();
        myBaseClient.storeObject('text', listName+'/'+id, {
          content: content
        });
        return id;
      }
      function on(eventType, cb) {
        myBaseClient.on(eventType, cb);
        if(eventType == 'error') {
          errorHandlers.push(cb);
        }
      }
      return {
        getIds        : getIds,
        getContent    : getContent,
        getTitle      : getTitle,
        setContent   : setContent,
        add           : add,
        on            : on
      };
    }
    return {
      name: moduleName,
      dataHints: {
        "module": "documents can be text documents, or etherpad-lite documents or pdfs or whatever people consider a (text) document. But spreadsheets and diagrams probably not",
        "objectType text": "a human-readable plain-text document in utf-8. No html or markdown etc, they should have their own object types",
        "string text#content": "the content of the text document",
        
        "directory documents/notes/": "used by litewrite for quick notes",
        "item documents/notes/calendar": "used by docrastinate for the 'calendar' pane",
        "item documents/notes/projects": "used by docrastinate for the 'projects' pane",
        "item documents/notes/personal": "used by docrastinate for the 'personal' pane"
      },
      exports: {
        getPrivateList: getPrivateList
      }
    };
  });

  return remoteStorage[moduleName];

});

define('modules/money',['../remoteStorage'], function(remoteStorage) {

  remoteStorage.defineModule('money', function(myPrivateBaseClient, myPublicBaseClient) {
    return {
      name: 'money',
      dataHints: {
      },
      exports: {
        setDayBusiness: function(tab, year, month, day, transactions, endBalances) {
          var datePath = year+'/'+month+'/'+day+'/'+tab.substring(1)+'/';
          for(var i=0; i<transactions.length;i++) {
            myPrivateBaseClient.storeObject('transaction', datePath+'transaction/'+i, transactions[i]);
          }
          for(var j in endBalances) {
            myPrivateBaseClient.storeObject('balance', datePath+'balance/'+j, endBalances[j]);
          }
        }
      }
    };
  });

});

define('modules/tasks',['../remoteStorage'], function(remoteStorage) {

  var moduleName = "tasks";

  remoteStorage.defineModule(moduleName, function(myPrivateBaseClient, myPublicBaseClient) {

    // Namespace: remoteStorage.tasks
    //
    // tasks are things that need doing; items on your todo list
    //
    // Example:
    //   (start code)
    //
    //   remoteStorage.claimAccess('tasks', 'rw');
    //
    //   remoteStorage.displayWidget('remotestorage-connect');
    //
    //   // open a task list (you can have multiple task lists, see dataHints for naming suggestions)
    //   var todos = remoteStorage.tasks.getPrivateList('todos');
    //
    //   function printTasks() {
    //     // get all task ids...
    //     todos.getIds().forEach(function(id) {
    //       // ...then load each task and print it.
    //       var task = todos.get(id);
    //       console.log(task.completed ? '[x]' : '[ ]', task.title);
    //     });
    //   }
    //
    //   // add some tasks
    //   todos.add("Start unhosted webapp");
    //   todos.add("Obtain a freedombox");
    //   todos.add("Scientifically overcome the existence of dirty laundry");
    //
    //   // see the result
    //   printTasks();
    //
    //   // mark the first task as completed (after all, by copying this code you create a unhosted webapp)
    //   todos.markCompleted(todos.getIds()[0]);
    //
    //   // see what changed
    //   printTasks();
    //
    //   (end code)
    //
    // Method: getPrivateList
    //
    // open a task list to work with
    //
    // Parameters:
    //   listName - name of the list to open. try "todos" or "2012".
    //
    // Returns:
    //   a <TaskList> object
    //

    var errorHandlers=[];
    function fire(eventType, eventObj) {
      if(eventType == 'error') {
        for(var i=0; i<errorHandlers.length; i++) {
          errorHandlers[i](eventObj);
        }
      }
    }
    function getUuid() {
      var uuid = '',
      i,
      random;

      for ( i = 0; i < 32; i++ ) {
        random = Math.random() * 16 | 0;
        if ( i === 8 || i === 12 || i === 16 || i === 20 ) {
          uuid += '-';
        }
        uuid += ( i === 12 ? 4 : (i === 16 ? (random & 3 | 8) : random) ).toString( 16 );
      }
      return uuid;
    }
    function getPrivateList(listName) {
      myPrivateBaseClient.use(listName+'/');
      function getIds() {
        return myPrivateBaseClient.getListing(listName+'/');
      }
      function get(id) {
        return myPrivateBaseClient.getObject(listName+'/'+id);
      }
      function set(id, title) {
        var obj = myPrivateBaseClient.getObject(listName+'/'+id);
        obj.title = title;
        myPrivateBaseClient.storeObject('task', listName+'/'+id, obj);
      }
      function add(title) {
        var id = getUuid();
        myPrivateBaseClient.storeObject('task', listName+'/'+id, {
          title: title,
          completed: false
        });
        return id;
      }
      function markCompleted(id, completedVal) {
        if(typeof(completedVal) == 'undefined') {
          completedVal = true;
        }
        var obj = myPrivateBaseClient.getObject(listName+'/'+id);
        if(obj && obj.completed != completedVal) {
          obj.completed = completedVal;
          myPrivateBaseClient.storeObject('task', listName+'/'+id, obj);
        }
      }
      function isCompleted(id) {
        var obj = get(id);
        return obj && obj.completed;
      }
      function getStats() {
        var ids = getIds();
        var stat = {
          todoCompleted: 0,
          totalTodo: ids.length
        };
        for (var i=0; i<stat.totalTodo; i++) {
          if (isCompleted(ids[i])) {
            stat.todoCompleted += 1;
          }
        }
        stat.todoLeft = stat.totalTodo - stat.todoCompleted;
        return stat;
      }
      function remove(id) {
        myPrivateBaseClient.remove(listName+'/'+id);
      }
      function on(eventType, cb) {
        myPrivateBaseClient.on(eventType, cb);
        if(eventType == 'error') {
          errorHandlers.push(cb);
        }
      }
      // Class: TaskList
      return {
        // Method: getIds
        //
        // Get a list of task IDs, currently in this list
        //
        // Example:
        //   > remoteStorage.tasks.getIds();
        //
        getIds        : getIds,
        // Method: get
        //
        // Get a single task object, by it's ID.
        //
        // Parameters:
        //   id - the task ID
        //
        // Returns:
        //   An object containing the task's data.
        get           : get,
        // Method: set
        //
        // Set the title of a task.
        // 
        // Parameters:
        //   id - the task ID
        //   title - new title to set
        //
        set           : set,
        // Method: add
        //
        // Add a task by providing it's title.
        //
        // Newly created tasks are marked as not completed.
        //
        // Parameters:
        //   title - title to set for the new task.
        //
        add           : add,
        // Method: remove
        //
        // Remove a task
        //
        // Parameters:
        //   id - the task ID
        //
        remove        : remove,
        // Method: markCompleted
        //
        // Mark a task as completed.
        //
        // Parameters:
        //   id    - the task ID
        //   value - (optional) boolean. defaults to true.
        //
        // Examples:
        //   > remoteStorage.tasks.markCompleted(123);
        //
        //   > remoteStorage.tasks.markCompleted(234, false);
        markCompleted : markCompleted,
        // Method: getStats
        //
        // Get statistics on this <TaskList>.
        //
        // Returns:
        //   An Object with keys,
        //
        //   todoCompleted - number of completed tasks
        //   totalTodo     - total number of tasks in this list
        //   todoLeft      - number of tasks awaiting completion
        //
        getStats      : getStats,
        // Method: on
        //
        // Delegated to <BaseClient.on>
        on            : on
      };
    }
    return {
      name: moduleName,
      dataHints: {
        "module": "",
        
        "objectType task": "something that needs doing, like cleaning the windows or fixing a specific bug in a program",
        "string task#title": "describes what it is that needs doing",
        "boolean task#completed": "whether the task has already been completed or not (yet)",
        
        "directory tasks/todos/": "default private todo list",
        "directory tasks/:year/": "tasks that need doing during year :year",
        "directory public/tasks/:hash/": "tasks list shared to for instance a team"
      },
      exports: {
        getPrivateList: getPrivateList
      }
    };
  });

  return remoteStorage[moduleName];

});


define('modules/bookmarks',['../remoteStorage'], function(remoteStorage) {

  var moduleName = 'bookmarks';

  remoteStorage.defineModule(
    moduleName,
    function(privateClient, publicClient) {

      // publicClient.sync('');

      return {
        name: moduleName,

        dataHints: {
          "module" : "Store URLs which you do not wish to forget"
        },

        exports: {

          // remoteStorage.bookmarks.on('change', function(changeEvent) {
          //   if(changeEvent.newValue && changeEvent.oldValue) {
          //    changeEvent.origin:
          //      * window - event come from current window
          //            -> ignore it
          //      * device - same device, other tab (/window/...)
          //      * remote - not related to this app's instance, some other app updated something on remoteStorage
          //   }
          // });
          on: privateClient.on,

          listUrls: function() {
            var keys = privateClient.getListing('');
            var urls = [];
            keys.forEach(function(key) {
              urls.push(privateClient.getObject(key).url);
            });
            return urls;
          },


          listBookmarks: function() {
            var keys = privateClient.getListing('');
            var bms = [];
            keys.forEach(function(key) {
              bms.push(privateClient.getObject(key));
            });
            privateClient.use('');
            return bms;
          },
          
          // remoteStorage.bookmarks.addUrl
          addUrl: function(url) {
            return privateClient.storeObject(
              // /bookmarks/http%3A%2F%2Funhosted.org%2F
              'bookmark', encodeURIComponent(url), {
                url: url,
                createdAt: new Date()
              }
            );
          },

          getPublicListing: function() {
            var listing = publicClient.getObject('publishedItems');
            return listing || { items: [] };
          },

          publish: function(url) {
            var key = encodeURIComponent(url);
            var bookmark = privateClient.getObject(key);

            publicClient.storeObject('bookmark', key, bookmark);

            var listing = publicClient.getListing('');
            delete listing.published;
            publicClient.storeObject('bookmark-list', 'published', listing);
          }

        }
      };
    }
  );

});

define('modules/music',['../remoteStorage'], function(remoteStorage) {
  remoteStorage.defineModule('music', function(privateClient, publicClient) {
    return {
      exports: {

        clear: function() {
          return publicClient.getListing('').then(function(listing) {
            return remoteStorage.util.asyncEach(listing, function(item) {
              return publicClient.remove(item);
            });
          });
        },

        storeSong: function(path, arrayBuffer) {
          if(false) {
            var url = localStorage['remotestorage_wire:storageHref']+'/public/music/'+path;
            var authHeader = 'Bearer '+localStorage['remotestorage_wire:bearerToken'];
            var xhr = new XMLHttpRequest();
            xhr.open('PUT', url, true);
            xhr.setRequestHeader('Authorization', authHeader);
            xhr.setRequestHeader('Content-Type', 'audio/ogg; charset=binary');
            xhr.onreadystatechange = function() {
            };
            xhr.send(arrayBuffer);
          } else {
            console.log('publicClient.storeFile(audio/ogg', path, arrayBuffer);
            publicClient.storeFile('audio/ogg', path, arrayBuffer);
          }
        },

        listSongs: function() {
          return publicClient.getListing('');
        },

        getSongURL: function(path) {
          return publicClient.getItemURL(path);
        }

      }
    }
  });

  return remoteStorage.music;
});
define('remoteStorage-modules',[
  './remoteStorage',
  './modules/root',
  './modules/calendar',
  './modules/contacts',
  './modules/documents',
  './modules/money',
  './modules/tasks',
  './modules/bookmarks',
  './modules/music'
], function(remoteStorage) {
  return remoteStorage;
});


  remoteStorage = require('remoteStorage-modules');

})();