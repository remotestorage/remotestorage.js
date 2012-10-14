
define([], function() {

  "use strict";

  // Namespace: util
  //
  // Utility functions. Mainly logging.
  //

  var loggers = {}, silentLogger = {};

  var knownLoggers = ['base', 'sync', 'webfinger', 'getputdelete', 'platform',
                      'baseClient', 'widget', 'store', 'foreignClient'];

  var util = {

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

    // Method: isDir
    // Convenience method to check if given path is a directory.
    isDir: function(path) {
      return path.substr(-1) == '/';
    },
    
    pathParts: function(path) {
      var parts = ['/'];
      var md;
      while(md = path.match(/^(.*?)([^\/]+\/?)$/)) {
        parts.unshift(md[2]);
        path = md[1];
      }
      return parts;
    },

    extend: function(a, b) {
      for(var key in b) {
        a[key] = b[key];
      }
      return a;
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

    bindAll: function(object) {
      for(var key in object) {
        if(typeof(object[key]) === 'function') {
          object[key] = this.bind(object[key], object);
        }
      }
      return object;
    },

    curry: function(f) {
      var _a = Array.prototype.slice.call(arguments, 1);
      return function() {
        var a = Array.prototype.slice.call(arguments);
        for(var i=(_a.length-1);i>=0;i--) {
          a.unshift(_a[i]);
        }
        return f.apply(this, a);
      }
    },

    bind: function(callback, context) {
      if(context) {
        return function() { return callback.apply(context, arguments); };
      } else {
        return callback;
      }
    },

    deprecate: function(methodName, replacement) {
      console.trace();
      console.log('WARNING: ' + methodName + ' is deprecated, use ' + replacement + ' instead');
    },

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

      return this.bindAll({

        _handlers: (function() {
          var eventNames = Array.prototype.slice.call(arguments);
          var handlers = {};
          eventNames.forEach(function(name) {
            handlers[name] = [];
          });
          return handlers;
        }).apply(null, arguments),

        emit: function(eventName) {
          var handlerArgs = Array.prototype.slice.call(arguments, 1);
          // console.log("EMIT", eventName, handlerArgs);
          if(! this._handlers[eventName]) {
            throw "Unknown event: " + eventName;
          }
          this._handlers[eventName].forEach(function(handler) {
            if(handler) {
              handler.apply(null, handlerArgs);
            }
          });
        },

        once: function(eventName, handler) {
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
          if(! this._handlers[eventName]) {
            throw "Unknown event: " + eventName;
          }
          if(typeof(handler) !== 'function') {
            throw "Expected function as handler, got: " + typeof(handler);
          }
          this._handlers[eventName].push(handler);
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
            if(silentLogger[name]) {
              return;
            }

            if(! type) {
              type = 'log';
            }

            args.unshift("[" + name.toUpperCase() + "] -- " + level + " ");
            
            (console[type] || console.log).apply(console, args);
          }
        }
      }

      return loggers[name];
    },

    // Method: silenceLogger
    // Silence all given loggers.
    //
    // So, if you're not interested in seeing all the synchronization logs, you could do:
    // > remoteStorage.util.silenceLogger('sync');
    //
    silenceLogger: function() {
      var names = util.toArray(arguments);
      for(var i=0;i<names.length;i++) {
        silentLogger[ names[i] ] = true;
      }
    },

    // Method: silenceLogger
    // Unsilence all given loggers.
    // The opposite of <silenceLogger>
    unsilenceLogger: function() {
      var names = util.toArray(arguments);
      for(var i=0;i<names.length;i++) {
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
    }
  }

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

