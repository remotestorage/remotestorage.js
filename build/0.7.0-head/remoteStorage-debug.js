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

define('lib/assets',[], function () {
  return {
    remoteStorageIcon: 'data:image/png;base64,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',
    remoteStorageCube: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAN1wAADdcBQiibeAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAR2SURBVFiFtddfqGVVHQfwz2/vfZ28c2WgP6hMoYkUV4qIYnSKmaQYwaaJ3oLeUnpJmDCmUhCaIhhKGelhelCqN9+ECKdAxR6kgnJASBN9KTGwP2oKTtyZs8/+9bDXPufcfe51xju6YLHX2fu3ft/v+q7fWb/fisy0o3brez6qmt4Luvo7frvx/E7cxNsmcCj2WGnuEb6JaXlbSz8zaX/ksXzj3SHwg6j8aeU28jjeh8TZ8nU3Aq8Sx+2b/ML3s3vnCHxp5YB0Hz6OTkgpMax2jxBSoMJfhGMemTx5aQQOxzWsnCC/gm6hZ+mvFMv36xUYCJQev2Jyt9P54tsj8OVYNW2+izuxIkzlAoGUQuLlMuNqKcQCgVBJNSa4X93+xK/zfxcmcLj5GtUJ8ipMC/i0gA/PQYF/lFkfHClQFxJ1IVET/6S72+n2oa0JHL7s0+RPsR9tAZuOxuNtGKS9xpL8A7BmNP4j8S2nzz+lGJaWDxB7RyCbV54DkZiSrbAhbJBt/25LtUbEY2+P1bdmQY1V8mr8DruET5Z9n4NHTOmmZK9A2ihzp3RdL3tVy+z16OeG0ElncI48yGzeogIzQgexByelp2fMZ+CDAtFK56XzxFwBXSE6C9incbL4PDha9BKBPrjCddJRVT5DHsMLczkLUGhFbPR9iJNYjJUXyGOqfEY6KlxnHrybVjwm0JVDJmV8FZ8TeZysZdyBK9FKXb/6mdTZ+4uXRXcKUxnHpavKdqV58G5JYJFdLvT3yuok3ROiuY3JZ3Rxu7CH7lxvHlPpNVX+nJU/yMk9VJ8nm5GvMc42W6Bwnhl2KRyQ7cOyaqy1R0ScEvFq6aestUdk1cj2YeEA3RwwtwbfSoHtxxmJXeS3nV25RR0/9KnJL8GZyz7i7MoD5MfQ9LZ5YZ+WY+AiW16vc8if/av8PkRevxNPiwTiLceRISPIM3iUOGxa/wfUbiTvxy3ETb3tRfi0HAMx+xgLY1XIeAUPYoO4S+YNqupyVXW5zBuIu/pvHuxtq5j5DLHkfxsFxoaBlN1vVKbEN2TQ5wdYLc8++YibhZvJx3VZizgy8rVEYhwDfUKZFxd/Jf8m4gsydtENJ17TZ8lcLbOGrFfJrKmOiDxHPk58GJ8oPqu3UmDOLr2B5/AhYt08K9Z9AMdAsCeQml6BnKdiriC+iP/iKWkdH7gQgSRfQoi4SWoLcMqsRaUcZiX1xu4yrZmpp6p721lavlLYK/PfeIm4djsCE7xZDNqSVocV9evNJCKIjq6TuTbbAlWvQGZfiCwWJqkqqb7pMUwG0IV/QXwdz1ouKjZXOP021EQjqt2i2k00/Tv1Evj8OfRnC1aPeokl2e/LrM/aYUk2Pgc43T6knqzjBCZytqqhpGpK0DXCmrC26d1Qgs3BJzihnqyPwbdWYJMaFyzLnyuW6yMFLrEsH7ftLyZ/LxbX7vRisrwFW7VHJk/a1+4njuL1udx5Rd9nW/A6cdS+dv/FgHPpl9PhorH67l9Ox62/nv8YdPX3dno9/z+G+TGrzjgPKwAAAABJRU5ErkJggg==',
   widgetCss:
      //make the things as a whole wide by default, or just the cube in 'connected', 'busy' and 'offline' states:
      '#remotestorage-state { position:fixed; top:15px; right:15px; height:32px; width:275px; font:normal 16px/100% sans-serif; z-index:99999; background:rgba(0,0,0,.3); padding:5px; border-radius:7px; box-shadow:0 1px rgba(255,255,255,.05), inset 0 1px rgba(0,0,0,.05); transition:width 500ms, background 500ms; }\n' 
      +'#remotestorage-state.connected, #remotestorage-state.busy, #remotestorage-state.offline { width:32px; background:none; box-shadow:none; }\n' 
      //style for both buttons:
      +'.remotestorage-button { margin:0; padding:.3em; font-size:14px; height:26px !important; background:#ddd; color:#333; border:1px solid #ccc; border-radius:3px; box-shadow:0 1px 1px #fff inset; }\n' 
      //style for the register button:
      +'#remotestorage-register-button { position:absolute; left:25px; top:8px; max-height:16px; text-decoration:none; font-weight:normal; }\n' 
      //style for the connect button:
      +'#remotestorage-connect-button { position:absolute; right:8px; top:8px; padding:0 0 0 17px; width:90px; cursor:pointer; text-align:left; border-radius:0 3px 3px 0; font-weight:normal; }\n' 
      +'#remotestorage-connect-button:hover, #remotestorage-connect-button:focus, .remotestorage-button:hover, .remotestorage-button:focus { background:#eee; color:#000; text-decoration:none; }\n' 
      //style for the useraddress text input:
      +'#remotestorage-useraddress { position:absolute; left:25px; top:8px; margin:0; padding:0 17px 0 3px; height:25px; width:142px; background:#eee; color:#333; border:0; border-radius:3px 0 0 3px; box-shadow:0 1px #fff, inset 0 1px #999; font-weight:normal; font-size:14px;}\n'
      +'#remotestorage-useraddress:hover, #remotestorage-useraddress:focus { background:#fff; color:#000; }\n' 
      //style for the cube:
      +'#remotestorage-cube { position:absolute; right:84px; -webkit-transition:right 500ms; -moz-transition:right 500ms; transition:right 500ms; z-index:99997; }\n' 
      //style for the questionmark and infotexts:
      +'#remotestorage-questionmark { position:absolute; left:0; padding:9px 8px; color:#fff; text-decoration:none; z-index:99999; font-weight:normal; }\n' 
      +'.infotext { position:absolute; left:0; top:0; width:255px; height:32px; padding:6px 5px 4px 25px; font-size:10px; background:black; color:white; border-radius:7px; opacity:.85; text-decoration:none; white-space:nowrap; z-index:99998; }\n' 
      +'#remotestorage-questiomark:hover { color:#fff; }\n' 
      +'#remotestorage-questionmark:hover+#remotestorage-infotext { display:inline; }\n' 
      //make cube spin in busy and connecting states: 
      +'#remotestorage-state.busy #remotestorage-cube, #remotestoreage-state.authing #remotestorage-cube, #remotestorage-state.connecting #remotestorage-cube {' 
      +'   -webkit-animation-name:remotestorage-loading; -webkit-animation-duration:2s; -webkit-animation-iteration-count:infinite; -webkit-animation-timing-function:linear;\n' 
      +'   -moz-animation-name:remotestorage-loading; -moz-animation-duration:2s; -moz-animation-iteration-count:infinite; -moz-animation-timing-function:linear;\n' 
      +'   -o-animation-name:remotestorage-loading; -o-animation-duration:2s; -o-animation-iteration-count:infinite; -o-animation-timing-function:linear;\n' 
      +'   -ms-animation-name:remotestorage-loading; -ms-animation-duration:2s; -ms-animation-iteration-count:infinite; -ms-animation-timing-function:linear; }\n' 
      
      +'   @-webkit-keyframes remotestorage-loading { from{-webkit-transform:rotate(0deg)} to{-webkit-transform:rotate(360deg)} }\n' 
      +'   @-moz-keyframes remotestorage-loading { from{-moz-transform:rotate(0deg)} to{-moz-transform:rotate(360deg)} }\n' 
      +'   @-o-keyframes remotestorage-loading { from{-o-transform:rotate(0deg)} to{-o-transform:rotate(360deg)} }\n' 
      +'   @-ms-keyframes remotestorage-loading { from{-ms-transform:rotate(0deg)} to{ -ms-transform:rotate(360deg)} }\n' 
      //hide all elements by default:
      +'#remotestorage-connect-button, #remotestorage-questionmark, #remotestorage-register-button, #remotestorage-cube, #remotestorage-useraddress, #remotestorage-infotext, #remotestorage-devsonly, #remotestorage-disconnect { display:none }\n' 
      //in anonymous, interrupted, authing and failed state, display register-button, connect-button, cube, questionmark:
      +'#remotestorage-state.anonymous #remotestorage-cube, #remotestorage-state.anonymous #remotestorage-connect-button, #remotestorage-state.anonymous #remotestorage-register-button, #remotestorage-state.anonymous #remotestorage-questionmark { display: block }\n'
      +'#remotestorage-state.connecting #remotestorage-cube, #remotestorage-state.connecting #remotestorage-connect-button, #remotestorage-state.connecting #remotestorage-useraddress, #remotestorage-state.connecting #remotestorage-questionmark { display: block }\n'
      +'#remotestorage-state.interrupted #remotestorage-cube, #remotestorage-state.interrupted #remotestorage-connect-button, #remotestorage-state.interrupted #remotestorage-register-button, #remotestorage-state.interrupted #remotestorage-questionmark { display: block }\n'
      +'#remotestorage-state.failed #remotestorage-cube, #remotestorage-state.failed #remotestorage-connect-button, #remotestorage-state.failed #remotestorage-register-button, #remotestorage-state.failed #remotestorage-questionmark { display: block }\n'
      +'#remotestorage-state.authing #remotestorage-cube, #remotestorage-state.authing #remotestorage-connect-button, #remotestorage-state.authing #remotestorage-useraddress, #remotestorage-state.authing #remotestorage-questionmark { display: block }\n'
      //in typing state, display useraddress, connect-button, cube, questionmark:
      +'#remotestorage-state.typing #remotestorage-cube, #remotestorage-state.typing #remotestorage-connect-button, #remotestorage-state.typing #remotestorage-useraddress, #remotestorage-state.typing #remotestorage-questionmark { display: block }\n'
      //display the cube when in connected, busy or offline state:
      +'#remotestorage-state.connected #remotestorage-cube, #remotestorage-state.busy #remotestorage-cube, #remotestorage-state.offline #remotestorage-cube { right:0; opacity:.5; cursor:pointer; display: block }\n'
      //display the devsonly text when in devsonly state:
      +'#remotestorage-state.devsonly #remotestorage-devsonly { display: block }\n'
      //style for disconnect hover only while hovering of widget:
      +'#remotestorage-disconnect { position:absolute; right:6px; top:9px; padding:5px 28px 2px 6px; height:17px; white-space:nowrap; font-size:10px; background:#000; color:#fff; border-radius:5px; opacity:.5; text-decoration:none; z-index:99996; }\n' 
      +'#remotestorage-disconnect strong { font-weight:bold; }\n' 
      +'#remotestorage-state.connected #remotestorage-cube:hover, #remotestorage-state.busy #remotestorage-cube:hover, #remotestorage-state.offline #remotestorage-cube:hover { opacity:1; }\n' 
      +'#remotestorage-state.connected #remotestorage-disconnect:hover, #remotestorage-state.busy #remotestorage-disconnect:hover, #remotestorage-state.offline #remotestorage-disconnect:hover { display:inline; }\n' 
      +'#remotestorage-state.connected #remotestorage-cube:hover+#remotestorage-disconnect, #remotestorage-state.busy #remotestorage-cube:hover+#remotestorage-disconnect, #remotestorage-state.offline #remotestorage-cube:hover+#remotestorage-disconnect { display:inline; }\n'
  };
});


define('lib/util',[], function() {

  

  // Namespace: util
  //
  // Utility functions. Mainly logging.
  //

  var loggers = {}, silentLogger = {};

  var knownLoggers = ['base', 'sync', 'webfinger', 'getputdelete', 'platform', 'baseClient', 'widget', 'store'];

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
          object[key] = this.bindContext(object[key], object);
        }
      }
      return object;
    },

    bindContext: function(callback, context) {
      if(context) {
        return function() { return callback.apply(context, arguments); };
      } else {
        return callback;
      }
    },

    deprecate: function(methodName, replacement) {
      console.log('WARNING: ' + methodName + ' is deprecated, use ' + replacement + ' instead');
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
          if(! this._handlers[eventName]) {
            throw "Unknown event: " + eventName;
          }
          this._handlers[eventName].forEach(function(handler) {
            handler.apply(null, handlerArgs);
          });
        },

        on: function(eventName, handler) {
          if(! this._handlers[eventName]) {
            throw "Unknown event: " + eventName;
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
  //
  // Method: setElementHTML
  //
  // Set the HTML content of an element.
  //
  // Parameters:
  //   element - either an Element or a DOM ID resolving to an element
  //   content - HTML content to set
  //
  // Platform support:
  //   browser - Yes
  //   node - not implemented
  //
  //
  // Method: getElementValue
  //
  //
  // Method: eltOn
  //
  //
  // Method: getLocation
  //
  //
  // Method: setLocation
  //
  //
  // Method: alert
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
    for(var i=0;i<lines.length;i++) {
      if(lines[i].length == 0) {
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

  function ajaxBrowser(params) {
    var timedOut = false;
    var timer;
    var xhr = new XMLHttpRequest();
    if(params.timeout) {
      timer = window.setTimeout(function() {
        timedOut = true;
        xhr.abort();
        params.error('timeout');
      }, params.timeout);
    }
    if(!params.method) {
      params.method='GET';
    }
    xhr.open(params.method, params.url, true);
    if(params.headers) {
      for(var header in params.headers) {
        xhr.setRequestHeader(header, params.headers[header]);
      }
    }
    logger.debug('A '+params.url);
    xhr.onreadystatechange = function() {
      if((xhr.readyState==4)) {
        logger.debug('B '+params.url);
        if(timer) {
          window.clearTimeout(timer);
        }
        logger.debug('xhr cb '+params.url);
        if(xhr.status==200 || xhr.status==201 || xhr.status==204 || xhr.status==207) {
          var headers = browserParseHeaders(xhr.getAllResponseHeaders());
          if(! headers) {
            // Firefox' getAllResponseHeaders is broken for CORS requests since forever.
            // https://bugzilla.mozilla.org/show_bug.cgi?id=608735
            // Any additional headers that are needed by other code, should be added here.
            headers = {
              'content-type': xhr.getResponseHeader('Content-Type')
            }
          }
          params.success(xhr.responseText, headers);
        } else {
          params.error(xhr.status || 'unknown error');
        }
      }
    }
    logger.debug('xhr '+params.url);
    if(typeof(params.data) === 'string') {
      xhr.send(params.data);
    } else {
      xhr.send();
    }
  }
  function ajaxExplorer(params) {
    //this won't work, because we have no way of sending the Authorization header. It might work for GET to the 'public' category, though.
    var xdr=new XDomainRequest();
    xdr.timeout=params.timeout || 3000;//is this milliseconds? documentation doesn't say
    xdr.open(params.method, params.url);
    xdr.onload=function() {
      if(xdr.status==200 || xdr.status==201 || xdr.status==204) {
        params.success(xhr.responseText);
      } else {
        params.error(xhr.status);
      }
    };
    xdr.onerror = function() {
      err('unknown error');//See http://msdn.microsoft.com/en-us/library/ms536930%28v=vs.85%29.aspx
    };
    xdr.ontimeout = function() {
      err(timeout);
    };
    if(params.data) {
      xdr.send(params.data);
    } else {
      xdr.send();
    }
  }
  function ajaxNode(params) {
    var http=require('http'),
      https=require('https'),
      url=require('url');
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
      port: (urlObj.port?port:(urlObj.protocol=='https:'?443:80)),
      headers: params.headers
    };
    var timer, timedOut;

    if(params.timeout) {
      timer = setTimeout(function() {
        params.error('timeout');
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
            params.success(str, normalizeHeaders(response.headers));
          } else {
            params.error(response.statusCode);
          }
        }
      });
    });
    request.on('error', function(e) {
      if(timer) {
        clearTimeout(timer);
      }
      params.error(e.message);
    });
    if(params.data) {
      request.end(params.data);
    } else {
      request.end();
    }
  }
  function parseXmlBrowser(str, cb) {
    var tree=(new DOMParser()).parseFromString(str, 'text/xml')
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
      link.properties = {}
      for(var k=0; k<props.length;k++) {
        link.properties[
          props[k].getAttribute('type')
        ] = props[k].childNodes[0].nodeValue;
      }
      if(link['rel']) {
        obj.Link.push({
          '@': link
        });
      }
    }
    cb(null, obj);
  }
  function parseXmlNode(str, cb) {
    var xml2js=require('xml2js');
    new xml2js.Parser().parseString(str, cb);
  }

  function harvestParamNode() {
  }
  function harvestParamBrowser(param) {
    if(location.hash.length) {
      var pairs = location.hash.substring(1).split('&');
      for(var i=0; i<pairs.length; i++) {
        if(pairs[i].substring(0, (param+'=').length) == param+'=') {
          var ret = decodeURIComponent(pairs[i].substring((param+'=').length));
          delete pairs[i];
          location = '#'+pairs.join('&');
          return ret;
        }
      }
    }
  }
  function setElementHtmlNode(eltName, html) {
  }
  function setElementHtmlBrowser(eltName, html) {
    var elt = eltName;
    if(! (elt instanceof Element)) {
      elt = document.getElementById(eltName);
    }
    elt.innerHTML = html;
  }
  function getElementValueNode(eltName) {
  }
  function getElementValueBrowser(eltName) {
    return document.getElementById(eltName).value;
  }
  function eltOnNode(eltName, eventType, cb) {
  }
  function eltOnBrowser(eltName, eventType, cb) {
    if(eventType == 'click') {
      document.getElementById(eltName).onclick = cb;
    } else if(eventType == 'hover') {
      document.getElementById(eltName).onmouseover = cb;
    } else if(eventType == 'type') {
      document.getElementById(eltName).onkeyup = cb;
    }
  }
  function getLocationBrowser() {
    //TODO: deal with http://user:a#aa@host.com/ although i doubt someone would actually use that even once between now and the end of the internet
    return window.location.href.split('#')[0];
  }
  function getLocationNode() {
  }
  function setLocationBrowser(location) {
    window.location = location;
  }
  function setLocationNode() {
  }
  function alertBrowser(str) {
    alert(str);
  }
  function alertNode(str) {
    console.log(str);
  }
  if(typeof(window) === 'undefined') {
    return {
      ajax: ajaxNode,
      parseXml: parseXmlNode,
      harvestParam: harvestParamNode,
      setElementHTML: setElementHtmlNode,
      getElementValue: getElementValueNode,
      eltOn: eltOnNode,
      getLocation: getLocationNode,
      setLocation: setLocationNode,
      alert: alertNode
    }
  } else {
    if(window.XDomainRequest) {
      return {
        ajax: ajaxExplorer,
        parseXml: parseXmlBrowser,
        harvestParam: harvestParamBrowser,
        setElementHTML: setElementHtmlBrowser,
        getElementValue: getElementValueBrowser,
        eltOn: eltOnBrowser,
        getLocation: getLocationBrowser,
        setLocation: setLocationBrowser,
        alert: alertBrowser
      };
    } else {
      return {
        ajax: ajaxBrowser,
        parseXml: parseXmlBrowser,
        harvestParam: harvestParamBrowser,
        setElementHTML: setElementHtmlBrowser,
        getElementValue: getElementValueBrowser,
        eltOn: eltOnBrowser,
        getLocation: getLocationBrowser,
        setLocation: setLocationBrowser,
        alert: alertBrowser
      };
    }
  }
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

    function userAddress2hostMetas(userAddress, cb) {
      var parts = userAddress.toLowerCase().split('@');
      if(parts.length < 2) {
        cb('That is not a user address. There is no @-sign in it');
      } else if(parts.length > 2) {
        cb('That is not a user address. There is more than one @-sign in it');
      } else {
        if(!(/^[\.0-9a-z\-\_]+$/.test(parts[0]))) {
          cb('That is not a user address. There are non-dotalphanumeric symbols before the @-sign: "'+parts[0]+'"');
        } else if(!(/^[\.0-9a-z\-]+$/.test(parts[1]))) {
          cb('That is not a user address. There are non-dotalphanumeric symbols after the @-sign: "'+parts[1]+'"');
        } else {
          var query = '?resource=acct:'+encodeURIComponent(userAddress);
          cb(null, [
            'https://'+parts[1]+'/.well-known/host-meta.json'+query,
            'https://'+parts[1]+'/.well-known/host-meta'+query,
            'http://'+parts[1]+'/.well-known/host-meta.json'+query,
            'http://'+parts[1]+'/.well-known/host-meta'+query
            ]);
        }
      }
    }
    function fetchXrd(addresses, timeout, cb, errors) {
      var firstAddress = addresses.shift();
      if(! errors) {
        errors = [];
      }
      if(firstAddress) {
        platform.ajax({
          url: firstAddress,
          success: function(data) {
            parseAsJrd(data, function(err, obj){
              if(err) {
                parseAsXrd(data, function(err, obj){
                  if(err) {
                    fetchXrd(addresses, timeout, cb);
                  } else {
                    cb(null, obj);
                  }
                });
              } else {
                cb(null, obj);
              }
            });
          },
          error: function(error) {
            errors.push(error);
            fetchXrd(addresses, timeout, cb, errors);
          },
          timeout: timeout
        });
      } else {
        cb('could not fetch XRD: ' + errors[0]);
      }
    }
    function parseAsXrd(str, cb) {
      platform.parseXml(str, function(err, obj) {
        if(err) {
          cb(err);
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
            cb(null, links);
          } else {
            cb('found valid xml but with no Link elements in there');
          }
        }
      });
    }
    function parseAsJrd(str, cb) {
      var obj;
      try {
        obj = JSON.parse(str);
      } catch(e) {
        cb('not valid JSON');
        return;
      }
      if(! obj.links) {
        cb('JRD contains no links');
      }
      var links = {};
      for(var i=0; i<obj.links.length; i++) {
        //just take the first one of each rel:
        if(obj.links[i].rel) {
          links[obj.links[i].rel]=obj.links[i];
        }
      }
      cb(null, links);
    }

    function parseRemoteStorageLink(obj, cb) {
      // TODO:
      //   * check for and validate properties.auth-method
      //   * validate type
      if(obj
          && obj['href']
          && obj['type']
          && obj['properties']
          && obj['properties']['auth-endpoint']
        ) {
        cb(null, obj);
      } else {
        cb('could not extract storageInfo from lrdd');
      }
    }


    // Method: getStorageInfo
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
    function getStorageInfo(userAddress, options, cb) {
      userAddress2hostMetas(userAddress, function(err1, hostMetaAddresses) {
        logger.debug("HOST META ADDRESSES", hostMetaAddresses, '(error: ', err1, ')');
        if(err1) {
          cb(err1);
        } else {
          fetchXrd(hostMetaAddresses, options.timeout, function(err2, hostMetaLinks) {
            if(err2) {
              cb('could not fetch host-meta for '+userAddress + ' (' + err2 + ')');
            } else {
              if(hostMetaLinks['remoteStorage'] || hostMetaLinks['remotestorage']) {
                parseRemoteStorageLink(
                  hostMetaLinks['remoteStorage'] || hostMetaLinks['remotestorage'],
                  cb
                );
              } else if(hostMetaLinks['lrdd'] && hostMetaLinks['lrdd'].template) {
                var parts = hostMetaLinks['lrdd'].template.split('{uri}');
                var lrddAddresses=[parts.join('acct:'+userAddress), parts.join(userAddress)];
                 fetchXrd(lrddAddresses, options.timeout, function(err4, lrddLinks) {
                  if(err4) {
                    cb('could not fetch lrdd for '+userAddress);
                  } else if(lrddLinks['remoteStorage']) {
                    parseRemoteStorageLink(lrddLinks['remoteStorage'], cb);
                  } else if(lrddLinks['remotestorage']) {
                    parseRemoteStorageLink(lrddLinks['remotestorage'], cb);
                  } else {
                    cb('could not extract storageInfo from lrdd');
                  }
                });
              } else {
                cb('could not extract lrdd template from host-meta');
              }
            }
          });
        }
      });
    }
    return {
      getStorageInfo: getStorageInfo
    }
});

define('lib/hardcoded',
  ['./platform'],
  function (platform) {

    

    // Namespace: hardcoded
    //
    // Legacy webfinger fallbacks for dutch universities.

    var guesses={
      //'dropbox.com': {
      //  api: 'Dropbox',
      //  authPrefix: 'http://proxy.unhosted.org/OAuth.html?userAddress=',
      //  authSuffix: '',
      //  templatePrefix: 'http://proxy.unhosted.org/Dropbox/',
      //  templateSuffix: '/{category}/'
      //},
      //'gmail.com': {
      //  api: 'GoogleDocs',
      //  authPrefix: 'http://proxy.unhosted.org/OAuth.html?userAddress=',
      //  authSuffix: '',
      //  templatePrefix: 'http://proxy.unhosted.org/GoogleDocs/',
      //  templateSuffix: '/{category}/'
      //},
      'iriscouch.com': {
        type: 'https://www.w3.org/community/unhosted/wiki/remotestorage-2011.10#couchdb',
        authPrefix: 'http://proxy.unhosted.org/OAuth.html?userAddress=',
        hrefPrefix: 'http://proxy.unhosted.org/CouchDb',
        pathFormat: 'host/user'
      }
    };
    (function() {
      var surfnetSaml= {
        type: 'https://www.w3.org/community/unhosted/wiki/remotestorage-2011.10#simple',
        authPrefix: 'https://storage.surfnetlabs.nl/saml/oauth/authorize?user_address=',
        hrefPrefix: 'https://storage.surfnetlabs.nl/saml',
        pathFormat: 'user@host'
      };
      var surfnetBrowserId= {
        type: 'https://www.w3.org/community/unhosted/wiki/remotestorage-2011.10#simple',
        authPrefix: 'https://storage.surfnetlabs.nl/browserid/oauth/authorize?user_address=',
        hrefPrefix: 'https://storage.surfnetlabs.nl/browserid',
        pathFormat: 'user@host'
      };
      var dutchUniversitiesNoSaml= ['leidenuniv.nl', 'leiden.edu', 'uva.nl', 'vu.nl', 'eur.nl', 'maastrichtuniversity.nl',
        'ru.nl', 'rug.nl', 'uu.nl', 'tudelft.nl', 'utwente.nl', 'tue.nl', 'tilburguniversity.edu', 'uvt.nl', 'wur.nl',
        'wageningenuniversity.nl', 'ou.nl', 'lumc.nl', 'amc.nl',
        'ahk.nl', 'cah.nl', 'driestar.nl', 'che.nl', 'chn.nl', 'hen.nl', 'huygens.nl', 'diedenoort.nl', 'efa.nl', 'dehaagsehogeschool.nl',
        'hasdenbosch.nl', 'inholland.nl', 'hsbrabant.nl', 'dehorst.nl', 'kempel.nl', 'domstad.nl', 'hsdrenthe.nl', 'edith.nl', 'hsleiden.nl',
        'interport.nl', 'schumann.nl', 'hsbos.nl', 'hva.nl', 'han.nl', 'hvu.nl', 'hesasd.nl', 'hes-rdam.nl', 'hku.nl', 'hmtr.nl',
        'hzeeland.nl', 'hotelschool.nl', 'ichtus-rdam.nl', 'larenstein.nl', 'iselinge.nl', 'koncon.nl', 'kabk.nl', 'lhump.nl', 'msm.nl', 'hsmarnix.nl',
        'nhtv.nl', 'nth.nl', 'nhl.nl', 'sandberg.nl', 'hsij.nl', 'stoas.nl', 'thrijswijk.nl', 'tio.nl', 'vhall.nl', 'chw.nl', 'hogeschoolrotterdam.nl'];
      var dutchUniversitiesSaml= ['surfnet.nl', 'fontys.nl'];
      for(var i=0;i<dutchUniversitiesSaml.length;i++) {
        guesses[dutchUniversitiesSaml[i]]=surfnetSaml;
      }
      for(var i=0;i<dutchUniversitiesNoSaml.length;i++) {
        guesses[dutchUniversitiesNoSaml[i]]=surfnetBrowserId;
      }
    })();

    function testIrisCouch(userAddress, options, cb) {
      platform.ajax({
        url: 'http://proxy.unhosted.org/irisCouchCheck?q=acct:'+userAddress,
        //url: 'http://proxy.unhosted.org/lookup?q=acct:'+userAddress,
        success: function(data) {
          var obj;
          try {
            obj=JSON.parse(data);
          } catch(e) {
          }
          if(!obj) {
            cb('err: unparsable response from IrisCouch check');
          } else {
            cb(null, obj);
          }
        },
        error: function(err) {
          cb('err: during IrisCouch test:'+err);
        },
        timeout: options.timeout/*,
        data: userName*/
      });
    }
    function mapToIrisCouch(userAddress) {
      var parts=userAddress.split('@');
      if(['libredocs', 'mail', 'browserid', 'me'].indexOf(parts[0]) == -1) {
        return parts[0]+'@iriscouch.com';
      } else {
        return parts[2].substring(0, parts[2].indexOf('.'))+'@iriscouch.com';
      }
    }
    function guessStorageInfo(userAddress, options, cb) {
      var parts=userAddress.split('@');
      if(parts.length < 2) {
        cb('That is not a user address. There is no @-sign in it');
      } else if(parts.length > 2) {
        cb('That is not a user address. There is more than one @-sign in it');
      } else {
        if(!(/^[\.0-9A-Za-z]+$/.test(parts[0]))) {
          cb('That is not a user address. There are non-dotalphanumeric symbols before the @-sign: "'+parts[0]+'"');
        } else if(!(/^[\.0-9A-Za-z\-]+$/.test(parts[1]))) {
          cb('That is not a user address. There are non-dotalphanumeric symbols after the @-sign: "'+parts[1]+'"');
        } else {
          while(parts[1].indexOf('.') != -1) {
            if(guesses[parts[1]]) {
              blueprint=guesses[parts[1]];
              cb(null, {
                rel: 'https://www.w3.org/community/unhosted/wiki/personal-data-service-00',
                type: blueprint.type,
                href: blueprint.hrefPrefix+'/'+(blueprint.pathFormat=='user@host'?userAddress:parts[1]+'/'+parts[0]),
                properties: {
                  'access-methods': ['http://oauth.net/core/1.0/parameters/auth-header'],
                  'auth-methods': ['http://oauth.net/discovery/1.0/consumer-identity/static'],
                  'auth-endpoint': blueprint.authPrefix+userAddress
                }
              });
              return;
            }
            parts[1]=parts[1].substring(parts[1].indexOf('.')+1);
          }
          if(new Date() < new Date('9/9/2012')) {//temporary measure to help our 160 fakefinger users migrate learn to use their @iriscouch.com user addresses
            //testIrisCouch(mapToIrisCouch(userAddress), cb);
            testIrisCouch(userAddress, options, cb);
          } else {
            cb('err: not a guessable domain, and fakefinger-migration has ended');
          }
        }
      }
    }
    return {
      guessStorageInfo: guessStorageInfo
    }
});

define('lib/getputdelete',
  ['./platform', './util'],
  function (platform, util) {

    

    var logger = util.getLogger('getputdelete');

    var defaultContentType = 'application/octet-stream';

    function getContentType(headers) {
      if(headers['content-type']) {
        return headers['content-type'].split(';')[0];
      } else {
        logger.error("Falling back to default content type: ", defaultContentType, JSON.stringify(headers));
        return defaultContentType;
      }
    }

    function doCall(method, url, value, mimeType, token, cb, deadLine) {
      var platformObj = {
        url: url,
        method: method,
        error: function(err) {
          cb(err);
        },
        success: function(data, headers) {
          //logger.debug('doCall cb '+url, 'headers:', headers);
          cb(null, data, getContentType(headers));
        },
        timeout: deadLine || 5000
      }

      if(token) {
        platformObj.headers = {
          'Authorization': 'Bearer ' + token
        }
      }
      if(mimeType) {
        platformObj.headers['Content-Type'] = mimeType;
      }

      platformObj.fields = {withCredentials: 'true'};
      if(method != 'GET') {
        platformObj.data =value;
      }
      //logger.debug('platform.ajax '+url);
      platform.ajax(platformObj);
    }

    function get(url, token, cb) {
      doCall('GET', url, null, null, token, function(err, data, mimetype) {
        if(err == 404) {
          cb(null, undefined);
        } else {
          if(util.isDir(url)) {
            try {
              data = JSON.parse(data);
            } catch (e) {
              cb('unparseable directory index');
              return;
            }
          }
          cb(err, data, mimetype);
        }
      });
    }

    function put(url, value, mimeType, token, cb) {
      if(typeof(value) !== 'string') {
        cb("invalid value given to PUT, only strings allowed, got " + typeof(value));
      }

      logger.info('calling PUT '+url, ' (' + value.length + ')');
      doCall('PUT', url, value, mimeType, token, function(err, data) {
        //logger.debug('cb from PUT '+url);
        cb(err, data);
      });
    }

    function set(url, valueStr, mimeType, token, cb) {
      if(typeof(valueStr) == 'undefined') {
        doCall('DELETE', url, null, null, token, cb);
      } else {
        put(url, valueStr, mimeType, token, cb);
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
    }
});

define('lib/wireClient',['./getputdelete', './util'], function (getputdelete, util) {

  

  var prefix = 'remote_storage_wire_';

  var events = util.getEventEmitter('connected', 'error');

  function set(key, value) {
    localStorage.setItem(prefix+key, JSON.stringify(value));

    if(getState() == 'connected') {
      events.emit('connected');
    }
  }
  function remove(key) {
    localStorage.removeItem(prefix+key);
  }
  function get(key) {
    var valStr = localStorage.getItem(prefix+key);
    if(typeof(valStr) == 'string') {
      try {
        return JSON.parse(valStr);
      } catch(e) {
        localStorage.removeItem(prefix+key);
      }
    }
    return null;
  }
  function disconnectRemote() {
    remove('storageType');
    remove('storageHref');
    remove('bearerToken');
  }
  function getState() {
    if(get('storageType') && get('storageHref')) {
      if(get('bearerToken')) {
        return 'connected';
      } else {
        return 'authing';
      }
    } else {
      return 'anonymous';
    }
  }
  function on(eventType, cb) {
    events.on(eventType, cb);
  }

  function resolveKey(storageType, storageHref, basePath, relPath) {
    var item = ((basePath.length?(basePath + '/'):'') + relPath);
    return storageHref + item;
  }
  function setChain(driver, hashMap, mimeType, token, cb, timestamp) {
    var i;
    for(i in hashMap) {
      break;
    }
    if(i) {
      var thisOne = hashMap[i];
      delete hashMap[i];
      driver.set(i, thisOne, mimeType, token, function(err, timestamp) {
        if(err) {
          cb(err);
        } else {
          setChain(driver, hashMap, mimeType, token, cb, timestamp);
        }
      });
    } else {
      cb(null, timestamp);
    }
  }

  // Namespace: wireClient
  //
  // The wireClient stores the user's storage information and controls getputdelete accordingly.
  //
  // Event: connected
  //
  // Fired once everything is configured.
  return {

    // Method: get
    //
    // Get data from given path from remotestorage
    //
    // Parameters:
    //   path     - absolute path (starting from storage root)
    //   callback - see <getputdelete.get> for details on the callback parameters
    get: function (path, cb) {
      var storageType = get('storageType'),
        storageHref = get('storageHref'),
        token = get('bearerToken');
      if(typeof(path) != 'string') {
        cb('argument "path" should be a string');
      } else {
        getputdelete.get(resolveKey(storageType, storageHref, '', path), token, cb);
      }
    },

    // Method: set
    //
    // Write data to given path in remotestorage
    //
    // Parameters:
    //   path     - absolute path (starting from storage root)
    //   valueStr - raw data to write
    //   mimeType - MIME type to set as Content-Type header
    //   callback - see <getputdelete.set> for details on the callback parameters.
    set: function (path, valueStr, mimeType, cb) {
      var storageType = get('storageType'),
        storageHref = get('storageHref'),
        token = get('bearerToken');
      if(typeof(path) != 'string') {
        cb('argument "path" should be a string');
      } else {
        getputdelete.set(resolveKey(storageType, storageHref, '', path), valueStr, mimeType, token, cb);
      }
    },

    // Method: setStorageInfo
    //
    // Configure wireClient.
    //
    // Parameters:
    //   type - the storage type (see specification)
    //   href - base URL of the storage server
    //
    // Fires:
    //   configured - if wireClient is now fully configured
    //
    setStorageInfo   : function(type, href) { set('storageType', type); set('storageHref', href); },

    // Method: getStorageHref
    //
    // Get base URL of the user's remotestorage.
    getStorageHref   : function() { return get('storageHref') },
    
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
    setBearerToken   : function(bearerToken) { set('bearerToken', bearerToken); },

    // Method: disconnectRemote
    //
    // Clear the wireClient configuration
    disconnectRemote : disconnectRemote,

    // Method: on
    //
    // Install an event handler
    //
    // 
    on               : on,

    // Method: getState
    //
    // Get current state.
    //
    // Possible states are:
    //   anonymous - no information set
    //   authing   - storage's type & href set, but no token received yet
    //   connected - all information present.
    getState         : getState
  };
});

define('lib/store',['./util'], function (util) {

  

  // Namespace: store
  //
  // The store stores data locally. It treats all data as raw nodes, that have *metadata* and *payload*.
  // Metadata and payload are stored under separate keys.
  //
  // Type: Node
  //
  // Represents a node within the primary store.
  //
  // Properties:
  //   startAccess - either "r" or "rw". Flag means, that this node has been claimed access on (see <remoteStorage.claimAccess>) (default: null)
  //   startForce  - boolean flag to indicate that this node shall always be synced. (see <BaseClient.sync>) (default: null)
  //   timestamp   - last time this node was (apparently) updated (default: 0)
  //   keep        - A flag to indicate, whether this node should be kept in cache. Currently unused. (default: true)
  //   diff        - difference in the node's data since the last synchronization.
  //   mimeType    - MIME media type
  //
  // Event: change
  // See <BaseClient.Events>
  //
  // Event: error
  // See <BaseClient.Events>
  //
  // Method: on
  //
  // Install an event handler
  // See <util.EventEmitter.on> for documentation.

  var logger = util.getLogger('store');

  var events = util.getEventEmitter('change', 'error');

  var prefixNodes = 'remote_storage_nodes:',
      prefixNodesData = 'remote_storage_node_data:';

  function isPrefixed(key) {
    return key.substring(0, prefixNodes.length) == prefixNodes;
  }

  if(typeof(window) !== 'undefined') {
    window.addEventListener('storage', function(event) {
      if(isPrefixed(event.key)) {
        if(! util.isDir(event.path)) {
          event.path = event.key.substring(prefixNodes.length);
          event.origin = 'device';
          events.emit('change', event);
        }
      }
    });
  }

  // Method: getNode
  // get a node's metadata
  //
  // Parameters:
  //   path - absolute path
  //
  // Returns:
  //   a node object. If no node is found at the given path, a new empty
  //   node object is constructed instead.
  function getNode(path) {
    if(! path) {
      throw "No path given!";
    }
    validPath(path);
    var valueStr = localStorage.getItem(prefixNodes+path);
    var value;
    if(valueStr) {
      try {
        value = JSON.parse(valueStr);
      } catch(e) {
        logger.error("Invalid node data in store: ", valueStr);
        // invalid JSON data is treated like a node that doesn't exist.
      }
    }
    if(!value) {
      value = {//this is what an empty node looks like
        startAccess: null,
        startForce: null,
        timestamp: 0,
        mimeType: "application/json",
        keep: true,
        diff: {}
      };
    }
    return value;
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
    if(path[0] != '/') {
      throw "Invalid path: " + path;
    }
  }

  function updateNodeData(path, data) {
    validPath(path);
    if(! path) {
      console.trace();
      throw "Path is required!";
    }
    var encodedData;
    if(typeof(data) !== 'undefined') {
      if(typeof(data) === 'object') {
        encodedData = JSON.stringify(data);
      } else {
        encodedData = data;
      }
      localStorage.setItem(prefixNodesData+path, encodedData)
    } else {
      localStorage.removeItem(prefixNodesData+path)
    }
  }

  function determineDirTimestamp(path) {
    var data = getNodeData(path);
    if(data) {
      var times = [];
      for(var key in data) {
        times.push(data[key]);
      }
      return Math.max.apply(Math, times);
    } else {
      return getCurrTimestamp();
    }
  }

  function updateNode(path, node, outgoing, meta, timestamp) {
    validPath(path);

    if((!meta) && (! timestamp)) {
      if(outgoing) {
        timestamp = getCurrTimestamp();
      } else if(util.isDir(path)) {
        timestamp = determineDirTimestamp(path)
      } else {
        throw ('no timestamp given for node' + path);
        timestamp = 0;
      }
    }

    if(node && typeof(timestamp) !== 'undefined') {
      node.timestamp = timestamp;
    }

    if(node) {
      localStorage.setItem(prefixNodes+path, JSON.stringify(node));
    } else {
      localStorage.removeItem(prefixNodes+path);
    }
    var containingDir = util.containingDir(path);

    if(containingDir) {

      var parentNode=getNode(containingDir);
      var parentData = getNodeData(containingDir) || {};
      var baseName = getFileName(path);

      if(meta) {
        if(! (parentData && parentData[baseName])) {
          parentData[baseName] = 0;
          updateNodeData(containingDir, parentData);
        }
        updateNode(containingDir, parentNode, false, true, timestamp);
      } else if(outgoing) {
        if(node) {
          parentData[baseName] = timestamp;
        } else {
          delete parentData[baseName];
        }
        parentNode.diff[baseName] = timestamp;
        updateNodeData(containingDir, parentData);
        updateNode(containingDir, parentNode, true, false, timestamp);
      } else {//incoming
        if(node) {//incoming add or change
          if(!parentData[baseName] || parentData[baseName] < timestamp) {
            parentData[baseName] = timestamp;
            delete parentNode.diff[baseName];
            updateNodeData(containingDir, parentData);
            updateNode(containingDir, parentNode, false, false, timestamp);
          }
        } else {//incoming deletion
          if(parentData[baseName]) {
            delete parentData[baseName];
            delete parentNode.diff[baseName];
            updateNodeData(containingDir, parentData);
            updateNode(containingDir, parentNode, false, false, timestamp);
          }
        }
        if(! util.isDir(path)) {
          events.emit('change', {
            path: path,
            origin: 'remote',
            oldValue: undefined,
            newValue: (node ? getNodeData(path) : undefined),
            timestamp: timestamp
          });
        }
      }
    }
  }

  // Method: forget
  // Forget node at given path
  //
  // Parameters:
  //   path - absolute path
  function forget(path) {
    validPath(path);
    localStorage.removeItem(prefixNodes+path);
    localStorage.removeItem(prefixNodesData+path);
  }

  // Method: forgetAll
  // Forget all data stored by <store>.
  //
  function forgetAll() {
    for(var i=0; i<localStorage.length; i++) {
      if(localStorage.key(i).substr(0, prefixNodes.length) == prefixNodes ||
         localStorage.key(i).substr(0, prefixNodesData.length) == prefixNodesData) {
        localStorage.removeItem(localStorage.key(i));
        i--;
      }
    }
  }

  // Function: setNodeData
  //
  // update a node's metadata
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
    var node = getNode(path);
    if(!mimeType) {
      mimeType='application/json';
    }
    node.mimeType = mimeType;
    updateNodeData(path, data);
    updateNode(path, (data ? node : undefined), outgoing, false, timestamp);
  }

  // Method: getNodeData
  // get a node's data
  //
  // Parameters:
  //   path - absolute path
  //   raw  - (optional) if given and true, don't attempt to unpack JSON data
  //
  function getNodeData(path, raw) {
    logger.info('GET', path);
    validPath(path);
    var valueStr = localStorage.getItem(prefixNodesData+path);
    var node = getNode(path);
    if(valueStr) {
      if((!raw) && (node.mimeType == "application/json")) {
        try {
          return JSON.parse(valueStr);
        } catch(exc) {
          events.emit('error', "Invalid JSON node at " + path + ": " + valueStr);
        }
      }

      return valueStr;
    } else {
      return undefined;
    }
  }

  function removeNode(path) {
    setNodeData(path, undefined, false);
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
    var node = getNode(path);
    if((claim != node.startAccess) && (claim == 'rw' || node.startAccess == null)) {
      node.startAccess = claim;
      updateNode(path, node, false, true);//meta
    }
  }

  // Method: setNodeForce
  //
  // Set startForce flag on a node.
  //
  // Parameters:
  //   path  - absolute path to the node
  //   force - value to set for the force flag (boolean)
  //
  function setNodeForce(path, force) {
    var node = getNode(path);
    node.startForce = force;
    updateNode(path, node, false, true);//meta
  }

  // Method: clearDiff
  //
  // Clear current diff on the node. This only applies to
  // directory nodes.
  //
  // Clearing the diff is usually done, once the changes have been
  // propagated through sync.
  //
  // Parameters:
  //   path      - absolute path to the directory node
  //   childName - name of the child who's change has been propagated
  //
  function clearDiff(path, childName) {
    logger.debug('clearDiff', path, childName);
    var node = getNode(path);
    delete node.diff[childName];
    updateNode(path, node, false, true);//meta

    var parentPath;
    if(Object.keys(node.diff).length === 0 && (parentPath = util.containingDir(path))) {
      clearDiff(parentPath, util.baseName(path));
    }
  }

  // Method: fireInitialEvents
  //
  // Fire a change event with origin=device for each node present in localStorage.
  //
  // This is so apps don't need to add event handlers *and* initially request
  // listings to fill their views.
  //
  function fireInitialEvents() {
    for(var i=0; i<localStorage.length; i++) {
      var key = localStorage.key(i)
      if(isPrefixed(key)) {
        var path = key.substring(prefixNodes.length);
        if(! util.isDir(path)) {
          events.emit('change', {
            path: path,
            newValue: getNodeData(path),
            oldValue: undefined,
            origin: 'device'
          });
        }
      }
    }
  }

  return {
    on                : events.on,
    getNode           : getNode,
    getNodeData       : getNodeData,
    setNodeData       : setNodeData,
    setNodeAccess     : setNodeAccess,
    setNodeForce      : setNodeForce,
    clearDiff         : clearDiff,
    removeNode        : removeNode,
    forget            : forget,
    forgetAll         : forgetAll,
    fireInitialEvents : fireInitialEvents
  };
});

define('lib/sync',['./wireClient', './store', './util'], function(wireClient, store, util) {

  

  // Namespace: sync
  //
  // Sync is where all the magic happens. It connects the <store> and <wireClient>
  //

  var sync; // set below.

  var prefix = '_remoteStorage_', busy=false, syncOkNow=true;

  var logger = util.getLogger('sync');
  var events = util.getEventEmitter('state');

  function getState(path) {//should also distinguish between synced and locally modified for the path probably
    if(busy) {
      return 'busy';
    } else {
      return 'connected';
    }
  }
  function setBusy(val) {
    busy=val;

    events.emit('state', val ? 'busy' : 'connected');
  }

  var syncTimestamps = {};

  function dirMerge(dirPath, remote, cached, diff, force, access, startOne, finishOne, clearCb) {
    for(var i in remote) {
      if((!cached[i] && !diff[i]) || cached[i] < remote[i]) {//should probably include force and keep in this decision
        if(! util.isDir(dirPath + i)) {
          syncTimestamps[dirPath + i] = remote[i];
        }
        pullNode(dirPath+i, force, access, startOne, finishOne);
      }
    }
    for(var i in cached) {
      if(!remote[i] && !diff[i]) { // incoming delete
        store.removeNode(dirPath + i);
      } else if(!remote[i] || cached[i] > remote[i]) {
        if(util.isDir(i)) {
          pullNode(dirPath+i, force, access, startOne, finishOne);
        } else {//recurse
          var childNode = store.getNode(dirPath+i);
          var childData = store.getNodeData(dirPath + i);
          startOne();
          if(typeof(childData) === 'object') {
            childData = JSON.stringify(childData);
          }
          wireClient.set(dirPath+i, childData, childNode.mimeType, function(err) {
            if(err) {
              logger.error('wireclient said error', err);
            }
            finishOne(err);
          });
        }
      } else if(remote[i]) {
        if(! util.isDir(dirPath + i)) {
          syncTimestamps[dirPath + i] = remote[i];
        }
      }
    }
    for(var i in diff) {
      if(!cached[i]) {//outgoing delete
        if(remote[i]) {
          startOne();
          wireClient.set(dirPath+i, undefined, undefined, function(err) {
            finishOne();
          });
        } else {
          clearCb(i);
        }
      } else {
        clearCb(i);
      }
    }
  }

  function getFileName(path) {
    var parts = path.split('/');
    if(util.isDir(path)) {
      return parts[parts.length-2]+'/';
    } else {
      return parts[parts.length-1];
    }
  }

  function findForce(path, node) {
    if(! node) {
      return null;
    } else if(! node.startForce) {
      var parentPath = util.containingDir(path);
      if((!path) || (parentPath == path)) {
        return false;
      } else if(parentPath) {
        return findForce(parentPath, store.getNode(parentPath));
      }
    } else {
      return node.startForce;
    }
  }

  function hasDiff(parentPath, fname) {
    var parent = store.getNode(parentPath);
    return !! parent.diff[fname];
  }

  function pushNode(path, startOne, finishOne) {
    if(util.isDir(path)) {
      var dirNode = store.getNode(path);
      dirMerge(path, store.getNodeData(path), dirNode.diff, false, false, startOne, finishOne, function(i) { store.clearDiff(path, i); });
    }
    logger.debug('pushNode', path);
    var parentPath = util.containingDir(path);
    var fname = getFileName(path)
    if(hasDiff(parentPath, fname)) {
      logger.debug('pushNode!', path);
      var data = store.getNodeData(path, true);
      var node = store.getNode(path);
      if(! data) {
        logger.error("ATTEMPTED TO PUSH EMPTY DATA", node, data);
        return;
      }
      wireClient.set(path, data, node.mimeType, function(err) {
        logger.debug("wire client set result", arguments);
        if(! err) {
          store.clearDiff(parentPath, fname);
        } else {
          logger.error('pushNode', err);
        }
        finishOne(err);
      });
    }
  }

  function pullNode(path, force, access, startOne, finishOne) {
    var thisNode = store.getNode(path);
    var thisData = store.getNodeData(path);
    var isDir = util.isDir(path);
    if((! thisData) && isDir) {
      thisData = {};
    }
    logger.debug('pullNode "'+path+'"', thisNode);

    if(thisNode.startAccess == 'rw' || !access) {
      force = thisNode.startAccess;
    }

    if(! force) {
      force = findForce(path, thisNode);
    }
    
    startOne();

    if(force || access) {
      wireClient.get(path, function(err, data, mimeType) {
        if(!err && data) {
          if(isDir) {
            dirMerge(path, data, thisData, thisNode.diff, force, access, startOne, finishOne, function(i) {
              store.clearDiff(path, i);
            });
          } else {
            var t = syncTimestamps[path];
            delete syncTimestamps[path];
            store.setNodeData(path, data, false, t, mimeType);
          }
        } else {
          pushNode(path, startOne, finishOne);
        }
        
        finishOne(err);
        
      });

      return;

    } else if(thisData && isDir) {
      for(var i in thisData) {
        if(util.isDir(i)) {
          pullNode(path+i, force, access, startOne, finishOne);
        }
      }
    }

    // this is an edge case, reached when all of the following are true:
    // * this is NOT a directory node
    // * neither this node nor any of it's parent have startForce set
    // * this node doesn't have it's startAccess flag set
    // * neither 'force' nor 'access' are forced by this pullNode call
    finishOne();

  }

  // TODO: DRY those two:

  function fetchNow(path, callback) {
    var outstanding = 0, errors=[];
    function startOne() {
      outstanding++;
    }
    function finishOne(err) {
      if(err) {
        errors.push(err);
      }
      outstanding--;
      if(outstanding == 0) {
        setBusy(false);
        callback(errors || null, store.getNode(path));
      }
    }
    setBusy(true);
    pullNode(path, false, true, startOne, finishOne)
  }

  function syncNow(path, callback, force) {

    if(! path) {
      throw "path is required";
    }

    if((! syncOkNow) && (! force) || busy) {
      return callback(null);
    }

    if(wireClient.getState() == 'anonymous') {
      if(callback) {
        callback(['not connected']);
      }
      return;
    }

    var outstanding=0, errors=[];
    function startOne() {
      outstanding++;
    }
    function finishOne(err) {
      if(err) {
        errors.push(path);
      }
      outstanding--;
      if(outstanding==0) {
        setBusy(false);
        setTimeout(function() {
          syncOkNow = true;
        }, sync.minPollInterval);
        if(callback) {
          callback(errors.length > 0 ? errors : null);
        } else {
          logger.info('syncNow done');
        }
      }
    }
    logger.info('syncNow '+path);
    setBusy(true);
    syncOkNow = false;
    pullNode(path, false, false, startOne, finishOne);
  }

  sync = {
    // Property: minPollInterval
    // Minimal interval between syncNow calls.
    // All calls that happen in between, immediately succeed
    // (call their callbacks) without doing anything.
    minPollInterval: 3000,
    syncNow: syncNow,
    fetchNow: fetchNow,
    getState : getState,
    on: events.on,

    sleep: function() { syncOkNow = false; },
    wakeup: function() { syncOkNow = true; }

  };

  return sync;

});

define('lib/widget',['./assets', './webfinger', './hardcoded', './wireClient', './sync', './store', './platform', './util'], function (assets, webfinger, hardcoded, wireClient, sync, store, platform, util) {

  // Namespace: widget
  //
  // The remotestorage widget.
  //
  // See <remoteStorage.displayWidget>
  //
  //
  // Event: state
  //
  // Fired when the widget state changes.
  // See <remoteStorage.getWidgetState> for available states.

  

  var locale='en',
    connectElement,
    widgetState,
    userAddress,
    authDialogStrategy = 'redirect',
    authPopupRef,
    scopesObj = {};

  var events = util.getEventEmitter('state', 'ready');

  var popupSettings = 'resizable,toolbar=yes,location=yes,scrollbars=yes,menubar=yes,width=820,height=800,top=0,left=0';

  var logger = util.getLogger('widget');
  function translate(text) {
    return text;
  }

  function calcWidgetState() {
    var wireClientState = wireClient.getState();
    if(wireClientState == 'connected') {
      return sync.getState();// 'connected', 'busy'
    }
    return wireClientState;//'connected', 'authing', 'anonymous'
  }

  function setWidgetStateOnLoad() {
    setWidgetState(calcWidgetState());
  }

  function setWidgetState(state, updateView) {
    widgetState = state;
    if(updateView !== false) {
      displayWidgetState(state, userAddress);
    }
    events.emit('state', state);
  }

  function getWidgetState() {
    return widgetState;
  }

  function displayWidgetState(state, userAddress) {
    if(state === 'authing') {
      platform.alert("Authentication was aborted. Please try again.");
      return setWidgetState('typing')
    }

    var userAddress = localStorage['remote_storage_widget_useraddress'] || '';
    var html = 
      '<style>'+assets.widgetCss+'</style>'
      +'<div id="remotestorage-state" class="'+state+'">'
      +'  <input id="remotestorage-connect-button" class="remotestorage-button" type="submit" value="'+translate('connect')+'"/>'//connect button
      +'  <span id="remotestorage-register-button" class="remotestorage-button">'+translate('get remotestorage')+'</span>'//register
      +'  <img id="remotestorage-cube" src="'+assets.remoteStorageCube+'"/>'//cube
      +'  <span id="remotestorage-disconnect">Disconnect ' + (userAddress ? '<strong>'+userAddress+'</strong>' : '') + '</span>'//disconnect hover; should be immediately preceded by cube because of https://developer.mozilla.org/en/CSS/Adjacent_sibling_selectors:
      +'  <a id="remotestorage-questionmark" href="http://unhosted.org/#remotestorage" target="_blank">?</a>'//question mark
      +'  <span class="infotext" id="remotestorage-infotext">This app allows you to use your own data storage!<br/>Click for more info on the Unhosted movement.</span>'//info text
      //+'  <input id="remotestorage-useraddress" type="text" placeholder="you@remotestorage" autofocus >'//text input
      +'  <input id="remotestorage-useraddress" ' + (state == 'connecting' || state == 'authing' ? 'disabled="disabled" ' : '') + 'type="text" value="' + userAddress + '" placeholder="user@host" autofocus="" />'//text input
      +'  <a class="infotext" href="http://remotestoragejs.com/" target="_blank" id="remotestorage-devsonly">RemoteStorageJs is still in developer preview!<br/>Click for more info.</a>'
      +'</div>';
    platform.setElementHTML(connectElement, html);
    platform.eltOn('remotestorage-register-button', 'click', handleRegisterButtonClick);
    platform.eltOn('remotestorage-connect-button', 'click', handleConnectButtonClick);
    platform.eltOn('remotestorage-disconnect', 'click', handleDisconnectClick);
    platform.eltOn('remotestorage-cube', 'click', handleCubeClick);
    platform.eltOn('remotestorage-useraddress', 'type', handleWidgetTypeUserAddress);

    if(state === 'typing') {
      document.getElementById('remotestorage-useraddress').focus();
    }
  }
  function handleRegisterButtonClick() {
    window.open(
      'http://unhosted.org/en/a/register.html',
      'Get your remote storage',
      popupSettings
    );
  }
  function redirectUriToClientId(loc) {
    //TODO: add some serious unit testing to this function
    if(loc.substring(0, 'http://'.length) == 'http://') {
      loc = loc.substring('http://'.length);
    } else if(loc.substring(0, 'https://'.length) == 'https://') {
      loc = loc.substring('https://'.length);
    } else {
      return loc;//for all other schemes
    }
    var hostParts = loc.split('/')[0].split('@');
    if(hostParts.length > 2) {
      return loc;//don't know how to simplify URLs with more than 1 @ before the third slash
    }
    if(hostParts.length == 2) {
      hostParts.shift();
    }
    return hostParts[0];
  }

  //
  // //Section: Auth popup
  //
  //
  // when remoteStorage.displayWidget is called with the authDialog option set to 'popup',
  // the following happens:
  //   * When clicking "connect", a window is opened and saved as authPopupRef (prepareAuthPopup)
  //   * Once webfinger discovery is done, authPopupRef's location is set to the auth URL (setPopupLocation)
  //   * In case webfinger discovery fails, the popup is closed (closeAuthPopup)
  //   * As soon as the auth dialog redirects back with an access_token, the child popup calls
  //     "remotestorageTokenReceived" on the opening window and closes itself.
  //   * remotestorageTokenReceived recalculates the widget state -> we're connected!
  // 

  function prepareAuthPopup() { // in parent window
    authPopupRef = window.open(
      document.location,
      'remotestorageAuthPopup',
      popupSettings + ',dependent=yes'
    );
    window.remotestorageTokenReceived = function() {
      delete window.remotestorageTokenReceived;
      setWidgetStateOnLoad();
    };
  }

  function closeAuthPopup() { // in parent window
    authPopupRef.close();
  }

  function setAuthPopupLocation(location) { // in parent window
    authPopupRef.document.location = location;
  }

  function finalizeAuthPopup() { // in child window
    if(! frames.opener) {
      // not in child window (probably due to storage-first)
      return;
    }
    frames.opener.remotestorageTokenReceived();
    window.close();
  }

  function dance(endpoint) {
    var endPointParts = endpoint.split('?');
    var queryParams = [];
    if(endPointParts.length == 2) {
      queryParams=endPointParts[1].split('&');
    } else if(endPointParts.length>2) {
      errorHandler('more than one questionmark in auth-endpoint - ignoring');
    }
    var loc = platform.getLocation();
    var scopesArr = [];
    for(var i in scopesObj) {
      scopesArr.push(i+':'+scopesObj[i]);
    }
    queryParams.push('response_type=token');
    queryParams.push('scope='+encodeURIComponent(scopesArr.join(' ')));
    queryParams.push('redirect_uri='+encodeURIComponent(loc));
    queryParams.push('client_id='+encodeURIComponent(redirectUriToClientId(loc)));

    var authLocation = endPointParts[0]+'?'+queryParams.join('&');

    if(typeof(authDialogStrategy) == 'function') {
      authDialogStrategy(authLocation);
    } else {
      switch(authDialogStrategy) {
      case 'redirect':
        platform.setLocation(authLocation);
        break;
      case 'popup':
        setAuthPopupLocation(authLocation);
        break;
      default:
        throw "Invalid strategy for auth dialog: " + authDialogStrategy;
      }
    }
  }

  function discoverStorageInfo(userAddress, cb) {
    webfinger.getStorageInfo(userAddress, {timeout: 5000}, function(err, data) {
      if(err) {
        hardcoded.guessStorageInfo(userAddress, {timeout: 5000}, function(err2, data2) {
          if(err2) {
            logger.debug("Error from fakefinger: " + err2);
            cb(err);
          } else {
            if(data2.type && data2.href && data.properties && data.properties['auth-endpoint']) {
              wireClient.setStorageInfo(data2.type, data2.href);
              cb(null, data2.properties['auth-endpoint']);
            } else {
              cb('cannot make sense of storageInfo from webfinger');
            }
          }
        });
      } else {
        if(data.type && data.href && data.properties && data.properties['auth-endpoint']) {
          wireClient.setStorageInfo(data.type, data.href);
          cb(null, data.properties['auth-endpoint']);
        } else {
          cb('cannot make sense of storageInfo from hardcoded');
        }
      }
    });
  }

  var maxRetryCount = 2;

  function tryWebfinger(userAddress, retryCount) {
    if(typeof(retryCount) == 'undefined') {
      retryCount = 0;
    }
    discoverStorageInfo(userAddress, function(err, auth) {
      if(err) {
        if(err == 'timeout' && retryCount != maxRetryCount) {
          tryWebfinger(userAddress, retryCount + 1);
        } else {
          platform.alert('webfinger discovery failed! Please check if your user address is correct and try again. If the problem persists, contact your storage provider for support. (Error is: ' + err + ')');
        }
        if(authDialogStrategy == 'popup') {
          closeAuthPopup();
        }
        setWidgetState('failed');
      } else {
        dance(auth);
      }
    });
  }

  function handleConnectButtonClick() {
    if(widgetState == 'typing') {
      userAddress = platform.getElementValue('remotestorage-useraddress');
      localStorage['remote_storage_widget_useraddress']=userAddress;
      setWidgetState('connecting');
      if(authDialogStrategy == 'popup') {
        prepareAuthPopup();
      }
      tryWebfinger(userAddress);
    } else {
      setWidgetState('typing');
    }
  }
  function handleDisconnectClick() {
    sync.syncNow('/', function() {
      wireClient.disconnectRemote();
      store.forgetAll();
      // trigger 'disconnected' once, so the app can clear it's views.
      setWidgetState('disconnected', true);
      setWidgetState('anonymous');
    }, true);
  }
  function handleCubeClick() {
    if(widgetState == 'connected') {
     handleDisconnectClick();
    }
  }
  function handleWidgetTypeUserAddress(event) {
    if(event.keyCode === 13) {
      document.getElementById('remotestorage-connect-button').click();
    }
  }
  function handleWidgetHover() {
    logger.debug('handleWidgetHover');
  }

  function nowConnected() {
    setWidgetState('connected');
    store.fireInitialEvents();
    sync.syncNow('/', function(err) {
      if(err) {
        logger.error("Initial sync failed: ", err)
      } else {
        events.emit('ready');
      }
    }, true);
  }

  function display(setConnectElement, options) {
    var tokenHarvested = platform.harvestParam('access_token');
    var storageRootHarvested = platform.harvestParam('storage_root');
    var storageApiHarvested = platform.harvestParam('storage_api');
    var authorizeEndpointHarvested = platform.harvestParam('authorize_endpoint');
    if(! options) {
      options = {};
    }

    connectElement = setConnectElement;

    if(wireClient.getState() == 'connected') {
      nowConnected();
    } else {
      wireClient.on('connected', nowConnected);
    }

    wireClient.on('error', function(err) {
      platform.alert(translate(err));
    });

    sync.on('state', setWidgetState);

    if(typeof(options.authDialog) !== 'undefined') {
      authDialogStrategy = options.authDialog;
    }

    locale = options.locale;

    if(tokenHarvested) {
      wireClient.setBearerToken(tokenHarvested);

      if(authDialogStrategy === 'popup') {
        finalizeAuthPopup();
      }
    }
    if(storageRootHarvested) {
      wireClient.setStorageInfo((storageApiHarvested ? storageApiHarvested : '2012.04'), storageRootHarvested);
    }
    if(authorizeEndpointHarvested) {
      dance(authorizeEndpointHarvested);
    }

    setWidgetStateOnLoad();

    if(options.syncShortcut !== false) {
      window.onkeydown = function(evt) {
        if(evt.ctrlKey && evt.which == 83) {
          evt.preventDefault();
          logger.info("CTRL+S - SYNCING");
          sync.syncNow('/', function(errors) {});
          return false;
        }
      }
    }
    
  }

  function addScope(module, mode) {
    if(!scopesObj[module] || mode == 'rw') {
      scopesObj[module] = mode;
    }
  }
  
  return {
    display : display,
    addScope: addScope,
    getState: getWidgetState,
    on: events.on
  };
});

/* -*- js-indent-level:2 -*- */

define('lib/baseClient',['./sync', './store', './util'], function (sync, store, util) {

  

  var logger = util.getLogger('baseClient');
  var moduleEvents = {};

  function extractModuleName(path) {
    if (path && typeof(path) == 'string') {
      var parts = path.split('/');
      if(parts.length > 3 && parts[1] == 'public') {
        return parts[2];
      } else if(parts.length > 2){
        return parts[1];
      }
    }
  }

  function fireChange(moduleName, eventObj) {
    if(moduleEvents[moduleName]) {

      if(moduleName !== 'root') {
        eventObj.relativePath = eventObj.path.replace(new RegExp('^/(?:public/|)' + moduleName + '/'), '');
      }

      moduleEvents[moduleName].emit('change', eventObj);
    }
  }

  store.on('change', function(e) {
    var moduleName = extractModuleName(e.path);
    fireChange(moduleName, e);//remote-based changes get fired from the store.
    fireChange('root', e);//root module gets everything
  });

  function set(path, absPath, value) {
    var moduleName = extractModuleName(absPath);
    if(util.isDir(absPath)) {
      moduleEvents[moduleName].emit('error', 'attempt to set a value to a directory '+absPath);
      return;
    }
    var changeEvent = {
      origin: 'window',
      oldValue: store.getNodeData(absPath),
      newValue: value,
      path: path
    };
    store.setNodeData(absPath, value, true);
    fireChange(moduleName, changeEvent);
    fireChange('root', changeEvent);
  }

  var BaseClient = function(moduleName, isPublic) {
    this.moduleName = moduleName, this.isPublic = isPublic;
    moduleEvents[moduleName] = util.getEventEmitter('change', 'error');
    util.bindAll(this);
  }

  // Class: BaseClient
  //
  // A BaseClient allows you to get, set or remove data. It is the basic
  // interface for building "modules".
  //
  // See <remoteStorage.defineModule> for details.
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
    //   window - this event was generated from the same *browser tab* or window that received the event
    //   device - this event was generated from the same *app*, but a differnent tab or window
    //   remote - this event came from the *remotestorage server*. that means another app or the same app on another device caused the event.
    //
    // Example:
    //   > client.on('change', function(event) {
    //   >   if(event.newValue && event.oldValue) {
    //   >     console.log(event.origin + ' updated ' + event.path + ':', event.oldValue, '->', event.newValue);
    //   >   } else if(event.newValue) {
    //   >     console.log(event.origin + ' created ' + event.path + ':', undefined, '->', event.newValue);
    //   >   } else {
    //   >     console.log(event.origin + ' removed ' + event.path + ':', event.oldValue, '->', undefined);
    //   >   }
    //   > });
    //   

    makePath: function(path) {
      if(this.moduleName == 'root') {
        return path[0] === '/' ? path : ('/' + path);
      }
      return (this.isPublic?'/public/':'/')+this.moduleName+'/'+path;
    },

    nodeGivesAccess: function(path, mode) {
      var node = store.getNode(path);
      logger.debug("check node access", path, mode, node);
      var access = (new RegExp(mode)).test(node.startAccess);
      if(access) {
        return true
      } else if(path.length > 0) {
        return this.nodeGivesAccess(path.replace(/[^\/]+\/?$/, ''))
      }
    },

    ensureAccess: function(mode) {
      var path = this.makePath(this.moduleName == 'root' ? '/' : '');

      if(! this.nodeGivesAccess(path, mode)) {
        throw "Not sufficient access claimed for node at " + path;
      }
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
      moduleEvents[this.moduleName].on(eventType, util.bindContext(handler, context));
    },

    //
    // Method: getObject
    //
    // Get a JSON object from given path.
    //
    // Parameters:
    //   path     - relative path from the module root (without leading slash)
    //   callback - (optional) callback, see below
    //   context  - context for callback.
    //
    // Sync vs. async:
    //
    //   getObject can be called with or without a callback. When the callback is
    //   omitted, an object is returned immediately, from local cache.
    //   If on the other hand a callback is given, this forces a synchronization
    //   with remotestorage and calls the callback once that synchronization has
    //   happened.
    //
    // When do I use what?:
    //
    //   It very much depends on your circumstances, but roughly put,
    //   * if you are interested in a whole *branch* of objects, then force
    //     synchronization on the root of that branch using <BaseClient.use>,
    //     and after that use getObject *without* a callback to get your data from
    //     local cache.
    //   * if you only want to access a *single object* without syncing an entire
    //     branch, use the *asynchronous* variant. That way you only cause that
    //     particular object to be synchronized.
    //   * another reason to use the *asynchronous* call sequence would be, if you
    //     want to be very sure, that the local version of a certain object is
    //     *up-to-date*, when you retrieve it, without triggering a full-blown sync
    //     cycle.
    //
    // Returns:
    //   undefined              - When called with a callback
    //   an object or undefined - when called without a callback
    //
    getObject: function(path, callback, context) {
      this.ensureAccess('r');
      var absPath = this.makePath(path);
      if(callback) {
        sync.fetchNow(absPath, function(err, node) {
          var data = store.getNodeData(absPath);
          if(data && (typeof(data) == 'object')) {
            delete data['@type'];
          }
          util.bindContext(callback, context)(data);
        });
      } else {
        var node = store.getNode(absPath);
        var data = store.getNodeData(absPath);
        if(data && (typeof(data) == 'object')) {
          delete data['@type'];
        }
        return data;
      }
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
    //   callback - see getObject
    //   context  - see getObject
    //
    // Returns:
    //   An Array of keys, representing child nodes.
    //   Those keys ending in a forward slash, represent *directory nodes*, all
    //   other keys represent *data nodes*.
    //
    getListing: function(path, callback, context) {
      this.ensureAccess('r');
      var absPath = this.makePath(path);
      if(callback) {
        sync.fetchNow(absPath, function(err, node) {
          var data = store.getNodeData(absPath);
          var arr = [];
          for(var i in data) {
            arr.push(i);
          }
          util.bindContext(callback, context)(arr);
        });
      } else {
        var node = store.getNode(absPath);
        var data = store.getNodeData(absPath);
        var arr = [];
        for(var i in data) {
          arr.push(i);
        }
        return arr;
      }
    },

    //
    // Method: getAll
    //
    // Get all objects directly below a given path.
    //
    // Receives the same parameters as <getListing>
    //
    // Returns an object in the form { path : object, ... }
    //
    getAll: function(path, callback, context) {
      var makeMap = function(listing) {
        var o = {};
        listing.forEach(function(item) {
          o[path + item] = this.getObject(path + item);
        }, this);
        return o;
      }.bind(this);
      if(callback) {
        this.getListing(path, function(listing) {
          util.bindContext(callback, context)(makeMap(listing));
        }, this);
      } else {
        return makeMap(this.getListing(path));
      }
    },

    //
    // Method: getDocument
    //
    // Get the document at the given path. A Document is raw data, as opposed to
    // a JSON object (use <getObject> for that).
    //
    // Except for the return value structure, getDocument works exactly like
    // getObject.
    //
    // Parameters:
    //   path     - see getObject
    //   callback - see getObject
    //   context  - see getObject
    //
    // Returns:
    //   An object,
    //   mimeType - String representing the MIME Type of the document.
    //   data     - Raw data of the document.
    //
    getDocument: function(path, callback, context) {
      this.ensureAccess('r');
      var absPath = this.makePath(path);
      if(callback) {
        sync.fetchNow(absPath, function(err, node) {
          util.bindContext(callback, context)({
            mimeType: node.mimeType,
            data: store.getNodeData(absPath)
          });
        });
      } else {
        var node = store.getNode(absPath);
        return {
          mimeType: node.mimeType,
          data: store.getNodeData(absPath)
        };
      }
    },


    //
    // Method: remove
    //
    // Remove node at given path from storage. Triggers synchronization.
    //
    // Parameters:
    //   path     - Path relative to the module root.
    //   callback - (optional) passed on to <syncNow>
    //   context  - (optional) passed on to <syncNow>
    //
    remove: function(path, callback, context) {
      this.ensureAccess('w');
      set(path, this.makePath(path), undefined);
      this.syncNow(util.containingDir(path), callback, context);
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
    //   callback - (optional) passed on to <syncNow>
    //   context  - (optional) passed on to <syncNow>
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
    // 
    storeObject: function(type, path, obj, callback, context) {
      this.ensureAccess('w');
      if(typeof(obj) !== 'object') {
        throw "storeObject needs to get an object as value!"
      }
      obj['@type'] = 'https://remotestoragejs.com/spec/modules/'+this.moduleName+'/'+type;
      set(path, this.makePath(path), obj, 'application/json');
      var parentPath = util.containingDir(path);
      this.use(parentPath);
      this.syncNow(parentPath, callback, context);
    },

    //
    // Method: storeDocument
    //
    // Store raw data at a given path. Triggers synchronization.
    //
    // Parameters:
    //   mimeType - MIME media type of the data being stored
    //   path     - path relative to the module root. MAY NOT end in a forward slash.
    //   data     - string of raw data to store
    //   callback - (optional) passed to <syncNow>
    //   context  - (optional) passed to <syncNow>
    //
    // The given mimeType will later be returned, when retrieving the data
    // using getDocument.
    //
    storeDocument: function(mimeType, path, data, callback, context) {
      this.ensureAccess('w');
      set(path, this.makePath(path), data, mimeType);
      this.syncNow(path, callback, context);
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
      var base = remoteStorage.getStorageHref();
      if(! base) {
        return null;
      }
      if(base.substr(-1) != '/') {
        base = base + '/';
      }
      return base + this.makePath(path);
    },

    //
    // Method: use
    //
    // Force given path to be synchronized in the future.
    //
    // In order for a given path to be synchronized with remotestorage by
    // <syncNow>, it has to be marked as "interesting". This is done via the
    // *force* flag. Forcing sync on a directory causes the entire branch
    // to be considered "forced".
    //
    // Parameters:
    //   path      - path relative to the module root
    //   switchVal - optional boolean flag to set force value. Use "false" to remove the force flag.
    //
    use: function(path, switchVal) {
      var absPath = this.makePath(path);
      store.setNodeForce(absPath, (switchVal != false));
    },

    sync: function() {
      util.deprecate('BaseClient.sync', 'BaseClient.use');
      this.use.apply(this, arguments);
    },

    //
    // Method: syncNow
    //
    // Start synchronization at given path.
    //
    // Note that only those nodes will be synchronized, that have a *force* flag
    // set. Use <BaseClient.sync> to set the force flag on a node.
    //
    // Parameters:
    //   path     - relative path from the module root. 
    //   callback - (optional) callback to call once synchronization finishes.
    //   context  - (optional) context to bind callback to.
    //
    syncNow: function(path, callback, context) {
      sync.syncNow(
        this.makePath(path),
        ( callback ?
          util.bindContext(callback, context) :
          util.bindContext(function(errors) {
            if(errors && errors.length > 0) {
              if(! (errors.length == 1 && errors[0] == 'not connected')) {
                logger.error("Error syncing: ", errors);
              }
              moduleEvents[this.moduleName].emit('error', errors);
            }
          }, this) )
      );
    },

    deactivateSync: function() { sync.sleep(); },
    activateSync: function() { sync.wakeup(); }
    
  };

  return BaseClient;

});


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
    // Set bearer token directly. This practice is currently heavily discussed and
    // criticized on the mailinglist, as it apparently goes against the principles
    // of oauth.
    //
    setBearerToken: wireClient.setBearerToken

  }

});
define('remoteStorage',[
  'require',
  './lib/widget',
  './lib/baseClient',
  './lib/store',
  './lib/sync',
  './lib/wireClient',
  './lib/nodeConnect',
  './lib/util'
], function(require, widget, BaseClient, store, sync, wireClient, nodeConnect, util) {

  

  var claimedModules = {}, modules = {}, moduleNameRE = /^[a-z]+$/;

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
    //   remoteStorage.displayWidget(/* see documentation */);
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
        throw 'Invalid moduleName: "'+moduleName+'", only a-z lowercase allowed.'
      }

      logger.debug('DEFINE MODULE', moduleName);
      var module = builder(
        // private client:
        new BaseClient(moduleName, false),
        // public client:
        new BaseClient(moduleName, true)
      );
      modules[moduleName] = module;
      this[moduleName] = module.exports;
      logger.debug('Module defined: ' + moduleName, module, this);
    },

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
        moduleObj[moduleName] = mode
      }
      for(var _moduleName in moduleObj) {
        var _mode = moduleObj[_moduleName];
        testMode(_moduleName, _mode);
        this.claimModuleAccess(_moduleName, _mode);
      }
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

      if(moduleName == 'root') {
        moduleName = '';
        widget.addScope('', mode);
        store.setNodeAccess('/', mode);
      } else {
        widget.addScope(moduleName, mode);
        store.setNodeAccess('/'+moduleName+'/', mode);
        store.setNodeAccess('/public/'+moduleName+'/', mode);
      }
      claimedModules[moduleName] = true;
    },

    // PRIVATE
    setBearerToken: function(bearerToken, claimedScopes) {
      wireClient.setBearerToken(bearerToken);
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
    flushLocal       : store.forgetAll,

    //
    // Method: syncNow(path, callback)
    //
    // Synchronize local <-> remote storage.
    //
    // Syncing starts at given path and bubbles down.
    // The actual changes to either local or remote storage happen in the
    // future, so you should attach change handlers on the modules you're
    // interested in.
    //
    // Parameters:
    //   path - relative path from the storage root.
    //   callback - (optional) callback to be notified when synchronization has finished or failed.
    // 
    // Example:
    //   > remoteStorage.money.on('change', function(changeEvent) {
    //   >   // handle change event (update UI etc)
    //   > });
    //   >
    //   > remoteStorage.syncNow('/money/', function(errors) {
    //   >   // handle errors, if any.
    //   > });
    //
    // Modules may bring their own syncNow method, which should take preference
    // over the one here.
    //
    // Yields:
    //   Array of error messages - when errors occured. When syncNow is called and the user is not connected, this is also considered an error.
    //   null - no error occured, synchronization finished gracefully.
    //
    syncNow          : sync.syncNow,

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
    displayWidget    : widget.display,

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
    getWidgetState   : widget.getState,
    setStorageInfo   : wireClient.setStorageInfo,
    getStorageHref   : wireClient.getStorageHref,

    nodeConnect: nodeConnect,

    util: util

  };

  return remoteStorage;
});

  remoteStorage = require('remoteStorage');
})();
