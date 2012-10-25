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

/** THIS FILE WAS GENERATED BY build/compile-assets.js. DO NOT CHANGE IT MANUALLY, BUT INSTEAD CHANGE THE ASSETS IN assets/. **/
define('lib/assets',[], function() {
  return {
    remotestorageIconError: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhLS0gQ3JlYXRlZCB3aXRoIElua3NjYXBlIChodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy8pIC0tPgoKPHN2ZwogICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgIHhtbG5zOmNjPSJodHRwOi8vY3JlYXRpdmVjb21tb25zLm9yZy9ucyMiCiAgIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyIKICAgeG1sbnM6c3ZnPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogICB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIKICAgeG1sbnM6c29kaXBvZGk9Imh0dHA6Ly9zb2RpcG9kaS5zb3VyY2Vmb3JnZS5uZXQvRFREL3NvZGlwb2RpLTAuZHRkIgogICB4bWxuczppbmtzY2FwZT0iaHR0cDovL3d3dy5pbmtzY2FwZS5vcmcvbmFtZXNwYWNlcy9pbmtzY2FwZSIKICAgd2lkdGg9IjMyIgogICBoZWlnaHQ9IjMyIgogICBpZD0ic3ZnMiIKICAgdmVyc2lvbj0iMS4xIgogICBpbmtzY2FwZTp2ZXJzaW9uPSIwLjQ4LjMuMSByOTg4NiIKICAgc29kaXBvZGk6ZG9jbmFtZT0icmVtb3Rlc3RvcmFnZS1pY29uLWVycm9yLnN2ZyIKICAgaW5rc2NhcGU6ZXhwb3J0LWZpbGVuYW1lPSIvaG9tZS91c2VyL3JlbW90ZXN0b3JhZ2UtaWNvbi1lcnJvci5wbmciCiAgIGlua3NjYXBlOmV4cG9ydC14ZHBpPSI5MCIKICAgaW5rc2NhcGU6ZXhwb3J0LXlkcGk9IjkwIj4KICA8ZGVmcwogICAgIGlkPSJkZWZzNCI+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwMzMiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZTIyMWI3O3N0b3Atb3BhY2l0eTowLjc0NjE1MzgzOyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDQwMzUiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNlMjIxYjc7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDAzNyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1NzUiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzciCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzAwMDAwMDtzdG9wLW9wYWNpdHk6MC43Mzg0NjE1NTsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDU3OSIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMDAwMDAwO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDQwODYiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OCIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY5MTAwO3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNjNDZmMDA7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8aW5rc2NhcGU6cGVyc3BlY3RpdmUKICAgICAgIHNvZGlwb2RpOnR5cGU9Imlua3NjYXBlOnBlcnNwM2QiCiAgICAgICBpbmtzY2FwZTp2cF94PSIwIDogNTI2LjE4MTA5IDogMSIKICAgICAgIGlua3NjYXBlOnZwX3k9IjAgOiAxMDAwIDogMCIKICAgICAgIGlua3NjYXBlOnZwX3o9Ijc0NC4wOTQ0OCA6IDUyNi4xODEwOSA6IDEiCiAgICAgICBpbmtzY2FwZTpwZXJzcDNkLW9yaWdpbj0iMzcyLjA0NzI0IDogMzUwLjc4NzM5IDogMSIKICAgICAgIGlkPSJwZXJzcGVjdGl2ZTI5ODUiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjkxMDA7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojYzQ2ZjAwO3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIHkyPSIwIgogICAgICAgeDI9IjEyOCIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4MT0iMTI4IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODkwIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xIgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzktMC0yIgogICAgICAgeDE9IjEyOCIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTI4IgogICAgICAgeTI9IjAiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmYwNDA0O3N0b3Atb3BhY2l0eTowLjc2MTUzODQ1OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmYwNDA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTciCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODM5LTAtOCIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTEyIgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIzMiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMzIsNzk2LjM2MjE4KSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTciPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY5MTAwO3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy0zIiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojYzQ2ZjAwO3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0yIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtMiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzktMC0zIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDMyLDc5Ni4zNjIxOCkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTIiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY5MzA0O3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTEiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjkzMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtMCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsNjUuMTQ4NzQ4LDEwNzEuNTAwNikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwMjUtNSIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMyIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC0zIj4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTQiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzA0OGJmZjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC03IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMwNDhiZmY7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzktMC04OSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwzMiw3OTYuMzYyMTgpIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC01Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC0yIiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTIiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDQ0LTkiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtMyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ4LTgiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0LTciPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDQwODYtNiIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3A0MDg4LTUiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE1OSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC42ODc1LDAsMCwtMSwyMjQsMTAyMC4zNjIyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTkiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MTYxIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsMC41OTUzOTI0NywtMC44NjYwMjU0LDAuNSwxOTAuODUxMjUsNzQ1LjIyMzc2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC03IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE2MyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwwLjU5NTM5MjQ3LDAuODY2MDI1NCwwLjUsNjUuMTQ4NzUsNzQ1LjIyMzc2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MTcwIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwzMiw3OTYuMzYyMTgpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MTcyIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LC0wLjU5NTM5MjQ3LDAuODY2MDI1NCwtMC41LDY1LjE0ODc0OCwxMDcxLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE3NCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwxOTAuODUxMjUsMTA3MS41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtNCI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNSIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC0yIj4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTciCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC00IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC02IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE3NC0yIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDE5MC44NTEyNSwxMDcxLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0LTYiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDQwODYtMCIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3A0MDg4LTkiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjUzLTkiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDE3Niw4MjguMzYyMTgpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNS0yIiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTctNCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMi05IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1NS03IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LC0wLjU5NTM5MjQ3LDAuODY2MDI1NCwtMC41LDIwOS4xNDg3NSwxMTAzLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDQ0LTItOSI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0Ni03LTciCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC00LTUiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTctNCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwzMzQuODUxMjUsMTEwMy41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA4NC02LTUiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDQwODYtMC05IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDQwODgtOS0zIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgeTI9Ii0wLjk5NDg1NjQyIgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwzMzQuODUxMjUsMTEwMy41MDA2KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDMxNyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi01IgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDM1OCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMTc2LDgyOC4zNjIxOCkiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDM2MCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSwyMDkuMTQ4NzUsMTEwMy41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC02IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDM2MiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwzMzQuODUxMjUsMTEwMy41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC02IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDM1OC03IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwxNzYsODI4LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC00LTYiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTUtOSIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03LTAiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItOCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzNjAtNCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSwyMDkuMTQ4NzUsMTEwMy41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC0yLTgiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtNy0zIgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtNC02IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC02LTYiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MzYyLTQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQtNi02Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTAtMCIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3A0MDg4LTktOCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1My05LTYiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDE3Niw4MjguMzYyMTgpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC01LTItNyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03LTQtMyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMi05LTMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjU1LTctMSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSwyMDkuMTQ4NzUsMTEwMy41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC0yLTktMyI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0Ni03LTctNSIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ4LTQtNS0zIgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgeTI9Ii0wLjk5NDg1NjQyIgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwzMzQuODUxMjUsMTEwMy41MDA2KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDMxNy04IgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC02LTUtNSIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA4NC02LTUtNSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDA4Ni0wLTktNiIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3A0MDg4LTktMy0zIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgeTI9Ii0wLjk5NDg1NjQyIgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwzMzQuODUxMjUsMTEwMy41MDA2KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDQzNCIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi01LTUiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi02IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUwOCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSw3MDIuODUxMjUsMTA3MS41MDA1KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTgiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTExIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LC0wLjU5NTM5MjQ3LDAuODY2MDI1NCwtMC41LDU3Ny4xNDg3NSwxMDcxLjUwMDUpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTYiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTE0IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSw1NDQsLTZlLTUpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1MTciCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDU4NCw3OTYuMzYyMTIpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi01LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTIwIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LDAuNTk1MzkyNDcsMC44NjYwMjU0LDAuNSw1NzcuMTQ4NzUsNzc3LjIyMzgpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItOS0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUyMyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LDAuNTk1MzkyNDcsLTAuODY2MDI1NCwwLjUsNzAyLjg1MTI1LDc3Ny4yMjM4KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTkiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTI2IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjY4NzUsMCwwLC0xLDczNiwyNTYuMDAwMDIpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUyOSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC42ODc1LDAsMCwtMSw3NzYsMTA1Mi4zNjIyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTYiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTMyIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSw1NjQsNzk2LjM2MjEyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1MzQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuNjg3NSwwLDAsLTEsNzU2LDI1Ni4wMDAwMikiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTkiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTM5IgogICAgICAgY3g9IjY2MCIKICAgICAgIGN5PSIxMjgiCiAgICAgICBmeD0iNjYwIgogICAgICAgZnk9IjEyOCIKICAgICAgIHI9IjExMiIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsMS4xNDI4NTcxLDYwLDcxMC4wNzY1MikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgLz4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTktOCIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1MzktNyIKICAgICAgIGN4PSI2NjAiCiAgICAgICBjeT0iMTI4IgogICAgICAgZng9IjY2MCIKICAgICAgIGZ5PSIxMjgiCiAgICAgICByPSIxMTIiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEsMCwwLDEuMTQyODU3MSwtMjAsNzc4LjA3NjQ3KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOS04Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC01LTItNy05IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTctNC0zLTgiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICByPSIxMTIiCiAgICAgICBmeT0iMTI4IgogICAgICAgZng9IjY2MCIKICAgICAgIGN5PSIxMjgiCiAgICAgICBjeD0iNjYwIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwxLjE0Mjg1NzEsMTYsMzMwLjA3NjUyKSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDU1NiIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQ1NzUiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05LTEiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTM5LTAiCiAgICAgICBjeD0iNjYwIgogICAgICAgY3k9IjEyOCIKICAgICAgIGZ4PSI2NjAiCiAgICAgICBmeT0iMTI4IgogICAgICAgcj0iMTEyIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwxLjE0Mjg1NzEsLTIwLDc3OC4wNzY0NykiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTktMSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNS0yLTctNiIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03LTQtMy0wIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgcj0iMTEyIgogICAgICAgZnk9IjEyOCIKICAgICAgIGZ4PSI2NjAiCiAgICAgICBjeT0iMTI4IgogICAgICAgY3g9IjY2MCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4xMjQ5OTk5OSwwLDAsMC4xNDI4NTcxMyw3OTcuNSw2NzguMDc2NTIpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTU2LTMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0NTc1LTIiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1NzUtMiI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDU3Ny02IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM4MTgxODE7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzktNCIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzA3MDcwO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIHI9IjExMiIKICAgICAgIGZ5PSIxMjgiCiAgICAgICBmeD0iNjYwIgogICAgICAgY3k9IjEyOCIKICAgICAgIGN4PSI2NjAiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMTI0OTk5OTksMCwwLDAuMTQyODU3MTMsNzMzLjUwMDAxLDY3OC4wNzY1MikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ2MDEiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOS0xIgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICByPSIxMTIiCiAgICAgICBmeT0iMTI4IgogICAgICAgZng9IjY2MCIKICAgICAgIGN5PSIxMjgiCiAgICAgICBjeD0iNjYwIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwxLjE0Mjg1NzEsMjM2LDc3OC4wNzY0NykiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1NTYtNSIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQ1NzUtMyIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDU3NS0zIj4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0NTc3LTkiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzgxODE4MTtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDU3OS04IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3MDcwNzA7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgcj0iMTEyIgogICAgICAgZnk9IjEyOCIKICAgICAgIGZ4PSI2NjAiCiAgICAgICBjeT0iMTI4IgogICAgICAgY3g9IjY2MCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4xMjQ5OTk5OSwwLDAsMC4xNDI4NTcxMyw4MjkuNTAwMDEsNjc4LjA3NjUyKSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDY0NSIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQ1NzUtMyIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgcj0iMTEyIgogICAgICAgZnk9IjEyOCIKICAgICAgIGZ4PSI2NjAiCiAgICAgICBjeT0iMTI4IgogICAgICAgY3g9IjY2MCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsMS4xNDI4NTcxLDIzNiw3NzguMDc2NDcpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTU2LTgiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0NTc1LTEiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1NzUtMSI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDU3Ny0yIgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMwMDAwMDA7c3RvcC1vcGFjaXR5OjAuNzM4NDYxNTU7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzktMiIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMDAwMDAwO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDAxNyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMzIsNzk2LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDAxOSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSw2NS4xNDg3NDgsMTA3MS41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwMjEiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMTkwLjg1MTI1LDEwNzEuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNTkiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MzU4LTMiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDE3Niw4MjguMzYyMTgpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNTkiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTUtNiIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03LTUiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItMyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzNjAtNiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSwyMDkuMTQ4NzUsMTEwMy41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC0yLTMiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtNy0wIgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtNC0yIgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC02LTciCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MzYyLTAiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQtNi03Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTAtNCIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3A0MDg4LTktNyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS0wIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1My05LTMiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDE3Niw4MjguMzYyMTgpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS0wIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC01LTItMSIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03LTQtNiIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMi05LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjU1LTctNyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSwyMDkuMTQ4NzUsMTEwMy41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC0yLTktNSI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0Ni03LTctNyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ4LTQtNS04IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgeTI9Ii0wLjk5NDg1NjQyIgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwzMzQuODUxMjUsMTEwMy41MDA2KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDMxNy04OSIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi01LTAiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQtNi01LTAiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDQwODYtMC05LTciIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC05LTMtOCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTMiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjc0NTA5ODA1OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTEwIiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTMiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDQ0LTciPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtMzIiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC43NDUwOTgwNTsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC0yIgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA4NC01Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC43NDUwOTgwNTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTMiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC0zIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtNS0yIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzU5MDRmZjtzdG9wLW9wYWNpdHk6MC43NDUwOTgwNTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC0yLTgiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM1OTA0ZmY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtMi01IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC05LTAiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtMy04IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtOC02IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC03LTMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MTYzLTkiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsMC41OTUzOTI0NywwLjg2NjAyNTQsMC41LDY1LjE0ODc1LDc0NS4yMjM3NikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQtNy0zIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2QyZGQyNjtzdG9wLW9wYWNpdHk6MC43NDUwOTgwNTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTYtMyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2QyZGQyNjtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3A0MDg4LTUtNyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi03IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDIzNSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSw1MjYuODUxMjUsMTI5MS41MDA3KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjM4IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LC0wLjU5NTM5MjQ3LDAuODY2MDI1NCwtMC41LDQwMS4xNDg3NSwxMjkxLjUwMDcpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTU5IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI0MSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMzUyLDQwMy45OTk5OSkiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01OSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNDQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDQ2OCwxMDE2LjM2MjIpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi01LTAiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjQ3IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LDAuNTk1MzkyNDcsMC44NjYwMjU0LDAuNSw0MDEuMTQ4NzUsOTk3LjIyMzkpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItOS01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1MCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LDAuNTk1MzkyNDcsLTAuODY2MDI1NCwwLjUsNTI2Ljg1MTI1LDk5Ny4yMjM5KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTAiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjUzIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjY4NzUsMCwwLC0xLDU0NCw2NjAuMDAwMDkpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1NyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwwLjU5NTM5MjQ3LDAuODY2MDI1NCwwLjUsNDAxLjE0ODc1LDcwOS4yMjM5KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTkiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjYwIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsMC41OTUzOTI0NywtMC44NjYwMjU0LDAuNSw1MjYuODUxMjUsNzA5LjIyMzkpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjYzIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjY4NzUsMCwwLC0xLDU2MCw5ODQuMzYyMzIpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTUyIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDM4Ny03IgogICAgICAgY3g9IjEwNDYuNTMxMiIKICAgICAgIGN5PSI1NzEuNDIxODgiCiAgICAgICBmeD0iMTA0Ni41MzEyIgogICAgICAgZnk9IjU3MS40MjE4OCIKICAgICAgIHI9Ijk1Ljk5OTk3NyIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMS4xNjY2NjY5LDAsMCwxLjM0NzI1MDEsLTI0NC45NTMzOSw4Ni41MDUwMzUpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTUyIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC43NjE1Mzg0NTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC03IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTQiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC0zMyI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuNzYxNTM4NDU7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNCIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC02IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTIwIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEuMTY2NjY2OSwwLDAsMS4zNDcyNTAxLC0yNDQuOTUzMzksODYuNTA1MDM1KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTMzIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUyMiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLjE2NjY2NjksMCwwLDEuMzQ3MjUwMSwxMzkuMDQ2NiwtMzYwLjE0OTk3KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTUyIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUyNCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjE0NDMyNjczLDAsMCwwLjE2NjY2NjQyLDkwNy4xMDIyMyw4OTcuMTI2NTYpIgogICAgICAgY3g9IjEwNDYuNTMxMiIKICAgICAgIGN5PSI1NzEuNDIxODgiCiAgICAgICBmeD0iMTA0Ni41MzEyIgogICAgICAgZnk9IjU3MS40MjE4OCIKICAgICAgIHI9Ijk1Ljk5OTk3NyIgLz4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtMzMiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTMyIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEuMTY2NjY2OSwwLDAsMS4zNDcyNTAxLDEzOS4wNDY2LC0zNjAuMTQ5OTcpIgogICAgICAgY3g9IjEwNDYuNTMxMiIKICAgICAgIGN5PSI1NzEuNDIxODgiCiAgICAgICBmeD0iMTA0Ni41MzEyIgogICAgICAgZnk9IjU3MS40MjE4OCIKICAgICAgIHI9Ijk1Ljk5OTk3NyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC03LTMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzMjU3IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LDAuNTk1MzkyNDcsMC44NjYwMjU0LDAuNSwxNDUuMTQ4NzUsOTk3LjIyMzgxKSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDAzMyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDMyNjAiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwwLjU5NTM5MjQ3LC0wLjg2NjAyNTQsMC41LDI3MC44NTEyNSw5OTcuMjIzODEpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC01LTIiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzMjYzIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjY4NzUsMCwwLC0xLDMwNCwxMjcyLjM2MjMpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDU4IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwtMTA4LDEwMTYuMzYyMikiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC03IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA2MCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSwtNzQuODUxMjUyLDEyOTEuNTAwNykiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNjIiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsNTAuODUxMjUsMTI5MS41MDA3KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA2NSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwyNzAuODUxMjUsMTI5MS41MDA3KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC03IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA2OCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSwxNDUuMTQ4NzUsMTI5MS41MDA3KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtMyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNzEiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDExMiwxMDE2LjM2MjIpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTIwIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUyMC00IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEuMTY2NjY2OSwwLDAsMS4zNDcyNTAxLC0yNDQuOTUzMzksODYuNTA1MDM1KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTIwIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC43NjE1Mzg0NTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC05IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTc3IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgcj0iOTUuOTk5OTc3IgogICAgICAgZnk9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgY3g9IjEwNDYuNTMxMiIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMS4xNjY2NjY5LDAsMCwxLjM0NzI1MDEsLTI0NC45NTMzOSw4Ni41MDUwMzUpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0MjA4IgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtMjAiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00IgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50MzYxNCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLjE2NjY2NjksMCwwLDEuMzQ3MjUwMSwyMTkuMDQ2NjEsODkuMTY3NzU3KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00IgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50MzYyNSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLjE2NjY2NjksMCwwLDEuMzQ3MjUwMSwyMTkuMDQ2NjEsODkuMTY3NzU3KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00IgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50MzIwOSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjE0NDMyNjk5LDAsMCwwLjE2NjY2NjczLDEyMDEuNTM1OCw4NzcuMTE0ODgpIgogICAgICAgY3g9IjEwNDYuNTMxMiIKICAgICAgIGN5PSI1NzEuNDIxODgiCiAgICAgICBmeD0iMTA0Ni41MzEyIgogICAgICAgZnk9IjU3MS40MjE4OCIKICAgICAgIHI9Ijk1Ljk5OTk3NyIgLz4KICA8L2RlZnM+CiAgPHNvZGlwb2RpOm5hbWVkdmlldwogICAgIGlkPSJiYXNlIgogICAgIHBhZ2Vjb2xvcj0iI2ZmZmZmZiIKICAgICBib3JkZXJjb2xvcj0iIzY2NjY2NiIKICAgICBib3JkZXJvcGFjaXR5PSIxLjAiCiAgICAgaW5rc2NhcGU6cGFnZW9wYWNpdHk9IjAuMCIKICAgICBpbmtzY2FwZTpwYWdlc2hhZG93PSIyIgogICAgIGlua3NjYXBlOnpvb209IjE2IgogICAgIGlua3NjYXBlOmN4PSI1LjkzMTE2NSIKICAgICBpbmtzY2FwZTpjeT0iMTYuMjM3MjI1IgogICAgIGlua3NjYXBlOmRvY3VtZW50LXVuaXRzPSJweCIKICAgICBpbmtzY2FwZTpjdXJyZW50LWxheWVyPSJsYXllcjEiCiAgICAgc2hvd2dyaWQ9InRydWUiCiAgICAgaW5rc2NhcGU6d2luZG93LXdpZHRoPSIxMjgwIgogICAgIGlua3NjYXBlOndpbmRvdy1oZWlnaHQ9IjgwMCIKICAgICBpbmtzY2FwZTp3aW5kb3cteD0iMCIKICAgICBpbmtzY2FwZTp3aW5kb3cteT0iLTMxIgogICAgIGlua3NjYXBlOndpbmRvdy1tYXhpbWl6ZWQ9IjEiCiAgICAgZml0LW1hcmdpbi10b3A9IjAiCiAgICAgZml0LW1hcmdpbi1sZWZ0PSIwIgogICAgIGZpdC1tYXJnaW4tcmlnaHQ9IjAiCiAgICAgZml0LW1hcmdpbi1ib3R0b209IjAiCiAgICAgaW5rc2NhcGU6c25hcC1wYWdlPSJ0cnVlIgogICAgIGlua3NjYXBlOnNuYXAtbm9kZXM9InRydWUiCiAgICAgZ3JpZHRvbGVyYW5jZT0iMTAiCiAgICAgc2hvd2JvcmRlcj0idHJ1ZSIKICAgICBzaG93Z3VpZGVzPSJ0cnVlIgogICAgIGlua3NjYXBlOmd1aWRlLWJib3g9InRydWUiPgogICAgPGlua3NjYXBlOmdyaWQKICAgICAgIHR5cGU9Inh5Z3JpZCIKICAgICAgIGlkPSJncmlkMzAyMSIKICAgICAgIGVtcHNwYWNpbmc9IjQiCiAgICAgICB2aXNpYmxlPSJ0cnVlIgogICAgICAgZW5hYmxlZD0idHJ1ZSIKICAgICAgIHNuYXB2aXNpYmxlZ3JpZGxpbmVzb25seT0idHJ1ZSIKICAgICAgIHNwYWNpbmd4PSIxNnB4IgogICAgICAgc3BhY2luZ3k9IjE2cHgiCiAgICAgICBkb3R0ZWQ9InRydWUiIC8+CiAgPC9zb2RpcG9kaTpuYW1lZHZpZXc+CiAgPG1ldGFkYXRhCiAgICAgaWQ9Im1ldGFkYXRhNyI+CiAgICA8cmRmOlJERj4KICAgICAgPGNjOldvcmsKICAgICAgICAgcmRmOmFib3V0PSIiPgogICAgICAgIDxkYzpmb3JtYXQ+aW1hZ2Uvc3ZnK3htbDwvZGM6Zm9ybWF0PgogICAgICAgIDxkYzp0eXBlCiAgICAgICAgICAgcmRmOnJlc291cmNlPSJodHRwOi8vcHVybC5vcmcvZGMvZGNtaXR5cGUvU3RpbGxJbWFnZSIgLz4KICAgICAgICA8ZGM6dGl0bGU+PC9kYzp0aXRsZT4KICAgICAgPC9jYzpXb3JrPgogICAgPC9yZGY6UkRGPgogIDwvbWV0YWRhdGE+CiAgPGcKICAgICBpbmtzY2FwZTpsYWJlbD0iTGF5ZXIgMSIKICAgICBpbmtzY2FwZTpncm91cG1vZGU9ImxheWVyIgogICAgIGlkPSJsYXllcjEiCiAgICAgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTEzMzYuNTc4NSwtOTU2LjM1MTg5KSI+CiAgICA8cGF0aAogICAgICAgc3R5bGU9ImNvbG9yOiMwMDAwMDA7ZmlsbDp1cmwoI3JhZGlhbEdyYWRpZW50MzIwOSk7ZmlsbC1vcGFjaXR5OjE7ZmlsbC1ydWxlOm5vbnplcm87c3Ryb2tlOm5vbmU7bWFya2VyOm5vbmU7dmlzaWJpbGl0eTp2aXNpYmxlO2Rpc3BsYXk6aW5saW5lO292ZXJmbG93OnZpc2libGU7ZW5hYmxlLWJhY2tncm91bmQ6YWNjdW11bGF0ZSIKICAgICAgIGQ9Im0gMTM1Mi41Nzg1LDk1Ni4zNTE4OSAwLjI4ODYsMTUuMTM2MjkgMTMuNTY2OCwtNy4xMzUxNiAtMTMuODU1NCwtOC4wMDExMyB6IG0gMCwwIC0xMy44NTU0LDguMDAxMTMgMTMuNTY2Nyw3LjEzNTE2IDAuMjg4NywtMTUuMTM2MjkgeiBtIC0xMy44NTU0LDguMDAxMTMgMCwxNS45OTc3NCAxMi45NTc5LC03LjgxNjIxIC0xMi45NTc5LC04LjE4MTUzIHogbSAwLDE1Ljk5Nzc0IDEzLjg1NTQsOC4wMDExMyAtMC42MDg5LC0xNS4zMTY3IC0xMy4yNDY1LDcuMzE1NTcgeiBtIDEzLjg1NTQsOC4wMDExMyAxMy44NTU0LC04LjAwMTEzIC0xMy4yNTEsLTcuMzE1NTcgLTAuNjA0NCwxNS4zMTY3IHogbSAxMy44NTU0LC04LjAwMTEzIDAsLTE1Ljk5Nzc0IC0xMi45NjI0LDguMTgxNTMgMTIuOTYyNCw3LjgxNjIxIHoiCiAgICAgICBpZD0icGF0aDQwMTYtMy04LTYiCiAgICAgICBpbmtzY2FwZTpjb25uZWN0b3ItY3VydmF0dXJlPSIwIiAvPgogIDwvZz4KPC9zdmc+Cg==',
    remotestorageIconOffline: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhLS0gQ3JlYXRlZCB3aXRoIElua3NjYXBlIChodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy8pIC0tPgoKPHN2ZwogICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgIHhtbG5zOmNjPSJodHRwOi8vY3JlYXRpdmVjb21tb25zLm9yZy9ucyMiCiAgIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyIKICAgeG1sbnM6c3ZnPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogICB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIKICAgeG1sbnM6c29kaXBvZGk9Imh0dHA6Ly9zb2RpcG9kaS5zb3VyY2Vmb3JnZS5uZXQvRFREL3NvZGlwb2RpLTAuZHRkIgogICB4bWxuczppbmtzY2FwZT0iaHR0cDovL3d3dy5pbmtzY2FwZS5vcmcvbmFtZXNwYWNlcy9pbmtzY2FwZSIKICAgd2lkdGg9IjMyIgogICBoZWlnaHQ9IjMyIgogICBpZD0ic3ZnMiIKICAgdmVyc2lvbj0iMS4xIgogICBpbmtzY2FwZTp2ZXJzaW9uPSIwLjQ4LjMuMSByOTg4NiIKICAgc29kaXBvZGk6ZG9jbmFtZT0icmVtb3Rlc3RvcmFnZS1pY29uLnN2ZyIKICAgaW5rc2NhcGU6ZXhwb3J0LWZpbGVuYW1lPSIvaG9tZS91c2VyL3dlYnNpdGUvaW1nL3JlbW90ZVN0b3JhZ2UtaWNvbi5wbmciCiAgIGlua3NjYXBlOmV4cG9ydC14ZHBpPSI5MCIKICAgaW5rc2NhcGU6ZXhwb3J0LXlkcGk9IjkwIj4KICA8ZGVmcwogICAgIGlkPSJkZWZzNCI+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwMzMiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZTIyMWI3O3N0b3Atb3BhY2l0eTowLjc0NjE1MzgzOyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDQwMzUiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNlMjIxYjc7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDAzNyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1NzUiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzciCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzAwMDAwMDtzdG9wLW9wYWNpdHk6MC43Mzg0NjE1NTsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDU3OSIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMDAwMDAwO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDQwODYiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OCIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY5MTAwO3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNjNDZmMDA7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8aW5rc2NhcGU6cGVyc3BlY3RpdmUKICAgICAgIHNvZGlwb2RpOnR5cGU9Imlua3NjYXBlOnBlcnNwM2QiCiAgICAgICBpbmtzY2FwZTp2cF94PSIwIDogNTI2LjE4MTA5IDogMSIKICAgICAgIGlua3NjYXBlOnZwX3k9IjAgOiAxMDAwIDogMCIKICAgICAgIGlua3NjYXBlOnZwX3o9Ijc0NC4wOTQ0OCA6IDUyNi4xODEwOSA6IDEiCiAgICAgICBpbmtzY2FwZTpwZXJzcDNkLW9yaWdpbj0iMzcyLjA0NzI0IDogMzUwLjc4NzM5IDogMSIKICAgICAgIGlkPSJwZXJzcGVjdGl2ZTI5ODUiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjkxMDA7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojYzQ2ZjAwO3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIHkyPSIwIgogICAgICAgeDI9IjEyOCIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4MT0iMTI4IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODkwIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xIgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzktMC0yIgogICAgICAgeDE9IjEyOCIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTI4IgogICAgICAgeTI9IjAiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojODI4MjgyO3N0b3Atb3BhY2l0eTowLjc2MTUzODQ1OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojODI4MjgyO3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTciCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODM5LTAtOCIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTEyIgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIzMiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMzIsNzk2LjM2MjE4KSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTciPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY5MTAwO3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy0zIiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojYzQ2ZjAwO3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0yIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtMiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzktMC0zIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDMyLDc5Ni4zNjIxOCkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTIiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY5MzA0O3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTEiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjkzMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtMCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsNjUuMTQ4NzQ4LDEwNzEuNTAwNikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwMjUtNSIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMyIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC0zIj4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTQiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzA0OGJmZjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC03IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMwNDhiZmY7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzktMC04OSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwzMiw3OTYuMzYyMTgpIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC01Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC0yIiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTIiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDQ0LTkiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtMyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ4LTgiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0LTciPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDQwODYtNiIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3A0MDg4LTUiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE1OSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC42ODc1LDAsMCwtMSwyMjQsMTAyMC4zNjIyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTkiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MTYxIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsMC41OTUzOTI0NywtMC44NjYwMjU0LDAuNSwxOTAuODUxMjUsNzQ1LjIyMzc2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC03IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE2MyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwwLjU5NTM5MjQ3LDAuODY2MDI1NCwwLjUsNjUuMTQ4NzUsNzQ1LjIyMzc2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MTcwIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwzMiw3OTYuMzYyMTgpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MTcyIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LC0wLjU5NTM5MjQ3LDAuODY2MDI1NCwtMC41LDY1LjE0ODc0OCwxMDcxLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE3NCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwxOTAuODUxMjUsMTA3MS41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtNCI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNSIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC0yIj4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTciCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC00IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC02IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE3NC0yIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDE5MC44NTEyNSwxMDcxLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0LTYiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDQwODYtMCIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3A0MDg4LTkiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjUzLTkiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDE3Niw4MjguMzYyMTgpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNS0yIiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTctNCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMi05IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1NS03IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LC0wLjU5NTM5MjQ3LDAuODY2MDI1NCwtMC41LDIwOS4xNDg3NSwxMTAzLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDQ0LTItOSI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0Ni03LTciCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC00LTUiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTctNCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwzMzQuODUxMjUsMTEwMy41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA4NC02LTUiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDQwODYtMC05IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDQwODgtOS0zIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgeTI9Ii0wLjk5NDg1NjQyIgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwzMzQuODUxMjUsMTEwMy41MDA2KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDMxNyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi01IgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDM1OCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMTc2LDgyOC4zNjIxOCkiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDM2MCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSwyMDkuMTQ4NzUsMTEwMy41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC02IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDM2MiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwzMzQuODUxMjUsMTEwMy41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC02IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDM1OC03IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwxNzYsODI4LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC00LTYiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTUtOSIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03LTAiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItOCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzNjAtNCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSwyMDkuMTQ4NzUsMTEwMy41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC0yLTgiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtNy0zIgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtNC02IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC02LTYiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MzYyLTQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQtNi02Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTAtMCIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3A0MDg4LTktOCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1My05LTYiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDE3Niw4MjguMzYyMTgpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC01LTItNyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03LTQtMyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMi05LTMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjU1LTctMSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSwyMDkuMTQ4NzUsMTEwMy41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC0yLTktMyI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0Ni03LTctNSIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ4LTQtNS0zIgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgeTI9Ii0wLjk5NDg1NjQyIgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwzMzQuODUxMjUsMTEwMy41MDA2KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDMxNy04IgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC02LTUtNSIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA4NC02LTUtNSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDA4Ni0wLTktNiIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3A0MDg4LTktMy0zIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgeTI9Ii0wLjk5NDg1NjQyIgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwzMzQuODUxMjUsMTEwMy41MDA2KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDQzNCIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi01LTUiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi02IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUwOCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSw3MDIuODUxMjUsMTA3MS41MDA1KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTgiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTExIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LC0wLjU5NTM5MjQ3LDAuODY2MDI1NCwtMC41LDU3Ny4xNDg3NSwxMDcxLjUwMDUpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTYiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTE0IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSw1NDQsLTZlLTUpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1MTciCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDU4NCw3OTYuMzYyMTIpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi01LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTIwIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LDAuNTk1MzkyNDcsMC44NjYwMjU0LDAuNSw1NzcuMTQ4NzUsNzc3LjIyMzgpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItOS0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUyMyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LDAuNTk1MzkyNDcsLTAuODY2MDI1NCwwLjUsNzAyLjg1MTI1LDc3Ny4yMjM4KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTkiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTI2IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjY4NzUsMCwwLC0xLDczNiwyNTYuMDAwMDIpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUyOSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC42ODc1LDAsMCwtMSw3NzYsMTA1Mi4zNjIyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTYiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTMyIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSw1NjQsNzk2LjM2MjEyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1MzQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuNjg3NSwwLDAsLTEsNzU2LDI1Ni4wMDAwMikiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTkiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTM5IgogICAgICAgY3g9IjY2MCIKICAgICAgIGN5PSIxMjgiCiAgICAgICBmeD0iNjYwIgogICAgICAgZnk9IjEyOCIKICAgICAgIHI9IjExMiIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsMS4xNDI4NTcxLDYwLDcxMC4wNzY1MikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgLz4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTktOCIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1MzktNyIKICAgICAgIGN4PSI2NjAiCiAgICAgICBjeT0iMTI4IgogICAgICAgZng9IjY2MCIKICAgICAgIGZ5PSIxMjgiCiAgICAgICByPSIxMTIiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEsMCwwLDEuMTQyODU3MSwtMjAsNzc4LjA3NjQ3KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOS04Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC01LTItNy05IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTctNC0zLTgiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICByPSIxMTIiCiAgICAgICBmeT0iMTI4IgogICAgICAgZng9IjY2MCIKICAgICAgIGN5PSIxMjgiCiAgICAgICBjeD0iNjYwIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwxLjE0Mjg1NzEsMTYsMzMwLjA3NjUyKSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDU1NiIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQ1NzUiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05LTEiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTM5LTAiCiAgICAgICBjeD0iNjYwIgogICAgICAgY3k9IjEyOCIKICAgICAgIGZ4PSI2NjAiCiAgICAgICBmeT0iMTI4IgogICAgICAgcj0iMTEyIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwxLjE0Mjg1NzEsLTIwLDc3OC4wNzY0NykiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTktMSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNS0yLTctNiIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03LTQtMy0wIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgcj0iMTEyIgogICAgICAgZnk9IjEyOCIKICAgICAgIGZ4PSI2NjAiCiAgICAgICBjeT0iMTI4IgogICAgICAgY3g9IjY2MCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4xMjQ5OTk5OSwwLDAsMC4xNDI4NTcxMyw3OTcuNSw2NzguMDc2NTIpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTU2LTMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0NTc1LTIiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1NzUtMiI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDU3Ny02IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM4MTgxODE7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzktNCIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzA3MDcwO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIHI9IjExMiIKICAgICAgIGZ5PSIxMjgiCiAgICAgICBmeD0iNjYwIgogICAgICAgY3k9IjEyOCIKICAgICAgIGN4PSI2NjAiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMTI0OTk5OTksMCwwLDAuMTQyODU3MTMsNzMzLjUwMDAxLDY3OC4wNzY1MikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ2MDEiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOS0xIgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICByPSIxMTIiCiAgICAgICBmeT0iMTI4IgogICAgICAgZng9IjY2MCIKICAgICAgIGN5PSIxMjgiCiAgICAgICBjeD0iNjYwIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwxLjE0Mjg1NzEsMjM2LDc3OC4wNzY0NykiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1NTYtNSIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQ1NzUtMyIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDU3NS0zIj4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0NTc3LTkiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzgxODE4MTtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDU3OS04IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3MDcwNzA7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgcj0iMTEyIgogICAgICAgZnk9IjEyOCIKICAgICAgIGZ4PSI2NjAiCiAgICAgICBjeT0iMTI4IgogICAgICAgY3g9IjY2MCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4xMjQ5OTk5OSwwLDAsMC4xNDI4NTcxMyw4MjkuNTAwMDEsNjc4LjA3NjUyKSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDY0NSIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQ1NzUtMyIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgcj0iMTEyIgogICAgICAgZnk9IjEyOCIKICAgICAgIGZ4PSI2NjAiCiAgICAgICBjeT0iMTI4IgogICAgICAgY3g9IjY2MCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsMS4xNDI4NTcxLDIzNiw3NzguMDc2NDcpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTU2LTgiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0NTc1LTEiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1NzUtMSI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDU3Ny0yIgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMwMDAwMDA7c3RvcC1vcGFjaXR5OjAuNzM4NDYxNTU7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzktMiIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMDAwMDAwO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDAxNyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMzIsNzk2LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDAxOSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSw2NS4xNDg3NDgsMTA3MS41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwMjEiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMTkwLjg1MTI1LDEwNzEuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNTkiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MzU4LTMiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDE3Niw4MjguMzYyMTgpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNTkiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTUtNiIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03LTUiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItMyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzNjAtNiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSwyMDkuMTQ4NzUsMTEwMy41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC0yLTMiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtNy0wIgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtNC0yIgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC02LTciCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MzYyLTAiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQtNi03Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTAtNCIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3A0MDg4LTktNyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS0wIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1My05LTMiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDE3Niw4MjguMzYyMTgpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS0wIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC01LTItMSIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03LTQtNiIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMi05LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjU1LTctNyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSwyMDkuMTQ4NzUsMTEwMy41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC0yLTktNSI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0Ni03LTctNyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ4LTQtNS04IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgeTI9Ii0wLjk5NDg1NjQyIgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwzMzQuODUxMjUsMTEwMy41MDA2KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDMxNy04OSIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi01LTAiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQtNi01LTAiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDQwODYtMC05LTciIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC05LTMtOCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTMiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjc0NTA5ODA1OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTEwIiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTMiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDQ0LTciPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtMzIiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC43NDUwOTgwNTsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC0yIgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA4NC01Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC43NDUwOTgwNTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTMiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC0zIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtNS0yIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzU5MDRmZjtzdG9wLW9wYWNpdHk6MC43NDUwOTgwNTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC0yLTgiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM1OTA0ZmY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtMi01IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC05LTAiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtMy04IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtOC02IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC03LTMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MTYzLTkiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsMC41OTUzOTI0NywwLjg2NjAyNTQsMC41LDY1LjE0ODc1LDc0NS4yMjM3NikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQtNy0zIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2QyZGQyNjtzdG9wLW9wYWNpdHk6MC43NDUwOTgwNTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTYtMyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2QyZGQyNjtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3A0MDg4LTUtNyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi03IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDIzNSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSw1MjYuODUxMjUsMTI5MS41MDA3KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjM4IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LC0wLjU5NTM5MjQ3LDAuODY2MDI1NCwtMC41LDQwMS4xNDg3NSwxMjkxLjUwMDcpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTU5IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI0MSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMzUyLDQwMy45OTk5OSkiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01OSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNDQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDQ2OCwxMDE2LjM2MjIpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi01LTAiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjQ3IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LDAuNTk1MzkyNDcsMC44NjYwMjU0LDAuNSw0MDEuMTQ4NzUsOTk3LjIyMzkpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItOS01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1MCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LDAuNTk1MzkyNDcsLTAuODY2MDI1NCwwLjUsNTI2Ljg1MTI1LDk5Ny4yMjM5KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTAiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjUzIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjY4NzUsMCwwLC0xLDU0NCw2NjAuMDAwMDkpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1NyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwwLjU5NTM5MjQ3LDAuODY2MDI1NCwwLjUsNDAxLjE0ODc1LDcwOS4yMjM5KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTkiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjYwIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsMC41OTUzOTI0NywtMC44NjYwMjU0LDAuNSw1MjYuODUxMjUsNzA5LjIyMzkpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjYzIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjY4NzUsMCwwLC0xLDU2MCw5ODQuMzYyMzIpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTUyIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDM4Ny03IgogICAgICAgY3g9IjEwNDYuNTMxMiIKICAgICAgIGN5PSI1NzEuNDIxODgiCiAgICAgICBmeD0iMTA0Ni41MzEyIgogICAgICAgZnk9IjU3MS40MjE4OCIKICAgICAgIHI9Ijk1Ljk5OTk3NyIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMS4xNjY2NjY5LDAsMCwxLjM0NzI1MDEsLTI0NC45NTMzOSw4Ni41MDUwMzUpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTUyIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC43NjE1Mzg0NTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC03IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTQiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC0zMyI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuNzYxNTM4NDU7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNCIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC02IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTIwIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEuMTY2NjY2OSwwLDAsMS4zNDcyNTAxLC0yNDQuOTUzMzksODYuNTA1MDM1KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTMzIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUyMiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLjE2NjY2NjksMCwwLDEuMzQ3MjUwMSwxMzkuMDQ2NiwtMzYwLjE0OTk3KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTUyIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUyNCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjE0NDMyNjczLDAsMCwwLjE2NjY2NjQyLDkwNy4xMDIyMyw4OTcuMTI2NTYpIgogICAgICAgY3g9IjEwNDYuNTMxMiIKICAgICAgIGN5PSI1NzEuNDIxODgiCiAgICAgICBmeD0iMTA0Ni41MzEyIgogICAgICAgZnk9IjU3MS40MjE4OCIKICAgICAgIHI9Ijk1Ljk5OTk3NyIgLz4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtMzMiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTMyIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEuMTY2NjY2OSwwLDAsMS4zNDcyNTAxLDEzOS4wNDY2LC0zNjAuMTQ5OTcpIgogICAgICAgY3g9IjEwNDYuNTMxMiIKICAgICAgIGN5PSI1NzEuNDIxODgiCiAgICAgICBmeD0iMTA0Ni41MzEyIgogICAgICAgZnk9IjU3MS40MjE4OCIKICAgICAgIHI9Ijk1Ljk5OTk3NyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC03LTMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzMjU3IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LDAuNTk1MzkyNDcsMC44NjYwMjU0LDAuNSwxNDUuMTQ4NzUsOTk3LjIyMzgxKSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDAzMyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDMyNjAiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwwLjU5NTM5MjQ3LC0wLjg2NjAyNTQsMC41LDI3MC44NTEyNSw5OTcuMjIzODEpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC01LTIiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzMjYzIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjY4NzUsMCwwLC0xLDMwNCwxMjcyLjM2MjMpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDU4IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwtMTA4LDEwMTYuMzYyMikiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC03IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA2MCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSwtNzQuODUxMjUyLDEyOTEuNTAwNykiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNjIiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsNTAuODUxMjUsMTI5MS41MDA3KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA2NSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwyNzAuODUxMjUsMTI5MS41MDA3KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC03IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA2OCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSwxNDUuMTQ4NzUsMTI5MS41MDA3KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtMyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNzEiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDExMiwxMDE2LjM2MjIpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTIwIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUyMC00IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEuMTY2NjY2OSwwLDAsMS4zNDcyNTAxLC0yNDQuOTUzMzksODYuNTA1MDM1KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTIwIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC43NjE1Mzg0NTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC05IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTc3IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgcj0iOTUuOTk5OTc3IgogICAgICAgZnk9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgY3g9IjEwNDYuNTMxMiIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMS4xNjY2NjY5LDAsMCwxLjM0NzI1MDEsLTI0NC45NTMzOSw4Ni41MDUwMzUpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0MjA4IgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtMjAiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00IgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50MzYxNCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLjE2NjY2NjksMCwwLDEuMzQ3MjUwMSwyMTkuMDQ2NjEsODkuMTY3NzU3KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00IgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50MzYyNSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLjE2NjY2NjksMCwwLDEuMzQ3MjUwMSwyMTkuMDQ2NjEsODkuMTY3NzU3KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00IgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50MzIwOSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjE0NDMyNjk5LDAsMCwwLjE2NjY2NjczLDEyMDEuNTM1OCw4NzcuMTE0ODgpIgogICAgICAgY3g9IjEwNDYuNTMxMiIKICAgICAgIGN5PSI1NzEuNDIxODgiCiAgICAgICBmeD0iMTA0Ni41MzEyIgogICAgICAgZnk9IjU3MS40MjE4OCIKICAgICAgIHI9Ijk1Ljk5OTk3NyIgLz4KICA8L2RlZnM+CiAgPHNvZGlwb2RpOm5hbWVkdmlldwogICAgIGlkPSJiYXNlIgogICAgIHBhZ2Vjb2xvcj0iI2ZmZmZmZiIKICAgICBib3JkZXJjb2xvcj0iIzY2NjY2NiIKICAgICBib3JkZXJvcGFjaXR5PSIxLjAiCiAgICAgaW5rc2NhcGU6cGFnZW9wYWNpdHk9IjAuMCIKICAgICBpbmtzY2FwZTpwYWdlc2hhZG93PSIyIgogICAgIGlua3NjYXBlOnpvb209IjE2IgogICAgIGlua3NjYXBlOmN4PSI1LjkzMTE2NSIKICAgICBpbmtzY2FwZTpjeT0iMTYuMjM3MjI1IgogICAgIGlua3NjYXBlOmRvY3VtZW50LXVuaXRzPSJweCIKICAgICBpbmtzY2FwZTpjdXJyZW50LWxheWVyPSJsYXllcjEiCiAgICAgc2hvd2dyaWQ9InRydWUiCiAgICAgaW5rc2NhcGU6d2luZG93LXdpZHRoPSIxMjgwIgogICAgIGlua3NjYXBlOndpbmRvdy1oZWlnaHQ9IjgwMCIKICAgICBpbmtzY2FwZTp3aW5kb3cteD0iMCIKICAgICBpbmtzY2FwZTp3aW5kb3cteT0iLTMxIgogICAgIGlua3NjYXBlOndpbmRvdy1tYXhpbWl6ZWQ9IjEiCiAgICAgZml0LW1hcmdpbi10b3A9IjAiCiAgICAgZml0LW1hcmdpbi1sZWZ0PSIwIgogICAgIGZpdC1tYXJnaW4tcmlnaHQ9IjAiCiAgICAgZml0LW1hcmdpbi1ib3R0b209IjAiCiAgICAgaW5rc2NhcGU6c25hcC1wYWdlPSJ0cnVlIgogICAgIGlua3NjYXBlOnNuYXAtbm9kZXM9InRydWUiCiAgICAgZ3JpZHRvbGVyYW5jZT0iMTAiCiAgICAgc2hvd2JvcmRlcj0idHJ1ZSIKICAgICBzaG93Z3VpZGVzPSJ0cnVlIgogICAgIGlua3NjYXBlOmd1aWRlLWJib3g9InRydWUiPgogICAgPGlua3NjYXBlOmdyaWQKICAgICAgIHR5cGU9Inh5Z3JpZCIKICAgICAgIGlkPSJncmlkMzAyMSIKICAgICAgIGVtcHNwYWNpbmc9IjQiCiAgICAgICB2aXNpYmxlPSJ0cnVlIgogICAgICAgZW5hYmxlZD0idHJ1ZSIKICAgICAgIHNuYXB2aXNpYmxlZ3JpZGxpbmVzb25seT0idHJ1ZSIKICAgICAgIHNwYWNpbmd4PSIxNnB4IgogICAgICAgc3BhY2luZ3k9IjE2cHgiCiAgICAgICBkb3R0ZWQ9InRydWUiIC8+CiAgPC9zb2RpcG9kaTpuYW1lZHZpZXc+CiAgPG1ldGFkYXRhCiAgICAgaWQ9Im1ldGFkYXRhNyI+CiAgICA8cmRmOlJERj4KICAgICAgPGNjOldvcmsKICAgICAgICAgcmRmOmFib3V0PSIiPgogICAgICAgIDxkYzpmb3JtYXQ+aW1hZ2Uvc3ZnK3htbDwvZGM6Zm9ybWF0PgogICAgICAgIDxkYzp0eXBlCiAgICAgICAgICAgcmRmOnJlc291cmNlPSJodHRwOi8vcHVybC5vcmcvZGMvZGNtaXR5cGUvU3RpbGxJbWFnZSIgLz4KICAgICAgICA8ZGM6dGl0bGU+PC9kYzp0aXRsZT4KICAgICAgPC9jYzpXb3JrPgogICAgPC9yZGY6UkRGPgogIDwvbWV0YWRhdGE+CiAgPGcKICAgICBpbmtzY2FwZTpsYWJlbD0iTGF5ZXIgMSIKICAgICBpbmtzY2FwZTpncm91cG1vZGU9ImxheWVyIgogICAgIGlkPSJsYXllcjEiCiAgICAgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTEzMzYuNTc4NSwtOTU2LjM1MTg5KSI+CiAgICA8cGF0aAogICAgICAgc3R5bGU9ImNvbG9yOiMwMDAwMDA7ZmlsbDp1cmwoI3JhZGlhbEdyYWRpZW50MzIwOSk7ZmlsbC1vcGFjaXR5OjE7ZmlsbC1ydWxlOm5vbnplcm87c3Ryb2tlOm5vbmU7bWFya2VyOm5vbmU7dmlzaWJpbGl0eTp2aXNpYmxlO2Rpc3BsYXk6aW5saW5lO292ZXJmbG93OnZpc2libGU7ZW5hYmxlLWJhY2tncm91bmQ6YWNjdW11bGF0ZSIKICAgICAgIGQ9Im0gMTM1Mi41Nzg1LDk1Ni4zNTE4OSAwLjI4ODYsMTUuMTM2MjkgMTMuNTY2OCwtNy4xMzUxNiAtMTMuODU1NCwtOC4wMDExMyB6IG0gMCwwIC0xMy44NTU0LDguMDAxMTMgMTMuNTY2Nyw3LjEzNTE2IDAuMjg4NywtMTUuMTM2MjkgeiBtIC0xMy44NTU0LDguMDAxMTMgMCwxNS45OTc3NCAxMi45NTc5LC03LjgxNjIxIC0xMi45NTc5LC04LjE4MTUzIHogbSAwLDE1Ljk5Nzc0IDEzLjg1NTQsOC4wMDExMyAtMC42MDg5LC0xNS4zMTY3IC0xMy4yNDY1LDcuMzE1NTcgeiBtIDEzLjg1NTQsOC4wMDExMyAxMy44NTU0LC04LjAwMTEzIC0xMy4yNTEsLTcuMzE1NTcgLTAuNjA0NCwxNS4zMTY3IHogbSAxMy44NTU0LC04LjAwMTEzIDAsLTE1Ljk5Nzc0IC0xMi45NjI0LDguMTgxNTMgMTIuOTYyNCw3LjgxNjIxIHoiCiAgICAgICBpZD0icGF0aDQwMTYtMy04LTYiCiAgICAgICBpbmtzY2FwZTpjb25uZWN0b3ItY3VydmF0dXJlPSIwIiAvPgogIDwvZz4KPC9zdmc+Cg==',
    widgetCss: '#remotestorage-state {     position:fixed;     top:5px;     right:5px;     height:32px;     width:275px;     font:normal 16px/100% sans-serif;     z-index:99999;     background:rgba(0,0,0,.3);     padding:5px;     border-radius:7px;     box-shadow:0 1px rgba(255,255,255,.05), inset 0 1px rgba(0,0,0,.05);     transition:width 500ms, background 500ms; }  #remotestorage-state.connected, #remotestorage-state.busy, #remotestorage-state.offline {     width:32px;     background:none;     box-shadow:none; } .remotestorage-button {     margin:0;     padding:.3em;     font-size:14px;     height:26px !important;     background:#ddd;     color:#333;     border:1px solid #ccc;     border-radius:3px;     box-shadow:0 1px 1px #fff inset; }  #remotestorage-register-button {     position:absolute;     left:25px;     top:8px;     max-height:16px;     text-decoration:none;     font-weight:normal;     cursor:pointer; }  #remotestorage-connect-button {     position:absolute;     right:8px;     top:8px;     padding:0 0 0 17px;     width:90px;     cursor:pointer;     text-align:left;     border-radius:0 3px 3px 0;     font-weight:normal; }  #remotestorage-connect-button:hover, #remotestorage-connect-button:focus, .remotestorage-button:hover, .remotestorage-button:focus, #remotestorage-sync-button:hover, #remotestorage-sync-button:focus {     background:#eee;     color:#000;     text-decoration:none; }  #remotestorage-useraddress {     position:absolute;     left:25px;     top:8px;     margin:0;     padding:0 17px 0 3px;     height:25px;     width:142px;     background:#eee;     color:#333;     border:0;     border-radius:3px 0 0 3px;     box-shadow:0 1px #fff, inset 0 1px #999;     font-weight:normal;     font-size:14px; }  #remotestorage-useraddress:hover, #remotestorage-useraddress:focus {     background:#fff;     color:#000; }  #remotestorage-cube {     position:absolute;     right:84px;     -webkit-transition:right 500ms;     -moz-transition:right 500ms;     transition:right 500ms;     z-index:99997; }  #remotestorage-questionmark {     position:absolute;     left:0;     padding:9px 8px;     color:#fff;     text-decoration:none;     z-index:99999;     font-weight:normal; }  .infotext {     position:absolute;     left:0;     top:0;     width:255px;     height:32px;     padding:6px 5px 4px 25px;     font-size:10px;     background:black;     color:white;     border-radius:7px;     opacity:.85;     text-decoration:none;     white-space:nowrap;     z-index:99998; }  #remotestorage-questiomark:hover {     color:#fff; }  #remotestorage-questionmark:hover+#remotestorage-infotext {     display:inline; }  #remotestorage-state.busy #remotestorage-cube, #remotestoreage-state.authing #remotestorage-cube, #remotestorage-state.connecting #remotestorage-cube {     -webkit-animation-name:remotestorage-loading;     -webkit-animation-duration:2s;     -webkit-animation-iteration-count:infinite;     -webkit-animation-timing-function:linear;     -moz-animation-name:remotestorage-loading;     -moz-animation-duration:2s;     -moz-animation-iteration-count:infinite;     -moz-animation-timing-function:linear;     -o-animation-name:remotestorage-loading;     -o-animation-duration:2s;     -o-animation-iteration-count:infinite;     -o-animation-timing-function:linear;     -ms-animation-name:remotestorage-loading;     -ms-animation-duration:2s;     -ms-animation-iteration-count:infinite;     -ms-animation-timing-function:linear; } @-webkit-keyframes remotestorage-loading { from{-webkit-transform:rotate(0deg)} to{-webkit-transform:rotate(360deg)} } @-moz-keyframes remotestorage-loading { from{-moz-transform:rotate(0deg)} to{-moz-transform:rotate(360deg)} } @-o-keyframes remotestorage-loading { from{-o-transform:rotate(0deg)} to{-o-transform:rotate(360deg)} } @-ms-keyframes remotestorage-loading { from{-ms-transform:rotate(0deg)} to{ -ms-transform:rotate(360deg)} }  #remotestorage-connect-button, #remotestorage-questionmark, #remotestorage-register-button, #remotestorage-cube, #remotestorage-useraddress, #remotestorage-infotext, #remotestorage-devsonly, #remotestorage-bubble {     display:none }  #remotestorage-state.anonymous #remotestorage-cube, #remotestorage-state.anonymous #remotestorage-connect-button, #remotestorage-state.anonymous #remotestorage-register-button, #remotestorage-state.anonymous #remotestorage-questionmark {     display: block }  #remotestorage-state.connecting #remotestorage-cube, #remotestorage-state.connecting #remotestorage-connect-button, #remotestorage-state.connecting #remotestorage-useraddress, #remotestorage-state.connecting #remotestorage-questionmark {     display: block }  #remotestorage-state.interrupted #remotestorage-cube, #remotestorage-state.interrupted #remotestorage-connect-button, #remotestorage-state.interrupted #remotestorage-register-button, #remotestorage-state.interrupted #remotestorage-questionmark {     display: block }  #remotestorage-state.failed #remotestorage-cube, #remotestorage-state.failed #remotestorage-connect-button, #remotestorage-state.failed #remotestorage-register-button, #remotestorage-state.failed #remotestorage-questionmark {     display: block }  #remotestorage-state.authing #remotestorage-cube, #remotestorage-state.authing #remotestorage-connect-button, #remotestorage-state.authing #remotestorage-useraddress, #remotestorage-state.authing #remotestorage-questionmark {     display: block }  #remotestorage-state.typing #remotestorage-cube, #remotestorage-state.typing #remotestorage-connect-button, #remotestorage-state.typing #remotestorage-useraddress, #remotestorage-state.typing #remotestorage-questionmark {     display: block }  #remotestorage-state.connected #remotestorage-cube, #remotestorage-state.busy #remotestorage-cube, #remotestorage-state.offline #remotestorage-cube {     right:0;     opacity:.5;     cursor:pointer;     display: block }  #remotestorage-state.devsonly #remotestorage-devsonly {     display: block }  #remotestorage-bubble {     position:absolute;     right:6px;     top:9px;     padding:5px 28px 2px 6px;     height:17px;     white-space:nowrap;     font-size:10px;     background:#000;     color:#fff;     border-radius:5px;     opacity:.5;     text-decoration:none;     z-index:99996; }  #remotestorage-state.connected #remotestorage-bubble, #remotestorage-state.busy #remotestorage-bubble, #remotestorage-state.offline #remotestorage-bubble {     cursor:pointer; }  #remotestorage-bubble strong {     font-weight:bold; }  #remotestorage-state.connected #remotestorage-cube:hover, #remotestorage-state.busy #remotestorage-cube:hover, #remotestorage-state.offline #remotestorage-cube:hover {     opacity:1; }  #remotestorage-state.connected #remotestorage-bubble:hover, #remotestorage-state.busy #remotestorage-bubble:hover, #remotestorage-state.offline #remotestorage-bubble:hover {     display:inline; }  #remotestorage-state.connected:hover #remotestorage-bubble, #remotestorage-state.busy:hover #remotestorage-bubble, #remotestorage-state.offline:hover #remotestorage-bubble {     display:inline; }  /* #remotestorage-state.connected #remotestorage-cube:hover+#remotestorage-bubble, #remotestorage-state.busy #remotestorage-cube:hover+#remotestorage-bubble, #remotestorage-state.offline #remotestorage-cube:hover+#remotestorage-bubble { */ /*     display:inline; */ /* } */  #remotestorage-menu {     background: #000;     border-radius: 5px;     color: #fff;     font-size: 10px;     opacity: .5;     padding: 6px;     position: absolute;     right: 5px;     top: 40px; }  #remotestorage-menu .item {     white-space: nowrap; }  #remotestorage-menu .item button {     font-size: 10px;     margin-left: 6px; }  #remotestorage-error {     background: #000;     color: #fcc;     opacity: .5;     font-size: 10px;     position: absolute;     top: 40px;     right: 5px;     padding: 5px; }',
    remotestorageIcon: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhLS0gQ3JlYXRlZCB3aXRoIElua3NjYXBlIChodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy8pIC0tPgoKPHN2ZwogICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgIHhtbG5zOmNjPSJodHRwOi8vY3JlYXRpdmVjb21tb25zLm9yZy9ucyMiCiAgIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyIKICAgeG1sbnM6c3ZnPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogICB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIKICAgeG1sbnM6c29kaXBvZGk9Imh0dHA6Ly9zb2RpcG9kaS5zb3VyY2Vmb3JnZS5uZXQvRFREL3NvZGlwb2RpLTAuZHRkIgogICB4bWxuczppbmtzY2FwZT0iaHR0cDovL3d3dy5pbmtzY2FwZS5vcmcvbmFtZXNwYWNlcy9pbmtzY2FwZSIKICAgd2lkdGg9IjMyIgogICBoZWlnaHQ9IjMyIgogICBpZD0ic3ZnMiIKICAgdmVyc2lvbj0iMS4xIgogICBpbmtzY2FwZTp2ZXJzaW9uPSIwLjQ4LjIgcjk4MTkiCiAgIHNvZGlwb2RpOmRvY25hbWU9InJlbW90ZVN0b3JhZ2UtaWNvbi5zdmciCiAgIGlua3NjYXBlOmV4cG9ydC1maWxlbmFtZT0iL2hvbWUvdXNlci93ZWJzaXRlL2ltZy9yZW1vdGVTdG9yYWdlLWljb24ucG5nIgogICBpbmtzY2FwZTpleHBvcnQteGRwaT0iOTAiCiAgIGlua3NjYXBlOmV4cG9ydC15ZHBpPSI5MCI+CiAgPGRlZnMKICAgICBpZD0iZGVmczQiPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDMzIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2UyMjFiNztzdG9wLW9wYWNpdHk6MC43NDYxNTM4MzsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDM1IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZTIyMWI3O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDQwMzciIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTc1Ij4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0NTc3IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMwMDAwMDA7c3RvcC1vcGFjaXR5OjAuNzM4NDYxNTU7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzkiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzAwMDAwMDtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDQwODgiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDQ0Ij4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmOTEwMDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojYzQ2ZjAwO3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzciIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGlua3NjYXBlOnBlcnNwZWN0aXZlCiAgICAgICBzb2RpcG9kaTp0eXBlPSJpbmtzY2FwZTpwZXJzcDNkIgogICAgICAgaW5rc2NhcGU6dnBfeD0iMCA6IDUyNi4xODEwOSA6IDEiCiAgICAgICBpbmtzY2FwZTp2cF95PSIwIDogMTAwMCA6IDAiCiAgICAgICBpbmtzY2FwZTp2cF96PSI3NDQuMDk0NDggOiA1MjYuMTgxMDkgOiAxIgogICAgICAgaW5rc2NhcGU6cGVyc3AzZC1vcmlnaW49IjM3Mi4wNDcyNCA6IDM1MC43ODczOSA6IDEiCiAgICAgICBpZD0icGVyc3BlY3RpdmUyOTg1IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY5MTAwO3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2M0NmYwMDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTciIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICB5Mj0iMCIKICAgICAgIHgyPSIxMjgiCiAgICAgICB5MT0iMTI4IgogICAgICAgeDE9IjEyOCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50Mzg5MCIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMSIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODM5LTAtMiIKICAgICAgIHgxPSIxMjgiCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEyOCIKICAgICAgIHkyPSIwIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC43NjE1Mzg0NTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOCIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS03IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzOS0wLTgiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjExMiIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMzIiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDMyLDc5Ni4zNjIxOCkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS03Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmOTEwMDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctMyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2M0NmYwMDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMiIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTIiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODM5LTAtMyIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwzMiw3OTYuMzYyMTgpIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC0yIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmOTMwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC0xIiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY5MzA0O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTAiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LC0wLjU5NTM5MjQ3LDAuODY2MDI1NCwtMC41LDY1LjE0ODc0OCwxMDcxLjUwMDYpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDI1LTUiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTMiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMyI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0Ni00IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMwNDhiZmY7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtNyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMDQ4YmZmO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODM5LTAtODkiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMzIsNzk2LjM2MjE4KSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtNSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtMiIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC0yIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC05Ij4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTMiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC04IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA4NC03Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTYiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC01IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQxNTkiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuNjg3NSwwLDAsLTEsMjI0LDEwMjAuMzYyMikiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC05IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE2MSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LDAuNTk1MzkyNDcsLTAuODY2MDI1NCwwLjUsMTkwLjg1MTI1LDc0NS4yMjM3NikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQxNjMiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsMC41OTUzOTI0NywwLjg2NjAyNTQsMC41LDY1LjE0ODc1LDc0NS4yMjM3NikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE3MCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMzIsNzk2LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE3MiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSw2NS4xNDg3NDgsMTA3MS41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQxNzQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMTkwLjg1MTI1LDEwNzEuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTUiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMiI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0Ni03IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtNCIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQxNzQtMiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LC0wLjU5NTM5MjQ3LC0wLjg2NjAyNTQsLTAuNSwxOTAuODUxMjUsMTA3MS41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA4NC02Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTAiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC05IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1My05IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwxNzYsODI4LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTUtMiIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03LTQiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItOSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTUtNyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSwyMDkuMTQ4NzUsMTEwMy41MDA2KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC0yLTkiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtNy03IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtNC01IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjE7IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA4NC02LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjU3LTQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQtNi01Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTAtOSIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3A0MDg4LTktMyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIHkyPSItMC45OTQ4NTY0MiIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzMTciCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNSIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzNTgiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDE3Niw4MjguMzYyMTgpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzNjAiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMjA5LjE0ODc1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzNjIiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzNTgtNyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsMTc2LDgyOC4zNjIxOCkiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtNC02Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC01LTkiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNy0wIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTgiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MzYwLTQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMjA5LjE0ODc1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMi04Ij4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTctMyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ4LTQtNiIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi02IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDM2Mi00IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDMzNC44NTEyNSwxMTAzLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0LTYtNiI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDA4Ni0wLTAiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC05LTgiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTMtOS02IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwxNzYsODI4LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNS0yLTciIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNy00LTMiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItOS0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1NS03LTEiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMjA5LjE0ODc1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMi05LTMiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtNy03LTUiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC00LTUtMyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIHkyPSItMC45OTQ4NTY0MiIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzMTctOCIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi01LTUiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQtNi01LTUiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDQwODYtMC05LTYiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC05LTMtMyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIHkyPSItMC45OTQ4NTY0MiIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ0MzQiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNS01IgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNiIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1MDgiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsNzAyLjg1MTI1LDEwNzEuNTAwNSkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMi04IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUxMSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSw1NzcuMTQ4NzUsMTA3MS41MDA1KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC02IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUxNCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsNTQ0LC02ZS01KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTYiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTE3IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSw1ODQsNzk2LjM2MjEyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNS01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUyMCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwwLjU5NTM5MjQ3LDAuODY2MDI1NCwwLjUsNTc3LjE0ODc1LDc3Ny4yMjM4KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTktMyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1MjMiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwwLjU5NTM5MjQ3LC0wLjg2NjAyNTQsMC41LDcwMi44NTEyNSw3NzcuMjIzOCkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUyNiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC42ODc1LDAsMCwtMSw3MzYsMjU2LjAwMDAyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1MjkiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuNjg3NSwwLDAsLTEsNzc2LDEwNTIuMzYyMikiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC02IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDUzMiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsNTY0LDc5Ni4zNjIxMikiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTkiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTM0IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjY4NzUsMCwwLC0xLDc1NiwyNTYuMDAwMDIpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05IgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUzOSIKICAgICAgIGN4PSI2NjAiCiAgICAgICBjeT0iMTI4IgogICAgICAgZng9IjY2MCIKICAgICAgIGZ5PSIxMjgiCiAgICAgICByPSIxMTIiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEsMCwwLDEuMTQyODU3MSw2MCw3MTAuMDc2NTIpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05LTgiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTM5LTciCiAgICAgICBjeD0iNjYwIgogICAgICAgY3k9IjEyOCIKICAgICAgIGZ4PSI2NjAiCiAgICAgICBmeT0iMTI4IgogICAgICAgcj0iMTEyIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwxLjE0Mjg1NzEsLTIwLDc3OC4wNzY0NykiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTktOCI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNS0yLTctOSIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03LTQtMy04IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgcj0iMTEyIgogICAgICAgZnk9IjEyOCIKICAgICAgIGZ4PSI2NjAiCiAgICAgICBjeT0iMTI4IgogICAgICAgY3g9IjY2MCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsMS4xNDI4NTcxLDE2LDMzMC4wNzY1MikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1NTYiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0NTc1IgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtOS0xIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUzOS0wIgogICAgICAgY3g9IjY2MCIKICAgICAgIGN5PSIxMjgiCiAgICAgICBmeD0iNjYwIgogICAgICAgZnk9IjEyOCIKICAgICAgIHI9IjExMiIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsMS4xNDI4NTcxLC0yMCw3NzguMDc2NDcpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS05LTEiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTUtMi03LTYiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNy00LTMtMCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIHI9IjExMiIKICAgICAgIGZ5PSIxMjgiCiAgICAgICBmeD0iNjYwIgogICAgICAgY3k9IjEyOCIKICAgICAgIGN4PSI2NjAiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMTI0OTk5OTksMCwwLDAuMTQyODU3MTMsNzk3LjUsNjc4LjA3NjUyKSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDU1Ni0zIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDU3NS0yIgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTc1LTIiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzctNiIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojODE4MTgxO3N0b3Atb3BhY2l0eTowLjgzMDc2OTI0OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0NTc5LTQiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzcwNzA3MDtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICByPSIxMTIiCiAgICAgICBmeT0iMTI4IgogICAgICAgZng9IjY2MCIKICAgICAgIGN5PSIxMjgiCiAgICAgICBjeD0iNjYwIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjEyNDk5OTk5LDAsMCwwLjE0Mjg1NzEzLDczMy41MDAwMSw2NzguMDc2NTIpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NjAxIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01LTktMSIKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIgLz4KICAgIDxyYWRpYWxHcmFkaWVudAogICAgICAgcj0iMTEyIgogICAgICAgZnk9IjEyOCIKICAgICAgIGZ4PSI2NjAiCiAgICAgICBjeT0iMTI4IgogICAgICAgY3g9IjY2MCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsMS4xNDI4NTcxLDIzNiw3NzguMDc2NDcpIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBpZD0icmFkaWFsR3JhZGllbnQ0NTU2LTUiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0NTc1LTMiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQ1NzUtMyI+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDU3Ny05IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM4MTgxODE7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzktOCIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzA3MDcwO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIHI9IjExMiIKICAgICAgIGZ5PSIxMjgiCiAgICAgICBmeD0iNjYwIgogICAgICAgY3k9IjEyOCIKICAgICAgIGN4PSI2NjAiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMTI0OTk5OTksMCwwLDAuMTQyODU3MTMsODI5LjUwMDAxLDY3OC4wNzY1MikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ2NDUiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0NTc1LTMiCiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIHI9IjExMiIKICAgICAgIGZ5PSIxMjgiCiAgICAgICBmeD0iNjYwIgogICAgICAgY3k9IjEyOCIKICAgICAgIGN4PSI2NjAiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEsMCwwLDEuMTQyODU3MSwyMzYsNzc4LjA3NjQ3KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDU1Ni04IgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDU3NS0xIgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0NTc1LTEiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQ1NzctMiIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMDAwMDAwO3N0b3Atb3BhY2l0eTowLjczODQ2MTU1OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0NTc5LTIiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzAwMDAwMDtzdG9wLW9wYWNpdHk6MTsiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwMTciCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDMyLDc5Ni4zNjIxOCkiCiAgICAgICB4MT0iMTM5LjYzNjM3IgogICAgICAgeTE9IjEyOCIKICAgICAgIHgyPSIxMzkuNjM2MzciCiAgICAgICB5Mj0iMS4xMzY4Njg0ZS0xMyIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwMTkiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsNjUuMTQ4NzQ4LDEwNzEuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDIxIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDE5MC44NTEyNSwxMDcxLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTU5IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDM1OC0zIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwxNzYsODI4LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC00LTU5Ij4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC44MzA3NjkyNDsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC01LTYiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNy01IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MzYwLTYiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMjA5LjE0ODc1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMi0zIj4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTctMCIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ4LTQtMiIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNi03IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDM2Mi0wIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDMzNC44NTEyNSwxMTAzLjUwMDYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0LTYtNyI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjAuODMxMzcyNTY7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDA4Ni0wLTQiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC05LTciIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtMCIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTMtOS0zIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwxNzYsODI4LjM2MjE4KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC00LTUtMCI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuODMwNzY5MjQ7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNS0yLTEiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNy00LTYiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDQ0LTItOS01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1NS03LTciCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMjA5LjE0ODc1LDExMDMuNTAwNikiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtMi05LTUiPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDYtNy03LTciCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6IzIxOWJlMjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIGlkPSJzdG9wNDA0OC00LTUtOCIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIHkyPSItMC45OTQ4NTY0MiIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMzM0Ljg1MTI1LDExMDMuNTAwNikiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQzMTctODkiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNS0wIgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0LTYtNS0wIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6Izc1ZGQyNjtzdG9wLW9wYWNpdHk6MC44MzEzNzI1NjsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3A0MDg2LTAtOS03IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDQwODgtOS0zLTgiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC0zIj4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MC43NDUwOTgwNTsiCiAgICAgICAgIG9mZnNldD0iMCIKICAgICAgICAgaWQ9InN0b3AzODM1LTctOC0xMCIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC0zIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA0NC03Ij4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTMyIgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiMyMTliZTI7c3RvcC1vcGFjaXR5OjAuNzQ1MDk4MDU7IiAvPgogICAgICA8c3RvcAogICAgICAgICBpZD0ic3RvcDQwNDgtMiIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwODQtNSI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM3NWRkMjY7c3RvcC1vcGFjaXR5OjAuNzQ1MDk4MDU7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDA4Ni0zIiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNzVkZDI2O3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDQwODgtMyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDM4MzMtMS00LTUtMiI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiM1OTA0ZmY7c3RvcC1vcGFjaXR5OjAuNzQ1MDk4MDU7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtMi04IiAvPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojNTkwNGZmO3N0b3Atb3BhY2l0eToxOyIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBpZD0ic3RvcDM4MzctNy0wLTItNSIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNDQtOS0wIj4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ2LTMtOCIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eTowLjgzMTM3MjU2OyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgaWQ9InN0b3A0MDQ4LTgtNiIKICAgICAgICAgb2Zmc2V0PSIxIgogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojMjE5YmUyO3N0b3Atb3BhY2l0eToxOyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNy0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDE2My05IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KC0wLjM0Mzc1LDAuNTk1MzkyNDcsMC44NjYwMjU0LDAuNSw2NS4xNDg3NSw3NDUuMjIzNzYpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NjQyIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDg0LTctMyI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNkMmRkMjY7c3RvcC1vcGFjaXR5OjAuNzQ1MDk4MDU7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wNDA4Ni02LTMiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNkMmRkMjY7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wNDA4OC01LTciIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyMzUiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsNTI2Ljg1MTI1LDEyOTEuNTAwNykiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMi0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDIzOCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwtMC41OTUzOTI0NywwLjg2NjAyNTQsLTAuNSw0MDEuMTQ4NzUsMTI5MS41MDA3KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01OSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNDEiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC42ODc1LDAsMCwxLDM1Miw0MDMuOTk5OTkpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNTkiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MjQ0IgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSw0NjgsMTAxNi4zNjIyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNS0wIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI0NyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwwLjU5NTM5MjQ3LDAuODY2MDI1NCwwLjUsNDAxLjE0ODc1LDk5Ny4yMjM5KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTY0MiIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50NDA0NC0yLTktNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTAiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwwLjU5NTM5MjQ3LC0wLjg2NjAyNTQsMC41LDUyNi44NTEyNSw5OTcuMjIzOSkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTQtNS0wIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI1MyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC42ODc1LDAsMCwtMSw1NDQsNjYwLjAwMDA5KSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTYtNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQyNTciCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsMC41OTUzOTI0NywwLjg2NjAyNTQsMC41LDQwMS4xNDg3NSw3MDkuMjIzOSkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtMi05IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI2MCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjM0Mzc1LDAuNTk1MzkyNDcsLTAuODY2MDI1NCwwLjUsNTI2Ljg1MTI1LDcwOS4yMjM5KSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNC01IgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDI2MyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC42ODc1LDAsMCwtMSw1NjAsOTg0LjM2MjMyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC01MiIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQzODctNyIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEuMTY2NjY2OSwwLDAsMS4zNDcyNTAxLC0yNDQuOTUzMzksODYuNTA1MDM1KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC01MiI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuNzYxNTM4NDU7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtNyIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC00IiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzgzMy0xLTQtMzMiPgogICAgICA8c3RvcAogICAgICAgICBzdHlsZT0ic3RvcC1jb2xvcjojZmY0YTA0O3N0b3Atb3BhY2l0eTowLjc2MTUzODQ1OyIKICAgICAgICAgb2Zmc2V0PSIwIgogICAgICAgICBpZD0ic3RvcDM4MzUtNy04LTQiIC8+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjE7IgogICAgICAgICBvZmZzZXQ9IjEiCiAgICAgICAgIGlkPSJzdG9wMzgzNy03LTAtNiIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00IgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUyMCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLjE2NjY2NjksMCwwLDEuMzQ3MjUwMSwtMjQ0Ljk1MzM5LDg2LjUwNTAzNSkiCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgcj0iOTUuOTk5OTc3IiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC0zMyIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1MjIiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMS4xNjY2NjY5LDAsMCwxLjM0NzI1MDEsMTM5LjA0NjYsLTM2MC4xNDk5NykiCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgcj0iOTUuOTk5OTc3IiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC01MiIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1MjQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4xNDQzMjY3MywwLDAsMC4xNjY2NjY0Miw5MDcuMTAyMjMsODk3LjEyNjU2KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTMzIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDUzMiIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLjE2NjY2NjksMCwwLDEuMzQ3MjUwMSwxMzkuMDQ2NiwtMzYwLjE0OTk3KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNy0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzI1NyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC4zNDM3NSwwLjU5NTM5MjQ3LDAuODY2MDI1NCwwLjUsMTQ1LjE0ODc1LDk5Ny4yMjM4MSkiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwMzMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzMjYwIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsMC41OTUzOTI0NywtMC44NjYwMjU0LDAuNSwyNzAuODUxMjUsOTk3LjIyMzgxKSIKICAgICAgIHgxPSIxMzkuNjM2MzQiCiAgICAgICB5MT0iMTI3Ljk5OTk5IgogICAgICAgeDI9IjE0MC40NzE3OSIKICAgICAgIHkyPSItMC45OTQ4NTQ2OSIgLz4KICAgIDxsaW5lYXJHcmFkaWVudAogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIgogICAgICAgeGxpbms6aHJlZj0iI2xpbmVhckdyYWRpZW50MzgzMy0xLTQtNS0yIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50MzI2MyIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgtMC42ODc1LDAsMCwtMSwzMDQsMTI3Mi4zNjIzKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC0zIgogICAgICAgaWQ9ImxpbmVhckdyYWRpZW50NDA1OCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgwLjY4NzUsMCwwLDEsLTEwOCwxMDE2LjM2MjIpIgogICAgICAgeDE9IjEzOS42MzYzNyIKICAgICAgIHkxPSIxMjgiCiAgICAgICB4Mj0iMTM5LjYzNjM3IgogICAgICAgeTI9IjEuMTM2ODY4NGUtMTMiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtNyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNjAiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsLTc0Ljg1MTI1MiwxMjkxLjUwMDcpIgogICAgICAgeDE9IjEzOS42MzYzNCIKICAgICAgIHkxPSIxMjcuOTk5OTkiCiAgICAgICB4Mj0iMTQwLjQ3MTc5IgogICAgICAgeTI9Ii0wLjk5NDg1NDY5IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQ0MDg0LTUiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDYyIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuMzQzNzUsLTAuNTk1MzkyNDcsLTAuODY2MDI1NCwtMC41LDUwLjg1MTI1LDEyOTEuNTAwNykiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwODQtNSIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNjUiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4zNDM3NSwtMC41OTUzOTI0NywtMC44NjYwMjU0LC0wLjUsMjcwLjg1MTI1LDEyOTEuNTAwNykiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU2NDIiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDQwNDQtNyIKICAgICAgIGlkPSJsaW5lYXJHcmFkaWVudDQwNjgiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoLTAuMzQzNzUsLTAuNTk1MzkyNDcsMC44NjYwMjU0LC0wLjUsMTQ1LjE0ODc1LDEyOTEuNTAwNykiCiAgICAgICB4MT0iMTM5LjYzNjM0IgogICAgICAgeTE9IjEyNy45OTk5OSIKICAgICAgIHgyPSIxNDAuNDcxNzkiCiAgICAgICB5Mj0iLTAuOTk0ODU0NjkiIC8+CiAgICA8bGluZWFyR3JhZGllbnQKICAgICAgIGlua3NjYXBlOmNvbGxlY3Q9ImFsd2F5cyIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTMiCiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQ0MDcxIgogICAgICAgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDAuNjg3NSwwLDAsMSwxMTIsMTAxNi4zNjIyKSIKICAgICAgIHgxPSIxMzkuNjM2MzciCiAgICAgICB5MT0iMTI4IgogICAgICAgeDI9IjEzOS42MzYzNyIKICAgICAgIHkyPSIxLjEzNjg2ODRlLTEzIiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNC0yMCIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDQ1MjAtNCIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxLjE2NjY2NjksMCwwLDEuMzQ3MjUwMSwtMjQ0Ljk1MzM5LDg2LjUwNTAzNSkiCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgcj0iOTUuOTk5OTc3IiAvPgogICAgPGxpbmVhckdyYWRpZW50CiAgICAgICBpZD0ibGluZWFyR3JhZGllbnQzODMzLTEtNC0yMCI+CiAgICAgIDxzdG9wCiAgICAgICAgIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjRhMDQ7c3RvcC1vcGFjaXR5OjAuNzYxNTM4NDU7IgogICAgICAgICBvZmZzZXQ9IjAiCiAgICAgICAgIGlkPSJzdG9wMzgzNS03LTgtOSIgLz4KICAgICAgPHN0b3AKICAgICAgICAgc3R5bGU9InN0b3AtY29sb3I6I2ZmNGEwNDtzdG9wLW9wYWNpdHk6MTsiCiAgICAgICAgIG9mZnNldD0iMSIKICAgICAgICAgaWQ9InN0b3AzODM3LTctMC03NyIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQKICAgICAgIHI9Ijk1Ljk5OTk3NyIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICBmeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEuMTY2NjY2OSwwLDAsMS4zNDcyNTAxLC0yNDQuOTUzMzksODYuNTA1MDM1KSIKICAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIgogICAgICAgaWQ9InJhZGlhbEdyYWRpZW50NDIwOCIKICAgICAgIHhsaW5rOmhyZWY9IiNsaW5lYXJHcmFkaWVudDM4MzMtMS00LTIwIgogICAgICAgaW5rc2NhcGU6Y29sbGVjdD0iYWx3YXlzIiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNCIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDM2MTQiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMS4xNjY2NjY5LDAsMCwxLjM0NzI1MDEsMjE5LjA0NjYxLDg5LjE2Nzc1NykiCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgcj0iOTUuOTk5OTc3IiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNCIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDM2MjUiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMS4xNjY2NjY5LDAsMCwxLjM0NzI1MDEsMjE5LjA0NjYxLDg5LjE2Nzc1NykiCiAgICAgICBjeD0iMTA0Ni41MzEyIgogICAgICAgY3k9IjU3MS40MjE4OCIKICAgICAgIGZ4PSIxMDQ2LjUzMTIiCiAgICAgICBmeT0iNTcxLjQyMTg4IgogICAgICAgcj0iOTUuOTk5OTc3IiAvPgogICAgPHJhZGlhbEdyYWRpZW50CiAgICAgICBpbmtzY2FwZTpjb2xsZWN0PSJhbHdheXMiCiAgICAgICB4bGluazpocmVmPSIjbGluZWFyR3JhZGllbnQzODMzLTEtNCIKICAgICAgIGlkPSJyYWRpYWxHcmFkaWVudDMyMDkiCiAgICAgICBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIKICAgICAgIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMC4xNDQzMjY5OSwwLDAsMC4xNjY2NjY3MywxMjAxLjUzNTgsODc3LjExNDg4KSIKICAgICAgIGN4PSIxMDQ2LjUzMTIiCiAgICAgICBjeT0iNTcxLjQyMTg4IgogICAgICAgZng9IjEwNDYuNTMxMiIKICAgICAgIGZ5PSI1NzEuNDIxODgiCiAgICAgICByPSI5NS45OTk5NzciIC8+CiAgPC9kZWZzPgogIDxzb2RpcG9kaTpuYW1lZHZpZXcKICAgICBpZD0iYmFzZSIKICAgICBwYWdlY29sb3I9IiNmZmZmZmYiCiAgICAgYm9yZGVyY29sb3I9IiM2NjY2NjYiCiAgICAgYm9yZGVyb3BhY2l0eT0iMS4wIgogICAgIGlua3NjYXBlOnBhZ2VvcGFjaXR5PSIwLjAiCiAgICAgaW5rc2NhcGU6cGFnZXNoYWRvdz0iMiIKICAgICBpbmtzY2FwZTp6b29tPSIxNiIKICAgICBpbmtzY2FwZTpjeD0iMTYuMzA2MTY1IgogICAgIGlua3NjYXBlOmN5PSIxNi4yMzcyMjUiCiAgICAgaW5rc2NhcGU6ZG9jdW1lbnQtdW5pdHM9InB4IgogICAgIGlua3NjYXBlOmN1cnJlbnQtbGF5ZXI9ImxheWVyMSIKICAgICBzaG93Z3JpZD0idHJ1ZSIKICAgICBpbmtzY2FwZTp3aW5kb3ctd2lkdGg9IjEyODAiCiAgICAgaW5rc2NhcGU6d2luZG93LWhlaWdodD0iNzk5IgogICAgIGlua3NjYXBlOndpbmRvdy14PSIwIgogICAgIGlua3NjYXBlOndpbmRvdy15PSIxIgogICAgIGlua3NjYXBlOndpbmRvdy1tYXhpbWl6ZWQ9IjEiCiAgICAgZml0LW1hcmdpbi10b3A9IjAiCiAgICAgZml0LW1hcmdpbi1sZWZ0PSIwIgogICAgIGZpdC1tYXJnaW4tcmlnaHQ9IjAiCiAgICAgZml0LW1hcmdpbi1ib3R0b209IjAiCiAgICAgaW5rc2NhcGU6c25hcC1wYWdlPSJ0cnVlIgogICAgIGlua3NjYXBlOnNuYXAtbm9kZXM9InRydWUiCiAgICAgZ3JpZHRvbGVyYW5jZT0iMTAiCiAgICAgc2hvd2JvcmRlcj0idHJ1ZSIKICAgICBzaG93Z3VpZGVzPSJ0cnVlIgogICAgIGlua3NjYXBlOmd1aWRlLWJib3g9InRydWUiPgogICAgPGlua3NjYXBlOmdyaWQKICAgICAgIHR5cGU9Inh5Z3JpZCIKICAgICAgIGlkPSJncmlkMzAyMSIKICAgICAgIGVtcHNwYWNpbmc9IjQiCiAgICAgICB2aXNpYmxlPSJ0cnVlIgogICAgICAgZW5hYmxlZD0idHJ1ZSIKICAgICAgIHNuYXB2aXNpYmxlZ3JpZGxpbmVzb25seT0idHJ1ZSIKICAgICAgIHNwYWNpbmd4PSIxNnB4IgogICAgICAgc3BhY2luZ3k9IjE2cHgiCiAgICAgICBkb3R0ZWQ9InRydWUiIC8+CiAgPC9zb2RpcG9kaTpuYW1lZHZpZXc+CiAgPG1ldGFkYXRhCiAgICAgaWQ9Im1ldGFkYXRhNyI+CiAgICA8cmRmOlJERj4KICAgICAgPGNjOldvcmsKICAgICAgICAgcmRmOmFib3V0PSIiPgogICAgICAgIDxkYzpmb3JtYXQ+aW1hZ2Uvc3ZnK3htbDwvZGM6Zm9ybWF0PgogICAgICAgIDxkYzp0eXBlCiAgICAgICAgICAgcmRmOnJlc291cmNlPSJodHRwOi8vcHVybC5vcmcvZGMvZGNtaXR5cGUvU3RpbGxJbWFnZSIgLz4KICAgICAgICA8ZGM6dGl0bGU+PC9kYzp0aXRsZT4KICAgICAgPC9jYzpXb3JrPgogICAgPC9yZGY6UkRGPgogIDwvbWV0YWRhdGE+CiAgPGcKICAgICBpbmtzY2FwZTpsYWJlbD0iTGF5ZXIgMSIKICAgICBpbmtzY2FwZTpncm91cG1vZGU9ImxheWVyIgogICAgIGlkPSJsYXllcjEiCiAgICAgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTEzMzYuNTc4NSwtOTU2LjM1MTg5KSI+CiAgICA8cGF0aAogICAgICAgc3R5bGU9ImNvbG9yOiMwMDAwMDA7ZmlsbDp1cmwoI3JhZGlhbEdyYWRpZW50MzIwOSk7ZmlsbC1vcGFjaXR5OjE7ZmlsbC1ydWxlOm5vbnplcm87c3Ryb2tlOm5vbmU7bWFya2VyOm5vbmU7dmlzaWJpbGl0eTp2aXNpYmxlO2Rpc3BsYXk6aW5saW5lO292ZXJmbG93OnZpc2libGU7ZW5hYmxlLWJhY2tncm91bmQ6YWNjdW11bGF0ZSIKICAgICAgIGQ9Im0gMTM1Mi41Nzg1LDk1Ni4zNTE4OSAwLjI4ODYsMTUuMTM2MjkgMTMuNTY2OCwtNy4xMzUxNiAtMTMuODU1NCwtOC4wMDExMyB6IG0gMCwwIC0xMy44NTU0LDguMDAxMTMgMTMuNTY2Nyw3LjEzNTE2IDAuMjg4NywtMTUuMTM2MjkgeiBtIC0xMy44NTU0LDguMDAxMTMgMCwxNS45OTc3NCAxMi45NTc5LC03LjgxNjIxIC0xMi45NTc5LC04LjE4MTUzIHogbSAwLDE1Ljk5Nzc0IDEzLjg1NTQsOC4wMDExMyAtMC42MDg5LC0xNS4zMTY3IC0xMy4yNDY1LDcuMzE1NTcgeiBtIDEzLjg1NTQsOC4wMDExMyAxMy44NTU0LC04LjAwMTEzIC0xMy4yNTEsLTcuMzE1NTcgLTAuNjA0NCwxNS4zMTY3IHogbSAxMy44NTU0LC04LjAwMTEzIDAsLTE1Ljk5Nzc0IC0xMi45NjI0LDguMTgxNTMgMTIuOTYyNCw3LjgxNjIxIHoiCiAgICAgICBpZD0icGF0aDQwMTYtMy04LTYiCiAgICAgICBpbmtzY2FwZTpjb25uZWN0b3ItY3VydmF0dXJlPSIwIiAvPgogIDwvZz4KPC9zdmc+Cg=='
}
});


define('lib/util',[], function() {

  

  // Namespace: util
  //
  // Utility functions. Mainly logging.
  //

  var loggers = {}, silentLogger = {};

  var knownLoggers = ['base', 'sync', 'webfinger', 'getputdelete', 'platform',
                      'baseClient', 'widget', 'store', 'foreignClient', 'schedule'];

  var logFn = null;

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
      var eventNames = Array.prototype.slice.call(arguments);

      function setupHandlers() {
        var handlers = {};
        eventNames.forEach(function(name) {
          handlers[name] = [];
        });
        return handlers;
      }

      return this.bindAll({

        _handlers: setupHandlers(),

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
        },

        reset: function() {
          this._handlers = setupHandlers();
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
            if(logFn) {
              return logFn(name, level, args);
            }
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

    // Method: setLogFunction
    //
    // Override the default logger with a custom function.
    // After the remotestorage will no longer log to the browser console, but
    // instead pass each logger call to the provided function.
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
    },

    // Method: grepLocalStorage
    // Find a list of keys that match a given pattern.
    //
    // Iterates over all localStorage keys and calls given 'iter'
    // for each key that matches given 'pattern'.
    //
    // The iter receives the matching key as it's only argument.
    grepLocalStorage: function(pattern, iter) {
      for(var i=0;i<localStorage.length;i++) {
        var key = localStorage.key(i);
        if(pattern.test(key)) {
          iter(key);
        }
      }
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
    xhr.onreadystatechange = function() {
      if((xhr.readyState==4)) {
        if(timer) {
          window.clearTimeout(timer);
        }
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
    // location.hash in firefox has all URI entities decoded, so we can't
    // differentiate between %26 and & in URIs passed as parameters.
    var hash = String(location).split(/^.*?#/)[1];
    if(hash) {
      var pairs = hash.split('&');
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
      logger.info(method, url);
      var platformObj = {
        url: url,
        method: method,
        error: function(err) {
          if(err == 401) {
            err = 'unauthorized';
          } else if(err != 404) {
            logger.error(method + ' ' + url + ': ', err);
          }
          cb(err);
        },
        success: function(data, headers) {
          //logger.debug('doCall cb '+url, 'headers:', headers);
          cb(null, data, getContentType(headers));
        },
        timeout: deadLine || 5000,
        headers: {}
      }

      if(token) {
        platformObj.headers['Authorization'] = 'Bearer ' + token;
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
        } else if(err) {
          cb(err);
        } else {
          if(util.isDir(url)) {
            try {
              data = JSON.parse(data);
            } catch (e) {
              cb('unparseable directory index');
              return;
            }
          }
          cb(null, data, mimetype);
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

  var state = 'anonymous';

  function setSetting(key, value) {
    localStorage.setItem(prefix+key, JSON.stringify(value));

    calcState();

    if(state == 'connected') {
      events.emit('connected');
    }
  }

  function removeSetting(key) {
    localStorage.removeItem(prefix+key);
  }

  function getSetting(key) {
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
    util.grepLocalStorage(new RegExp('^' + prefix), function(key) {
      localStorage.removeItem(key);
    });
  }

  function getState() {
    return state;
  }

  function calcState() {
    if(getSetting('storageType') && getSetting('storageHref')) {
      if(getSetting('bearerToken')) {
        state = 'connected';
      } else {
        state = 'authing';
      }
    } else {
      state = 'anonymous';
    }
    return state;
  }

  function on(eventType, cb) {
    events.on(eventType, cb);
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
  //   callback - see <getputdelete.get> for details on the callback parameters
  function get(path, cb) {
    if(isForeign(path)) {
      return getForeign(path, cb);
    } else if(state != 'connected') {
      cb(new Error('not-connected'));
    }
    var token = getSetting('bearerToken');
    if(typeof(path) != 'string') {
      cb(new Error('argument "path" should be a string'));
    } else {
      getputdelete.get(resolveKey(path), token, cb);
    }
  }

  function getForeign(fullPath, cb) {
    var md = fullPath.match(foreignKeyRE);
    var userAddress = md[1];
    var path = md[2];
    var base = getStorageHrefForUser(userAddress);
    getputdelete.get(base + path, null, cb);
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
      return cb(new Error("Foreign storage is read-only"));
    } else if(state != 'connected') {
      cb(new Error('not-connected'));
    }
    var token = getSetting('bearerToken');
    if(typeof(path) != 'string') {
      cb(new Error('argument "path" should be a string'));
    } else {
      if(valueStr && typeof(valueStr) != 'string') {
        valueStr = JSON.stringify(valueStr);
      }
      getputdelete.set(resolveKey(path), valueStr, mimeType, token, cb);
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
    getputdelete.set(resolveKey(path), undefined, undefined, token, cb);
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

  return {

    get: get,
    set: set,
    remove: remove,

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
    setStorageInfo   : function(type, href) {
      setSetting('storageType', type);
      setSetting('storageHref', href);
    },

    // Method: getStorageHref
    //
    // Get base URL of the user's remotestorage.
    getStorageHref   : function() {
      return getSetting('storageHref')
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
    on               : on,

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
  };
});

define('lib/store',['./util'], function (util) {

  

  // Namespace: store
  //
  // The store stores data locally. It treats all data as raw nodes, that have *metadata* and *payload*.
  // Metadata and payload are stored under separate keys.


  var logger = util.getLogger('store');

  // node metadata key prefix
  var prefixNodes = 'remote_storage_nodes:';
  // note payload data key prefix
  var prefixNodesData = 'remote_storage_node_data:';
  // foreign nodes are prefixed with a user address
  var userAddressRE = /^[^@]+@[^:]+:\//;

  var events = util.getEventEmitter('error', 'change', 'foreign-change');

  //
  // Type: Node
  //
  // Represents a node within the local store.
  //
  // Properties:
  //   startAccess - either "r" or "rw". Flag means, that this node has been claimed access on (see <remoteStorage.claimAccess>) (default: null)
  //   startForce  - boolean flag to indicate that this node shall always be synced. (see <BaseClient.sync>) (default: null)
  //   timestamp   - last time this node was (apparently) updated (default: 0)
  //   lastUpdatedAt - Last time this node was upated from remotestorage
  //   mimeType    - MIME media type
  //   diff        - (directories only) marks children that have been modified.
  //


  // Event: change
  // See <BaseClient.Events>

  function fireChange(origin, path, oldValue) {
    var node = getNode(path);
    events.emit('change', {
      path: path,
      origin: origin,
      oldValue: oldValue,
      newValue: getNodeData(path),
      timestamp: node.timestamp
    });
  }

  // Event: foreign-change
  // Fired when a foreign node is updated.

  function fireForeignChange(path, oldValue) {
    var node = getNode(path);
    events.emit('foreign-change', {
      path: path,
      oldValue: oldValue,
      newValue: getNodeData(path),
      timestamp: node.timestamp
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

  // forward events from other tabs
  if(typeof(window) !== 'undefined') {
    window.addEventListener('storage', function(event) {
      if(isPrefixed(event.key)) {
        if(! util.isDir(event.key)) {
          fireChange('device', event.key.substring(prefixNodes.length), event.oldValue);
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
      throw new Error("No path given!");
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
        startForceTree: null,
        timestamp: 0,
        lastUpdatedAt: 0,
        mimeType: "application/json"
      };
      if(util.isDir(path)) {
        value.diff = {};
      }
    }
    return value;
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
    var oldValue;

    if(! outgoing) {
      if(typeof(timestamp) !== 'number') {
        throw "Attempted to set non-number timestamp in incoming change: " + timestamp + ' (' + typeof(timestamp) + ')';
      }
      node.lastUpdatedAt = timestamp;
      oldValue = getNodeData(path);
    }

    if(!mimeType) {
      mimeType='application/json';
    }
    node.mimeType = mimeType;
    updateNodeData(path, data);
    updateNode(path, (data ? node : undefined), outgoing, false, timestamp, oldValue);
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

  function removeNode(path, timestamp) {
    setNodeData(path, undefined, false, timestamp || getCurrTimestamp());
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
  // Set startForce and startForceTree flags on a node.
  //
  // Parameters:
  //   path      - absolute path to the node
  //   dataFlag  - whether to sync data
  //   treeFlag  - whether to sync the tree
  //
  function setNodeForce(path, dataFlag, treeFlag) {
    var node = getNode(path);
    node.startForce = dataFlag;
    node.startForceTree = treeFlag;
    updateNode(path, node, false, true);//meta
  }

  function setNodeError(path, error) {
    var node = getNode(path);
    if(! error) {
      delete node.error;
    } else {
      node.error = error;
    }
    updateNode(path, node, false, true);
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
    var node = getNode(path);
    if(timestamp) {
      node.timestamp = node.lastUpdatedAt = timestamp;
      updateNode(path, node, false, true);
    }

    if(util.isDir(path) && Object.keys(getNodeData(path)).length == 0 && !(node.startAccess || node.startForce || node.startForceTree)) {
      updateNodeData(path, undefined);
      updateNode(path, undefined, false);
    }

    var parentPath = util.containingDir(path);
    var baseName = util.baseName(path);
    if(parentPath) {
      var parent = getNode(parentPath);
      delete parent.diff[baseName];
      
      updateNode(parentPath, parent, false, true);

      if(Object.keys(parent.diff).length === 0) {
        clearDiff(parentPath);
      }
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
    logger.info('fire initial events');

    function iter(path) {
      if(util.isDir(path)) {
        var listing = getNodeData(path);
        if(listing) {
          for(var key in listing) {
            iter(path + key);
          }
        }
      } else {
        fireChange('device', path);
      }
    }

    iter('/');

  }




  function isPrefixed(key) {
    return key.substring(0, prefixNodes.length) == prefixNodes;
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

  function updateNodeData(path, data) {
    validPath(path);
    if(! path) {
      throw new Error("Path is required!");
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

  function updateNode(path, node, outgoing, meta, timestamp, oldValue) {
    validPath(path);

    if((!meta) && (! timestamp)) {
      if(outgoing) {
        timestamp = getCurrTimestamp();
      } else if(util.isDir(path)) {
        timestamp = determineDirTimestamp(path)
      } else {
        throw new Error('no timestamp given for node ' + path);
        timestamp = 0;
      }
    }

    if(node && typeof(timestamp) == 'number') {
      node.timestamp = timestamp;
    }

    if(node) {
      localStorage.setItem(prefixNodes+path, JSON.stringify(node));
    } else {
      localStorage.removeItem(prefixNodes+path);
    }
    var containingDir = util.containingDir(path);

    if(containingDir) {

      var parentNode = getNode(containingDir);
      var parentData = getNodeData(containingDir) || {};
      var baseName = getFileName(path);

      if(meta) {
        if(! (parentData && parentData[baseName])) {
          parentData[baseName] = 0;
          updateNodeData(containingDir, parentData);
        }
        updateNode(containingDir, parentNode, false, true, timestamp);
      } else if(outgoing) {
        // outgoing
        if(node) {
          parentData[baseName] = timestamp;
        } else {
          delete parentData[baseName];
        }
        parentNode.diff[baseName] = timestamp;
        updateNodeData(containingDir, parentData);
        updateNode(containingDir, parentNode, true, false, timestamp);
      } else {
        // incoming
        if(node) {
          // incoming add or change
          if(!parentData[baseName] || parentData[baseName] < timestamp) {
            parentData[baseName] = timestamp;
            delete parentNode.diff[baseName];
            updateNodeData(containingDir, parentData);
            updateNode(containingDir, parentNode, false, false, timestamp);
          }
        } else {
          // incoming deletion
          if(parentData[baseName]) {
            delete parentData[baseName];
            delete parentNode.diff[baseName];
            updateNodeData(containingDir, parentData);
            updateNode(containingDir, parentNode, false, false, timestamp);
          }
        }
        if(! util.isDir(path)) {
          // fire changes
          if(isForeign(path)) {
            fireForeignChange(path, oldValue);
          } else {
            fireChange('remote', path, oldValue);
          }
        }
      }
    }
  }

  return {
    
    events: events,

    // method         , local              , used by
                                           
    getNode           : getNode,          // sync
    getNodeData       : getNodeData,      // sync
    setNodeData       : setNodeData,      // sync
    clearDiff         : clearDiff,        // sync
    removeNode        : removeNode,       // sync

    setNodeError: setNodeError,

    on                : events.on,
    setNodeAccess     : setNodeAccess,
    setNodeForce      : setNodeForce,
    forget            : forget,
    
    forgetAll         : forgetAll,        // widget
    fireInitialEvents : fireInitialEvents // widget
  };

});

define('lib/sync',['./wireClient', './store', './util'], function(wireClient, store, util) {

  

  var events = util.getEventEmitter('error', 'conflict', 'state', 'busy', 'ready', 'timeout');
  var logger = util.getLogger('sync');

  /*******************/
  /* Namespace: sync */
  /*******************/

  // Settings. Trivial.

  var settingsPrefix = 'remote_storage_sync:';

  function getSetting(key) {
    var data = localStorage.getItem(settingsPrefix + key);
    try { data = JSON.parse(data); } catch(e) {};
    return data;
  }

  function setSetting(key, value) {
    if(typeof(value) !== 'string') {
      value = JSON.stringify(value);
    }
    return localStorage.setItem(settingsPrefix + key, value);
  }

  function clearSettings() {
    for(var i=0;i<localStorage.length;i++) {
      var key = localStorage.key(i);
      if(key.match(new RegExp('^' + settingsPrefix))) {
        localStorage.removeItem(key);
      }
    }
  }


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
    var listing = store.getNodeData('/');
    for(var key in listing) {
      if(util.isDir(key) && Object.keys(store.getNode('/' + key).diff).length > 0) {
        return true;
      }
    }
    return false;
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
  // Calls it's callback once 'ready' is fired.
  //
  // Fires:
  //   ready    - when the sync queue is empty afterwards
  //   conflict - when there are two incompatible versions of the same node
  //   change   - when the local store is updated
  //
  function fullSync(callback, pushOnly) {
    if(! isConnected()) {
      return callback && callback('not-connected');
    }

    logger.info("full " + (pushOnly ? "push" : "sync") + " started");

    var roots = findRoots();
    var synced = 0;

    function rootCb() {
      synced++;
      if(synced == roots.length) {
        sync.lastSyncAt = new Date();
        if(callback) {
          callback.apply(this, arguments);
        }
      }
    }

    if(roots.length == 0) {
      logger.info('full sync not happening. no access claimed.');
      return;
    }

    roots.forEach(function(root) {
      enqueueTask(function() {
        traverseTree(root, processNode, {
          pushOnly: pushOnly
        });
      }, rootCb);
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
    fullSync(callback, true);
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
  function partialSync(startPath, depth, callback) {
    if(! isConnected()) {
      return callback && callback('not-connected');
    }

    validatePath(startPath);
    logger.info("partial sync requested: " + startPath);
    enqueueTask(function() {
      logger.info("partial sync started from: " + startPath);
      events.once('ready', callback);
      traverseTree(startPath, processNode, {
        depth: depth
      });
    });
  }

  // Function: syncOne
  //
  // Sync a single path. Call the callback when done.
  //
  // This function ignores all flags (access, force, forceTree) set on the node.
  //
  // Parameters:
  //   path     - the path to synchronize
  //   callback - (optional) callback to call when done
  //
  // Callback parameters:
  //   node - local node after sync
  //   data - data of local node after sync
  //
  // Fires:
  //   ready    - when the sync queue is empty afterwards
  //   conflict - when there are two incompatible versions of the same node
  //   change   - when the local store is updated
  //
  function syncOne(path, callback) {
    if(! isConnected()) {
      return callback && callback('not-connected');
    }

    validatePath(path, true);
    logger.info("single sync requested: " + path);
    enqueueTask(function() {
      logger.info("single sync started: " + path);
      fetchRemoteNode(path, function(remoteNode) {
        var localNode = fetchLocalNode(path);
        processNode(path, localNode, remoteNode);
        if(callback) {
          // FIXME: document error parameter.
          callback(null, store.getNode(path), store.getNodeData(path));
        }
      });
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


  events.on('ready', function() {
    logger.info("READY", 'queued tasks: ', taskQueue.length);
    if(currentFinalizer) {
      currentFinalizer();
      currentFinalizer = null;
    }
    if(taskQueue.length > 0) {
      var nextTask = taskQueue.shift();
      currentFinalizer = nextTask.finalizer;
      nextTask.run();
    }
  });

  function enqueueTask(callback, finalizer) {
    if(ready) {
      currentFinalizer = finalizer;
      callback();
    } else {
      taskQueue.push({
        run: callback,
        finalizer: finalizer
      });
    }
  }

  function setBusy() {
    ready = false;
    events.emit('state', 'busy');
    events.emit('busy');
  }
  function setReady() {
    ready = true;
    if(deferredIterationQueue.length > 0) {
      spawnQueue.apply(this, deferredIterationQueue.shift());
    } else {
      events.emit('state', 'connected');
      events.emit('ready');
    }
  }

  // see if we can fire 'ready', or if there's more to do
  function tryReady() {
    if(ready && deferredIterationQueue.length == 0) {
      events.emit('ready');
    }
  }

  // Function: getState
  // Get the current ready state of synchronization. Either 'connected' or 'busy'.
  function getState() { return ready ? 'connected' : 'busy'; }

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
    var event = { path: path, };
    if(typeof(error) == 'object') {
      event.stack = error.stack;
      if(typeof(event.stack == 'string')) {
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
    var oldValue = store.getNodeData(path);
    store.removeNode(path, remote.timestamp);
  }

  // Function: deleteRemote
  //
  // remove remote data, then clear local diff.
  // Fires: error
  function deleteRemote(path, local, remote) {
    logger.info('DELETE', path, 'LOCAL -> REMOTE');
    wireClient.remove(
      path,
      makeErrorCatcher(path, util.curry(store.clearDiff, path, undefined))
    );
  }

  // Function: updateLocal
  //
  // update local data at path.
  function updateLocal(path, local, remote) {
    logger.info('UPDATE', path, 'REMOTE -> LOCAL');
    store.setNodeData(path, remote.data, false, remote.timestamp, remote.mimeType);
  }

  // Function: updateRemote
  //
  // update remote data at path, then clear local diff.
  // Fires: error
  function updateRemote(path, local, remote) {
    logger.info('UPDATE', path, 'LOCAL -> REMOTE');
    wireClient.set(
      path, local.data, local.mimeType,
      makeErrorCatcher(path, function() {
        // update lastUpdatedAt for this node to exact remote time.
        // this is a totally unnecessary step and should be handled better
        // in the protocol (e.g. by returning the new timestamp with the PUT
        // request).
        fetchNode(util.containingDir(path), function(listing) {
          store.clearDiff(path, listing[util.baseName(path)]);
        });
      })
    );
  }


  // Function: processNode
  //
  // Decides which action to perform on the node in order to synchronize it.
  //
  // Used as a callback for <traverseTree>.
  function processNode(path, local, remote) {

    var action = null;

    if(local.deleted) {
      // outgoing delete!
      logger.debug(path, 'outgoing delete');
      action = deleteRemote;

    } else if(remote.deleted && local.lastUpdatedAt > 0) {
      if(local.timestamp == local.lastUpdatedAt) {
        // incoming delete!
        logger.debug(path, 'incoming delete');
        action = deleteLocal;

      } else {
        // deletion conflict!
        logger.debug(path, 'deletion conflict', 'remote', remote, 'local', local);
        action = util.curry(fireConflict, 'delete');

      }
    } else if(local.timestamp == remote.timestamp) {
      // no action today!
      logger.debug(path, 'no action today');
      return;

    } else if(local.timestamp > remote.timestamp) {
      // local updated happpened before remote update
      if(local.lastUpdatedAt == remote.timestamp) {
        // outgoing update!
        logger.debug(path, 'outgoing update');
        action = updateRemote;

      } else {
        // merge conflict!
        logger.debug(path, 'merge conflict (local > remote)', 'remote', remote, 'local', local);
        action = util.curry(fireConflict, 'merge');

      }
    } else if(local.timestamp < remote.timestamp) {
      // remote updated happened before local update
      if(local.lastUpdatedAt == local.timestamp) {
        // incoming update!
        logger.debug(path, 'incoming update');
        action = updateLocal;

      } else {
        // merge conflict!
        logger.debug(path, 'merge conflict (local < remote)', 'remote', remote, 'local', local);
        action = util.curry(fireConflict, 'merge');

      }
    }

    if(! action) {
      var exc = new Error("Something went terribly wrong.");
      exc.path = path;
      exc.localNode = local;
      exc.remoteNode = remote;
      throw exc;
    }

    action(path, local, remote);
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
    logger.info("fetch local", path);
    var localNode = store.getNode(path);
    localNode.data = store.getNodeData(path);

    if(isForeignPath(path)) {
      // can't modify foreign data locally
      isDeleted = false;
    }

    if(typeof(isDeleted) == 'undefined') {
      // in some contexts we don't have the parent present already to check.
      var parentPath = util.containingDir(path);
      if(parentPath) {
        var baseName = util.baseName(path);
        var parent = store.getNode(parentPath);
        var parentData = store.getNodeData(parentPath);
        isDeleted = (! parentData[baseName]) && parent.diff[baseName];
      } else {
        // root node can't be deleted.
        isDeleted = false;
      }
    }
    localNode.deleted = isDeleted;
    return localNode;
  }

  function fetchNode(path, callback) {
    logger.info("fetch remote", path);
    wireClient.get(path, function(err, data, mimeType) {
      if(err) {
        fireError(path, err);
      } else {
        try {
          callback(data, mimeType);
        } catch(exc) {
          fireError(path, exc);
        }
      }
    });
  }

  function prepareRemoteNode(data, mimeType, timestamp) {
    return {
      timestamp: timestamp,
      data: data,
      deleted: timestamp == 0,
      mimeType: mimeType
    }
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
  function fetchRemoteNode(path, parentData, callback) {
    var isForeign = isForeignPath(path);

    function done(data, mimeType) {
      callback(prepareRemoteNode(
        data, mimeType,
        (parentData && parentData[util.baseName(path)]) || (
          isForeign ? new Date().getTime() : 0
        )
      ));
    }

    if(callback) {
      fetchNode(path, done);
    } else {
      callback = parentData, parentData = null;
      var parentPath = util.containingDir(path);
      if(isForeign) {
        // foreign node (no listing possible)
        fetchNode(path, done);
      } else if(parentPath) {
        // get parent listing (to get a timestamp), then continue
        fetchNode(parentPath, function(data) {
          parentData = data;
          fetchNode(path, done);
        });
      } else {
        // root node, doesn't have a parent to consult
        fetchNode(path, done);
      }
    }
  }

  // Section: Trivial helpers

  function isConnected() {
    return wireClient.getState() == 'connected';
  }

  function makeSet(a, b) {
    var o = {};
    for(var i=0;i<a.length;i++) { o[a[i]] = true; }
    for(var j=0;j<b.length;j++) { o[b[j]] = true; }
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

  function findRoots(path) {
    var root = store.getNode('/');
    var roots = []
    if(root.startAccess) {
      roots.push('/');
    } else {
      Object.keys(store.getNodeData('/')).forEach(function(key) {
        if(store.getNode('/' + key).startAccess) {
          roots.push('/' + key);
        }
      });
    }
    return roots;
  }

  function findAccess(path) {
    if(! path) {
      return null;
    } else {
      var node = store.getNode(path);
      if(node.startAccess) {
        return node.startAccess;
      } else {
        return findAccess(util.containingDir(path));
      }
    }
  }

  function findNextForceRoots(path) {
    var roots = [];
    var listing = store.getNodeData(path)
    for(var key in listing) {
      var node = store.getNode(path + key);
      if(node.startForce || node.startForceTree) {
        roots.push(path + key);
      } else if(util.isDir(key)) {
        findNextForceRoots(path + key).forEach(function(root) {
          roots.push(root);
        });
      }
    }
    logger.debug('findNextForceRoots', path, JSON.stringify(roots));
    return roots;
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

    var done = opts.done || function() {};

    if(opts.depth || opts.depth == 0) {
      logger.debug("traverse depth", opts.depth, root);
    }

    // fetch local listing
    var localRootNode = store.getNode(root);
    var localListing = store.getNodeData(root);

    if(! localListing) {
      // create empty directory node, if it doesn't exist.
      localListing = {};
      store.setNodeData(root, localListing, false, 0, 'application/json');
    }

    opts.access = util.highestAccess(opts.access, localRootNode.startAccess);
    opts.force = opts.force || localRootNode.startForce;
    opts.forceTree = opts.forceTree || localRootNode.startForceTree;

    if(! opts.access) {
      // in case of a partial sync, we have not been informed about
      // access inherited from the parent.
      opts.access = findAccess(util.containingDir(root));
    }

    if(! (opts.force || opts.forceTree)) {
      // no interest.
      // -> bail!
      logger.debug('skipping', root, 'no interest', '(access: ', opts.access, ' force: ', opts.force, ' forceTree: ', opts.forceTree, ')');
      if(opts.access || root == '/') { // (access can begin only on the root or it's direct children, so we don't need to descend further)
        var nextRoots = findNextForceRoots(root);
        if(nextRoots.length > 0) {
          var nextRoot;
          while(nextRoot = nextRoots.shift()) {
            var thisParts = util.pathParts(root);
            var nextParts = util.pathParts(nextRoot);
            var newOpts = util.extend({}, opts);
            newOpts.done = done;
            newOpts.depth = opts.depth ? (nextParts.length - thisParts.length) : null;
            if((newOpts.depth == null) || (newOpts.depth > 0)) {
              traverseTree(nextRoot, callback, newOpts);
            }
          }
          return;
        } // no more roots.
      } // no access anyway.
      tryReady();
      done();
      return; // done.
    }

    var localDiff = Object.keys(localRootNode.diff).length > 0;

    if(! localDiff) {
      if(opts.pushOnly) {
        tryReady();
        done();
        return;
      }
    }

    // fetch remote listing
    fetchNode(root, function(remoteListing) {
      if(! remoteListing) { remoteListing = {}; }

      // not really "done", but no more immediate requests in this
      // function.
      done();

      // all keys in local and/or remote listing
      var fullListing = makeSet(
        Object.keys(remoteListing),
        Object.keys(localListing)
      );

      if(opts.forceTree && (! opts.force) && Object.keys(localListing).length == 0) {
        // empty listing, only trees are synced.
        // -> copy children, but don't sync..
        fullListing.forEach(function(key) {
          localListing[key] = 0;
        });
        store.setNodeData(root, localListing, false, 0, 'application/json');
      }

      // check if we can skip this node.
      //
      if(! localDiff) {
        var remoteDiff = false;
        for(var i=0;i<fullListing.length;i++) {
          var item = fullListing[i];
          if(localListing[item] != remoteListing[item]) {
            // remote diff detected.
            // -> continue!
            remoteDiff = true;
            break;
          }
        }
        if(! remoteDiff) {
          // no remote diff.
          // -> bail!
          logger.debug('skipping', root, 'no changes');
          tryReady();
          done();
          return;
        }
      }

      spawnQueue(fullListing, 6, function(item, next) {
        var path = root + item;
        if(util.isDir(item)) {
          if(opts.depth && opts.depth == 1) {
            next();
          } else {
            var newOpts = util.extend({}, opts);
            if(newOpts.depth) { newOpts.depth--; }
            newOpts.done = next;
            traverseTree(path, callback, newOpts);
          }
        } else if(opts.force) {
          fetchRemoteNode(path, remoteListing, function(remoteNode) {
            var localNode = fetchLocalNode(
              path,
              // local deletions only appear in the diff of the parent.
              ( (! localListing[item]) &&
                (localRootNode.diff[item]) )
            );
            callback(path, localNode, remoteNode);
            next();
          });
        } else {
          next();
        }
      });

    });
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
    }
  }

  // Function: makeErrorCatcher
  // returns a function, that receives an error as it's only parameter.
  // if the error resolves to true, an error event is fired.
  //
  // If an optional callback is supplied, and the error resolves to false,
  // the callback will be called with all additional arguments.
  function makeErrorCatcher(path, callback) {
    return function(error) {
      if(error) {
        fireError(path, error);
      } else if(callback) {
        var args = Array.prototype.slice.call(arguments, 1);
        callback.apply(this, args);
      }
    }
  }

  // Function: spawnQueue
  // run a procedure for each item in list.
  //
  // Parameters:
  //   list - an array of items to pass to the iter
  //   max  - maximum number of simultaneously running versions of iter
  //   iter - iterator to call
  //
  // Iterator parameters:
  //   item - an item from the list
  //   done - a callback function to call, when the iterator is finished
  //
  function spawnQueue(list, max, iter) {
    if(! ready) {
      deferredIterationQueue.push([list, max, iter]);
      return;
    }

    setBusy();

    var n = 0;
    var i = 0;
    function next() {
      n++;
      iter(list[i++], done);
    }
    function done() {
      n--;
      if(i == list.length && n == 0) {
        setReady();
      } else if(i < list.length) {
        spawn();
      }
    }
    function spawn() {
      while(n < max && i < list.length) {
        next();
      }
    }
    setTimeout(spawn, 1);
  }

  // Limit calls to the given function to the given interval.
  // If the function receives a callback, it must be the last argument.
  // If the call is intercepted, as minInterval has not passed yet, the callback
  // will be called immediately. No parameters will be passed on to the callback.
  function limit(name, syncFunction, minInterval) {
    return function() {
      var args = Array.prototype.slice.call(arguments);
      var callback = args.slice(-1)[0];
      var plainArgs = args;
      if(typeof(callback) == 'function') {
        plainArgs = args.slice(0, -1);
      } else {
        callback = null;
      }
      var now = new Date().getTime();
      var cacheKey = [name, plainArgs];
      var limitCache = getSetting('limitCache') || {};
      if(limitCache[cacheKey] && limitCache[cacheKey] > (now - minInterval)) {
        logger.debug('limit', name, '-> replay');
        if(callback) {
          callback();
        }
      } else {
        logger.debug('limit', name, '-> call through');
        limitCache[cacheKey] = now;
        setSetting('limitCache', limitCache);
        syncFunction.apply(this, args);
      }
    }
  }


  events.on('error', function(error) {
    logger.error("Error: ", error);
  });

  var limitedFullSync = limit('fullSync', fullSync, 30000);
  var limitedPartialSync = limit('partialSync', partialSync, 30000);
  
  var sync = {

    lastSyncAt: null,

    // Section: exported functions

    // Method: fullSync
    // <fullSync>, limited to act at max once every 30 seconds
    fullSync: limitedFullSync,

    forceSync: fullSync,
    // Method: fullPush
    // <fullPush>
    fullPush: fullPush,
    // Method: partialSync
    // <partialSync>, limited to act at max once every 30 seconds per (path, depth) pair.
    partialSync: limitedPartialSync,
    // Method: syncOne
    // <syncOne>
    syncOne: syncOne,

    // Method: needsSync
    // Returns true, if there are local changes that have not been synced.
    needsSync: needsSync,

    // Method: getState
    // <getState>
    getState: getState,

    // Method: on
    // Install an event handler.
    on: events.on,

    // Method: clearSettings
    // Clear all data from localStorage that this file put there.
    clearSettings: clearSettings,

    // Method: syncNow
    // DEPRECATED. calls <fullSync>
    syncNow: function(path, callback) {
      util.deprecate('sync.syncNow', 'sync.fullSync');
      this.fullSync(callback);
    },
    // Method: fetchNow
    // DEPRECATED. calls <syncOne>
    fetchNow: function(path, callback) {
      util.deprecate('sync.fetchNow', 'sync.syncOne or sync.partialSync');
      this.syncOne(path, callback);
    },

    // Method: disableThrottling
    // Disable throttling of <fullSync>/<partialSync> for debugging purposes.
    // Cannot be undone!
    disableThrottling: function() {
      sync.fullSync = fullSync;
      sync.partialSync = partialSync;
    }

  }

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
  var runInterval = 30000;
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
    for(var path in watchedPaths) {
      var lastSync = lastPathSync[path];
      if((! lastSync) || (lastSync + watchedPaths[path]) <= now) {
        syncNow.push(path);
      }
    }

    if(syncNow.length == 0) {
      scheduleNextRun();
      return;
    }

    logger.info("Paths to refresh: ", syncNow);

    // request a sync for each path
    for(var i=0;i<syncNow.length;i++) {
      var path = syncNow[i];
      var syncer = function(path, cb) {
        if(path == '/') {
          sync.fullSync(cb);
        } else {
          sync.partialSync(path, null, cb);
        }
      };
      syncer(path, function() {
        lastPathSync[path] = new Date().getTime();

        syncedCount++;

        if(syncedCount == syncNow.length) {
          scheduleNextRun();
        }
      });
    }
  }

  return {

    enable: function() {
      enabled = true;
      logger.info('enabled');
      scheduleNextRun();
    },

    disable: function() {
      enabled = false;
      logger.info('disabled');
    },

    watch: function(path, interval) {
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
    }

  }

});
/*
 * Mailcheck https://github.com/Kicksend/mailcheck
 * Author
 * Derrick Ko (@derrickko)
 *
 * License
 * Copyright (c) 2012 Receivd, Inc.
 *
 * Licensed under the MIT License.
 *
 * v 1.1
 *
 * ------------------------------------
 * remoteStorage.js modifications:
 *
 * 2012-10-24:
 * - added AMD wrapper
 * - removed jQuery stuff
 * - replaced defaultDomains with our own version
 */

define('lib/mailcheck',[], function() {

  var Kicksend = {
    mailcheck : {
      threshold: 3,

      defaultDomains: ["5apps.com", "heahdk.net"],

      defaultTopLevelDomains: ["co.uk", "com", "net", "org", "info", "edu", "gov", "mil"],

      run: function(opts) {
        opts.domains = opts.domains || Kicksend.mailcheck.defaultDomains;
        opts.topLevelDomains = opts.topLevelDomains || Kicksend.mailcheck.defaultTopLevelDomains;
        opts.distanceFunction = opts.distanceFunction || Kicksend.sift3Distance;

        var result = Kicksend.mailcheck.suggest(encodeURI(opts.email), opts.domains, opts.topLevelDomains, opts.distanceFunction);

        if (result) {
          if (opts.suggested) {
            opts.suggested(result);
          }
        } else {
          if (opts.empty) {
            opts.empty();
          }
        }
      },

      suggest: function(email, domains, topLevelDomains, distanceFunction) {
        email = email.toLowerCase();

        var emailParts = this.splitEmail(email);

        var closestDomain = this.findClosestDomain(emailParts.domain, domains, distanceFunction);

        if (closestDomain) {
          if (closestDomain != emailParts.domain) {
            // The email address closely matches one of the supplied domains; return a suggestion
            return { address: emailParts.address, domain: closestDomain, full: emailParts.address + "@" + closestDomain };
          }
        } else {
          // The email address does not closely match one of the supplied domains
          var closestTopLevelDomain = this.findClosestDomain(emailParts.topLevelDomain, topLevelDomains);
          if (emailParts.domain && closestTopLevelDomain && closestTopLevelDomain != emailParts.topLevelDomain) {
            // The email address may have a mispelled top-level domain; return a suggestion
            var domain = emailParts.domain;
            closestDomain = domain.substring(0, domain.lastIndexOf(emailParts.topLevelDomain)) + closestTopLevelDomain;
            return { address: emailParts.address, domain: closestDomain, full: emailParts.address + "@" + closestDomain };
          }
        }
        /* The email address exactly matches one of the supplied domains, does not closely
         * match any domain and does not appear to simply have a mispelled top-level domain,
         * or is an invalid email address; do not return a suggestion.
         */
        return false;
      },

      findClosestDomain: function(domain, domains, distanceFunction) {
        var dist;
        var minDist = 99;
        var closestDomain = null;

        if (!domain || !domains) {
          return false;
        }
        if(!distanceFunction) {
          distanceFunction = this.sift3Distance;
        }

        for (var i = 0; i < domains.length; i++) {
          if (domain === domains[i]) {
            return domain;
          }
          dist = distanceFunction(domain, domains[i]);
          if (dist < minDist) {
            minDist = dist;
            closestDomain = domains[i];
          }
        }

        if (minDist <= this.threshold && closestDomain !== null) {
          return closestDomain;
        } else {
          return false;
        }
      },

      sift3Distance: function(s1, s2) {
        // sift3: http://siderite.blogspot.com/2007/04/super-fast-and-accurate-string-distance.html
        if (s1 == null || s1.length === 0) {
          if (s2 == null || s2.length === 0) {
            return 0;
          } else {
            return s2.length;
          }
        }

        if (s2 == null || s2.length === 0) {
          return s1.length;
        }

        var c = 0;
        var offset1 = 0;
        var offset2 = 0;
        var lcs = 0;
        var maxOffset = 5;

        while ((c + offset1 < s1.length) && (c + offset2 < s2.length)) {
          if (s1.charAt(c + offset1) == s2.charAt(c + offset2)) {
            lcs++;
          } else {
            offset1 = 0;
            offset2 = 0;
            for (var i = 0; i < maxOffset; i++) {
              if ((c + i < s1.length) && (s1.charAt(c + i) == s2.charAt(c))) {
                offset1 = i;
                break;
              }
              if ((c + i < s2.length) && (s1.charAt(c) == s2.charAt(c + i))) {
                offset2 = i;
                break;
              }
            }
          }
          c++;
        }
        return (s1.length + s2.length) /2 - lcs;
      },

      splitEmail: function(email) {
        var parts = email.split('@');

        if (parts.length < 2) {
          return false;
        }

        for (var i = 0; i < parts.length; i++) {
          if (parts[i] === '') {
            return false;
          }
        }

        var domain = parts.pop();
        var domainParts = domain.split('.');
        var tld = '';

        if (domainParts.length == 0) {
          // The address does not have a top-level domain
          return false;
        } else if (domainParts.length == 1) {
          // The address has only a top-level domain (valid under RFC)
          tld = domainParts[0];
        } else {
          // The address has a domain and a top-level domain
          for (var i = 1; i < domainParts.length; i++) {
            tld += domainParts[i] + '.';
          }
          if (domainParts.length >= 2) {
            tld = tld.substring(0, tld.length - 1);
          }
        }

        return {
          topLevelDomain: tld,
          domain: domain,
          address: parts.join('@')
        }
      }
    }
  };

  return Kicksend;

});

/*
 * Edit distance calculation. Taken from https://github.com/cfq/levenshtein.js
 * (license not mentioned, so I assume public domain)
 */
define('lib/levenshtein',[], function() {
  function levenshtein( first, second ){
	  var d	 = [],
		flen = first.length,
		slen = second.length;

	  for( i = 0; i <= flen; i++ ){
		  d[i] = d[i] ? d[i] : [];
		  d[i][0] = i;
	  }

	  for( j = 0; j <= slen; j++ ){
		  d[0][j] = d[0][j] ? d[0][j] : [];
		  d[0][j] = j;
	  }

	  for( j = 1; j <= slen; j++ ){
		  for( i = 1; i <= flen; i++ ){
			  if( first[i-1] == second[j-1] ){
				  d[i][j] = d[i-1][j-1];
			  }else{
				  d[i][j] = Math.min( 
					  d[i-1][j]	+ 1, 
					  d[i][j-1]	+ 1, 
					  d[i-1][j-1] + 2 
				  );
			  }
		  }
	  }

	  return d[flen][slen];
  }

  return levenshtein;
});
define('lib/widget',['./assets', './webfinger', './hardcoded', './wireClient', './sync', './store', './platform', './util', './schedule', './mailcheck', './levenshtein'], function (assets, webfinger, hardcoded, wireClient, sync, store, platform, util, schedule, mailcheck, levenshtein) {

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

  

  var locale='en';
  var connectElement;
  var widgetState;
  var userAddress;
  var authDialogStrategy = 'redirect';
  var authPopupRef;
  var initialSync;
  var scopesObj = {};
  var timeoutCount = 0;

  var widget;
  var offlineReason;

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
    if(state == 'offline') {
      schedule.disable();
    }
    events.emit('state', state);
  }

  function getWidgetState() {
    return widgetState;
  }

  function buildWidget() {

    function el(tag, id, attrs) {
      var e = document.createElement(tag);
      if(id) {
        e.setAttribute('id', id);
      }
      if(attrs && attrs._content) {
        e.innerHTML = attrs._content;
        delete attrs._content;
      }
      for(var key in attrs) {
        e.setAttribute(key, attrs[key]);
      }
      return e;
    }

    var widget = {
      root: el('div', 'remotestorage-state'),
      connectButton: el('input', 'remotestorage-connect-button', {
        'class': 'remotestorage-button',
        'type': 'submit',
        'value': translate('connect')
      }),
      registerButton: el('span', 'remotestorage-register-button', {
        'class': 'remotestorage-button',
        '_content': translate('get remotestorage')
      }),
      cube: el('img', 'remotestorage-cube', {
        'src': assets.remotestorageIcon
      }),
      bubble: el('span', 'remotestorage-bubble'),
      helpHint: el('a', 'remotestorage-questionmark', {
        'href': 'http://remotestorage.io',
        'target': '_blank',
        '_content': '?'
      }),
      helpText: el('span', 'remotestorage-infotext', {
        'class': 'infotext',
        '_content': 'This app allows you to use your own data storage!<br/>Click for more info on remotestorage.'
      }),
      userAddress: el('input', 'remotestorage-useraddress', {
        'placeholder': 'user@host',
        'type': 'email'
      }),
      style: el('style'),

      menu: el('div', 'remotestorage-menu'),
      menuItemSync: el('div', null, {
        'class': 'item'
      }),
      syncButton: el('button', 'remotestorage-sync-button', {
        '_content': 'Sync now',
        'class': 'remotestoage-button'
      }),
      error: el('div', 'remotestorage-error', {
        'style': 'display:none'
      })

    };

    widget.root.appendChild(widget.connectButton);
    widget.root.appendChild(widget.registerButton);
    widget.root.appendChild(widget.cube);
    widget.root.appendChild(widget.bubble);
    widget.root.appendChild(widget.helpHint);
    widget.root.appendChild(widget.helpText);
    widget.root.appendChild(widget.userAddress);
    widget.root.appendChild(widget.menu);
    widget.root.appendChild(widget.error);

    widget.menu.appendChild(widget.menuItemSync);

    widget.style.innerHTML = assets.widgetCss;

    return widget;
  }

  function handleSyncNowClick() {
    if(widgetState == 'connected' || widgetState == 'busy') {
      sync.fullSync();
    }
  }

  function showMenu() {
    if(widgetState == 'connected' || widgetState == 'busy') {
      if(widget.menu.style.display != 'block') {
        widget.menu.style.display = 'block';
        if(widgetState == 'busy') {
          widget.menuItemSync.innerHTML = "Syncing";
        } else if(sync.needsSync()) {
          widget.menuItemSync.innerHTML = "Unsynced";
        } else if(sync.lastSyncAt > 0) {
          var t = new Date().getTime() - sync.lastSyncAt.getTime();
          widget.menuItemSync.innerHTML = "Synced " + Math.round(t / 1000) + ' seconds ago';
        } else {
          widget.menuItemSync.innerHTML = "(never synced)";
        }
        widget.menuItemSync.appendChild(widget.syncButton);
      }
    }
  }

  function hideMenu() {
    widget.menu.style.display = 'none';
  }

  function displayWidgetState(state, userAddress) {
    if(state === 'authing') {
      displayError("Authentication was aborted. Please try again.");
      return setWidgetState('typing')
    }

    if(! widget) {
      var root = document.getElementById(connectElement);
      widget = buildWidget();

      widget.registerButton.addEventListener('click', handleRegisterButtonClick);
      widget.connectButton.addEventListener('click', handleConnectButtonClick);
      widget.bubble.addEventListener('click', handleBubbleClick);
      widget.cube.addEventListener('click', handleCubeClick);
      widget.userAddress.addEventListener('keyup', handleWidgetTypeUserAddress);
      widget.syncButton.addEventListener('click', handleSyncNowClick);
      widget.root.addEventListener('mouseover', showMenu);
      widget.root.addEventListener('mouseout', hideMenu);

      root.appendChild(widget.style);
      root.appendChild(widget.root);
    }

    if(state == 'connecting') {
      widget.connectButton.setAttribute('disabled', 'disabled');
      widget.userAddress.setAttribute('disabled', 'disabled');
    } else {
      widget.connectButton.removeAttribute('disabled');
      widget.userAddress.removeAttribute('disabled');
    }

    hideMenu();

    widget.root.setAttribute('class', state);

    var userAddress = localStorage['remote_storage_widget_useraddress'] || '';

    if(userAddress) {
      widget.userAddress.value = userAddress;
      userAddress = '<strong>' + userAddress + '</strong>';
    } else {
      userAddress = '<strong>(n/a)</strong>';
    }

    var bubbleText = '';
    var bubbleVisible = false;
    var cubeIcon = assets.remotestorageIcon;
    if(initialSync && state != 'offline') {
      bubbleText = 'Connecting ' + userAddress;
      bubbleVisible = true
    } else if(state == 'connected') {
      bubbleText = 'Disconnect ' + userAddress;
    } else if(state == 'busy') {
      bubbleText = 'Synchronizing ' + userAddress + '...';
    } else if(state == 'offline') {
      if(offlineReason == 'unauthorized') {
        cubeIcon = assets.remotestorageIconError;
        bubbleText = 'Access denied by remotestorage. Click to reconnect.';
        bubbleVisible = true;
      } else {
        cubeIcon = assets.remotestorageIconOffline;
        bubbleText = 'Offline (' + userAddress + ')';
        bubbleVisible = true;
      }
    }

    widget.cube.setAttribute('src', cubeIcon);
    
    widget.bubble.innerHTML = bubbleText;

    if(bubbleVisible) {
      // always show cube & bubble while connecting or error
      widget.cube.setAttribute('style', 'opacity:1');
      widget.bubble.setAttribute('style', 'display:inline');
    } else {
      widget.cube.removeAttribute('style');
      widget.bubble.removeAttribute('style');
    }

    if(state === 'typing') {
      widget.userAddress.focus();
    }
  }

  function displayError(message) {
    widget.error.style.display = 'block'
    widget.error.innerHTML = message;
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

  function dance() {
    var endpoint = localStorage['remote_storage_widget_auth_endpoint'];
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
          displayError('webfinger discovery failed! Please check if your user address is correct and try again. If the problem persists, contact your storage provider for support. (Error is: ' + err + ')');
        }
        if(authDialogStrategy == 'popup') {
          closeAuthPopup();
        }
        setWidgetState('typing');
      } else {
        localStorage['remote_storage_widget_auth_endpoint'] = auth;
        dance();
      }
    });
  }

  function handleConnectButtonClick() {
    if(widgetState == 'typing') {
      userAddress = widget.userAddress.value;
      localStorage['remote_storage_widget_useraddress'] = userAddress;
      setWidgetState('connecting');
      if(authDialogStrategy == 'popup') {
        prepareAuthPopup();
      }
      tryWebfinger(userAddress);
    } else {
      setWidgetState('typing');
      tweakConnectButton();
    }
  }

  function handleBubbleClick() {
    if(widgetState == 'connected' || widgetState == 'busy') {
      // DISCONNECT
      sync.fullPush(function() {
        wireClient.disconnectRemote();
        store.forgetAll();
        sync.clearSettings();
        localStorage.removeItem('remote_storage_widget_useraddress');
        widget.userAddress.value = '';
        // trigger 'disconnected' once, so the app can clear it's views.
        setWidgetState('disconnected', true);
        setWidgetState('anonymous');
      });
    } else if(widgetState == 'offline' && offlineReason == 'unauthorized') {
      dance();
    } else if(widgetState == 'offline' && offlineReason == 'timeout') {
      tryReconnect();
    }
  }
  function handleCubeClick() {
    if(widgetState == 'connected' || widgetState == 'connected') {
      handleBubbleClick();
    }
  }

  function tweakConnectButton() {
    if(widget.userAddress.value.length > 0) {
      widget.connectButton.removeAttribute('disabled');
    } else {
      widget.connectButton.setAttribute('disabled', 'disabled');
    }
  }

  function handleWidgetTypeUserAddress(event) {
    if(event.keyCode === 13) {
      widget.connectButton.click();
    } else {
      tweakConnectButton();
    }
  }
  function handleWidgetHover() {
    logger.debug('handleWidgetHover');
  }

  function nowConnected() {
    logger.info("NOW CONNECTED");
    setWidgetState('connected');
    initialSync = true;
    store.fireInitialEvents();
    sync.forceSync(function() {
      logger.info("Initial sync done.");
      initialSync = false;
      setWidgetState(getWidgetState());
      schedule.enable();
      events.emit('ready');
    });
  }

  function tryReconnect() {
    var tCount = timeoutCount;
    sync.fullSync(function() {
      if(timeoutCount == tCount) {
        timeoutCount = 0;
        setWidgetState('connected');
        schedule.enable();
      }
    });
  }

  function scheduleReconnect(milliseconds) {
    setTimeout(tryReconnect, milliseconds);
  }

  function handleSyncTimeout() {
    offlineReason = 'timeout';
    setWidgetState('offline');
    timeoutCount++;
    scheduleReconnect(Math.min(timeoutCount * 10000, 300000));
  }

  function display(setConnectElement, options) {
    var tokenHarvested = platform.harvestParam('access_token');
    var storageRootHarvested = platform.harvestParam('storage_root');
    var storageApiHarvested = platform.harvestParam('storage_api');
    var authorizeEndpointHarvested = platform.harvestParam('authorize_endpoint');
    if(! options) {
      options = {};
    }

    sync.on('error', function(error) {
      if(error.message == 'unauthorized') {
        offlineReason = 'unauthorized';
        // clear bearer token, so the wireClient state is correct.
        wireClient.setBearerToken(null);
        setWidgetState('offline');
      } else if(error.message == 'unknown error') {
        // "unknown error" happens when the XHR doesn't
        // have any status code set. this usually means
        // a network error occured. We handle it exactly
        // like we handle a timeout.
        handleSyncTimeout();
      } else {
        logger.error("unhandled sync error: ", error);
      }
      
      if(initialSync) {
        // abort initial sync
        initialSync = false;
        // give control to the app (it runs in offline-mode now)
        events.emit('ready');
      }
    });

    sync.on('timeout', handleSyncTimeout);

    // sync access-roots every minute.
    schedule.watch('/', 60000);

    connectElement = setConnectElement;

    if(wireClient.calcState() == 'connected') {
      nowConnected();
    } else {
      wireClient.on('connected', nowConnected);
    }

    wireClient.on('error', function(err) {
      displayError(translate(err));
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
      localStorage['remote_storage_widget_auth_endpoint'] = authorizeEndpointHarvested;
      dance();
    }

    setWidgetStateOnLoad();

    if(options.syncShortcut !== false) {
      window.addEventListener('keydown', function(evt) {
        if(evt.ctrlKey && evt.which == 83) {
          evt.preventDefault();
          sync.fullSync();
          return false;
        }
      });
    }

    window.addEventListener('beforeunload', function(event) {
      if(widgetState != 'anonymous' && widgetState != 'authing' && widgetState != 'connecting' && sync.needsSync()) {
        sync.fullPush();
        var message = "Synchronizing your data now. Please wait until the cube stops spinning."
        event.returnValue = message
        return message;
      }
    });
    
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
define('lib/validate',[], function(){
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

define('lib/baseClient',['./sync', './store', './util', './validate'], function (sync, store, util, validate) {

  

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
    moduleEvents[moduleName][isPublic].emit('error', error);
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
    fireModuleEvent('conflict', moduleName, event);
    fireModuleEvent('conflict', 'root', event);
  });

  function set(path, absPath, value, mimeType) {
    var moduleName = extractModuleName(absPath);
    if(util.isDir(absPath)) {
      fireError(absPath, 'attempt to set a value to a directory '+absPath);
      return;
    }
    var changeEvent = {
      origin: 'window',
      oldValue: store.getNodeData(absPath),
      newValue: value,
      path: absPath
    };
    store.setNodeData(absPath, value, true, undefined, mimeType);
    fireModuleEvent('change', moduleName, changeEvent);
    fireModuleEvent('change', 'root', changeEvent);
  }

  var BaseClient = function(moduleName, isPublic) {
    this.moduleName = moduleName, this.isPublic = isPublic;
    if(! moduleEvents[moduleName]) {
      moduleEvents[moduleName] = {};
    }
    this.events = util.getEventEmitter('change', 'conflict', 'error');
    moduleEvents[moduleName][isPublic] = this.events;
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
      var base = (this.moduleName == 'root' ?
                  (path[0] === '/' ? '' : '/') :
                  '/' + this.moduleName + '/');
      return (this.isPublic ? '/public' + base : base) + path;
    },

    nodeGivesAccess: function(path, mode) {
      var node = store.getNode(path);
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
      var data = store.getNodeData(absPath);

      if(callback) {
        var cb = util.bind(callback, context);
        if(data && !(typeof(data) == 'object' && Object.keys(data).length == 0)) {
          cb(data);
        } else {
          sync.syncOne(absPath, function(node, data) {
            cb(data);
          });
        }
      } else {
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
          util.bind(callback, context)(arr);
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
    // Receives the same parameters as <getListing> (FIXME!!!)
    //
    // Returns an object in the form { path : object, ... }
    //
    getAll: function(type, path, callback, context) {
      if(typeof(path) != 'string') {
        path = type, callback = path, context = callback;
        type = null;
      }
      var makeMap = function(listing) {
        var o = {};
        listing.forEach(function(name) {
          var item = this.getObject(path + name);
          if((! type) || type == item['@type'].split('/').slice(-1)[0]) {
            o[path + name] = item;
          }
        }, this);
        return o;
      }.bind(this);
      if(callback) {
        this.getListing(path, function(listing) {
          util.bind(callback, context)(makeMap(listing));
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

      function makeResult() {
        var node = store.getNode(absPath);
        if(node) {
          return {
            mimeType: node.mimeType,
            data: store.getNodeData(absPath)
          };
        } else {
          return null;
        }
      }

      var result = makeResult();

      if(callback) {
        var cb = util.bind(callback, context);
        if(result) {
          cb(result);
        } else {
          sync.syncOne(absPath, function() {
            cb(makeResult());
          });
        }
      } else {
        return result;
      }
    },


    //
    // Method: remove
    //
    // Remove node at given path from storage. Triggers synchronization.
    //
    // Parameters:
    //   path     - Path relative to the module root.
    //   callback - (optional) called when the change has been propagated to remotestorage
    //   context  - (optional)
    //
    remove: function(path, callback, context) {
      this.ensureAccess('w');
      var absPath = this.makePath(path);
      set(path, absPath, undefined);
      sync.syncOne(absPath, util.bind(callback, context));
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
    //   callback - (optional) called when the change has been propagated to remotestorage
    //   context  - (optional) 
    //
    // Returns:
    //   An array of errors, when the validation failed, otherwise null.
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
    storeObject: function(type, path, obj, callback, context) {
      this.ensureAccess('w');
      if(typeof(obj) !== 'object') {
        throw "storeObject needs to get an object as value!"
      }
      obj['@type'] = this.resolveType(type);

      var errors = this.validateObject(obj);

      if(errors) {
        console.error("Error saving this ", type, ": ", obj, errors);
        return errors;
      } else {
        var absPath = this.makePath(path);
        set(path, absPath, obj, 'application/json');
        sync.syncOne(absPath, util.bind(callback, context));
        return null;
      }
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
    //   callback - (optional) called when the change has been propagated to remotestorage
    //   context  - (optional)
    //
    // The given mimeType will later be returned, when retrieving the data
    // using getDocument.
    //
    storeDocument: function(mimeType, path, data, callback, context) {
      this.ensureAccess('w');
      var absPath = this.makePath(path);
      set(path, absPath, data, mimeType);
      sync.syncOne(absPath, util.bind(callback, context));
    },

    getStorageHref: function() {
      return remoteStorage.getStorageHref();
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
      if(base.substr(-1) != '/') {
        base = base + '/';
      }
      return base + this.makePath(path);
    },

    syncOnce: function(path, callback) {
      var previousTreeForce = store.getNode(path).startForceTree;
      this.use(path, false);
      sync.partialSync(path, 1, function() {
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
      store.setNodeForce(absPath, !treeOnly, true);
    },

    // Method: release
    //
    // Remove force flags from given node.
    //
    // See <sync> for details.
    // 
    release: function(path) {
      var absPath = this.makePath(path);
      store.setNodeForce(absPath, false, false);
    },

    hasDiff: function(path) {
      var absPath = this.makePath(path);
      if(util.isDir(absPath)) {
        return Object.keys(store.getNode(absPath).diff).length > 0;
      } else {
        var parentPath = util.containingDir(absPath);
        return !! store.getNode(parentPath).diff[path.split('/').slice(-1)[0]];
      }
    },

    /**** TYPE HANDLING ****/

    types: {},
    schemas: {},

    resolveType: function(alias) {
      var type = this.types[alias];
      if(! type) {
        // FIXME: support custom namespace. don't fall back to remotestoragejs.com.
        type = 'https://remotestoragejs.com/spec/modules/' + this.moduleName + '/' + alias;
        logger.error("WARNING: type alias not declared: " + alias, '(have:', this.types, this.schemas, ')');
      }
      return type;
    },

    resolveSchema: function(type) {
      var schema = this.schemas[type];
      if(! schema) {
        schema = {};
        logger.error("WARNING: can't find schema for type: ", type);
      }
      return schema;
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
    //   client.storeObject('drink', 'foo', {});
    //   // returns errors:
    //   // [{ "property": "name",
    //   //    "message": "is missing and it is required" }]
    //
    //   
    //   (end code)
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

      this.types[alias] = type;
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
    // > { "property": "foo", "message": "is named badly" }
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
    }
    
  };

  return BaseClient;

});

define('lib/foreignClient',['./util', './baseClient', './getputdelete', './store'], function(util, BaseClient, getputdelete, store) {

  var logger = util.getLogger('foreignClient');

  var knownClients = {}

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
  }
  
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

  }

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
  }

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
  './lib/baseClient'
], function(require, widget, store, sync, wireClient, nodeConnect, util, webfinger, foreignClient, BaseClient) {

  

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

      var module = builder(
        // private client:
        new BaseClient(moduleName, false),
        // public client:
        new BaseClient(moduleName, true)
      );
      modules[moduleName] = module;
      this[moduleName] = module.exports;
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
    // Method: fullSync
    //
    // Synchronize local <-> remote storage.
    //
    // Syncing starts at the access roots (the once you claimed using claimAccess)
    // and moves down the directory tree.
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
    //   > remoteStorage.fullSync('/money/', function(errors) {
    //   >   // handle errors, if any.
    //   > });
    //
    // Yields:
    //   Array of error messages - when errors occured. When fullSync is called and the user is not connected, this is also considered an error.
    //   null - no error occured, synchronization finished gracefully.
    //
    fullSync: sync.fullSync,

    // Method: syncNow
    //
    // DEPRECATED!!! use fullSync instead.
    syncNow          : function(path, depth, callback) {
      if(! depth) {
        callback = depth;
        depth = null;
      }

      sync.partialSync(path, depth, callback);
    },


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

    //
    getSyncState     : sync.getState,
    //
    setStorageInfo   : wireClient.setStorageInfo,

    getStorageHref   : wireClient.getStorageHref,

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
    }

  };

  return remoteStorage;
});

define('modules/root',['../remoteStorage'], function(remoteStorage) {

  window.rootRemoteStorage = remoteStorage;

  remoteStorage.defineModule('public', function(client) {
    function getPublicItems() {
      return client.getObject("publishedItems");
    }

    return {
      exports: {
        getPublicItems: getPublicItems,
        getObject: client.getObject
      }
    }
  });

  remoteStorage.defineModule('root', function(myPrivateBaseClient, myPublicBaseClient) {
    function setOnChange(cb) {
      myPrivateBaseClient.on('change', cb);
      myPublicBaseClient.on('change', cb);
    }

    function addToPublicItems(path) {
      var data = myPublicBaseClient.getObject("publishedItems");
      if(path[0] == "/")
        path = path.substr(1);

      if(data) {
        if(data.indexOf(path) == -1)
        {
          data.unshift(path);
        }
      } else {
        data = [];
        data.push(path);
      }
      myPublicBaseClient.storeObject('array', "publishedItems", data);
    }

    function removeFromPublicItems(path) {
      var data = myPublicBaseClient.getObject("publishedItems");
      if(path[0] == "/")
        path = path.substr(1);
      if(data) {
        if(data.indexOf(path) != -1) {
          data.pop(path);
        }
      } else {
        data = [];
      }
      myPublicBaseClient.storeObject('array', "publishedItems", data);
    }

    function publishObject(path) {
      if(pathIsPublic(path))
        return 'Object has already been made public';

      var data = myPrivateBaseClient.getObject(path);
      var publicPath = "/public" + path;
      addToPublicItems(publicPath);
      myPrivateBaseClient.remove(path);
      myPrivateBaseClient.storeObject(data['@type'], publicPath, data);

      return "Object " + path + " has been published to " + publicPath;
    }

    function archiveObject(path) {
      if(!pathIsPublic(path))
        return 'Object has already been made private';

      var data = myPrivateBaseClient.getObject(path);
      var privatePath = path.substring(7, path.length);
      removeFromPublicItems(path);
      myPrivateBaseClient.remove(path);
      myPrivateBaseClient.storeObject(data['@type'], privatePath, data);

      return "Object " + path + " has been archived to " + privatePath;
    }

    function pathIsPublic(path) {
      if(path.substring(0, 8) == "/public/")
        return true;
      return false;
    }

    function getClient(path) {
      if(!pathIsPublic(path))
        return myPrivateBaseClient;
      return myPublicBaseClient;
    }

    function hasDiff(path) {
      var client = getClient(path);
      return client.hasDiff(path);
    }

    /** getObject(path, [callback, [context]]) - get the object at given path
     **
     ** If the callback is NOT given, getObject returns the object at the given
     ** path from local cache:
     **
     **   remoteStorage.root.getObject('/todo/today')
     **   // -> { items: ['sit in the sun', 'watch the clouds', ...], ... }
     **
     ** If the callback IS given, getObject returns undefined and will at some
     ** point in the future, when the object's data has been pulled, call
     ** call the given callback.
     **
     **   remoteStorage.root.getObject('/todo/tomorrow', function(list) {
     **     // do something
     **   });
     ** 
     ** If both callback and context are given, the callback will be bound to
     ** the given context object:
     **
     **  remoteStorage.root.getObject('/todo/next-months', function(list) {
     **      for(var i=0;i<list.items.length;i++) {
     **        this.addToBacklog(list.items[i]);
     **      }// ^^ context 
     **    },
     **    this // < context.
     **  );
     **
     **/
    function getObject(path, cb, context) {
      return myPrivateBaseClient.getObject(path, cb, context);
    }

    function getDocument(path, cb, context) {
      return myPrivateBaseClient.getDocument(path, cb, context);
    }

    function setDocument(mimeType, path, data, cb, context) {
      return myPrivateBaseClient.storeDocument(mimeType, path, data, cb, context);
    }

    /** setObject(type, path, object) - store the given object at the given path.
     **
     ** The given type should be a string and is used to build a JSON-LD @type
     ** URI to store along with the given object.
     **
     **/
    function setObject(type, path, obj) {
      if(typeof(obj) === 'object') {
        myPrivateBaseClient.storeObject(type, path, obj);
      } else {
        myPrivateBaseClient.storeDocument(type, path, obj);
      }
    }

    /** removeObject(path) - remove node at given path
     **/
    function removeObject(path) {
      myPrivateBaseClient.remove(path);
    }

    /** getListing(path, [callback, [context]]) - get a listing of the given
     **                                           path's child nodes.
     **
     ** Callback and return semantics are the same as for getObject.
     **/
    function getListing(path, cb, context) {
      if(! path) {
        throw "Path is required"
      }
      return myPrivateBaseClient.getListing(path, cb, context);
    }

    function on(eventName, callback) {
      myPrivateBaseClient.on(eventName, callback);
      myPublicBaseClient.on(eventName, callback);
    }

    return {
      exports: {
        on: on,
        use: function() {
          myPrivateBaseClient.use.apply(myPrivateBaseClient, arguments);
        },
        release: function() {
          myPrivateBaseClient.release.apply(myPrivateBaseClient, arguments);
        },
        getListing: getListing,
        getObject: getObject,
        setObject: setObject,
        getDocument: getDocument,
        setDocument: setDocument,
        removeObject: removeObject,
        archiveObject: archiveObject,
        publishObject: publishObject,
        setOnChange: setOnChange,
        hasDiff: hasDiff,
        syncOnce: myPrivateBaseClient.syncOnce.bind(myPrivateBaseClient)
      }
    }
  });

  return remoteStorage.root;

});

define('modules/calendar',['../remoteStorage'], function(remoteStorage) {

  var moduleName = 'calendar';

  remoteStorage.defineModule(moduleName, function(client) {

    client.declareType('event', {
	    "description": "A representation of an event",
	    "type": "object",
	    "properties": {
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
 * vCardJS - a vCard 4.0 implementation in JavaScript
 *
 * (c) 2012 - Niklas Cathor
 *
 * Latest source: https://github.com/nilclass/vcardjs
 **/

define('modules/deps/vcardjs-0.2',[], function() {

  /*!
    Math.uuid.js (v1.4)
    http://www.broofa.com
    mailto:robert@broofa.com

    Copyright (c) 2010 Robert Kieffer
    Dual licensed under the MIT and GPL licenses.
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
  (function() {
    // Private array of chars to use
    var CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');

    Math.uuid = function (len, radix) {
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
    };

    // A more performant, but slightly bulkier, RFC4122v4 solution.  We boost performance
    // by minimizing calls to random()
    Math.uuidFast = function() {
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
    };

    // A more compact, but less performant, RFC4122v4 solution:
    Math.uuidCompact = function() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
      });
    };
  })();

  // exported globals
  var VCard;

  (function() {

    VCard = function(attributes) {
	    this.changed = false;
      if(typeof(attributes) === 'object') {
        for(var key in attributes) {
          this[key] = attributes[key];
	        this.changed = true;
        }
      }
    };

    VCard.prototype = {

	    // Check validity of this VCard instance. Properties that can be generated,
	    // will be generated. If any error is found, false is returned and vcard.errors
	    // set to an Array of [attribute, errorType] arrays.
	    // Otherwise true is returned.
	    //
	    // In case of multivalued properties, the "attribute" part of the error is
	    // the attribute name, plus it's index (starting at 0). Example: email0, tel7, ...
	    //
	    // It is recommended to call this method even if this VCard object was imported,
	    // as some software (e.g. Gmail) doesn't generate UIDs.
	    validate: function() {
	      var errors = [];

	      function addError(attribute, type) {
		      errors.push([attribute, type]);
	      }

	      if(! this.fn) { // FN is a required attribute
		      addError("fn", "required");
	      }

	      // make sure multivalued properties are *always* in array form
	      for(var key in VCard.multivaluedKeys) {
		      if(this[key] && ! (this[key] instanceof Array)) {
            this[key] = [this[key]];
		      }
	      }

	      // make sure compound fields have their type & value set
	      // (to prevent mistakes such as vcard.addAttribute('email', 'foo@bar.baz')
	      function validateCompoundWithType(attribute, values) {
		      for(var i in values) {
		        var value = values[i];
		        if(typeof(value) !== 'object') {
			        errors.push([attribute + '-' + i, "not-an-object"]);
		        } else if(! value.type) {
			        errors.push([attribute + '-' + i, "missing-type"]);
		        } else if(! value.value) { // empty values are not allowed.
			        errors.push([attribute + '-' + i, "missing-value"]);
		        }
		      }
	      }

	      if(this.email) {
		      validateCompoundWithType('email', this.email);
	      }

	      if(this.tel) {
		      validateCompoundWithType('email', this.tel);
	      }

	      if(! this.uid) {
		      this.addAttribute('uid', this.generateUID());
	      }

	      if(! this.rev) {
		      this.addAttribute('rev', this.generateRev());
	      }

	      this.errors = errors;

	      return ! (errors.length > 0);
	    },

	    // generate a UID. This generates a UUID with uuid: URN namespace, as suggested
	    // by RFC 6350, 6.7.6
	    generateUID: function() {
	      return 'uuid:' + Math.uuid();
	    },

	    // generate revision timestamp (a full ISO 8601 date/time string in basic format)
	    generateRev: function() {
	      return (new Date()).toISOString().replace(/[\.\:\-]/g, '');
	    },

	    // Set the given attribute to the given value.
	    // This sets vcard.changed to true, so you can check later whether anything
	    // was updated by your code.
      setAttribute: function(key, value) {
        this[key] = value;
	      this.changed = true;
      },

	    // Set the given attribute to the given value.
	    // If the given attribute's key has cardinality > 1, instead of overwriting
	    // the current value, an additional value is appended.
      addAttribute: function(key, value) {
        console.log('add attribute', key, value);
        if(! value) {
          return;
        }
        if(VCard.multivaluedKeys[key]) {
          if(this[key]) {
            console.log('multivalued push');
            this[key].push(value)
          } else {
            console.log('multivalued set');
            this.setAttribute(key, [value]);
          }
        } else {
          this.setAttribute(key, value);
        }
      },

	    // convenience method to get a JSON serialized jCard.
	    toJSON: function() {
	      return JSON.stringify(this.toJCard());
	    },

	    // Copies all properties (i.e. all specified in VCard.allKeys) to a new object
	    // and returns it.
	    // Useful to serialize to JSON afterwards.
      toJCard: function() {
        var jcard = {};
        for(var k in VCard.allKeys) {
          var key = VCard.allKeys[k];
          if(this[key]) {
            jcard[key] = this[key];
          }
        }
        return jcard;
      },

      // synchronizes two vcards, using the mechanisms described in
      // RFC 6350, Section 7.
      // Returns a new VCard object.
      // If a property is present in both source vcards, and that property's
      // maximum cardinality is 1, then the value from the second (given) vcard
      // precedes.
      //
      // TODO: implement PID matching as described in 7.3.1
      merge: function(other) {
        if(typeof(other.uid) !== 'undefined' &&
           typeof(this.uid) !== 'undefined' &&
           other.uid !== this.uid) {
          // 7.1.1
          throw "Won't merge vcards without matching UIDs.";
        }

        var result = new VCard();

        function mergeProperty(key) {
          if(other[key]) {
            if(other[key] == this[key]) {
              result.setAttribute(this[key]);
            } else {
              result.addAttribute(this[key]);
              result.addAttribute(other[key]);
            }
          } else {
            result[key] = this[key];
          }
        }

        for(key in this) { // all properties of this
          mergeProperty(key);
        }
        for(key in other) { // all properties of other *not* in this
          if(! result[key]) {
            mergeProperty(key);
          }
        }
      }
    };

    VCard.enums = {
      telType: ["text", "voice", "fax", "cell", "video", "pager", "textphone"],
      relatedType: ["contact", "acquaintance", "friend", "met", "co-worker",
                    "colleague", "co-resident", "neighbor", "child", "parent",
                    "sibling", "spouse", "kin", "muse", "crush", "date",
                    "sweetheart", "me", "agent", "emergency"],
      // FIXME: these aren't actually defined anywhere. just very commmon.
      //        maybe there should be more?
      emailType: ["work", "home", "internet"],
      langType: ["work", "home"],
      
    };

    VCard.allKeys = [
      'fn', 'n', 'nickname', 'photo', 'bday', 'anniversary', 'gender',
      'tel', 'email', 'impp', 'lang', 'tz', 'geo', 'title', 'role', 'logo',
      'org', 'member', 'related', 'categories', 'note', 'prodid', 'rev',
      'sound', 'uid'
    ];

    VCard.multivaluedKeys = {
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

  })();
  /**
   ** VCF - Parser for the vcard format.
   **
   ** This is purely a vCard 4.0 implementation, as described in RFC 6350.
   **
   ** The generated VCard object roughly corresponds to the JSON representation
   ** of a hCard, as described here: http://microformats.org/wiki/jcard
   ** (Retrieved May 17, 2012)
   **
   **/

  var VCF;

  (function() {
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
              vcard.addAttribute(key.toLowerCase(), val);
            }
          }
          if(key == 'BEGIN') {
            vcard = new VCard();
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

  })();


  return {
    VCard: VCard,
    VCF: VCF
  }

});

/**
 ** Skeleton for new modules
 **/

define('modules/contacts',[
  // don't change these weird paths.
  // required due to builder issues hopefully to be resolved by
  // https://github.com/RemoteStorage/remoteStorage.js/issues/84
  '../remoteStorage',
  '../modules/deps/vcardjs-0.2'
], function(remoteStorage, vCardJS) {

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

  var VCard = vCardJS.VCard, VCF = vCardJS.VCF;

  remoteStorage.defineModule(moduleName, function(base) {

    var DEBUG = true, contacts = {};

    // Copy over all properties from source to destination.
    // Return destination.
    function extend() {
      var destination = arguments[0], source;
      for(var i=1;i<arguments.length;i++) {
        source = arguments[i];
        var keys = Object.keys(source);
        for(var j=0;j<keys.length;j++) {
          var key = keys[j];
          destination[key] = source[key];
        }
      }
      return destination;
    }


    var bindContext = (
      ( (typeof (function() {}).bind === 'function') ?
        // native version
        function(cb, context) { return cb.bind(context); } :
        // custom version
        function(cb, context) {
          return function() { return cb.apply(context, arguments); }
        } )
    );

    var debug = DEBUG ? bindContext(console.log, console) : function() {};

    // VCard subtypes:

    var Contact = function() {
      VCard.apply(this, arguments);
      this.setAttribute('kind', 'individual');
    }

    function makeVcardInstance(data) {
      var type = (data.kind == 'individual' ? Contact :
                  (data.kind == 'group' ? Group : VCard));
      return new type(data);
    }

    var Group = function(name) {
      VCard.apply(this, arguments);
      this.setAttribute('kind', 'group');
    }

    var groupMembers = {

      getMembers: function() {
        var members = [];
        for(var i=0;i<this.member.length;i++) {
          members.push(this.lookupMember(member[i]));
        }
        return members;
      },

      // resolve a URI to a contact an return it.
      lookupMember: function(uri) {
        var md = uri.match(/^([^:]):(.*)$/), scheme = md[1], rest = md[2];
        var key;
        switch(scheme) {
          // URN and UUID directly resolve to the contact's key.
          // if they don't, there is nothing we can do about it.
        case 'urn':
        case 'uuid':
          return contacts.get(uri);
        case 'mailto':
        case 'xmpp':
        case 'sip':
        case 'tel':
          var query = {};
          query[{
            mailto: 'email',
            xmpp: 'impp',
            sip: 'impp',
            tel: 'tel'
          }[scheme]] = rest;
          var results = contacts.search(query);
          if(results.length > 0) {
            return results[0];
          }
          if(scheme == 'tel') {
            break; // no fallback for TEL
          }
          // fallback for MAILTO, XMPP, SIP schems is webfinger:
        case 'acct':
          console.error("FIXME: implement contact-lookup via webfinger!");
          break;
          // HTTP could resolve to a foaf profile, a vcard, a jcard...
        case 'http':
          console.error("FIXME: implement contact-lookup via HTTP!");
          break;
        default:
          console.error("FIXME: unknown URI scheme " + scheme);
        }
        return undefined;
      }

    };

    // Namespace: exports

    extend(contacts, {

      // Property: Contact
      // A VCard constructor for contacts (kind: "individual")
      Contact: Contact,

      // Property: Group
      // A VCard constructor for groups (kind: "group")
      //
      Group: Group,

      //
      // Method: on
      //
      // Install an event handler.
      //
      // "change" events will be altered, so the newValue and oldValue attributes contain VCard instances.
      //
      // For documentation on events see <BaseClient> and <BaseClient.on>.
      on: function(eventType, callback) {
        base.on(eventType, function(event) {
          if(event.oldValue) {
            event.oldValue = contacts._wrap(event.oldValue);
          }
          if(event.newValue) {
            event.newValue = contacts._wrap(event.newValue);
          }
          callback(event);
        });
      },

      //
      // Method: use
      //
      // Set the "force sync" flag for all contacts.
      //
      // This causes the complete data to be synced, next time <syncNow> is called on either /contacts/ or /.
      //
      use: function() {
        debug("contacts.sync()");
        base.use('');
      },

      //
      // Method: list
      //
      // Get a list of contact objects.
      //
      // Parameters:
      //   limit - (optional) maximum number of objects to return
      //   offset - (optional) index to start at.
      //
      //   you can use limit / offset to implement pagination or load-on-scroll flows.
      //
      // Returns:
      //   An Array of VCard objects (or descendants)
      //
      // Example:
      //   > remoteStorage.contacts.list().forEach(function(contact) {
      //   >   console.log(contact.getAttribute('fn'));
      //   > });
      //
      list: function(limit, offset) {
        var list = base.getListing('');
        if(! offset) {
          offset = 0;
        }
        if(! limit) {
          limit = list.length - offset;
        }
        for(var i=0;i<limit;i++) {
          if(list[i + offset]) {
            list[i + offset] = this.get(list[i + offset]);
          }
        }
        return list;
      },

      //
      // Method: get
      //
      // Retrieve a single contact.
      //
      // Parameters:
      //   uid - UID of the contact
      //   callback - (optional)
      //   context - (optional)
      //
      // The callbacks follow the semantics described in <BaseClient.getObject>
      //
      get: function(uid, cb, context) {
        if(cb) {
          base.getObject(uid, function(data) {
            bindContext(cb, context)(this._wrap(data));
          }, this);
        } else {
          return this._wrap(base.getObject(uid));
        }
      },

      //
      // Method: build
      //
      // Build a new (unsaved) contact object.
      //
      // If you want to store the object later, use <put>.
      //
      // Parameters:
      //   attributes - (optional) initial attributes to add
      //
      build: function(attributes) {
        return this._wrap(attributes);
      },

      //
      // Method: put
      //
      // Update or create a contact.
      //
      // Parameters:
      //   contact - a VCard object
      //
      // Returns:
      //   the (possibly altered) VCard object
      //
      // Sets UID and REV attributes as needed.
      //
      //
      // Example:
      //   (start code)
      //   var contact = remoteStorage.contacts.build({ "kind":"individual" });
      //   contact.fn = "Donald Duck";
      //   // (at this point you could contact.validate(), to check if everything is in order)
      //   remoteStorage.contacts.put(contact);
      //   // contact now persisted.
      //   (end code)
      //
      put: function(contact) {
        var contact = this.build(contact);
        contact.validate();
        // TODO: do something with the errors!
        base.storeObject('vcard+' + (contact.kind || 'individual'), contact.uid, contact.attributes);
        return contact;
      },

      filter: function(cb, context) {
        // this is highly ineffective. go fix it!
        var list = this.list();
        var results = [];
        var item;
        for(var i=0;i<list.length;i++) {
          item = bindContext(cb, context)(list[i]);
          if(item) {
            results.push(item)
          }
        }
        return results;
      },

      search: function(filter) {
        var keys = Object.keys(filter);

        return this.filter(function(item) {
          return this.searchMatch(item, filter, keys);
        }, this);
      },

      searchMatch: function(item, filter, filterKeys) {
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
        }

        return this.filter(function(item) {
          for(var i=0;i<keys.length;i++) {
            var k = keys[i], v = filter[k];
            if(! check(item[k], v)) {
              return false;
            }
          }
          debug('success');
          return item;
        });
      },

      _wrap: function(data) {
        return(data instanceof VCard ? data : makeVcardInstance(data));
      }

    });


    return {
      name: moduleName,

      dataHints: {
      },

      exports: contacts
    }
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
        if(content == '') {
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
          for(var i in endBalances) {
            myPrivateBaseClient.storeObject('balance', datePath+'balance/'+i, endBalances[i]);
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
            delete listing['published'];
            publicClient.storeObject('bookmark-list', 'published', listing);
          }

        }
      };
    }
  );

});

define('remoteStorage-modules',[
  './remoteStorage',
  './modules/root',
  './modules/calendar',
  './modules/contacts',
  './modules/documents',
  './modules/money',
  './modules/tasks',
  './modules/bookmarks'
], function(remoteStorage) {
  return remoteStorage;
});


  remoteStorage = require('remoteStorage-modules');

})();