/*global Buffer */
/*global window */
/*global console */
/*global Uint8Array */
/*global setTimeout */
/*global localStorage */
/*global ArrayBuffer */

define([], function() {

  "use strict";

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

  var Warning = function() {
    Error.apply(this, arguments);
  };
  Warning.prototype = Error.prototype;

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
      var parts = [];
      var md;
      while((md = path.match(/^(.*?)([^\/]+\/?)$/))) {
        parts.unshift(md[2]);
        path = md[1];
      }
      parts.unshift('/');
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

        emit: function(eventName) {
          var handlerArgs = Array.prototype.slice.call(arguments, 1);
          // eventName validation happens in hasHandler
          if(this.hasHandler(eventName)) {
            this._handlers[eventName].forEach(function(handler) {
              if(handler) {
                try {
                  handler.apply(null, handlerArgs);
                } catch(exc) {
                  if(eventName !== 'error' && 'error' in this._handlers && this.hasHandler('error')) {
                    this.emit('error', exc);
                  } else {
                    console.error("Error in '" + eventName + "' event handler:", exc);
                  }
                }
              }
            }.bind(this));
          }
        },

        on: function(eventName, handler) {
          validEvent.call(this, eventName);
          if(typeof(handler) !== 'function') {
            throw "Expected function as handler, got: " + typeof(handler);
          }
          this._handlers[eventName].push(handler);
        },

        reset: function() {
          this._handlers = setupHandlers();
        },

        hasHandler: function(eventName) {
          validEvent.call(this, eventName);
          return this._handlers[eventName].length > 0;
        }

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

    // Function: getPromise
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
    //     return util.getPromise(function(promise) {
    //       // promise will be fulfilled in next tick
    //       promise.fulfill(a + b);
    //     });
    //   }
    //
    //   function b() {
    //     return util.getPromise(function(promise) {
    //       // promise will be fulfilled as soon as the returned promise is fulfilled
    //       return asyncFunctionReturningPromise();
    //     });
    //   }
    //
    //   function c() {
    //     return util.getPromise(function(promise) {
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
    getPromise: function(builder) {
      var promise;

      if(typeof(builder) === 'function') {
        setTimeout(function() {
          try {
            builder(promise);
          } catch(e) {
            promise.reject(e);
          }
        }, 0);
      }

      var consumers = [], success, result;

      function notifyConsumer(consumer) {
        if(success) {
          var nextValue;
          if(consumer.fulfilled) {
            try {
              nextValue = [consumer.fulfilled.apply(null, result)];
            } catch(exc) {
              consumer.promise.reject(exc);
              return;
            }
          } else {
            nextValue = result;
          }
          if(nextValue[0] && typeof(nextValue[0].then) === 'function') {
            nextValue[0].then(consumer.promise.fulfill, consumer.promise.reject);
          } else {
            consumer.promise.fulfill.apply(null, nextValue);
          }
        } else {
          if(consumer.rejected) {
            var ret;
            try {
              ret = consumer.rejected.apply(null, result);
            } catch(exc) {
              consumer.promise.reject(exc);
              return;
            }
            if(ret && typeof(ret.then) === 'function') {
              ret.then(consumer.promise.fulfill, consumer.promise.reject);
            } else {
              consumer.promise.fulfill(ret);
            }
          } else {
            consumer.promise.reject.apply(null, result);
          }
        }
      }

      function resolve(succ, res) {
        if(result) {
          console.log("WARNING: Can't resolve promise, already resolved!");
          console.trace();
          return;
        }
        success = succ;
        result = Array.prototype.slice.call(res);
        setTimeout(function() {
          var cl = consumers.length;
          if(cl === 0 && (! success)) {
            var error = result[0] instanceof Error ? (result[0].message + '\n' + result[0].stack) : result;
            console.error("Possibly uncaught error: ", error);
          }
          for(var i=0;i<cl;i++) {
            notifyConsumer(consumers[i]);
          }
          consumers = undefined;
        }, 0);
      }

      promise = {

        then: function(fulfilled, rejected) {
          var consumer = {
            fulfilled: typeof(fulfilled) === 'function' ? fulfilled : undefined,
            rejected: typeof(rejected) === 'function' ? rejected : undefined,
            promise: util.getPromise()
          };
          if(result) {
            setTimeout(function() {
              notifyConsumer(consumer)
            }, 0);
          } else {
            consumers.push(consumer);
          }
          return consumer.promise;
        },

        fulfill: function() {
          resolve(true, arguments);
          return this;
        },
        
        reject: function() {
          resolve(false, arguments);
          return this;
        }
        
      };

      return promise;
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
    //       return util.getPromise(function(p) {
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
      return util.getPromise(function(promise) {
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
      return util.getPromise(function(promise) {
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

