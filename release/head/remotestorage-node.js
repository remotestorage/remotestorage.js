/** remotestorage.js 0.10.3-pre, http://remotestorage.io, MIT-licensed **/

/** FILE: lib/bluebird.js **/
/**
 * bluebird build version 2.3.4
 * Features enabled: core, nodeify
 * Features disabled: race, call_get, generators, map, promisify, props, reduce, settle, some, progress, cancel, using, filter, any, each, timers
*/
/**
 * @preserve Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.Promise=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var schedule = _dereq_("./schedule.js");
var Queue = _dereq_("./queue.js");
var errorObj = _dereq_("./util.js").errorObj;
var tryCatch1 = _dereq_("./util.js").tryCatch1;
var _process = typeof process !== "undefined" ? process : void 0;

function Async() {
    this._isTickUsed = false;
    this._schedule = schedule;
    this._length = 0;
    this._lateBuffer = new Queue(16);
    this._functionBuffer = new Queue(65536);
    var self = this;
    this.consumeFunctionBuffer = function Async$consumeFunctionBuffer() {
        self._consumeFunctionBuffer();
    };
}

Async.prototype.haveItemsQueued = function Async$haveItemsQueued() {
    return this._length > 0;
};

Async.prototype.invokeLater = function Async$invokeLater(fn, receiver, arg) {
    if (_process !== void 0 &&
        _process.domain != null &&
        !fn.domain) {
        fn = _process.domain.bind(fn);
    }
    this._lateBuffer.push(fn, receiver, arg);
    this._queueTick();
};

Async.prototype.invoke = function Async$invoke(fn, receiver, arg) {
    if (_process !== void 0 &&
        _process.domain != null &&
        !fn.domain) {
        fn = _process.domain.bind(fn);
    }
    var functionBuffer = this._functionBuffer;
    functionBuffer.push(fn, receiver, arg);
    this._length = functionBuffer.length();
    this._queueTick();
};

Async.prototype._consumeFunctionBuffer =
function Async$_consumeFunctionBuffer() {
    var functionBuffer = this._functionBuffer;
    while (functionBuffer.length() > 0) {
        var fn = functionBuffer.shift();
        var receiver = functionBuffer.shift();
        var arg = functionBuffer.shift();
        fn.call(receiver, arg);
    }
    this._reset();
    this._consumeLateBuffer();
};

Async.prototype._consumeLateBuffer = function Async$_consumeLateBuffer() {
    var buffer = this._lateBuffer;
    while(buffer.length() > 0) {
        var fn = buffer.shift();
        var receiver = buffer.shift();
        var arg = buffer.shift();
        var res = tryCatch1(fn, receiver, arg);
        if (res === errorObj) {
            this._queueTick();
            if (fn.domain != null) {
                fn.domain.emit("error", res.e);
            } else {
                throw res.e;
            }
        }
    }
};

Async.prototype._queueTick = function Async$_queue() {
    if (!this._isTickUsed) {
        this._schedule(this.consumeFunctionBuffer);
        this._isTickUsed = true;
    }
};

Async.prototype._reset = function Async$_reset() {
    this._isTickUsed = false;
    this._length = 0;
};

module.exports = new Async();

},{"./queue.js":15,"./schedule.js":16,"./util.js":19}],2:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var Promise = _dereq_("./promise.js")();
module.exports = Promise;
},{"./promise.js":12}],3:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function() {
var inherits = _dereq_("./util.js").inherits;
var defineProperty = _dereq_("./es5.js").defineProperty;

var rignore = new RegExp(
    "\\b(?:[a-zA-Z0-9.]+\\$_\\w+|" +
    "tryCatch(?:1|2|3|4|Apply)|new \\w*PromiseArray|" +
    "\\w*PromiseArray\\.\\w*PromiseArray|" +
    "setTimeout|CatchFilter\\$_\\w+|makeNodePromisified|processImmediate|" +
    "process._tickCallback|nextTick|Async\\$\\w+)\\b"
);

var rtraceline = null;
var formatStack = null;

function formatNonError(obj) {
    var str;
    if (typeof obj === "function") {
        str = "[function " +
            (obj.name || "anonymous") +
            "]";
    } else {
        str = obj.toString();
        var ruselessToString = /\[object [a-zA-Z0-9$_]+\]/;
        if (ruselessToString.test(str)) {
            try {
                var newStr = JSON.stringify(obj);
                str = newStr;
            }
            catch(e) {

            }
        }
        if (str.length === 0) {
            str = "(empty array)";
        }
    }
    return ("(<" + snip(str) + ">, no stack trace)");
}

function snip(str) {
    var maxChars = 41;
    if (str.length < maxChars) {
        return str;
    }
    return str.substr(0, maxChars - 3) + "...";
}

function CapturedTrace(ignoreUntil, isTopLevel) {
    this.captureStackTrace(CapturedTrace, isTopLevel);

}
inherits(CapturedTrace, Error);

CapturedTrace.prototype.captureStackTrace =
function CapturedTrace$captureStackTrace(ignoreUntil, isTopLevel) {
    captureStackTrace(this, ignoreUntil, isTopLevel);
};

CapturedTrace.possiblyUnhandledRejection =
function CapturedTrace$PossiblyUnhandledRejection(reason) {
    if (typeof console === "object") {
        var message;
        if (typeof reason === "object" || typeof reason === "function") {
            var stack = reason.stack;
            message = "Possibly unhandled " + formatStack(stack, reason);
        } else {
            message = "Possibly unhandled " + String(reason);
        }
        if (typeof console.error === "function" ||
            typeof console.error === "object") {
            console.error(message);
        } else if (typeof console.log === "function" ||
            typeof console.log === "object") {
            console.log(message);
        }
    }
};

CapturedTrace.combine = function CapturedTrace$Combine(current, prev) {
    var curLast = current.length - 1;
    for (var i = prev.length - 1; i >= 0; --i) {
        var line = prev[i];
        if (current[curLast] === line) {
            current.pop();
            curLast--;
        } else {
            break;
        }
    }

    current.push("From previous event:");
    var lines = current.concat(prev);

    var ret = [];

    for (var i = 0, len = lines.length; i < len; ++i) {

        if (((rignore.test(lines[i]) && rtraceline.test(lines[i])) ||
            (i > 0 && !rtraceline.test(lines[i])) &&
            lines[i] !== "From previous event:")
       ) {
            continue;
        }
        ret.push(lines[i]);
    }
    return ret;
};

CapturedTrace.protectErrorMessageNewlines = function(stack) {
    for (var i = 0; i < stack.length; ++i) {
        if (rtraceline.test(stack[i])) {
            break;
        }
    }

    if (i <= 1) return;

    var errorMessageLines = [];
    for (var j = 0; j < i; ++j) {
        errorMessageLines.push(stack.shift());
    }
    stack.unshift(errorMessageLines.join("\u0002\u0000\u0001"));
};

CapturedTrace.isSupported = function CapturedTrace$IsSupported() {
    return typeof captureStackTrace === "function";
};

var captureStackTrace = (function stackDetection() {
    if (typeof Error.stackTraceLimit === "number" &&
        typeof Error.captureStackTrace === "function") {
        rtraceline = /^\s*at\s*/;
        formatStack = function(stack, error) {
            if (typeof stack === "string") return stack;

            if (error.name !== void 0 &&
                error.message !== void 0) {
                return error.name + ". " + error.message;
            }
            return formatNonError(error);


        };
        var captureStackTrace = Error.captureStackTrace;
        return function CapturedTrace$_captureStackTrace(
            receiver, ignoreUntil) {
            captureStackTrace(receiver, ignoreUntil);
        };
    }
    var err = new Error();

    if (typeof err.stack === "string" &&
        typeof "".startsWith === "function" &&
        (err.stack.startsWith("stackDetection@")) &&
        stackDetection.name === "stackDetection") {

        defineProperty(Error, "stackTraceLimit", {
            writable: true,
            enumerable: false,
            configurable: false,
            value: 25
        });
        rtraceline = /@/;
        var rline = /[@\n]/;

        formatStack = function(stack, error) {
            if (typeof stack === "string") {
                return (error.name + ". " + error.message + "\n" + stack);
            }

            if (error.name !== void 0 &&
                error.message !== void 0) {
                return error.name + ". " + error.message;
            }
            return formatNonError(error);
        };

        return function captureStackTrace(o) {
            var stack = new Error().stack;
            var split = stack.split(rline);
            var len = split.length;
            var ret = "";
            for (var i = 0; i < len; i += 2) {
                ret += split[i];
                ret += "@";
                ret += split[i + 1];
                ret += "\n";
            }
            o.stack = ret;
        };
    } else {
        formatStack = function(stack, error) {
            if (typeof stack === "string") return stack;

            if ((typeof error === "object" ||
                typeof error === "function") &&
                error.name !== void 0 &&
                error.message !== void 0) {
                return error.name + ". " + error.message;
            }
            return formatNonError(error);
        };

        return null;
    }
})();

return CapturedTrace;
};

},{"./es5.js":8,"./util.js":19}],4:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(NEXT_FILTER) {
var util = _dereq_("./util.js");
var errors = _dereq_("./errors.js");
var tryCatch1 = util.tryCatch1;
var errorObj = util.errorObj;
var keys = _dereq_("./es5.js").keys;
var TypeError = errors.TypeError;

function CatchFilter(instances, callback, promise) {
    this._instances = instances;
    this._callback = callback;
    this._promise = promise;
}

function CatchFilter$_safePredicate(predicate, e) {
    var safeObject = {};
    var retfilter = tryCatch1(predicate, safeObject, e);

    if (retfilter === errorObj) return retfilter;

    var safeKeys = keys(safeObject);
    if (safeKeys.length) {
        errorObj.e = new TypeError(
            "Catch filter must inherit from Error "
          + "or be a simple predicate function");
        return errorObj;
    }
    return retfilter;
}

CatchFilter.prototype.doFilter = function CatchFilter$_doFilter(e) {
    var cb = this._callback;
    var promise = this._promise;
    var boundTo = promise._boundTo;
    for (var i = 0, len = this._instances.length; i < len; ++i) {
        var item = this._instances[i];
        var itemIsErrorType = item === Error ||
            (item != null && item.prototype instanceof Error);

        if (itemIsErrorType && e instanceof item) {
            var ret = tryCatch1(cb, boundTo, e);
            if (ret === errorObj) {
                NEXT_FILTER.e = ret.e;
                return NEXT_FILTER;
            }
            return ret;
        } else if (typeof item === "function" && !itemIsErrorType) {
            var shouldHandle = CatchFilter$_safePredicate(item, e);
            if (shouldHandle === errorObj) {
                var trace = errors.canAttach(errorObj.e)
                    ? errorObj.e
                    : new Error(errorObj.e + "");
                this._promise._attachExtraTrace(trace);
                e = errorObj.e;
                break;
            } else if (shouldHandle) {
                var ret = tryCatch1(cb, boundTo, e);
                if (ret === errorObj) {
                    NEXT_FILTER.e = ret.e;
                    return NEXT_FILTER;
                }
                return ret;
            }
        }
    }
    NEXT_FILTER.e = e;
    return NEXT_FILTER;
};

return CatchFilter;
};

},{"./errors.js":6,"./es5.js":8,"./util.js":19}],5:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var util = _dereq_("./util.js");
var isPrimitive = util.isPrimitive;
var wrapsPrimitiveReceiver = util.wrapsPrimitiveReceiver;

module.exports = function(Promise) {
var returner = function Promise$_returner() {
    return this;
};
var thrower = function Promise$_thrower() {
    throw this;
};

var wrapper = function Promise$_wrapper(value, action) {
    if (action === 1) {
        return function Promise$_thrower() {
            throw value;
        };
    } else if (action === 2) {
        return function Promise$_returner() {
            return value;
        };
    }
};


Promise.prototype["return"] =
Promise.prototype.thenReturn =
function Promise$thenReturn(value) {
    if (wrapsPrimitiveReceiver && isPrimitive(value)) {
        return this._then(
            wrapper(value, 2),
            void 0,
            void 0,
            void 0,
            void 0
       );
    }
    return this._then(returner, void 0, void 0, value, void 0);
};

Promise.prototype["throw"] =
Promise.prototype.thenThrow =
function Promise$thenThrow(reason) {
    if (wrapsPrimitiveReceiver && isPrimitive(reason)) {
        return this._then(
            wrapper(reason, 1),
            void 0,
            void 0,
            void 0,
            void 0
       );
    }
    return this._then(thrower, void 0, void 0, reason, void 0);
};
};

},{"./util.js":19}],6:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var Objectfreeze = _dereq_("./es5.js").freeze;
var util = _dereq_("./util.js");
var inherits = util.inherits;
var notEnumerableProp = util.notEnumerableProp;

function markAsOriginatingFromRejection(e) {
    try {
        notEnumerableProp(e, "isOperational", true);
    }
    catch(ignore) {}
}

function originatesFromRejection(e) {
    if (e == null) return false;
    return ((e instanceof OperationalError) ||
        e["isOperational"] === true);
}

function isError(obj) {
    return obj instanceof Error;
}

function canAttach(obj) {
    return isError(obj);
}

function subError(nameProperty, defaultMessage) {
    function SubError(message) {
        if (!(this instanceof SubError)) return new SubError(message);
        this.message = typeof message === "string" ? message : defaultMessage;
        this.name = nameProperty;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
    inherits(SubError, Error);
    return SubError;
}

var _TypeError, _RangeError;
var CancellationError = subError("CancellationError", "cancellation error");
var TimeoutError = subError("TimeoutError", "timeout error");
var AggregateError = subError("AggregateError", "aggregate error");
try {
    _TypeError = TypeError;
    _RangeError = RangeError;
} catch(e) {
    _TypeError = subError("TypeError", "type error");
    _RangeError = subError("RangeError", "range error");
}

var methods = ("join pop push shift unshift slice filter forEach some " +
    "every map indexOf lastIndexOf reduce reduceRight sort reverse").split(" ");

for (var i = 0; i < methods.length; ++i) {
    if (typeof Array.prototype[methods[i]] === "function") {
        AggregateError.prototype[methods[i]] = Array.prototype[methods[i]];
    }
}

AggregateError.prototype.length = 0;
AggregateError.prototype["isOperational"] = true;
var level = 0;
AggregateError.prototype.toString = function() {
    var indent = Array(level * 4 + 1).join(" ");
    var ret = "\n" + indent + "AggregateError of:" + "\n";
    level++;
    indent = Array(level * 4 + 1).join(" ");
    for (var i = 0; i < this.length; ++i) {
        var str = this[i] === this ? "[Circular AggregateError]" : this[i] + "";
        var lines = str.split("\n");
        for (var j = 0; j < lines.length; ++j) {
            lines[j] = indent + lines[j];
        }
        str = lines.join("\n");
        ret += str + "\n";
    }
    level--;
    return ret;
};

function OperationalError(message) {
    this.name = "OperationalError";
    this.message = message;
    this.cause = message;
    this["isOperational"] = true;

    if (message instanceof Error) {
        this.message = message.message;
        this.stack = message.stack;
    } else if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
    }

}
inherits(OperationalError, Error);

var key = "__BluebirdErrorTypes__";
var errorTypes = Error[key];
if (!errorTypes) {
    errorTypes = Objectfreeze({
        CancellationError: CancellationError,
        TimeoutError: TimeoutError,
        OperationalError: OperationalError,
        RejectionError: OperationalError,
        AggregateError: AggregateError
    });
    notEnumerableProp(Error, key, errorTypes);
}

module.exports = {
    Error: Error,
    TypeError: _TypeError,
    RangeError: _RangeError,
    CancellationError: errorTypes.CancellationError,
    OperationalError: errorTypes.OperationalError,
    TimeoutError: errorTypes.TimeoutError,
    AggregateError: errorTypes.AggregateError,
    originatesFromRejection: originatesFromRejection,
    markAsOriginatingFromRejection: markAsOriginatingFromRejection,
    canAttach: canAttach
};

},{"./es5.js":8,"./util.js":19}],7:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise) {
var TypeError = _dereq_('./errors.js').TypeError;

function apiRejection(msg) {
    var error = new TypeError(msg);
    var ret = Promise.rejected(error);
    var parent = ret._peekContext();
    if (parent != null) {
        parent._attachExtraTrace(error);
    }
    return ret;
}

return apiRejection;
};

},{"./errors.js":6}],8:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
var isES5 = (function(){
    "use strict";
    return this === void 0;
})();

if (isES5) {
    module.exports = {
        freeze: Object.freeze,
        defineProperty: Object.defineProperty,
        keys: Object.keys,
        getPrototypeOf: Object.getPrototypeOf,
        isArray: Array.isArray,
        isES5: isES5
    };
} else {
    var has = {}.hasOwnProperty;
    var str = {}.toString;
    var proto = {}.constructor.prototype;

    var ObjectKeys = function ObjectKeys(o) {
        var ret = [];
        for (var key in o) {
            if (has.call(o, key)) {
                ret.push(key);
            }
        }
        return ret;
    }

    var ObjectDefineProperty = function ObjectDefineProperty(o, key, desc) {
        o[key] = desc.value;
        return o;
    }

    var ObjectFreeze = function ObjectFreeze(obj) {
        return obj;
    }

    var ObjectGetPrototypeOf = function ObjectGetPrototypeOf(obj) {
        try {
            return Object(obj).constructor.prototype;
        }
        catch (e) {
            return proto;
        }
    }

    var ArrayIsArray = function ArrayIsArray(obj) {
        try {
            return str.call(obj) === "[object Array]";
        }
        catch(e) {
            return false;
        }
    }

    module.exports = {
        isArray: ArrayIsArray,
        keys: ObjectKeys,
        defineProperty: ObjectDefineProperty,
        freeze: ObjectFreeze,
        getPrototypeOf: ObjectGetPrototypeOf,
        isES5: isES5
    };
}

},{}],9:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, NEXT_FILTER, cast) {
var util = _dereq_("./util.js");
var wrapsPrimitiveReceiver = util.wrapsPrimitiveReceiver;
var isPrimitive = util.isPrimitive;
var thrower = util.thrower;

function returnThis() {
    return this;
}
function throwThis() {
    throw this;
}
function return$(r) {
    return function Promise$_returner() {
        return r;
    };
}
function throw$(r) {
    return function Promise$_thrower() {
        throw r;
    };
}
function promisedFinally(ret, reasonOrValue, isFulfilled) {
    var then;
    if (wrapsPrimitiveReceiver && isPrimitive(reasonOrValue)) {
        then = isFulfilled ? return$(reasonOrValue) : throw$(reasonOrValue);
    } else {
        then = isFulfilled ? returnThis : throwThis;
    }
    return ret._then(then, thrower, void 0, reasonOrValue, void 0);
}

function finallyHandler(reasonOrValue) {
    var promise = this.promise;
    var handler = this.handler;

    var ret = promise._isBound()
                    ? handler.call(promise._boundTo)
                    : handler();

    if (ret !== void 0) {
        var maybePromise = cast(ret, void 0);
        if (maybePromise instanceof Promise) {
            return promisedFinally(maybePromise, reasonOrValue,
                                    promise.isFulfilled());
        }
    }

    if (promise.isRejected()) {
        NEXT_FILTER.e = reasonOrValue;
        return NEXT_FILTER;
    } else {
        return reasonOrValue;
    }
}

function tapHandler(value) {
    var promise = this.promise;
    var handler = this.handler;

    var ret = promise._isBound()
                    ? handler.call(promise._boundTo, value)
                    : handler(value);

    if (ret !== void 0) {
        var maybePromise = cast(ret, void 0);
        if (maybePromise instanceof Promise) {
            return promisedFinally(maybePromise, value, true);
        }
    }
    return value;
}

Promise.prototype._passThroughHandler =
function Promise$_passThroughHandler(handler, isFinally) {
    if (typeof handler !== "function") return this.then();

    var promiseAndHandler = {
        promise: this,
        handler: handler
    };

    return this._then(
            isFinally ? finallyHandler : tapHandler,
            isFinally ? finallyHandler : void 0, void 0,
            promiseAndHandler, void 0);
};

Promise.prototype.lastly =
Promise.prototype["finally"] = function Promise$finally(handler) {
    return this._passThroughHandler(handler, true);
};

Promise.prototype.tap = function Promise$tap(handler) {
    return this._passThroughHandler(handler, false);
};
};

},{"./util.js":19}],10:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports =
function(Promise, PromiseArray, cast, INTERNAL) {
var util = _dereq_("./util.js");
var canEvaluate = util.canEvaluate;
var tryCatch1 = util.tryCatch1;
var errorObj = util.errorObj;


if (canEvaluate) {
    var thenCallback = function(i) {
        return new Function("value", "holder", "                             \n\
            'use strict';                                                    \n\
            holder.pIndex = value;                                           \n\
            holder.checkFulfillment(this);                                   \n\
            ".replace(/Index/g, i));
    };

    var caller = function(count) {
        var values = [];
        for (var i = 1; i <= count; ++i) values.push("holder.p" + i);
        return new Function("holder", "                                      \n\
            'use strict';                                                    \n\
            var callback = holder.fn;                                        \n\
            return callback(values);                                         \n\
            ".replace(/values/g, values.join(", ")));
    };
    var thenCallbacks = [];
    var callers = [void 0];
    for (var i = 1; i <= 5; ++i) {
        thenCallbacks.push(thenCallback(i));
        callers.push(caller(i));
    }

    var Holder = function(total, fn) {
        this.p1 = this.p2 = this.p3 = this.p4 = this.p5 = null;
        this.fn = fn;
        this.total = total;
        this.now = 0;
    };

    Holder.prototype.callers = callers;
    Holder.prototype.checkFulfillment = function(promise) {
        var now = this.now;
        now++;
        var total = this.total;
        if (now >= total) {
            var handler = this.callers[total];
            var ret = tryCatch1(handler, void 0, this);
            if (ret === errorObj) {
                promise._rejectUnchecked(ret.e);
            } else if (!promise._tryFollow(ret)) {
                promise._fulfillUnchecked(ret);
            }
        } else {
            this.now = now;
        }
    };
}




Promise.join = function Promise$Join() {
    var last = arguments.length - 1;
    var fn;
    if (last > 0 && typeof arguments[last] === "function") {
        fn = arguments[last];
        if (last < 6 && canEvaluate) {
            var ret = new Promise(INTERNAL);
            ret._setTrace(void 0);
            var holder = new Holder(last, fn);
            var reject = ret._reject;
            var callbacks = thenCallbacks;
            for (var i = 0; i < last; ++i) {
                var maybePromise = cast(arguments[i], void 0);
                if (maybePromise instanceof Promise) {
                    if (maybePromise.isPending()) {
                        maybePromise._then(callbacks[i], reject,
                                           void 0, ret, holder);
                    } else if (maybePromise.isFulfilled()) {
                        callbacks[i].call(ret,
                                          maybePromise._settledValue, holder);
                    } else {
                        ret._reject(maybePromise._settledValue);
                        maybePromise._unsetRejectionIsUnhandled();
                    }
                } else {
                    callbacks[i].call(ret, maybePromise, holder);
                }
            }
            return ret;
        }
    }
    var $_len = arguments.length;var args = new Array($_len); for(var $_i = 0; $_i < $_len; ++$_i) {args[$_i] = arguments[$_i];}
    var ret = new PromiseArray(args).promise();
    return fn !== void 0 ? ret.spread(fn) : ret;
};

};

},{"./util.js":19}],11:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise) {
var util = _dereq_("./util.js");
var async = _dereq_("./async.js");
var tryCatch2 = util.tryCatch2;
var tryCatch1 = util.tryCatch1;
var errorObj = util.errorObj;

function thrower(r) {
    throw r;
}

function Promise$_spreadAdapter(val, receiver) {
    if (!util.isArray(val)) return Promise$_successAdapter(val, receiver);
    var ret = util.tryCatchApply(this, [null].concat(val), receiver);
    if (ret === errorObj) {
        async.invokeLater(thrower, void 0, ret.e);
    }
}

function Promise$_successAdapter(val, receiver) {
    var nodeback = this;
    var ret = val === void 0
        ? tryCatch1(nodeback, receiver, null)
        : tryCatch2(nodeback, receiver, null, val);
    if (ret === errorObj) {
        async.invokeLater(thrower, void 0, ret.e);
    }
}
function Promise$_errorAdapter(reason, receiver) {
    var nodeback = this;
    var ret = tryCatch1(nodeback, receiver, reason);
    if (ret === errorObj) {
        async.invokeLater(thrower, void 0, ret.e);
    }
}

Promise.prototype.nodeify = function Promise$nodeify(nodeback, options) {
    if (typeof nodeback == "function") {
        var adapter = Promise$_successAdapter;
        if (options !== void 0 && Object(options).spread) {
            adapter = Promise$_spreadAdapter;
        }
        this._then(
            adapter,
            Promise$_errorAdapter,
            void 0,
            nodeback,
            this._boundTo
        );
    }
    return this;
};
};

},{"./async.js":1,"./util.js":19}],12:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var old;
if (typeof Promise !== "undefined") old = Promise;
function noConflict(bluebird) {
    try { if (Promise === bluebird) Promise = old; }
    catch (e) {}
    return bluebird;
}
module.exports = function() {
var util = _dereq_("./util.js");
var async = _dereq_("./async.js");
var errors = _dereq_("./errors.js");

var INTERNAL = function(){};
var APPLY = {};
var NEXT_FILTER = {e: null};

var cast = _dereq_("./thenables.js")(Promise, INTERNAL);
var PromiseArray = _dereq_("./promise_array.js")(Promise, INTERNAL, cast);
var CapturedTrace = _dereq_("./captured_trace.js")();
var CatchFilter = _dereq_("./catch_filter.js")(NEXT_FILTER);
var PromiseResolver = _dereq_("./promise_resolver.js");

var isArray = util.isArray;

var errorObj = util.errorObj;
var tryCatch1 = util.tryCatch1;
var tryCatch2 = util.tryCatch2;
var tryCatchApply = util.tryCatchApply;
var RangeError = errors.RangeError;
var TypeError = errors.TypeError;
var CancellationError = errors.CancellationError;
var TimeoutError = errors.TimeoutError;
var OperationalError = errors.OperationalError;
var originatesFromRejection = errors.originatesFromRejection;
var markAsOriginatingFromRejection = errors.markAsOriginatingFromRejection;
var canAttach = errors.canAttach;
var thrower = util.thrower;
var apiRejection = _dereq_("./errors_api_rejection")(Promise);


var makeSelfResolutionError = function Promise$_makeSelfResolutionError() {
    return new TypeError("circular promise resolution chain");
};

function Promise(resolver) {
    if (typeof resolver !== "function") {
        throw new TypeError("the promise constructor requires a resolver function");
    }
    if (this.constructor !== Promise) {
        throw new TypeError("the promise constructor cannot be invoked directly");
    }
    this._bitField = 0;
    this._fulfillmentHandler0 = void 0;
    this._rejectionHandler0 = void 0;
    this._promise0 = void 0;
    this._receiver0 = void 0;
    this._settledValue = void 0;
    this._boundTo = void 0;
    if (resolver !== INTERNAL) this._resolveFromResolver(resolver);
}

function returnFirstElement(elements) {
    return elements[0];
}

Promise.prototype.bind = function Promise$bind(thisArg) {
    var maybePromise = cast(thisArg, void 0);
    var ret = new Promise(INTERNAL);
    if (maybePromise instanceof Promise) {
        var binder = maybePromise.then(function(thisArg) {
            ret._setBoundTo(thisArg);
        });
        var p = Promise.all([this, binder]).then(returnFirstElement);
        ret._follow(p);
    } else {
        ret._follow(this);
        ret._setBoundTo(thisArg);
    }
    ret._propagateFrom(this, 2 | 1);
    return ret;
};

Promise.prototype.toString = function Promise$toString() {
    return "[object Promise]";
};

Promise.prototype.caught = Promise.prototype["catch"] =
function Promise$catch(fn) {
    var len = arguments.length;
    if (len > 1) {
        var catchInstances = new Array(len - 1),
            j = 0, i;
        for (i = 0; i < len - 1; ++i) {
            var item = arguments[i];
            if (typeof item === "function") {
                catchInstances[j++] = item;
            } else {
                var catchFilterTypeError =
                    new TypeError(
                        "A catch filter must be an error constructor "
                        + "or a filter function");

                this._attachExtraTrace(catchFilterTypeError);
                return Promise.reject(catchFilterTypeError);
            }
        }
        catchInstances.length = j;
        fn = arguments[i];

        this._resetTrace();
        var catchFilter = new CatchFilter(catchInstances, fn, this);
        return this._then(void 0, catchFilter.doFilter, void 0,
            catchFilter, void 0);
    }
    return this._then(void 0, fn, void 0, void 0, void 0);
};

Promise.prototype.then =
function Promise$then(didFulfill, didReject, didProgress) {
    return this._then(didFulfill, didReject, didProgress,
        void 0, void 0);
};


Promise.prototype.done =
function Promise$done(didFulfill, didReject, didProgress) {
    var promise = this._then(didFulfill, didReject, didProgress,
        void 0, void 0);
    promise._setIsFinal();
};

Promise.prototype.spread = function Promise$spread(didFulfill, didReject) {
    return this._then(didFulfill, didReject, void 0,
        APPLY, void 0);
};

Promise.prototype.isCancellable = function Promise$isCancellable() {
    return !this.isResolved() &&
        this._cancellable();
};

Promise.prototype.toJSON = function Promise$toJSON() {
    var ret = {
        isFulfilled: false,
        isRejected: false,
        fulfillmentValue: void 0,
        rejectionReason: void 0
    };
    if (this.isFulfilled()) {
        ret.fulfillmentValue = this._settledValue;
        ret.isFulfilled = true;
    } else if (this.isRejected()) {
        ret.rejectionReason = this._settledValue;
        ret.isRejected = true;
    }
    return ret;
};

Promise.prototype.all = function Promise$all() {
    return new PromiseArray(this).promise();
};


Promise.is = function Promise$Is(val) {
    return val instanceof Promise;
};

Promise.all = function Promise$All(promises) {
    return new PromiseArray(promises).promise();
};

Promise.prototype.error = function Promise$_error(fn) {
    return this.caught(originatesFromRejection, fn);
};

Promise.prototype._resolveFromSyncValue =
function Promise$_resolveFromSyncValue(value) {
    if (value === errorObj) {
        this._cleanValues();
        this._setRejected();
        this._settledValue = value.e;
        this._ensurePossibleRejectionHandled();
    } else {
        var maybePromise = cast(value, void 0);
        if (maybePromise instanceof Promise) {
            this._follow(maybePromise);
        } else {
            this._cleanValues();
            this._setFulfilled();
            this._settledValue = value;
        }
    }
};

Promise.method = function Promise$_Method(fn) {
    if (typeof fn !== "function") {
        throw new TypeError("fn must be a function");
    }
    return function Promise$_method() {
        var value;
        switch(arguments.length) {
        case 0: value = tryCatch1(fn, this, void 0); break;
        case 1: value = tryCatch1(fn, this, arguments[0]); break;
        case 2: value = tryCatch2(fn, this, arguments[0], arguments[1]); break;
        default:
            var $_len = arguments.length;var args = new Array($_len); for(var $_i = 0; $_i < $_len; ++$_i) {args[$_i] = arguments[$_i];}
            value = tryCatchApply(fn, args, this); break;
        }
        var ret = new Promise(INTERNAL);
        ret._setTrace(void 0);
        ret._resolveFromSyncValue(value);
        return ret;
    };
};

Promise.attempt = Promise["try"] = function Promise$_Try(fn, args, ctx) {
    if (typeof fn !== "function") {
        return apiRejection("fn must be a function");
    }
    var value = isArray(args)
        ? tryCatchApply(fn, args, ctx)
        : tryCatch1(fn, ctx, args);

    var ret = new Promise(INTERNAL);
    ret._setTrace(void 0);
    ret._resolveFromSyncValue(value);
    return ret;
};

Promise.defer = Promise.pending = function Promise$Defer() {
    var promise = new Promise(INTERNAL);
    promise._setTrace(void 0);
    return new PromiseResolver(promise);
};

Promise.bind = function Promise$Bind(thisArg) {
    var maybePromise = cast(thisArg, void 0);
    var ret = new Promise(INTERNAL);
    ret._setTrace(void 0);

    if (maybePromise instanceof Promise) {
        var p = maybePromise.then(function(thisArg) {
            ret._setBoundTo(thisArg);
        });
        ret._follow(p);
    } else {
        ret._setBoundTo(thisArg);
        ret._setFulfilled();
    }
    return ret;
};

Promise.cast = function Promise$_Cast(obj) {
    var ret = cast(obj, void 0);
    if (!(ret instanceof Promise)) {
        var val = ret;
        ret = new Promise(INTERNAL);
        ret._setTrace(void 0);
        ret._setFulfilled();
        ret._cleanValues();
        ret._settledValue = val;
    }
    return ret;
};

Promise.resolve = Promise.fulfilled = Promise.cast;

Promise.reject = Promise.rejected = function Promise$Reject(reason) {
    var ret = new Promise(INTERNAL);
    ret._setTrace(void 0);
    markAsOriginatingFromRejection(reason);
    ret._cleanValues();
    ret._setRejected();
    ret._settledValue = reason;
    if (!canAttach(reason)) {
        var trace = new Error(reason + "");
        ret._setCarriedStackTrace(trace);
    }
    ret._ensurePossibleRejectionHandled();
    return ret;
};

Promise.onPossiblyUnhandledRejection =
function Promise$OnPossiblyUnhandledRejection(fn) {
        CapturedTrace.possiblyUnhandledRejection = typeof fn === "function"
                                                    ? fn : void 0;
};

var unhandledRejectionHandled;
Promise.onUnhandledRejectionHandled =
function Promise$onUnhandledRejectionHandled(fn) {
    unhandledRejectionHandled = typeof fn === "function" ? fn : void 0;
};

var debugging = false || !!(
    typeof process !== "undefined" &&
    typeof process.execPath === "string" &&
    typeof process.env === "object" &&
    (process.env["BLUEBIRD_DEBUG"] ||
        process.env["NODE_ENV"] === "development")
);


Promise.longStackTraces = function Promise$LongStackTraces() {
    if (async.haveItemsQueued() &&
        debugging === false
   ) {
        throw new Error("cannot enable long stack traces after promises have been created");
    }
    debugging = CapturedTrace.isSupported();
};

Promise.hasLongStackTraces = function Promise$HasLongStackTraces() {
    return debugging && CapturedTrace.isSupported();
};

Promise.prototype._then =
function Promise$_then(
    didFulfill,
    didReject,
    didProgress,
    receiver,
    internalData
) {
    var haveInternalData = internalData !== void 0;
    var ret = haveInternalData ? internalData : new Promise(INTERNAL);

    if (!haveInternalData) {
        if (debugging) {
            var haveSameContext = this._peekContext() === this._traceParent;
            ret._traceParent = haveSameContext ? this._traceParent : this;
        }
        ret._propagateFrom(this, 7);
    }

    var callbackIndex =
        this._addCallbacks(didFulfill, didReject, didProgress, ret, receiver);

    if (this.isResolved()) {
        async.invoke(this._queueSettleAt, this, callbackIndex);
    }

    return ret;
};

Promise.prototype._length = function Promise$_length() {
    return this._bitField & 262143;
};

Promise.prototype._isFollowingOrFulfilledOrRejected =
function Promise$_isFollowingOrFulfilledOrRejected() {
    return (this._bitField & 939524096) > 0;
};

Promise.prototype._isFollowing = function Promise$_isFollowing() {
    return (this._bitField & 536870912) === 536870912;
};

Promise.prototype._setLength = function Promise$_setLength(len) {
    this._bitField = (this._bitField & -262144) |
        (len & 262143);
};

Promise.prototype._setFulfilled = function Promise$_setFulfilled() {
    this._bitField = this._bitField | 268435456;
};

Promise.prototype._setRejected = function Promise$_setRejected() {
    this._bitField = this._bitField | 134217728;
};

Promise.prototype._setFollowing = function Promise$_setFollowing() {
    this._bitField = this._bitField | 536870912;
};

Promise.prototype._setIsFinal = function Promise$_setIsFinal() {
    this._bitField = this._bitField | 33554432;
};

Promise.prototype._isFinal = function Promise$_isFinal() {
    return (this._bitField & 33554432) > 0;
};

Promise.prototype._cancellable = function Promise$_cancellable() {
    return (this._bitField & 67108864) > 0;
};

Promise.prototype._setCancellable = function Promise$_setCancellable() {
    this._bitField = this._bitField | 67108864;
};

Promise.prototype._unsetCancellable = function Promise$_unsetCancellable() {
    this._bitField = this._bitField & (~67108864);
};

Promise.prototype._setRejectionIsUnhandled =
function Promise$_setRejectionIsUnhandled() {
    this._bitField = this._bitField | 2097152;
};

Promise.prototype._unsetRejectionIsUnhandled =
function Promise$_unsetRejectionIsUnhandled() {
    this._bitField = this._bitField & (~2097152);
    if (this._isUnhandledRejectionNotified()) {
        this._unsetUnhandledRejectionIsNotified();
        this._notifyUnhandledRejectionIsHandled();
    }
};

Promise.prototype._isRejectionUnhandled =
function Promise$_isRejectionUnhandled() {
    return (this._bitField & 2097152) > 0;
};

Promise.prototype._setUnhandledRejectionIsNotified =
function Promise$_setUnhandledRejectionIsNotified() {
    this._bitField = this._bitField | 524288;
};

Promise.prototype._unsetUnhandledRejectionIsNotified =
function Promise$_unsetUnhandledRejectionIsNotified() {
    this._bitField = this._bitField & (~524288);
};

Promise.prototype._isUnhandledRejectionNotified =
function Promise$_isUnhandledRejectionNotified() {
    return (this._bitField & 524288) > 0;
};

Promise.prototype._setCarriedStackTrace =
function Promise$_setCarriedStackTrace(capturedTrace) {
    this._bitField = this._bitField | 1048576;
    this._fulfillmentHandler0 = capturedTrace;
};

Promise.prototype._unsetCarriedStackTrace =
function Promise$_unsetCarriedStackTrace() {
    this._bitField = this._bitField & (~1048576);
    this._fulfillmentHandler0 = void 0;
};

Promise.prototype._isCarryingStackTrace =
function Promise$_isCarryingStackTrace() {
    return (this._bitField & 1048576) > 0;
};

Promise.prototype._getCarriedStackTrace =
function Promise$_getCarriedStackTrace() {
    return this._isCarryingStackTrace()
        ? this._fulfillmentHandler0
        : void 0;
};

Promise.prototype._receiverAt = function Promise$_receiverAt(index) {
    var ret = index === 0
        ? this._receiver0
        : this[(index << 2) + index - 5 + 4];
    if (this._isBound() && ret === void 0) {
        return this._boundTo;
    }
    return ret;
};

Promise.prototype._promiseAt = function Promise$_promiseAt(index) {
    return index === 0
        ? this._promise0
        : this[(index << 2) + index - 5 + 3];
};

Promise.prototype._fulfillmentHandlerAt =
function Promise$_fulfillmentHandlerAt(index) {
    return index === 0
        ? this._fulfillmentHandler0
        : this[(index << 2) + index - 5 + 0];
};

Promise.prototype._rejectionHandlerAt =
function Promise$_rejectionHandlerAt(index) {
    return index === 0
        ? this._rejectionHandler0
        : this[(index << 2) + index - 5 + 1];
};

Promise.prototype._addCallbacks = function Promise$_addCallbacks(
    fulfill,
    reject,
    progress,
    promise,
    receiver
) {
    var index = this._length();

    if (index >= 262143 - 5) {
        index = 0;
        this._setLength(0);
    }

    if (index === 0) {
        this._promise0 = promise;
        if (receiver !== void 0) this._receiver0 = receiver;
        if (typeof fulfill === "function" && !this._isCarryingStackTrace())
            this._fulfillmentHandler0 = fulfill;
        if (typeof reject === "function") this._rejectionHandler0 = reject;
        if (typeof progress === "function") this._progressHandler0 = progress;
    } else {
        var base = (index << 2) + index - 5;
        this[base + 3] = promise;
        this[base + 4] = receiver;
        this[base + 0] = typeof fulfill === "function"
                                            ? fulfill : void 0;
        this[base + 1] = typeof reject === "function"
                                            ? reject : void 0;
        this[base + 2] = typeof progress === "function"
                                            ? progress : void 0;
    }
    this._setLength(index + 1);
    return index;
};

Promise.prototype._setProxyHandlers =
function Promise$_setProxyHandlers(receiver, promiseSlotValue) {
    var index = this._length();

    if (index >= 262143 - 5) {
        index = 0;
        this._setLength(0);
    }
    if (index === 0) {
        this._promise0 = promiseSlotValue;
        this._receiver0 = receiver;
    } else {
        var base = (index << 2) + index - 5;
        this[base + 3] = promiseSlotValue;
        this[base + 4] = receiver;
        this[base + 0] =
        this[base + 1] =
        this[base + 2] = void 0;
    }
    this._setLength(index + 1);
};

Promise.prototype._proxyPromiseArray =
function Promise$_proxyPromiseArray(promiseArray, index) {
    this._setProxyHandlers(promiseArray, index);
};

Promise.prototype._proxyPromise = function Promise$_proxyPromise(promise) {
    promise._setProxied();
    this._setProxyHandlers(promise, -15);
};

Promise.prototype._setBoundTo = function Promise$_setBoundTo(obj) {
    if (obj !== void 0) {
        this._bitField = this._bitField | 8388608;
        this._boundTo = obj;
    } else {
        this._bitField = this._bitField & (~8388608);
    }
};

Promise.prototype._isBound = function Promise$_isBound() {
    return (this._bitField & 8388608) === 8388608;
};

Promise.prototype._resolveFromResolver =
function Promise$_resolveFromResolver(resolver) {
    var promise = this;
    this._setTrace(void 0);
    this._pushContext();

    function Promise$_resolver(val) {
        if (promise._tryFollow(val)) {
            return;
        }
        promise._fulfill(val);
    }
    function Promise$_rejecter(val) {
        var trace = canAttach(val) ? val : new Error(val + "");
        promise._attachExtraTrace(trace);
        markAsOriginatingFromRejection(val);
        promise._reject(val, trace === val ? void 0 : trace);
    }
    var r = tryCatch2(resolver, void 0, Promise$_resolver, Promise$_rejecter);
    this._popContext();

    if (r !== void 0 && r === errorObj) {
        var e = r.e;
        var trace = canAttach(e) ? e : new Error(e + "");
        promise._reject(e, trace);
    }
};

Promise.prototype._spreadSlowCase =
function Promise$_spreadSlowCase(targetFn, promise, values, boundTo) {
    var promiseForAll = new PromiseArray(values).promise();
    var promise2 = promiseForAll._then(function() {
        return targetFn.apply(boundTo, arguments);
    }, void 0, void 0, APPLY, void 0);
    promise._follow(promise2);
};

Promise.prototype._callSpread =
function Promise$_callSpread(handler, promise, value) {
    var boundTo = this._boundTo;
    if (isArray(value)) {
        for (var i = 0, len = value.length; i < len; ++i) {
            if (cast(value[i], void 0) instanceof Promise) {
                this._spreadSlowCase(handler, promise, value, boundTo);
                return;
            }
        }
    }
    promise._pushContext();
    return tryCatchApply(handler, value, boundTo);
};

Promise.prototype._callHandler =
function Promise$_callHandler(
    handler, receiver, promise, value) {
    var x;
    if (receiver === APPLY && !this.isRejected()) {
        x = this._callSpread(handler, promise, value);
    } else {
        promise._pushContext();
        x = tryCatch1(handler, receiver, value);
    }
    promise._popContext();
    return x;
};

Promise.prototype._settlePromiseFromHandler =
function Promise$_settlePromiseFromHandler(
    handler, receiver, value, promise
) {
    if (!(promise instanceof Promise)) {
        handler.call(receiver, value, promise);
        return;
    }
    var x = this._callHandler(handler, receiver, promise, value);
    if (promise._isFollowing()) return;

    if (x === errorObj || x === promise || x === NEXT_FILTER) {
        var err = x === promise
                    ? makeSelfResolutionError()
                    : x.e;
        var trace = canAttach(err) ? err : new Error(err + "");
        if (x !== NEXT_FILTER) promise._attachExtraTrace(trace);
        promise._rejectUnchecked(err, trace);
    } else {
        var castValue = cast(x, promise);
        if (castValue instanceof Promise) {
            if (castValue.isRejected() &&
                !castValue._isCarryingStackTrace() &&
                !canAttach(castValue._settledValue)) {
                var trace = new Error(castValue._settledValue + "");
                promise._attachExtraTrace(trace);
                castValue._setCarriedStackTrace(trace);
            }
            promise._follow(castValue);
            promise._propagateFrom(castValue, 1);
        } else {
            promise._fulfillUnchecked(x);
        }
    }
};

Promise.prototype._follow =
function Promise$_follow(promise) {
    this._setFollowing();

    if (promise.isPending()) {
        this._propagateFrom(promise, 1);
        promise._proxyPromise(this);
    } else if (promise.isFulfilled()) {
        this._fulfillUnchecked(promise._settledValue);
    } else {
        this._rejectUnchecked(promise._settledValue,
            promise._getCarriedStackTrace());
    }

    if (promise._isRejectionUnhandled()) promise._unsetRejectionIsUnhandled();

    if (debugging &&
        promise._traceParent == null) {
        promise._traceParent = this;
    }
};

Promise.prototype._tryFollow =
function Promise$_tryFollow(value) {
    if (this._isFollowingOrFulfilledOrRejected() ||
        value === this) {
        return false;
    }
    var maybePromise = cast(value, void 0);
    if (!(maybePromise instanceof Promise)) {
        return false;
    }
    this._follow(maybePromise);
    return true;
};

Promise.prototype._resetTrace = function Promise$_resetTrace() {
    if (debugging) {
        this._trace = new CapturedTrace(this._peekContext() === void 0);
    }
};

Promise.prototype._setTrace = function Promise$_setTrace(parent) {
    if (debugging) {
        var context = this._peekContext();
        this._traceParent = context;
        var isTopLevel = context === void 0;
        if (parent !== void 0 &&
            parent._traceParent === context) {
            this._trace = parent._trace;
        } else {
            this._trace = new CapturedTrace(isTopLevel);
        }
    }
    return this;
};

Promise.prototype._attachExtraTrace =
function Promise$_attachExtraTrace(error) {
    if (debugging) {
        var promise = this;
        var stack = error.stack;
        stack = typeof stack === "string" ? stack.split("\n") : [];
        CapturedTrace.protectErrorMessageNewlines(stack);
        var headerLineCount = 1;
        var combinedTraces = 1;
        while(promise != null &&
            promise._trace != null) {
            stack = CapturedTrace.combine(
                stack,
                promise._trace.stack.split("\n")
            );
            promise = promise._traceParent;
            combinedTraces++;
        }

        var stackTraceLimit = Error.stackTraceLimit || 10;
        var max = (stackTraceLimit + headerLineCount) * combinedTraces;
        var len = stack.length;
        if (len > max) {
            stack.length = max;
        }

        if (len > 0)
            stack[0] = stack[0].split("\u0002\u0000\u0001").join("\n");

        if (stack.length <= headerLineCount) {
            error.stack = "(No stack trace)";
        } else {
            error.stack = stack.join("\n");
        }
    }
};

Promise.prototype._cleanValues = function Promise$_cleanValues() {
    if (this._cancellable()) {
        this._cancellationParent = void 0;
    }
};

Promise.prototype._propagateFrom =
function Promise$_propagateFrom(parent, flags) {
    if ((flags & 1) > 0 && parent._cancellable()) {
        this._setCancellable();
        this._cancellationParent = parent;
    }
    if ((flags & 4) > 0) {
        this._setBoundTo(parent._boundTo);
    }
    if ((flags & 2) > 0) {
        this._setTrace(parent);
    }
};

Promise.prototype._fulfill = function Promise$_fulfill(value) {
    if (this._isFollowingOrFulfilledOrRejected()) return;
    this._fulfillUnchecked(value);
};

Promise.prototype._reject =
function Promise$_reject(reason, carriedStackTrace) {
    if (this._isFollowingOrFulfilledOrRejected()) return;
    this._rejectUnchecked(reason, carriedStackTrace);
};

Promise.prototype._settlePromiseAt = function Promise$_settlePromiseAt(index) {
    var handler = this.isFulfilled()
        ? this._fulfillmentHandlerAt(index)
        : this._rejectionHandlerAt(index);

    var value = this._settledValue;
    var receiver = this._receiverAt(index);
    var promise = this._promiseAt(index);

    if (typeof handler === "function") {
        this._settlePromiseFromHandler(handler, receiver, value, promise);
    } else {
        var done = false;
        var isFulfilled = this.isFulfilled();
        if (receiver !== void 0) {
            if (receiver instanceof Promise &&
                receiver._isProxied()) {
                receiver._unsetProxied();

                if (isFulfilled) receiver._fulfillUnchecked(value);
                else receiver._rejectUnchecked(value,
                    this._getCarriedStackTrace());
                done = true;
            } else if (receiver instanceof PromiseArray) {
                if (isFulfilled) receiver._promiseFulfilled(value, promise);
                else receiver._promiseRejected(value, promise);
                done = true;
            }
        }

        if (!done) {
            if (isFulfilled) promise._fulfill(value);
            else promise._reject(value, this._getCarriedStackTrace());
        }
    }

    if (index >= 4) {
        this._queueGC();
    }
};

Promise.prototype._isProxied = function Promise$_isProxied() {
    return (this._bitField & 4194304) === 4194304;
};

Promise.prototype._setProxied = function Promise$_setProxied() {
    this._bitField = this._bitField | 4194304;
};

Promise.prototype._unsetProxied = function Promise$_unsetProxied() {
    this._bitField = this._bitField & (~4194304);
};

Promise.prototype._isGcQueued = function Promise$_isGcQueued() {
    return (this._bitField & -1073741824) === -1073741824;
};

Promise.prototype._setGcQueued = function Promise$_setGcQueued() {
    this._bitField = this._bitField | -1073741824;
};

Promise.prototype._unsetGcQueued = function Promise$_unsetGcQueued() {
    this._bitField = this._bitField & (~-1073741824);
};

Promise.prototype._queueGC = function Promise$_queueGC() {
    if (this._isGcQueued()) return;
    this._setGcQueued();
    async.invokeLater(this._gc, this, void 0);
};

Promise.prototype._gc = function Promise$gc() {
    var len = this._length() * 5 - 5;
    for (var i = 0; i < len; i++) {
        delete this[i];
    }
    this._clearFirstHandlerData();
    this._setLength(0);
    this._unsetGcQueued();
};

Promise.prototype._clearFirstHandlerData =
function Promise$_clearFirstHandlerData() {
    this._fulfillmentHandler0 = void 0;
    this._rejectionHandler0 = void 0;
    this._promise0 = void 0;
    this._receiver0 = void 0;
};

Promise.prototype._queueSettleAt = function Promise$_queueSettleAt(index) {
    if (this._isRejectionUnhandled()) this._unsetRejectionIsUnhandled();
    async.invoke(this._settlePromiseAt, this, index);
};

Promise.prototype._fulfillUnchecked =
function Promise$_fulfillUnchecked(value) {
    if (!this.isPending()) return;
    if (value === this) {
        var err = makeSelfResolutionError();
        this._attachExtraTrace(err);
        return this._rejectUnchecked(err, void 0);
    }
    this._cleanValues();
    this._setFulfilled();
    this._settledValue = value;
    var len = this._length();

    if (len > 0) {
        async.invoke(this._settlePromises, this, len);
    }
};

Promise.prototype._rejectUncheckedCheckError =
function Promise$_rejectUncheckedCheckError(reason) {
    var trace = canAttach(reason) ? reason : new Error(reason + "");
    this._rejectUnchecked(reason, trace === reason ? void 0 : trace);
};

Promise.prototype._rejectUnchecked =
function Promise$_rejectUnchecked(reason, trace) {
    if (!this.isPending()) return;
    if (reason === this) {
        var err = makeSelfResolutionError();
        this._attachExtraTrace(err);
        return this._rejectUnchecked(err);
    }
    this._cleanValues();
    this._setRejected();
    this._settledValue = reason;

    if (this._isFinal()) {
        async.invokeLater(thrower, void 0, trace === void 0 ? reason : trace);
        return;
    }
    var len = this._length();

    if (trace !== void 0) this._setCarriedStackTrace(trace);

    if (len > 0) {
        async.invoke(this._rejectPromises, this, null);
    } else {
        this._ensurePossibleRejectionHandled();
    }
};

Promise.prototype._rejectPromises = function Promise$_rejectPromises() {
    this._settlePromises();
    this._unsetCarriedStackTrace();
};

Promise.prototype._settlePromises = function Promise$_settlePromises() {
    var len = this._length();
    for (var i = 0; i < len; i++) {
        this._settlePromiseAt(i);
    }
};

Promise.prototype._ensurePossibleRejectionHandled =
function Promise$_ensurePossibleRejectionHandled() {
    this._setRejectionIsUnhandled();
    if (CapturedTrace.possiblyUnhandledRejection !== void 0) {
        async.invokeLater(this._notifyUnhandledRejection, this, void 0);
    }
};

Promise.prototype._notifyUnhandledRejectionIsHandled =
function Promise$_notifyUnhandledRejectionIsHandled() {
    if (typeof unhandledRejectionHandled === "function") {
        async.invokeLater(unhandledRejectionHandled, void 0, this);
    }
};

Promise.prototype._notifyUnhandledRejection =
function Promise$_notifyUnhandledRejection() {
    if (this._isRejectionUnhandled()) {
        var reason = this._settledValue;
        var trace = this._getCarriedStackTrace();

        this._setUnhandledRejectionIsNotified();

        if (trace !== void 0) {
            this._unsetCarriedStackTrace();
            reason = trace;
        }
        if (typeof CapturedTrace.possiblyUnhandledRejection === "function") {
            CapturedTrace.possiblyUnhandledRejection(reason, this);
        }
    }
};

var contextStack = [];
Promise.prototype._peekContext = function Promise$_peekContext() {
    var lastIndex = contextStack.length - 1;
    if (lastIndex >= 0) {
        return contextStack[lastIndex];
    }
    return void 0;

};

Promise.prototype._pushContext = function Promise$_pushContext() {
    if (!debugging) return;
    contextStack.push(this);
};

Promise.prototype._popContext = function Promise$_popContext() {
    if (!debugging) return;
    contextStack.pop();
};

Promise.noConflict = function Promise$NoConflict() {
    return noConflict(Promise);
};

Promise.setScheduler = function(fn) {
    if (typeof fn !== "function") throw new TypeError("fn must be a function");
    async._schedule = fn;
};

if (!CapturedTrace.isSupported()) {
    Promise.longStackTraces = function(){};
    debugging = false;
}

Promise._makeSelfResolutionError = makeSelfResolutionError;
_dereq_("./finally.js")(Promise, NEXT_FILTER, cast);
_dereq_("./direct_resolve.js")(Promise);
_dereq_("./synchronous_inspection.js")(Promise);
_dereq_("./join.js")(Promise, PromiseArray, cast, INTERNAL);
Promise.RangeError = RangeError;
Promise.CancellationError = CancellationError;
Promise.TimeoutError = TimeoutError;
Promise.TypeError = TypeError;
Promise.OperationalError = OperationalError;
Promise.RejectionError = OperationalError;
Promise.AggregateError = errors.AggregateError;

util.toFastProperties(Promise);
util.toFastProperties(Promise.prototype);
Promise.Promise = Promise;
_dereq_('./nodeify.js')(Promise);

Promise.prototype = Promise.prototype;
return Promise;

};

},{"./async.js":1,"./captured_trace.js":3,"./catch_filter.js":4,"./direct_resolve.js":5,"./errors.js":6,"./errors_api_rejection":7,"./finally.js":9,"./join.js":10,"./nodeify.js":11,"./promise_array.js":13,"./promise_resolver.js":14,"./synchronous_inspection.js":17,"./thenables.js":18,"./util.js":19}],13:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, INTERNAL, cast) {
var canAttach = _dereq_("./errors.js").canAttach;
var util = _dereq_("./util.js");
var isArray = util.isArray;

function toResolutionValue(val) {
    switch(val) {
    case -1: return void 0;
    case -2: return [];
    case -3: return {};
    }
}

function PromiseArray(values) {
    var promise = this._promise = new Promise(INTERNAL);
    var parent = void 0;
    if (values instanceof Promise) {
        parent = values;
        promise._propagateFrom(parent, 1 | 4);
    }
    promise._setTrace(parent);
    this._values = values;
    this._length = 0;
    this._totalResolved = 0;
    this._init(void 0, -2);
}
PromiseArray.prototype.length = function PromiseArray$length() {
    return this._length;
};

PromiseArray.prototype.promise = function PromiseArray$promise() {
    return this._promise;
};

PromiseArray.prototype._init =
function PromiseArray$_init(_, resolveValueIfEmpty) {
    var values = cast(this._values, void 0);
    if (values instanceof Promise) {
        this._values = values;
        values._setBoundTo(this._promise._boundTo);
        if (values.isFulfilled()) {
            values = values._settledValue;
            if (!isArray(values)) {
                var err = new Promise.TypeError("expecting an array, a promise or a thenable");
                this.__hardReject__(err);
                return;
            }
        } else if (values.isPending()) {
            values._then(
                PromiseArray$_init,
                this._reject,
                void 0,
                this,
                resolveValueIfEmpty
           );
            return;
        } else {
            values._unsetRejectionIsUnhandled();
            this._reject(values._settledValue);
            return;
        }
    } else if (!isArray(values)) {
        var err = new Promise.TypeError("expecting an array, a promise or a thenable");
        this.__hardReject__(err);
        return;
    }

    if (values.length === 0) {
        if (resolveValueIfEmpty === -5) {
            this._resolveEmptyArray();
        }
        else {
            this._resolve(toResolutionValue(resolveValueIfEmpty));
        }
        return;
    }
    var len = this.getActualLength(values.length);
    var newLen = len;
    var newValues = this.shouldCopyValues() ? new Array(len) : this._values;
    var isDirectScanNeeded = false;
    for (var i = 0; i < len; ++i) {
        var maybePromise = cast(values[i], void 0);
        if (maybePromise instanceof Promise) {
            if (maybePromise.isPending()) {
                maybePromise._proxyPromiseArray(this, i);
            } else {
                maybePromise._unsetRejectionIsUnhandled();
                isDirectScanNeeded = true;
            }
        } else {
            isDirectScanNeeded = true;
        }
        newValues[i] = maybePromise;
    }
    this._values = newValues;
    this._length = newLen;
    if (isDirectScanNeeded) {
        this._scanDirectValues(len);
    }
};

PromiseArray.prototype._settlePromiseAt =
function PromiseArray$_settlePromiseAt(index) {
    var value = this._values[index];
    if (!(value instanceof Promise)) {
        this._promiseFulfilled(value, index);
    } else if (value.isFulfilled()) {
        this._promiseFulfilled(value._settledValue, index);
    } else if (value.isRejected()) {
        this._promiseRejected(value._settledValue, index);
    }
};

PromiseArray.prototype._scanDirectValues =
function PromiseArray$_scanDirectValues(len) {
    for (var i = 0; i < len; ++i) {
        if (this._isResolved()) {
            break;
        }
        this._settlePromiseAt(i);
    }
};

PromiseArray.prototype._isResolved = function PromiseArray$_isResolved() {
    return this._values === null;
};

PromiseArray.prototype._resolve = function PromiseArray$_resolve(value) {
    this._values = null;
    this._promise._fulfill(value);
};

PromiseArray.prototype.__hardReject__ =
PromiseArray.prototype._reject = function PromiseArray$_reject(reason) {
    this._values = null;
    var trace = canAttach(reason) ? reason : new Error(reason + "");
    this._promise._attachExtraTrace(trace);
    this._promise._reject(reason, trace);
};

PromiseArray.prototype._promiseProgressed =
function PromiseArray$_promiseProgressed(progressValue, index) {
    if (this._isResolved()) return;
    this._promise._progress({
        index: index,
        value: progressValue
    });
};


PromiseArray.prototype._promiseFulfilled =
function PromiseArray$_promiseFulfilled(value, index) {
    if (this._isResolved()) return;
    this._values[index] = value;
    var totalResolved = ++this._totalResolved;
    if (totalResolved >= this._length) {
        this._resolve(this._values);
    }
};

PromiseArray.prototype._promiseRejected =
function PromiseArray$_promiseRejected(reason, index) {
    if (this._isResolved()) return;
    this._totalResolved++;
    this._reject(reason);
};

PromiseArray.prototype.shouldCopyValues =
function PromiseArray$_shouldCopyValues() {
    return true;
};

PromiseArray.prototype.getActualLength =
function PromiseArray$getActualLength(len) {
    return len;
};

return PromiseArray;
};

},{"./errors.js":6,"./util.js":19}],14:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var util = _dereq_("./util.js");
var maybeWrapAsError = util.maybeWrapAsError;
var errors = _dereq_("./errors.js");
var TimeoutError = errors.TimeoutError;
var OperationalError = errors.OperationalError;
var async = _dereq_("./async.js");
var haveGetters = util.haveGetters;
var es5 = _dereq_("./es5.js");

function isUntypedError(obj) {
    return obj instanceof Error &&
        es5.getPrototypeOf(obj) === Error.prototype;
}

function wrapAsOperationalError(obj) {
    var ret;
    if (isUntypedError(obj)) {
        ret = new OperationalError(obj);
    } else {
        ret = obj;
    }
    errors.markAsOriginatingFromRejection(ret);
    return ret;
}

function nodebackForPromise(promise) {
    function PromiseResolver$_callback(err, value) {
        if (promise === null) return;

        if (err) {
            var wrapped = wrapAsOperationalError(maybeWrapAsError(err));
            promise._attachExtraTrace(wrapped);
            promise._reject(wrapped);
        } else if (arguments.length > 2) {
            var $_len = arguments.length;var args = new Array($_len - 1); for(var $_i = 1; $_i < $_len; ++$_i) {args[$_i - 1] = arguments[$_i];}
            promise._fulfill(args);
        } else {
            promise._fulfill(value);
        }

        promise = null;
    }
    return PromiseResolver$_callback;
}


var PromiseResolver;
if (!haveGetters) {
    PromiseResolver = function PromiseResolver(promise) {
        this.promise = promise;
        this.asCallback = nodebackForPromise(promise);
        this.callback = this.asCallback;
    };
}
else {
    PromiseResolver = function PromiseResolver(promise) {
        this.promise = promise;
    };
}
if (haveGetters) {
    var prop = {
        get: function() {
            return nodebackForPromise(this.promise);
        }
    };
    es5.defineProperty(PromiseResolver.prototype, "asCallback", prop);
    es5.defineProperty(PromiseResolver.prototype, "callback", prop);
}

PromiseResolver._nodebackForPromise = nodebackForPromise;

PromiseResolver.prototype.toString = function PromiseResolver$toString() {
    return "[object PromiseResolver]";
};

PromiseResolver.prototype.resolve =
PromiseResolver.prototype.fulfill = function PromiseResolver$resolve(value) {
    if (!(this instanceof PromiseResolver)) {
        throw new TypeError("Illegal invocation, resolver resolve/reject must be called within a resolver context. Consider using the promise constructor instead.");
    }

    var promise = this.promise;
    if (promise._tryFollow(value)) {
        return;
    }
    async.invoke(promise._fulfill, promise, value);
};

PromiseResolver.prototype.reject = function PromiseResolver$reject(reason) {
    if (!(this instanceof PromiseResolver)) {
        throw new TypeError("Illegal invocation, resolver resolve/reject must be called within a resolver context. Consider using the promise constructor instead.");
    }

    var promise = this.promise;
    errors.markAsOriginatingFromRejection(reason);
    var trace = errors.canAttach(reason) ? reason : new Error(reason + "");
    promise._attachExtraTrace(trace);
    async.invoke(promise._reject, promise, reason);
    if (trace !== reason) {
        async.invoke(this._setCarriedStackTrace, this, trace);
    }
};

PromiseResolver.prototype.progress =
function PromiseResolver$progress(value) {
    if (!(this instanceof PromiseResolver)) {
        throw new TypeError("Illegal invocation, resolver resolve/reject must be called within a resolver context. Consider using the promise constructor instead.");
    }
    async.invoke(this.promise._progress, this.promise, value);
};

PromiseResolver.prototype.cancel = function PromiseResolver$cancel() {
    async.invoke(this.promise.cancel, this.promise, void 0);
};

PromiseResolver.prototype.timeout = function PromiseResolver$timeout() {
    this.reject(new TimeoutError("timeout"));
};

PromiseResolver.prototype.isResolved = function PromiseResolver$isResolved() {
    return this.promise.isResolved();
};

PromiseResolver.prototype.toJSON = function PromiseResolver$toJSON() {
    return this.promise.toJSON();
};

PromiseResolver.prototype._setCarriedStackTrace =
function PromiseResolver$_setCarriedStackTrace(trace) {
    if (this.promise.isRejected()) {
        this.promise._setCarriedStackTrace(trace);
    }
};

module.exports = PromiseResolver;

},{"./async.js":1,"./errors.js":6,"./es5.js":8,"./util.js":19}],15:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
function arrayCopy(src, srcIndex, dst, dstIndex, len) {
    for (var j = 0; j < len; ++j) {
        dst[j + dstIndex] = src[j + srcIndex];
    }
}

function Queue(capacity) {
    this._capacity = capacity;
    this._length = 0;
    this._front = 0;
    this._makeCapacity();
}

Queue.prototype._willBeOverCapacity =
function Queue$_willBeOverCapacity(size) {
    return this._capacity < size;
};

Queue.prototype._pushOne = function Queue$_pushOne(arg) {
    var length = this.length();
    this._checkCapacity(length + 1);
    var i = (this._front + length) & (this._capacity - 1);
    this[i] = arg;
    this._length = length + 1;
};

Queue.prototype.push = function Queue$push(fn, receiver, arg) {
    var length = this.length() + 3;
    if (this._willBeOverCapacity(length)) {
        this._pushOne(fn);
        this._pushOne(receiver);
        this._pushOne(arg);
        return;
    }
    var j = this._front + length - 3;
    this._checkCapacity(length);
    var wrapMask = this._capacity - 1;
    this[(j + 0) & wrapMask] = fn;
    this[(j + 1) & wrapMask] = receiver;
    this[(j + 2) & wrapMask] = arg;
    this._length = length;
};

Queue.prototype.shift = function Queue$shift() {
    var front = this._front,
        ret = this[front];

    this[front] = void 0;
    this._front = (front + 1) & (this._capacity - 1);
    this._length--;
    return ret;
};

Queue.prototype.length = function Queue$length() {
    return this._length;
};

Queue.prototype._makeCapacity = function Queue$_makeCapacity() {
    var len = this._capacity;
    for (var i = 0; i < len; ++i) {
        this[i] = void 0;
    }
};

Queue.prototype._checkCapacity = function Queue$_checkCapacity(size) {
    if (this._capacity < size) {
        this._resizeTo(this._capacity << 3);
    }
};

Queue.prototype._resizeTo = function Queue$_resizeTo(capacity) {
    var oldFront = this._front;
    var oldCapacity = this._capacity;
    var oldQueue = new Array(oldCapacity);
    var length = this.length();

    arrayCopy(this, 0, oldQueue, 0, oldCapacity);
    this._capacity = capacity;
    this._makeCapacity();
    this._front = 0;
    if (oldFront + length <= oldCapacity) {
        arrayCopy(oldQueue, oldFront, this, 0, length);
    } else {        var lengthBeforeWrapping =
            length - ((oldFront + length) & (oldCapacity - 1));

        arrayCopy(oldQueue, oldFront, this, 0, lengthBeforeWrapping);
        arrayCopy(oldQueue, 0, this, lengthBeforeWrapping,
                    length - lengthBeforeWrapping);
    }
};

module.exports = Queue;

},{}],16:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var schedule;
var _MutationObserver;
if (typeof process === "object" && typeof process.version === "string") {
    schedule = function Promise$_Scheduler(fn) {
        process.nextTick(fn);
    };
}
else if ((typeof MutationObserver !== "undefined" &&
         (_MutationObserver = MutationObserver)) ||
         (typeof WebKitMutationObserver !== "undefined" &&
         (_MutationObserver = WebKitMutationObserver))) {
    schedule = (function() {
        var div = document.createElement("div");
        var queuedFn = void 0;
        var observer = new _MutationObserver(
            function Promise$_Scheduler() {
                var fn = queuedFn;
                queuedFn = void 0;
                fn();
            }
       );
        observer.observe(div, {
            attributes: true
        });
        return function Promise$_Scheduler(fn) {
            queuedFn = fn;
            div.classList.toggle("foo");
        };

    })();
}
else if (typeof setTimeout !== "undefined") {
    schedule = function Promise$_Scheduler(fn) {
        setTimeout(fn, 0);
    };
}
else throw new Error("no async scheduler available");
module.exports = schedule;

},{}],17:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise) {
function PromiseInspection(promise) {
    if (promise !== void 0) {
        this._bitField = promise._bitField;
        this._settledValue = promise.isResolved()
            ? promise._settledValue
            : void 0;
    }
    else {
        this._bitField = 0;
        this._settledValue = void 0;
    }
}

PromiseInspection.prototype.isFulfilled =
Promise.prototype.isFulfilled = function Promise$isFulfilled() {
    return (this._bitField & 268435456) > 0;
};

PromiseInspection.prototype.isRejected =
Promise.prototype.isRejected = function Promise$isRejected() {
    return (this._bitField & 134217728) > 0;
};

PromiseInspection.prototype.isPending =
Promise.prototype.isPending = function Promise$isPending() {
    return (this._bitField & 402653184) === 0;
};

PromiseInspection.prototype.value =
Promise.prototype.value = function Promise$value() {
    if (!this.isFulfilled()) {
        throw new TypeError("cannot get fulfillment value of a non-fulfilled promise");
    }
    return this._settledValue;
};

PromiseInspection.prototype.error =
PromiseInspection.prototype.reason =
Promise.prototype.reason = function Promise$reason() {
    if (!this.isRejected()) {
        throw new TypeError("cannot get rejection reason of a non-rejected promise");
    }
    return this._settledValue;
};

PromiseInspection.prototype.isResolved =
Promise.prototype.isResolved = function Promise$isResolved() {
    return (this._bitField & 402653184) > 0;
};

Promise.PromiseInspection = PromiseInspection;
};

},{}],18:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
module.exports = function(Promise, INTERNAL) {
var util = _dereq_("./util.js");
var canAttach = _dereq_("./errors.js").canAttach;
var errorObj = util.errorObj;
var isObject = util.isObject;

function getThen(obj) {
    try {
        return obj.then;
    }
    catch(e) {
        errorObj.e = e;
        return errorObj;
    }
}

function Promise$_Cast(obj, originalPromise) {
    if (isObject(obj)) {
        if (obj instanceof Promise) {
            return obj;
        }
        else if (isAnyBluebirdPromise(obj)) {
            var ret = new Promise(INTERNAL);
            ret._setTrace(void 0);
            obj._then(
                ret._fulfillUnchecked,
                ret._rejectUncheckedCheckError,
                ret._progressUnchecked,
                ret,
                null
            );
            ret._setFollowing();
            return ret;
        }
        var then = getThen(obj);
        if (then === errorObj) {
            if (originalPromise !== void 0 && canAttach(then.e)) {
                originalPromise._attachExtraTrace(then.e);
            }
            return Promise.reject(then.e);
        } else if (typeof then === "function") {
            return Promise$_doThenable(obj, then, originalPromise);
        }
    }
    return obj;
}

var hasProp = {}.hasOwnProperty;
function isAnyBluebirdPromise(obj) {
    return hasProp.call(obj, "_promise0");
}

function Promise$_doThenable(x, then, originalPromise) {
    var resolver = Promise.defer();
    var called = false;
    try {
        then.call(
            x,
            Promise$_resolveFromThenable,
            Promise$_rejectFromThenable,
            Promise$_progressFromThenable
        );
    } catch(e) {
        if (!called) {
            called = true;
            var trace = canAttach(e) ? e : new Error(e + "");
            if (originalPromise !== void 0) {
                originalPromise._attachExtraTrace(trace);
            }
            resolver.promise._reject(e, trace);
        }
    }
    return resolver.promise;

    function Promise$_resolveFromThenable(y) {
        if (called) return;
        called = true;

        if (x === y) {
            var e = Promise._makeSelfResolutionError();
            if (originalPromise !== void 0) {
                originalPromise._attachExtraTrace(e);
            }
            resolver.promise._reject(e, void 0);
            return;
        }
        resolver.resolve(y);
    }

    function Promise$_rejectFromThenable(r) {
        if (called) return;
        called = true;
        var trace = canAttach(r) ? r : new Error(r + "");
        if (originalPromise !== void 0) {
            originalPromise._attachExtraTrace(trace);
        }
        resolver.promise._reject(r, trace);
    }

    function Promise$_progressFromThenable(v) {
        if (called) return;
        var promise = resolver.promise;
        if (typeof promise._progress === "function") {
            promise._progress(v);
        }
    }
}

return Promise$_Cast;
};

},{"./errors.js":6,"./util.js":19}],19:[function(_dereq_,module,exports){
/**
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
"use strict";
var es5 = _dereq_("./es5.js");
var haveGetters = (function(){
    try {
        var o = {};
        es5.defineProperty(o, "f", {
            get: function () {
                return 3;
            }
        });
        return o.f === 3;
    }
    catch (e) {
        return false;
    }

})();
var canEvaluate = typeof navigator == "undefined";
var errorObj = {e: {}};
function tryCatch1(fn, receiver, arg) {
    try { return fn.call(receiver, arg); }
    catch (e) {
        errorObj.e = e;
        return errorObj;
    }
}

function tryCatch2(fn, receiver, arg, arg2) {
    try { return fn.call(receiver, arg, arg2); }
    catch (e) {
        errorObj.e = e;
        return errorObj;
    }
}

function tryCatch3(fn, receiver, arg, arg2, arg3) {
    try { return fn.call(receiver, arg, arg2, arg3); }
    catch (e) {
        errorObj.e = e;
        return errorObj;
    }
}

function tryCatch4(fn, receiver, arg, arg2, arg3, arg4) {
    try { return fn.call(receiver, arg, arg2, arg3, arg4); }
    catch (e) {
        errorObj.e = e;
        return errorObj;
    }
}

function tryCatchApply(fn, args, receiver) {
    try { return fn.apply(receiver, args); }
    catch (e) {
        errorObj.e = e;
        return errorObj;
    }
}

var inherits = function(Child, Parent) {
    var hasProp = {}.hasOwnProperty;

    function T() {
        this.constructor = Child;
        this.constructor$ = Parent;
        for (var propertyName in Parent.prototype) {
            if (hasProp.call(Parent.prototype, propertyName) &&
                propertyName.charAt(propertyName.length-1) !== "$"
           ) {
                this[propertyName + "$"] = Parent.prototype[propertyName];
            }
        }
    }
    T.prototype = Parent.prototype;
    Child.prototype = new T();
    return Child.prototype;
};

function asString(val) {
    return typeof val === "string" ? val : ("" + val);
}

function isPrimitive(val) {
    return val == null || val === true || val === false ||
        typeof val === "string" || typeof val === "number";

}

function isObject(value) {
    return !isPrimitive(value);
}

function maybeWrapAsError(maybeError) {
    if (!isPrimitive(maybeError)) return maybeError;

    return new Error(asString(maybeError));
}

function withAppended(target, appendee) {
    var len = target.length;
    var ret = new Array(len + 1);
    var i;
    for (i = 0; i < len; ++i) {
        ret[i] = target[i];
    }
    ret[i] = appendee;
    return ret;
}

function getDataPropertyOrDefault(obj, key, defaultValue) {
    if (es5.isES5) {
        var desc = Object.getOwnPropertyDescriptor(obj, key);
        if (desc != null) {
            return desc.get == null && desc.set == null
                    ? desc.value
                    : defaultValue;
        }
    } else {
        return {}.hasOwnProperty.call(obj, key) ? obj[key] : void 0;
    }
}

function notEnumerableProp(obj, name, value) {
    if (isPrimitive(obj)) return obj;
    var descriptor = {
        value: value,
        configurable: true,
        enumerable: false,
        writable: true
    };
    es5.defineProperty(obj, name, descriptor);
    return obj;
}


var wrapsPrimitiveReceiver = (function() {
    return this !== "string";
}).call("string");

function thrower(r) {
    throw r;
}

var inheritedDataKeys = (function() {
    if (es5.isES5) {
        return function(obj, opts) {
            var ret = [];
            var visitedKeys = Object.create(null);
            var getKeys = Object(opts).includeHidden
                ? Object.getOwnPropertyNames
                : Object.keys;
            while (obj != null) {
                var keys;
                try {
                    keys = getKeys(obj);
                } catch (e) {
                    return ret;
                }
                for (var i = 0; i < keys.length; ++i) {
                    var key = keys[i];
                    if (visitedKeys[key]) continue;
                    visitedKeys[key] = true;
                    var desc = Object.getOwnPropertyDescriptor(obj, key);
                    if (desc != null && desc.get == null && desc.set == null) {
                        ret.push(key);
                    }
                }
                obj = es5.getPrototypeOf(obj);
            }
            return ret;
        };
    } else {
        return function(obj) {
            var ret = [];
            /*jshint forin:false */
            for (var key in obj) {
                ret.push(key);
            }
            return ret;
        };
    }

})();

function isClass(fn) {
    try {
        if (typeof fn === "function") {
            var keys = es5.keys(fn.prototype);
            return keys.length > 0 &&
                   !(keys.length === 1 && keys[0] === "constructor");
        }
        return false;
    } catch (e) {
        return false;
    }
}

function toFastProperties(obj) {
    /*jshint -W027*/
    function f() {}
    f.prototype = obj;
    return f;
    eval(obj);
}

var rident = /^[a-z$_][a-z$_0-9]*$/i;
function isIdentifier(str) {
    return rident.test(str);
}

function filledRange(count, prefix, suffix) {
    var ret = new Array(count);
    for(var i = 0; i < count; ++i) {
        ret[i] = prefix + i + suffix;
    }
    return ret;
}

var ret = {
    isClass: isClass,
    isIdentifier: isIdentifier,
    inheritedDataKeys: inheritedDataKeys,
    getDataPropertyOrDefault: getDataPropertyOrDefault,
    thrower: thrower,
    isArray: es5.isArray,
    haveGetters: haveGetters,
    notEnumerableProp: notEnumerableProp,
    isPrimitive: isPrimitive,
    isObject: isObject,
    canEvaluate: canEvaluate,
    errorObj: errorObj,
    tryCatch1: tryCatch1,
    tryCatch2: tryCatch2,
    tryCatch3: tryCatch3,
    tryCatch4: tryCatch4,
    tryCatchApply: tryCatchApply,
    inherits: inherits,
    withAppended: withAppended,
    asString: asString,
    maybeWrapAsError: maybeWrapAsError,
    wrapsPrimitiveReceiver: wrapsPrimitiveReceiver,
    toFastProperties: toFastProperties,
    filledRange: filledRange
};

module.exports = ret;

},{"./es5.js":8}]},{},[2])
(2)
});            ;if (typeof window !== 'undefined' && window !== null) {                           window.P = window.Promise;                                                 } else if (typeof self !== 'undefined' && self !== null) {                         self.P = self.Promise;                                                     }

/** FILE: lib/bluebird-defer.js **/
// wrapper to implement defer() functionality
(function () {
  Promise.defer = function () {
    var resolve, reject;
    var promise = new Promise(function() {
        resolve = arguments[0];
        reject = arguments[1];
    });
    return {
        resolve: resolve,
        reject: reject,
        promise: promise
    };
  };
}());

/** FILE: src/remotestorage.js **/
(function (global) {
  function logError(error) {
    if (typeof(error) === 'string') {
      console.error(error);
    } else {
      console.error(error.message, error.stack);
    }
  }

  function emitUnauthorized(r) {
    if (r.statusCode === 403  || r.statusCode === 401) {
      this._emit('error', new RemoteStorage.Unauthorized());
    }
    return Promise.resolve(r);
  }

  function shareFirst(path) {
    return ( this.backend === 'dropbox' &&
             path.match(/^\/public\/.*[^\/]$/) );
  }

  var SyncedGetPutDelete = {
    get: function (path, maxAge) {
      var self = this;
      if (this.local) {
        if (maxAge === undefined) {
          if (this.connected) {
            maxAge = 2*this.getSyncInterval();
          } else {
            maxAge = false;
          }
        }
        var maxAgeInvalid = function (maxAge) {
          return maxAge !== false && typeof(maxAge) !== 'number';
        };

        if (maxAgeInvalid(maxAge)) {
          return Promise.reject('Argument \'maxAge\' must be false or a number');
        }
        return this.local.get(path, maxAge, this.sync.queueGetRequest.bind(this.sync));
      } else {
        return this.remote.get(path);
      }
    },

    put: function (path, body, contentType) {
      if (shareFirst.bind(this)(path)) {
        return SyncedGetPutDelete._wrapBusyDone.call(this, this.remote.put(path, body, contentType));
      }
      else if (this.local) {
        return this.local.put(path, body, contentType);
      } else {
        return SyncedGetPutDelete._wrapBusyDone.call(this, this.remote.put(path, body, contentType));
      }
    },

    'delete': function (path) {
      if (this.local) {
        return this.local.delete(path);
      } else {
        return SyncedGetPutDelete._wrapBusyDone.call(this, this.remote.delete(path));
      }
    },

    _wrapBusyDone: function (result) {
      var self = this;
      this._emit('wire-busy');
      return result.then(function (r) {
        self._emit('wire-done', { success: true });
        return Promise.resolve(r);
      }, function (err) {
        self._emit('wire-done', { success: false });
        return Promise.reject(err);
      });
    }
  };

  /**
   * Class: RemoteStorage
   *
   * TODO needs proper introduction and links to relevant classes etc
   *
   * Constructor for global remoteStorage object.
   *
   * This class primarily contains feature detection code and a global convenience API.
   *
   * Depending on which features are built in, it contains different attributes and
   * functions. See the individual features for more information.
   *
   */
  var RemoteStorage = function () {
    /**
     * Event: ready
     *
     * Fired when ready
     **/
    /**
     * Event: not-connected
     *
     * Fired when ready, but no storage connected ("anonymous mode")
     **/
    /**
     * Event: connected
     *
     * Fired when a remote storage has been connected
     **/
    /**
     * Event: disconnected
     *
     * Fired after disconnect
     **/
    /**
     * Event: error
     *
     * Fired when an error occurs
     *
     * Arguments:
     * the error
     **/
    /**
     * Event: features-loaded
     *
     * Fired when all features are loaded
     **/
    /**
     * Event: connecting
     *
     * Fired before webfinger lookup
     **/
    /**
     * Event: authing
     *
     * Fired before redirecting to the authing server
     **/
    /**
     * Event: wire-busy
     *
     * Fired when a wire request starts
     **/
    /**
     * Event: wire-done
     *
     * Fired when a wire request completes
     **/
    RemoteStorage.eventHandling(
      this, 'ready', 'connected', 'disconnected', 'not-connected', 'conflict',
            'error', 'features-loaded', 'connecting', 'authing', 'wire-busy',
            'wire-done', 'sync-interval-change'
    );

    // pending get/put/delete calls.
    this._pending = [];

    this._setGPD({
      get: this._pendingGPD('get'),
      put: this._pendingGPD('put'),
      delete: this._pendingGPD('delete')
    });

    this._cleanups = [];

    this._pathHandlers = { change: {} };

    this.apiKeys = {};

    if (this.localStorageAvailable()) {
      try {
        this.apiKeys = JSON.parse(localStorage['remotestorage:api-keys']);
      } catch(exc) {
        // ignored
      }
      this.setBackend(localStorage['remotestorage:backend'] || 'remotestorage');
    }

    var origOn = this.on;

    this.on = function (eventName, handler) {
      if (eventName === 'ready' && this.remote.connected && this._allLoaded) {
        setTimeout(handler, 0);
      } else if (eventName === 'features-loaded' && this._allLoaded) {
        setTimeout(handler, 0);
      }
      return origOn.call(this, eventName, handler);
    };

    this._init();

    this.fireInitial = function () {
      if (this.local) {
        setTimeout(this.local.fireInitial.bind(this.local), 0);
      }
    }.bind(this);

    this.on('ready', this.fireInitial.bind(this));
  };

  RemoteStorage.SyncedGetPutDelete = SyncedGetPutDelete;

  RemoteStorage.DiscoveryError = function (message) {
    Error.apply(this, arguments);
    this.message = message;
  };

  RemoteStorage.DiscoveryError.prototype = Object.create(Error.prototype);

  RemoteStorage.Unauthorized = function () { Error.apply(this, arguments); };
  RemoteStorage.Unauthorized.prototype = Object.create(Error.prototype);

  /**
   * Method: RemoteStorage.log
   *
   * Log using console.log, when remoteStorage logging is enabled.
   *
   * You can enable logging with <enableLog>.
   */
  RemoteStorage.log = function () {
    if (RemoteStorage.config.logging) {
      console.log.apply(console, arguments);
    }
  };

  RemoteStorage.config = {
    logging: false,
    changeEvents: {
      local:    true,
      window:   false,
      remote:   true,
      conflict: true
    },
    discoveryTimeout: 10000
  };

  RemoteStorage.prototype = {

    /**
     * Method: displayWidget
     *
     * Displays the widget at the top right of the page. Make sure to call this function
     * once on every pageload (after the html 'body' tag), unless you use a custom widget.
     *
     * Parameters:
     *
     *   domID: identifier of the DOM element which should embody the widget (optional)
     */
     // (see src/widget.js for implementation)

    /**
     * Method: connect
     *
     * Connect to a remoteStorage server.
     *
     * Parameters:
     *   userAddress - The user address (user@host) to connect to.
     *
     * Discovers the webfinger profile of the given user address and
     * initiates the OAuth dance.
     *
     * This method must be called *after* all required access has been claimed.
     *
     */
    connect: function (userAddress) {
      this.setBackend('remotestorage');
      if (userAddress.indexOf('@') < 0) {
        this._emit('error', new RemoteStorage.DiscoveryError("User address doesn't contain an @."));
        return;
      }
      this.remote.configure(userAddress);
      this._emit('connecting');

      var discoveryTimeout = setTimeout(function () {
        this._emit('error', new RemoteStorage.DiscoveryError("No storage information found at that user address."));
      }.bind(this), RemoteStorage.config.discoveryTimeout);

      RemoteStorage.Discover(userAddress, function (href, storageApi, authURL) {
        clearTimeout(discoveryTimeout);
        if (!href) {
          this._emit('error', new RemoteStorage.DiscoveryError("Failed to contact storage server."));
          return;
        }
        this._emit('authing');
        this.remote.configure(userAddress, href, storageApi);
        if (! this.remote.connected) {
          if (authURL) {
            this.authorize(authURL);
          } else {
            // In lieu of an excplicit authURL, assume that the browser
            // and server handle any authorization needs; for instance,
            // TLS may trigger the browser to use a client certificate,
            // or a 401 Not Authorized response may make the browser
            // send a Kerberos ticket using the SPNEGO method.
            this.impliedauth();
          }
        }
      }.bind(this));
    },

    /**
     * Method: disconnect
     *
     * "Disconnect" from remotestorage server to terminate current session.
     * This method clears all stored settings and deletes the entire local
     * cache.
     */
    disconnect: function () {
      if (this.remote) {
        this.remote.configure(null, null, null, null);
      }
      this._setGPD({
        get: this._pendingGPD('get'),
        put: this._pendingGPD('put'),
        delete: this._pendingGPD('delete')
      });
      var n = this._cleanups.length, i = 0;

      var oneDone = function () {
        i++;
        if (i >= n) {
          this._init();
          RemoteStorage.log('Done cleaning up, emitting disconnected and disconnect events');
          this._emit('disconnected');
        }
      }.bind(this);

      if (n > 0) {
        this._cleanups.forEach(function (cleanup) {
          var cleanupResult = cleanup(this);
          if (typeof(cleanup) === 'object' && typeof(cleanup.then) === 'function') {
            cleanupResult.then(oneDone);
          } else {
            oneDone();
          }
        }.bind(this));
      } else {
        oneDone();
      }
    },

    setBackend: function (what) {
      this.backend = what;
      if (this.localStorageAvailable()) {
        if (what) {
          localStorage['remotestorage:backend'] = what;
        } else {
          delete localStorage['remotestorage:backend'];
        }
      }
    },

    /**
     * Method: onChange
     *
     * Add a "change" event handler to the given path. Whenever a "change"
     * happens (as determined by the backend, such as e.g.
     * <RemoteStorage.IndexedDB>) and the affected path is equal to or below
     * the given 'path', the given handler is called.
     *
     * You should usually not use this method directly, but instead use the
     * "change" events provided by <RemoteStorage.BaseClient>.
     *
     * Parameters:
     *   path    - Absolute path to attach handler to.
     *   handler - Handler function.
     */
    onChange: function (path, handler) {
      if (! this._pathHandlers.change[path]) {
        this._pathHandlers.change[path] = [];
      }
      this._pathHandlers.change[path].push(handler);
    },

    /**
     * Method: enableLog
     *
     * Enable remoteStorage logging
     */
    enableLog: function () {
      RemoteStorage.config.logging = true;
    },

    /**
     * Method: disableLog
     *
     * Disable remoteStorage logging
     */
    disableLog: function () {
      RemoteStorage.config.logging = false;
    },

    /**
     * Method: log
     *
     * The same as <RemoteStorage.log>.
     */
    log: function () {
      RemoteStorage.log.apply(RemoteStorage, arguments);
    },

    /**
     * Method: setApiKeys (experimental)
     *
     * Set API keys for (currently) GoogleDrive and/or Dropbox backend support.
     * See also the 'backends' example in the starter-kit. Note that support for
     * both these backends is still experimental.
     *
     * Parameters:
     * type - string, either 'googledrive' or 'dropbox'
     * keys - object, with one string field; 'client_id' for GoogleDrive, or
     *          'api_key' for Dropbox.
     *
     */
    setApiKeys: function (type, keys) {
      if (keys) {
        this.apiKeys[type] = keys;
      } else {
        delete this.apiKeys[type];
      }
      if (this.localStorageAvailable()) {
        localStorage['remotestorage:api-keys'] = JSON.stringify(this.apiKeys);
      }
    },

    /**
     ** INITIALIZATION
     **/

    _init: function () {
      var self = this,
          readyFired = false;

      function fireReady() {
        try {
          if (!readyFired) {
            self._emit('ready');
            readyFired = true;
          }
        } catch(e) {
          console.error("'ready' failed: ", e, e.stack);
          self._emit('error', e);
        }
      }

      this._loadFeatures(function (features) {
        this.log('[RemoteStorage] All features loaded');
        this.local = features.local && new features.local();
        // this.remote set by WireClient._rs_init as lazy property on
        // RS.prototype

        if (this.local && this.remote) {
          this._setGPD(SyncedGetPutDelete, this);
          this._bindChange(this.local);
        } else if (this.remote) {
          this._setGPD(this.remote, this.remote);
        }

        if (this.remote) {
          this.remote.on('connected', function (){
            fireReady();
            self._emit('connected');
          });
          this.remote.on('not-connected', function (){
            fireReady();
            self._emit('not-connected');
          });
          if (this.remote.connected) {
            fireReady();
            self._emit('connected');
          }
        }

        this._collectCleanupFunctions();

        try {
          this._allLoaded = true;
          this._emit('features-loaded');
        } catch(exc) {
          logError(exc);
          this._emit('error', exc);
        }
        this._processPending();
      }.bind(this));
    },

    _collectCleanupFunctions: function () {
      for (var i=0; i < this.features.length; i++) {
        var cleanup = this.features[i].cleanup;
        if (typeof(cleanup) === 'function') {
          this._cleanups.push(cleanup);
        }
      }
    },

    /**
     ** FEATURE DETECTION
     **/
    _loadFeatures: function (callback) {
      var featureList = [
        'WireClient',
        'I18n',
        'Dropbox',
        'GoogleDrive',
        'Access',
        'Caching',
        'Discover',
        'Authorize',
        'Widget',
        'IndexedDB',
        'LocalStorage',
        'InMemoryStorage',
        'Sync',
        'BaseClient',
        'Env'
      ];
      var features = [];
      var featuresDone = 0;
      var self = this;

      function featureDone() {
        featuresDone++;
        if (featuresDone === featureList.length) {
          setTimeout(function () {
            features.caching = !!RemoteStorage.Caching;
            features.sync = !!RemoteStorage.Sync;
            [
              'IndexedDB',
              'LocalStorage',
              'InMemoryStorage'
            ].some(function (cachingLayer) {
              if (features.some(function (feature) { return feature.name === cachingLayer; })) {
                features.local = RemoteStorage[cachingLayer];
                return true;
              }
            });
            self.features = features;
            callback(features);
          }, 0);
        }
      }

      function featureInitialized(name) {
        self.log("[RemoteStorage] [FEATURE "+name+"] initialized.");
        features.push({
          name : name,
          init :  RemoteStorage[name]._rs_init,
          supported : true,
          cleanup : RemoteStorage[name]._rs_cleanup
        });
        featureDone();
      }

      function featureFailed(name, err) {
        self.log("[RemoteStorage] [FEATURE "+name+"] initialization failed ( "+err+")");
        featureDone();
      }

      function featureSupported(name, success) {
        self.log("[RemoteStorage] [FEATURE "+name+"]" + success ? "":" not"+" supported");
        if (!success) {
          featureDone();
        }
      }

      function initFeature(name) {
        var initResult;
        try {
          initResult = RemoteStorage[name]._rs_init(self);
        } catch(e) {
          featureFailed(name, e);
          return;
        }
        if (typeof(initResult) === 'object' && typeof(initResult.then) === 'function') {
          initResult.then(
            function (){ featureInitialized(name); },
            function (err){ featureFailed(name, err); }
          );
        } else {
          featureInitialized(name);
        }
      }

      featureList.forEach(function (featureName) {
        self.log("[RemoteStorage] [FEATURE " + featureName + "] initializing...");
        var impl = RemoteStorage[featureName];
        var supported;

        if (impl) {
          supported = !impl._rs_supported || impl._rs_supported();

          if (typeof supported === 'object') {
            supported.then(
              function (){
                featureSupported(featureName, true);
                initFeature(featureName);
              },
              function (){
                featureSupported(featureName, false);
              }
            );
          }
          else if (typeof supported === 'boolean') {
            featureSupported(featureName, supported);
            if (supported) {
              initFeature(featureName);
            }
          }
        } else {
          featureSupported(featureName, false);
        }
      });
    },

    localStorageAvailable: function () {
      try {
        return !!global.localStorage;
      } catch(error) {
        return false;
      }
    },

    /**
     ** GET/PUT/DELETE INTERFACE HELPERS
     **/

    _setGPD: function (impl, context) {
      function wrap(func) {
        return function () {
          return func.apply(context, arguments)
            .then(emitUnauthorized.bind(this));
        };
      }
      this.get = wrap(impl.get);
      this.put = wrap(impl.put);
      this.delete = wrap(impl.delete);
    },

    _pendingGPD: function (methodName) {
      return function () {
        var pending = Promise.defer();
        this._pending.push({
          method: methodName,
          args: Array.prototype.slice.call(arguments),
          promise: pending
        });
        return pending.promise;
      }.bind(this);
    },

    _processPending: function () {
      this._pending.forEach(function (pending) {
        try {
          this[pending.method].apply(this, pending.args).then(pending.promise.resolve, pending.promise.reject);
        } catch(e) {
          pending.promise.reject(e);
        }
      }.bind(this));
      this._pending = [];
    },

    /**
     ** CHANGE EVENT HANDLING
     **/

    _bindChange: function (object) {
      object.on('change', this._dispatchEvent.bind(this, 'change'));
    },

    _dispatchEvent: function (eventName, event) {
      for (var path in this._pathHandlers[eventName]) {
        var pl = path.length;
        var self = this;
        if (event.path.substr(0, pl) === path) {
          this._pathHandlers[eventName][path].forEach(function (handler) {
            var ev = {};
            for (var key in event) { ev[key] = event[key]; }
            ev.relativePath = event.path.replace(new RegExp('^' + path), '');
            try {
              handler(ev);
            } catch(e) {
              console.error("'change' handler failed: ", e, e.stack);
              self._emit('error', e);
            }
          });
        }
      }
    }
  };

  /**
   * Property: connected
   *
   * Boolean property indicating if remoteStorage is currently connected.
   */
  Object.defineProperty(RemoteStorage.prototype, 'connected', {
    get: function () {
      return this.remote.connected;
    }
  });

  /**
   * Property: access
   *
   * Tracking claimed access scopes. A <RemoteStorage.Access> instance.
   *
   *
   * Property: caching
   *
   * Caching settings. A <RemoteStorage.Caching> instance.
   *
   * Not available in no-cache builds.
   *
   *
   * Property: remote
   *
   * Access to the remote backend used. Usually a <RemoteStorage.WireClient>.
   *
   *
   * Property: local
   *
   * Access to the local caching backend used. Usually either a
   * <RemoteStorage.IndexedDB> or <RemoteStorage.LocalStorage> instance.
   *
   * Not available in no-cache builds.
   */

  global.RemoteStorage = RemoteStorage;

})(typeof(window) !== 'undefined' ? window : global);


/** FILE: src/util.js **/
/**
 * Class: RemoteStorage.Util
 *
 * Provides reusable utility functions at RemoteStorage.util
 *
 */
(function () {

  /**
   * Function: fixArrayBuffers
   *
   * Takes an object and its copy as produced by the _deepClone function
   * below, and finds and fixes any ArrayBuffers that were cast to `{}` instead
   * of being cloned to new ArrayBuffers with the same content.
   *
   * It recurses into sub-objects, but skips arrays if they occur.
   */
  function fixArrayBuffers(srcObj, dstObj) {
    var field, srcArr, dstArr;
    if (typeof(srcObj) !== 'object' || Array.isArray(srcObj) || srcObj === null) {
      return;
    }
    for (field in srcObj) {
      if (typeof(srcObj[field]) === 'object' && srcObj[field] !== null) {
        if (srcObj[field].toString() === '[object ArrayBuffer]') {
          dstObj[field] = new ArrayBuffer(srcObj[field].byteLength);
          srcArr = new Int8Array(srcObj[field]);
          dstArr = new Int8Array(dstObj[field]);
          dstArr.set(srcArr);
        } else {
          fixArrayBuffers(srcObj[field], dstObj[field]);
        }
      }
    }
  }

  RemoteStorage.util = {
    getEventEmitter: function () {
      var object = {};
      var args = Array.prototype.slice.call(arguments);
      args.unshift(object);
      RemoteStorage.eventHandling.apply(RemoteStorage, args);
      object.emit = object._emit;
      return object;
    },

    extend: function (target) {
      var sources = Array.prototype.slice.call(arguments, 1);
      sources.forEach(function (source) {
        for (var key in source) {
          target[key] = source[key];
        }
      });
      return target;
    },

    asyncEach: function (array, callback) {
      return this.asyncMap(array, callback).
        then(function () { return array; });
    },

    asyncMap: function (array, callback) {
      var pending = Promise.defer();
      var n = array.length, i = 0;
      var results = [], errors = [];

      function oneDone() {
        i++;
        if (i === n) {
          pending.resolve(results, errors);
        }
      }

      array.forEach(function (item, index) {
        var result;
        try {
          result = callback(item);
        } catch(exc) {
          oneDone();
          errors[index] = exc;
        }
        if (typeof(result) === 'object' && typeof(result.then) === 'function') {
          result.then(function (res) { results[index] = res; oneDone(); },
                      function (error) { errors[index] = error; oneDone(); });
        } else {
          oneDone();
          results[index] = result;
        }
      });

      return pending.promise;
    },

    containingFolder: function (path) {
      if (path === '') {
        return '/';
      }
      if (! path) {
        throw "Path not given!";
      }

      return path.replace(/\/+/g, '/').replace(/[^\/]+\/?$/, '');
    },

    isFolder: function (path) {
      return path.substr(-1) === '/';
    },

    isDocument: function (path) {
      return path.substr(-1) !== '/';
    },

    baseName: function (path) {
      var parts = path.split('/');
      if (this.isFolder(path)) {
        return parts[parts.length-2]+'/';
      } else {
        return parts[parts.length-1];
      }
    },

    bindAll: function (object) {
      for (var key in this) {
        if (typeof(object[key]) === 'function') {
          object[key] = object[key].bind(object);
        }
      }
    },

    equal: function (a, b, seen) {
      seen = seen || [];

      if (typeof(a) !== typeof(b)) {
        return false;
      }

      if (typeof(a) === 'number' || typeof(a) === 'boolean' || typeof(a) === 'string') {
        return a === b;
      }

      if (typeof(a) === 'function') {
        return a.toString() === b.toString();
      }

      if (a instanceof ArrayBuffer && b instanceof ArrayBuffer) {
        // Without the following conversion the browsers wouldn't be able to
        // tell the ArrayBuffer instances apart.
        a = new Uint8Array(a);
        b = new Uint8Array(b);
      }

      // If this point has been reached, a and b are either arrays or objects.

      if (a instanceof Array) {
        if (a.length !== b.length) {
          return false;
        }

        for (var i = 0, c = a.length; i < c; i++) {
          if (!RemoteStorage.util.equal(a[i], b[i], seen)) {
            return false;
          }
        }
      } else {
        // Check that keys from a exist in b
        for (var key in a) {
          if (a.hasOwnProperty(key) && !(key in b)) {
            return false;
          }
        }

        // Check that keys from b exist in a, and compare the values
        for (var key in b) {
          if (!b.hasOwnProperty(key)) {
            continue;
          }

          if (!(key in a)) {
            return false;
          }

          var seenArg;

          if (typeof(b[key]) === 'object') {
            if (seen.indexOf(b[key]) >= 0) {
              // Circular reference, don't attempt to compare this object.
              // If nothing else returns false, the objects match.
              continue;
            }

            seenArg = seen.slice();
            seenArg.push(b[key]);
          }

          if (!RemoteStorage.util.equal(a[key], b[key], seenArg)) {
            return false;
          }
        }
      }

      return true;
    },

    equalObj: function (obj1, obj2) {
      console.warn('DEPRECATION WARNING: RemoteStorage.util.equalObj has been replaced by RemoteStorage.util.equal.');
      return RemoteStorage.util.equal(obj1, obj2);
    },

    deepClone: function (obj) {
      var clone;
      if (obj === undefined) {
        return undefined;
      } else {
        clone = JSON.parse(JSON.stringify(obj));
        fixArrayBuffers(obj, clone);
        return clone;
      }
    },

    pathsFromRoot: function (path) {
      var paths = [path];
      var parts = path.replace(/\/$/, '').split('/');

      while (parts.length > 1) {
        parts.pop();
        paths.push(parts.join('/')+'/');
      }
      return paths;
    }

  };

  if (!RemoteStorage.prototype.util) {
    Object.defineProperty(RemoteStorage.prototype, 'util', {
      get: function () {
        console.log('DEPRECATION WARNING: remoteStorage.util was moved to RemoteStorage.util');
        return RemoteStorage.util;
      }
    });
  }
})();


/** FILE: src/eventhandling.js **/
(function (global) {
  /**
   * Interface: eventhandling
   */
  var methods = {
    /**
     * Method: addEventListener
     *
     * Install an event handler for the given event name
     */
    addEventListener: function (eventName, handler) {
      if (typeof(eventName) !== 'string') {
        throw new Error('Argument eventName should be a string');
      }
      if (typeof(handler) !== 'function') {
        throw new Error('Argument handler should be a function');
      }
      RemoteStorage.log('[Eventhandling] Adding event listener', eventName, handler);
      this._validateEvent(eventName);
      this._handlers[eventName].push(handler);
    },

    /**
     * Method: removeEventListener
     *
     * Remove a previously installed event handler
     */
    removeEventListener: function (eventName, handler) {
      this._validateEvent(eventName);
      var hl = this._handlers[eventName].length;
      for (var i=0;i<hl;i++) {
        if (this._handlers[eventName][i] === handler) {
          this._handlers[eventName].splice(i, 1);
          return;
        }
      }
    },

    _emit: function (eventName) {
      this._validateEvent(eventName);
      var args = Array.prototype.slice.call(arguments, 1);
      this._handlers[eventName].forEach(function (handler) {
        handler.apply(this, args);
      });
    },

    _validateEvent: function (eventName) {
      if (! (eventName in this._handlers)) {
        throw new Error("Unknown event: " + eventName);
      }
    },

    _delegateEvent: function (eventName, target) {
      target.on(eventName, function (event) {
        this._emit(eventName, event);
      }.bind(this));
    },

    _addEvent: function (eventName) {
      this._handlers[eventName] = [];
    }
  };

  /**
   * Method: eventhandling.on
   *
   * Alias for <addEventListener>
   **/
  methods.on = methods.addEventListener;

  /**
   * Function: eventHandling
   *
   * Mixes event handling functionality into an object.
   *
   * The first parameter is always the object to be extended.
   * All remaining parameter are expected to be strings, interpreted as valid event
   * names.
   *
   * Example:
   *   (start code)
   *   var MyConstructor = function () {
   *     eventHandling(this, 'connected', 'disconnected');
   *
   *     this._emit('connected');
   *     this._emit('disconnected');
   *     // This would throw an exception:
   *     // this._emit('something-else');
   *   };
   *
   *   var myObject = new MyConstructor();
   *   myObject.on('connected', function () { console.log('connected'); });
   *   myObject.on('disconnected', function () { console.log('disconnected'); });
   *   // This would throw an exception as well:
   *   // myObject.on('something-else', function () {});
   *   (end code)
   */
  RemoteStorage.eventHandling = function (object) {
    var eventNames = Array.prototype.slice.call(arguments, 1);
    for (var key in methods) {
      object[key] = methods[key];
    }
    object._handlers = {};
    eventNames.forEach(function (eventName) {
      object._addEvent(eventName);
    });
  };
})(typeof(window) !== 'undefined' ? window : global);


/** FILE: src/wireclient.js **/
(function (global) {
  var RS = RemoteStorage;

  /**
   * Class: RemoteStorage.WireClient
   *
   * WireClient Interface
   * --------------------
   *
   * This file exposes a get/put/delete interface on top of XMLHttpRequest.
   * It requires to be configured with parameters about the remotestorage server to
   * connect to.
   * Each instance of WireClient is always associated with a single remotestorage
   * server and access token.
   *
   * Usually the WireClient instance can be accessed via `remoteStorage.remote`.
   *
   * This is the get/put/delete interface:
   *
   *   - #get() takes a path and optionally a ifNoneMatch option carrying a version
   *     string to check. It returns a promise that will be fulfilled with the HTTP
   *     response status, the response body, the MIME type as returned in the
   *     'Content-Type' header and the current revision, as returned in the 'ETag'
   *     header.
   *   - #put() takes a path, the request body and a content type string. It also
   *     accepts the ifMatch and ifNoneMatch options, that map to the If-Match and
   *     If-None-Match headers respectively. See the remotestorage-01 specification
   *     for details on handling these headers. It returns a promise, fulfilled with
   *     the same values as the one for #get().
   *   - #delete() takes a path and the ifMatch option as well. It returns a promise
   *     fulfilled with the same values as the one for #get().
   *
   * In addition to this, the WireClient has some compatibility features to work with
   * remotestorage 2012.04 compatible storages. For example it will cache revisions
   * from folder listings in-memory and return them accordingly as the "revision"
   * parameter in response to #get() requests. Similarly it will return 404 when it
   * receives an empty folder listing, to mimic remotestorage-01 behavior. Note
   * that it is not always possible to know the revision beforehand, hence it may
   * be undefined at times (especially for caching-roots).
   */

  var hasLocalStorage;
  var SETTINGS_KEY = "remotestorage:wireclient";

  var API_2012 = 1, API_00 = 2, API_01 = 3, API_02 = 4, API_HEAD = 5;

  var STORAGE_APIS = {
    'draft-dejong-remotestorage-00': API_00,
    'draft-dejong-remotestorage-01': API_01,
    'draft-dejong-remotestorage-02': API_02,
    'https://www.w3.org/community/rww/wiki/read-write-web-00#simple': API_2012
  };

  var isArrayBufferView;

  if (typeof(ArrayBufferView) === 'function') {
    isArrayBufferView = function (object) { return object && (object instanceof ArrayBufferView); };
  } else {
    var arrayBufferViews = [
      Int8Array, Uint8Array, Int16Array, Uint16Array,
      Int32Array, Uint32Array, Float32Array, Float64Array
    ];
    isArrayBufferView = function (object) {
      for (var i=0;i<8;i++) {
        if (object instanceof arrayBufferViews[i]) {
          return true;
        }
      }
      return false;
    };
  }

  var isFolder = RemoteStorage.util.isFolder;

  function addQuotes(str) {
    if (typeof(str) !== 'string') {
      return str;
    }
    if (str === '*') {
      return '*';
    }

    return '"' + str + '"';
  }

  function stripQuotes(str) {
    if (typeof(str) !== 'string') {
      return str;
    }

    return str.replace(/^["']|["']$/g, '');
  }

  function readBinaryData(content, mimeType, callback) {
    var blob = new Blob([content], { type: mimeType });
    var reader = new FileReader();
    reader.addEventListener("loadend", function () {
      callback(reader.result); // reader.result contains the contents of blob as a typed array
    });
    reader.readAsArrayBuffer(blob);
  }

  function getTextFromArrayBuffer(arrayBuffer, encoding) {
    var pending = Promise.defer();
    if (typeof Blob === 'undefined') {
      var buffer = new Buffer(new Uint8Array(arrayBuffer));
      pending.resolve(buffer.toString(encoding));
    } else {
      var blob = new Blob([arrayBuffer]);
      var fileReader = new FileReader();
      fileReader.addEventListener("loadend", function (evt) {
        pending.resolve(evt.target.result);
      });
      fileReader.readAsText(blob, encoding);
    }
    return pending.promise;
  }

  function determineCharset(mimeType) {
    var charset = 'UTF-8';
    var charsetMatch;

    if (mimeType) {
      charsetMatch = mimeType.match(/charset=(.+)$/);
      if (charsetMatch) {
        charset = charsetMatch[1];
      }
    }
    return charset;
  }

  function cleanPath(path) {
    return path.replace(/\/+/g, '/').split('/').map(encodeURIComponent).join('/');
  }

  function isFolderDescription(body) {
    return ((body['@context'] === 'http://remotestorage.io/spec/folder-description')
             && (typeof(body['items']) === 'object'));
  }

  function isSuccessStatus(status) {
    return [201, 204, 304].indexOf(status) >= 0;
  }

  function isErrorStatus(status) {
    return [401, 403, 404, 412].indexOf(status) >= 0;
  }

  var onErrorCb;

  /**
   * Class : RemoteStorage.WireClient
   **/
  RS.WireClient = function (rs) {
    this.connected = false;

    /**
     * Event: change
     *   never fired for some reason
     *
     * Event: connected
     *   fired when the wireclient connect method realizes that it is
     *   in posession of a token and a href
     **/
    RS.eventHandling(this, 'change', 'connected', 'wire-busy', 'wire-done', 'not-connected');

    onErrorCb = function (error){
      if (error instanceof RemoteStorage.Unauthorized) {
        this.configure(undefined, undefined, undefined, null);
      }
    }.bind(this);
    rs.on('error', onErrorCb);
    if (hasLocalStorage) {
      var settings;
      try { settings = JSON.parse(localStorage[SETTINGS_KEY]); } catch(e) {}
      if (settings) {
        setTimeout(function () {
          this.configure(settings.userAddress, settings.href, settings.storageApi, settings.token);
        }.bind(this), 0);
      }
    }

    this._revisionCache = {};

    if (this.connected) {
      setTimeout(this._emit.bind(this), 0, 'connected');
    }
  };

  RS.WireClient.REQUEST_TIMEOUT = 30000;

  RS.WireClient.prototype = {
    /**
     * Property: token
     *
     * Holds the bearer token of this WireClient, as obtained in the OAuth dance
     *
     * Example:
     *   (start code)
     *
     *   remoteStorage.remote.token
     *   // -> 'DEADBEEF01=='
     */

    /**
     * Property: href
     *
     * Holds the server's base URL, as obtained in the Webfinger discovery
     *
     * Example:
     *   (start code)
     *
     *   remoteStorage.remote.href
     *   // -> 'https://storage.example.com/users/jblogg/'
     */

    /**
     * Property: storageApi
     *
     * Holds the spec version the server claims to be compatible with
     *
     * Example:
     *   (start code)
     *
     *   remoteStorage.remote.storageApi
     *   // -> 'draft-dejong-remotestorage-01'
     */

    _request: function (method, uri, token, headers, body, getEtag, fakeRevision) {
      if ((method === 'PUT' || method === 'DELETE') && uri[uri.length - 1] === '/') {
        return Promise.reject("Don't " + method + " on directories!");
      }

      var revision;
      var reqType;
      var self = this;

      if (token !== RemoteStorage.Authorize.IMPLIED_FAKE_TOKEN) {
        headers['Authorization'] = 'Bearer ' + token;
      }

      this._emit('wire-busy', {
        method: method,
        isFolder: isFolder(uri)
      });

      return RS.WireClient.request(method, uri, {
        body: body,
        headers: headers,
        responseType: 'arraybuffer'
      }).then(function (response) {
        self._emit('wire-done', {
          method: method,
          isFolder: isFolder(uri),
          success: true
        });
        self.online = true;
        if (isErrorStatus(response.status)) {
          RemoteStorage.log('[WireClient] Error response status', response.status);
          if (getEtag) {
            revision = stripQuotes(response.getResponseHeader('ETag'));
          } else {
            revision = undefined;
          }
          return Promise.resolve({statusCode: response.status, revision: revision});
        } else if (isSuccessStatus(response.status) ||
                   (response.status === 200 && method !== 'GET')) {
          revision = stripQuotes(response.getResponseHeader('ETag'));
          RemoteStorage.log('[WireClient] Successful request', revision);
          return Promise.resolve({statusCode: response.status, revision: revision});
        } else {
          var mimeType = response.getResponseHeader('Content-Type');
          var body;
          if (getEtag) {
            revision = stripQuotes(response.getResponseHeader('ETag'));
          } else {
            revision = response.status === 200 ? fakeRevision : undefined;
          }

          var charset = determineCharset(mimeType);

          if ((!mimeType) || charset === 'binary') {
            RemoteStorage.log('[WireClient] Successful request with unknown or binary mime-type', revision);
            return Promise.resolve({statusCode: response.status, body: response.response, contentType: mimeType, revision: revision});
          } else {
            return getTextFromArrayBuffer(response.response, charset).then(function (body) {
              RemoteStorage.log('[WireClient] Successful request', revision);
              return Promise.resolve({statusCode: response.status, body: body, contentType: mimeType, revision: revision});
            });
          }
        }
      }, function (error) {
        self._emit('wire-done', {
          method: method,
          isFolder: isFolder(uri),
          success: false
        });
        return Promise.reject(error);
      });
    },

    configure: function (userAddress, href, storageApi, token) {
      if (typeof(userAddress) !== 'undefined') {
        this.userAddress = userAddress;
      }
      if (typeof(href) !== 'undefined') {
        this.href = href;
      }
      if (typeof(storageApi) !== 'undefined') {
        this.storageApi = storageApi;
      }
      if (typeof(token) !== 'undefined') {
        this.token = token;
      }
      if (typeof(this.storageApi) !== 'undefined') {
        this._storageApi = STORAGE_APIS[this.storageApi] || API_HEAD;
        this.supportsRevs = this._storageApi >= API_00;
      }
      if (this.href && this.token) {
        this.connected = true;
        this.online = true;
        this._emit('connected');
      } else {
        this.connected = false;
      }
      if (hasLocalStorage) {
        localStorage[SETTINGS_KEY] = JSON.stringify({
          userAddress: this.userAddress,
          href: this.href,
          token: this.token,
          storageApi: this.storageApi
        });
      }
      RS.WireClient.configureHooks.forEach(function (hook) {
        hook.call(this);
      }.bind(this));
    },

    stopWaitingForToken: function () {
      if (!this.connected) {
        this._emit('not-connected');
      }
    },

    get: function (path, options) {
      var self = this;
      if (!this.connected) {
        return Promise.reject("not connected (path: " + path + ")");
      }
      if (!options) { options = {}; }
      var headers = {};
      if (this.supportsRevs) {
        if (options.ifNoneMatch) {
          headers['If-None-Match'] = addQuotes(options.ifNoneMatch);
        }
      } else if (options.ifNoneMatch) {
        var oldRev = this._revisionCache[path];
      }


      return this._request('GET', this.href + cleanPath(path), this.token, headers,
                            undefined, this.supportsRevs, this._revisionCache[path])
      .then(function (r) {
        if (!isFolder(path)) {
          return Promise.resolve(r);
        }
        var itemsMap = {};
        if (typeof(r.body) !== 'undefined') {
          try {
            r.body = JSON.parse(r.body);
          } catch (e) {
            return Promise.reject('Folder description at ' + self.href + cleanPath(path) + ' is not JSON');
          }
        }

        if (r.statusCode === 200 && typeof(r.body) === 'object') {
        // New folder listing received
          if (Object.keys(r.body).length === 0) {
          // Empty folder listing of any spec
            r.statusCode = 404;
          } else if (isFolderDescription(r.body)) {
          // >= 02 spec
            for (var item in r.body.items) {
              self._revisionCache[path + item] = r.body.items[item].ETag;
            }
            itemsMap = r.body.items;
          } else {
          // < 02 spec
            Object.keys(r.body).forEach(function (key){
              self._revisionCache[path + key] = r.body[key];
              itemsMap[key] = {"ETag": r.body[key]};
            });
          }
          r.body = itemsMap;
          return Promise.resolve(r);
        } else {
          return Promise.resolve(r);
        }
      });
    },

    put: function (path, body, contentType, options) {
      if (!this.connected) {
        return Promise.reject("not connected (path: " + path + ")");
      }
      if (!options) { options = {}; }
      if ((!contentType.match(/charset=/)) && (body instanceof ArrayBuffer || isArrayBufferView(body))) {
        contentType +=  '; charset=binary';
      }
      var headers = { 'Content-Type': contentType };
      if (this.supportsRevs) {
        if (options.ifMatch) {
          headers['If-Match'] = addQuotes(options.ifMatch);
        }
        if (options.ifNoneMatch) {
          headers['If-None-Match'] = addQuotes(options.ifNoneMatch);
        }
      }
      return this._request('PUT', this.href + cleanPath(path), this.token,
                     headers, body, this.supportsRevs);
    },

    'delete': function (path, options) {
      if (!this.connected) {
        throw new Error("not connected (path: " + path + ")");
      }
      if (!options) { options = {}; }
      var headers = {};
      if (this.supportsRevs) {
        if (options.ifMatch) {
          headers['If-Match'] = addQuotes(options.ifMatch);
        }
      }
      return this._request('DELETE', this.href + cleanPath(path), this.token,
                     headers,
                     undefined, this.supportsRevs);
    }
  };

  // Shared cleanPath used by Dropbox
  RS.WireClient.cleanPath = cleanPath;

  // Shared isArrayBufferView used by WireClient and Dropbox
  RS.WireClient.isArrayBufferView = isArrayBufferView;

  RS.WireClient.readBinaryData = readBinaryData;

  // Shared request function used by WireClient, GoogleDrive and Dropbox.
  RS.WireClient.request = function (method, url, options) {
    var pending = Promise.defer();
    RemoteStorage.log('[WireClient]', method, url);

    var timedOut = false;

    var timer = setTimeout(function () {
      timedOut = true;
      pending.reject('timeout');
    }, RS.WireClient.REQUEST_TIMEOUT);

    var xhr = new XMLHttpRequest();
    xhr.open(method, url, true);

    if (options.responseType) {
      xhr.responseType = options.responseType;
    }

    if (options.headers) {
      for (var key in options.headers) {
        xhr.setRequestHeader(key, options.headers[key]);
      }
    }

    xhr.onload = function () {
      if (timedOut) { return; }
      clearTimeout(timer);
      pending.resolve(xhr);
    };

    xhr.onerror = function (error) {
      if (timedOut) { return; }
      clearTimeout(timer);
      pending.reject(error);
    };

    var body = options.body;

    if (typeof(body) === 'object') {
      if (isArrayBufferView(body)) {
        /* alright. */
        //FIXME empty block
      } else if (body instanceof ArrayBuffer) {
        body = new Uint8Array(body);
      }
    }
    xhr.send(body);
    return pending.promise;
  };

  Object.defineProperty(RemoteStorage.WireClient.prototype, 'storageType', {
    get: function () {
      if (this.storageApi) {
        var spec = this.storageApi.match(/draft-dejong-(remotestorage-\d\d)/);
        return spec ? spec[1] : '2012.04';
      }
    }
  });

  RS.WireClient.configureHooks = [];

  RS.WireClient._rs_init = function (remoteStorage) {
    hasLocalStorage = remoteStorage.localStorageAvailable();
    remoteStorage.remote = new RS.WireClient(remoteStorage);
    this.online = true;
  };

  RS.WireClient._rs_supported = function () {
    return !! global.XMLHttpRequest;
  };

  RS.WireClient._rs_cleanup = function (remoteStorage){
    if (hasLocalStorage){
      delete localStorage[SETTINGS_KEY];
    }
    remoteStorage.removeEventListener('error', onErrorCb);
  };

})(typeof(window) !== 'undefined' ? window : global);


/** FILE: src/discover.js **/
(function (global) {

  // feature detection flags
  var haveXMLHttpRequest, hasLocalStorage;
  // used to store settings in localStorage
  var SETTINGS_KEY = 'remotestorage:discover';
  // cache loaded from localStorage
  var cachedInfo = {};

  /**
   * Class: RemoteStorage.Discover
   *
   * This class deals with the Webfinger lookup, discovering a connecting
   * user's storage details.
   *
   * The discovery timeout can be configured via
   * `RemoteStorage.config.discoveryTimeout` (in ms).
   *
   * Arguments:
   *   userAddress - user@host
   *   callback    - gets called with href of the storage, the type and the authURL
   **/

  RemoteStorage.Discover = function (userAddress, callback) {
    if (userAddress in cachedInfo) {
      var info = cachedInfo[userAddress];
      callback(info.href, info.type, info.authURL);
      return;
    }
    var hostname = userAddress.split('@')[1];
    var params = '?resource=' + encodeURIComponent('acct:' + userAddress);
    var urls = [
      'https://' + hostname + '/.well-known/webfinger' + params,
      'http://' + hostname + '/.well-known/webfinger' + params
    ];

    function tryOne() {
      var xhr = new XMLHttpRequest();
      var url = urls.shift();
      if (!url) { return callback(); }
      RemoteStorage.log('[Discover] Trying URL', url);
      xhr.open('GET', url, true);
      xhr.onabort = xhr.onerror = function () {
        console.error("webfinger error", arguments, '(', url, ')');
        tryOne();
      };
      xhr.onload = function () {
        if (xhr.status !== 200) { return tryOne(); }
        var profile;

        try {
          profile = JSON.parse(xhr.responseText);
        } catch(e) {
          RemoteStorage.log("[Discover] Failed to parse profile ", xhr.responseText, e);
          tryOne();
          return;
        }

        if (!profile.links) {
          RemoteStorage.log("[Discover] Profile has no links section ", JSON.stringify(profile));
          tryOne();
          return;
        }

        var link;
        profile.links.forEach(function (l) {
          if (l.rel === 'remotestorage') {
            link = l;
          } else if (l.rel === 'remoteStorage' && !link) {
            link = l;
          }
        });
        RemoteStorage.log('[Discover] Got profile', profile, 'and link', link);
        if (link) {
          var authURL = link.properties['http://tools.ietf.org/html/rfc6749#section-4.2']
                  || link.properties['auth-endpoint'],
            storageType = link.properties['http://remotestorage.io/spec/version']
                  || link.type;
          cachedInfo[userAddress] = { href: link.href, type: storageType, authURL: authURL };
          if (hasLocalStorage) {
            localStorage[SETTINGS_KEY] = JSON.stringify({ cache: cachedInfo });
          }
          callback(link.href, storageType, authURL);
        } else {
          tryOne();
        }
      };
      xhr.send();
    }
    tryOne();
  };

  RemoteStorage.Discover._rs_init = function (remoteStorage) {
    hasLocalStorage = remoteStorage.localStorageAvailable();
    if (hasLocalStorage) {
      var settings;
      try { settings = JSON.parse(localStorage[SETTINGS_KEY]); } catch(e) {}
      if (settings) {
        cachedInfo = settings.cache;
      }
    }
  };

  RemoteStorage.Discover._rs_supported = function () {
    haveXMLHttpRequest = !! global.XMLHttpRequest;
    return haveXMLHttpRequest;
  };

  RemoteStorage.Discover._rs_cleanup = function () {
    if (hasLocalStorage) {
      delete localStorage[SETTINGS_KEY];
    }
  };

})(typeof(window) !== 'undefined' ? window : global);


/** FILE: src/authorize.js **/
(function (global) {

  function extractParams() {
    //FF already decodes the URL fragment in document.location.hash, so use this instead:
    var location = RemoteStorage.Authorize.getLocation(),
        hashPos  = location.href.indexOf('#'),
        hash;
    if (hashPos === -1) { return; }
    hash = location.href.substring(hashPos+1);
    // if hash is not of the form #key=val&key=val, it's probably not for us
    if (hash.indexOf('=') === -1) { return; }
    return hash.split('&').reduce(function (m, kvs) {
      var kv = kvs.split('=');
      m[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
      return m;
    }, {});
  }

  RemoteStorage.ImpliedAuth = function (storageApi, redirectUri) {
    RemoteStorage.log('ImpliedAuth proceeding due to absent authURL; storageApi = ' + storageApi + ' redirectUri = ' + redirectUri);
    // Set a fixed access token, signalling to not send it as Bearer
    remoteStorage.remote.configure(undefined, undefined, undefined, RemoteStorage.Authorize.IMPLIED_FAKE_TOKEN);
    document.location = redirectUri;
  };

  RemoteStorage.Authorize = function (authURL, scope, redirectUri, clientId) {
    RemoteStorage.log('[Authorize] authURL = ', authURL, 'scope = ', scope, 'redirectUri = ', redirectUri, 'clientId = ', clientId);

    var url = authURL, hashPos = redirectUri.indexOf('#');
    url += authURL.indexOf('?') > 0 ? '&' : '?';
    url += 'redirect_uri=' + encodeURIComponent(redirectUri.replace(/#.*$/, ''));
    url += '&scope=' + encodeURIComponent(scope);
    url += '&client_id=' + encodeURIComponent(clientId);
    if (hashPos !== -1) {
      url += '&state=' + encodeURIComponent(redirectUri.substring(hashPos+1));
    }
    url += '&response_type=token';
    RemoteStorage.Authorize.setLocation(url);
  };

  RemoteStorage.Authorize.IMPLIED_FAKE_TOKEN = false;

  RemoteStorage.prototype.authorize = function (authURL) {
    this.access.setStorageType(this.remote.storageType);
    var scope = this.access.scopeParameter;

    var redirectUri = String(RemoteStorage.Authorize.getLocation());
    var clientId = redirectUri.match(/^(https?:\/\/[^\/]+)/)[0];

    RemoteStorage.Authorize(authURL, scope, redirectUri, clientId);
  };

  /**
   * Get current document location
   *
   * Override this method if access to document.location is forbidden
   */
  RemoteStorage.Authorize.getLocation = function () {
    return global.document.location;
  };

  /**
   * Set current document location
   *
   * Override this method if access to document.location is forbidden
   */
  RemoteStorage.Authorize.setLocation = function (location) {
    if (typeof location === 'string') {
      global.document.location.href = location;
    } else if (typeof location === 'object') {
      global.document.location = location;
    } else {
      throw "Invalid location " + location;
    }
  };

  RemoteStorage.prototype.impliedauth = function () {
    RemoteStorage.ImpliedAuth(this.remote.storageApi, String(document.location));
  };

  RemoteStorage.Authorize._rs_supported = function (remoteStorage) {
    return typeof(document) !== 'undefined';
  };

  var onFeaturesLoaded;
  RemoteStorage.Authorize._rs_init = function (remoteStorage) {

    onFeaturesLoaded = function () {
      var authParamsUsed = false;
      if (params) {
        if (params.error) {
          throw "Authorization server errored: " + params.error;
        }
        if (params.access_token) {
          remoteStorage.remote.configure(undefined, undefined, undefined, params.access_token);
          authParamsUsed = true;
        }
        if (params.remotestorage) {
          remoteStorage.connect(params.remotestorage);
          authParamsUsed = true;
        }
        if (params.state) {
          RemoteStorage.Authorize.setLocation('#'+params.state);
        }
      }
      if (!authParamsUsed) {
        remoteStorage.remote.stopWaitingForToken();
      }
    };
    var params = extractParams(),
        location;
    if (params) {
      location = RemoteStorage.Authorize.getLocation();
      location.hash = '';
    }
    remoteStorage.on('features-loaded', onFeaturesLoaded);
  };

  RemoteStorage.Authorize._rs_cleanup = function (remoteStorage) {
    remoteStorage.removeEventListener('features-loaded', onFeaturesLoaded);
  };

})(typeof(window) !== 'undefined' ? window : global);


/** FILE: src/access.js **/
(function(global) {

  var SETTINGS_KEY = "remotestorage:access";

  /**
   * Class: RemoteStorage.Access
   *
   * Keeps track of claimed access and scopes.
   */
  RemoteStorage.Access = function() {
    this.reset();
  };

  RemoteStorage.Access.prototype = {

    /**
     * Method: claim
     *
     * Claim access on a given scope with given mode.
     *
     * Parameters:
     *   scope - An access scope, such as "contacts" or "calendar".
     *   mode  - Access mode to use. Either "r" or "rw".
     *
     * Example:
     *   (start code)
     *   remoteStorage.access.claim('contacts', 'r');
     *   remoteStorage.access.claim('pictures', 'rw');
     */
    claim: function(scope, mode) {
      if (typeof(scope) !== 'string' || scope.indexOf('/') !== -1 || scope.length === 0) {
        throw new Error('Scope should be a non-empty string without forward slashes');
      }
      if (!mode.match(/^rw?$/)) {
        throw new Error('Mode should be either \'r\' or \'rw\'');
      }
      this._adjustRootPaths(scope);
      this.scopeModeMap[scope] = mode;
    },

    get: function(scope) {
      return this.scopeModeMap[scope];
    },

    remove: function(scope) {
      var savedMap = {};
      var name;
      for (name in this.scopeModeMap) {
        savedMap[name] = this.scopeModeMap[name];
      }
      this.reset();
      delete savedMap[scope];
      for (name in savedMap) {
        this.set(name, savedMap[name]);
      }
    },

    /**
     * Verify permission for a given scope.
     */
    checkPermission: function(scope, mode) {
      var actualMode = this.get(scope);
      return actualMode && (mode === 'r' || actualMode === 'rw');
    },

    /**
     * Verify permission for a given path.
     */
    checkPathPermission: function(path, mode) {
      if (this.checkPermission('*', mode)) {
        return true;
      }
      return !!this.checkPermission(this._getModuleName(path), mode);
    },

    reset: function() {
      this.rootPaths = [];
      this.scopeModeMap = {};
    },

    /**
     * Return the module name for a given path.
     */
    _getModuleName: function(path) {
      if (path[0] !== '/') {
        throw new Error('Path should start with a slash');
      }
      var moduleMatch = path.replace(/^\/public/, '').match(/^\/([^\/]*)\//);
      return moduleMatch ? moduleMatch[1] : '*';
    },

    _adjustRootPaths: function(newScope) {
      if ('*' in this.scopeModeMap || newScope === '*') {
        this.rootPaths = ['/'];
      } else if (! (newScope in this.scopeModeMap)) {
        this.rootPaths.push('/' + newScope + '/');
        this.rootPaths.push('/public/' + newScope + '/');
      }
    },

    _scopeNameForParameter: function(scope) {
      if (scope.name === '*' && this.storageType) {
        if (this.storageType === '2012.04') {
          return '';
        } else if (this.storageType.match(/remotestorage-0[01]/)) {
          return 'root';
        }
      }
      return scope.name;
    },

    setStorageType: function(type) {
      this.storageType = type;
    }
  };

  /**
   * Property: scopes
   *
   * Holds an array of claimed scopes in the form
   * > { name: "<scope-name>", mode: "<mode>" }
   */
  Object.defineProperty(RemoteStorage.Access.prototype, 'scopes', {
    get: function() {
      return Object.keys(this.scopeModeMap).map(function(key) {
        return { name: key, mode: this.scopeModeMap[key] };
      }.bind(this));
    }
  });

  Object.defineProperty(RemoteStorage.Access.prototype, 'scopeParameter', {
    get: function() {
      return this.scopes.map(function(scope) {
        return this._scopeNameForParameter(scope) + ':' + scope.mode;
      }.bind(this)).join(' ');
    }
  });

  // Documented in src/remotestorage.js
  Object.defineProperty(RemoteStorage.prototype, 'access', {
    get: function() {
      var access = new RemoteStorage.Access();
      Object.defineProperty(this, 'access', {
        value: access
      });
      return access;
    },
    configurable: true
  });

  RemoteStorage.Access._rs_init = function() {};
})(typeof(window) !== 'undefined' ? window : global);


/** FILE: src/env.js **/
(function (pMode) {

  var mode = pMode,
      env = {},
      isBackground = false;


  RemoteStorage.Env = function () {
    return env;
  };

  RemoteStorage.Env.isBrowser = function () {
    return mode === "browser";
  };

  RemoteStorage.Env.isNode = function () {
    return mode === "node";
  };

  RemoteStorage.Env.goBackground = function () {
    isBackground = true;
    RemoteStorage.Env._emit("background");
  };

  RemoteStorage.Env.goForeground = function () {
    isBackground = false;
    RemoteStorage.Env._emit("foreground");
  };

  RemoteStorage.Env._rs_init = function (remoteStorage) {
    RemoteStorage.eventHandling(RemoteStorage.Env, "background", "foreground");

    function visibility() {
      if (document[env.hiddenProperty]) {
        RemoteStorage.Env.goBackground();
      } else {
        RemoteStorage.Env.goForeground();
      }
    }

    if ( mode === 'browser') {
      if ( typeof(document.hidden) !== "undefined" ) {
        env.hiddenProperty = "hidden";
        env.visibilityChangeEvent = "visibilitychange";
      } else if ( typeof(document.mozHidden) !== "undefined" ) {
        env.hiddenProperty = "mozHidden";
        env.visibilityChangeEvent = "mozvisibilitychange";
      } else if ( typeof(document.msHidden) !== "undefined" ) {
        env.hiddenProperty = "msHidden";
        env.visibilityChangeEvent = "msvisibilitychange";
      } else if ( typeof(document.webkitHidden) !== "undefined" ) {
        env.hiddenProperty = "webkitHidden";
        env.visibilityChangeEvent = "webkitvisibilitychange";
      }
      document.addEventListener(env.visibilityChangeEvent, visibility, false);
      visibility();
    }
  };

  RemoteStorage.Env._rs_cleanup = function (remoteStorage) {
  };

})(typeof(window) !== 'undefined' ? 'browser' : 'node');


/** FILE: lib/tv4.js **/
/**
Author: Geraint Luff and others
Year: 2013

This code is released into the "public domain" by its author(s).  Anybody may use, alter and distribute the code without restriction.  The author makes no guarantees, and takes no liability of any kind for use of this code.

If you find a bug or make an improvement, it would be courteous to let the author know, but it is not compulsory.
**/

(function (global) {
var ValidatorContext = function (parent, collectMultiple) {
	this.missing = [];
	this.schemas = parent ? Object.create(parent.schemas) : {};
	this.collectMultiple = collectMultiple;
	this.errors = [];
	this.handleError = collectMultiple ? this.collectError : this.returnError;
};
ValidatorContext.prototype.returnError = function (error) {
	return error;
};
ValidatorContext.prototype.collectError = function (error) {
	if (error) {
		this.errors.push(error);
	}
	return null;
}
ValidatorContext.prototype.prefixErrors = function (startIndex, dataPath, schemaPath) {
	for (var i = startIndex; i < this.errors.length; i++) {
		this.errors[i] = this.errors[i].prefixWith(dataPath, schemaPath);
	}
	return this;
}

ValidatorContext.prototype.getSchema = function (url) {
	if (this.schemas[url] != undefined) {
		var schema = this.schemas[url];
		return schema;
	}
	var baseUrl = url;
	var fragment = "";
	if (url.indexOf('#') != -1) {
		fragment = url.substring(url.indexOf("#") + 1);
		baseUrl = url.substring(0, url.indexOf("#"));
	}
	if (this.schemas[baseUrl] != undefined) {
		var schema = this.schemas[baseUrl];
		var pointerPath = decodeURIComponent(fragment);
		if (pointerPath == "") {
			return schema;
		} else if (pointerPath.charAt(0) != "/") {
			return undefined;
		}
		var parts = pointerPath.split("/").slice(1);
		for (var i = 0; i < parts.length; i++) {
			var component = parts[i].replace("~1", "/").replace("~0", "~");
			if (schema[component] == undefined) {
				schema = undefined;
				break;
			}
			schema = schema[component];
		}
		if (schema != undefined) {
			return schema;
		}
	}
	if (this.missing[baseUrl] == undefined) {
		this.missing.push(baseUrl);
		this.missing[baseUrl] = baseUrl;
	}
};
ValidatorContext.prototype.addSchema = function (url, schema) {
	var map = {};
	map[url] = schema;
	normSchema(schema, url);
	searchForTrustedSchemas(map, schema, url);
	for (var key in map) {
		this.schemas[key] = map[key];
	}
	return map;
};
	
ValidatorContext.prototype.validateAll = function validateAll(data, schema, dataPathParts, schemaPathParts) {
	if (schema['$ref'] != undefined) {
		schema = this.getSchema(schema['$ref']);
		if (!schema) {
			return null;
		}
	}
	
	var errorCount = this.errors.length;
	var error = this.validateBasic(data, schema)
		|| this.validateNumeric(data, schema)
		|| this.validateString(data, schema)
		|| this.validateArray(data, schema)
		|| this.validateObject(data, schema)
		|| this.validateCombinations(data, schema)
		|| null
	if (error || errorCount != this.errors.length) {
		while ((dataPathParts && dataPathParts.length) || (schemaPathParts && schemaPathParts.length)) {
			var dataPart = (dataPathParts && dataPathParts.length) ? "" + dataPathParts.pop() : null;
			var schemaPart = (schemaPathParts && schemaPathParts.length) ? "" + schemaPathParts.pop() : null;
			if (error) {
				error = error.prefixWith(dataPart, schemaPart);
			}
			this.prefixErrors(errorCount, dataPart, schemaPart);
		}
	}
		
	return this.handleError(error);
}

function recursiveCompare(A, B) {
	if (A === B) {
		return true;
	}
	if (typeof A == "object" && typeof B == "object") {
		if (Array.isArray(A) != Array.isArray(B)) {
			return false;
		} else if (Array.isArray(A)) {
			if (A.length != B.length) {
				return false
			}
			for (var i = 0; i < A.length; i++) {
				if (!recursiveCompare(A[i], B[i])) {
					return false;
				}
			}
		} else {
			for (var key in A) {
				if (B[key] === undefined && A[key] !== undefined) {
					return false;
				}
			}
			for (var key in B) {
				if (A[key] === undefined && B[key] !== undefined) {
					return false;
				}
			}
			for (var key in A) {
				if (!recursiveCompare(A[key], B[key])) {
					return false;
				}
			}
		}
		return true;
	}
	return false;
}

ValidatorContext.prototype.validateBasic = function validateBasic(data, schema) {
	var error;
	if (error = this.validateType(data, schema)) {
		return error.prefixWith(null, "type");
	}
	if (error = this.validateEnum(data, schema)) {
		return error.prefixWith(null, "type");
	}
	return null;
}

ValidatorContext.prototype.validateType = function validateType(data, schema) {
	if (schema.type == undefined) {
		return null;
	}
	var dataType = typeof data;
	if (data == null) {
		dataType = "null";
	} else if (Array.isArray(data)) {
		dataType = "array";
	}
	var allowedTypes = schema.type;
	if (typeof allowedTypes != "object") {
		allowedTypes = [allowedTypes];
	}
	
	for (var i = 0; i < allowedTypes.length; i++) {
		var type = allowedTypes[i];
		if (type == dataType || (type == "integer" && dataType == "number" && (data%1 == 0))) {
			return null;
		}
	}
	return new ValidationError(ErrorCodes.INVALID_TYPE, "invalid data type: " + dataType);
}

ValidatorContext.prototype.validateEnum = function validateEnum(data, schema) {
	if (schema["enum"] == undefined) {
		return null;
	}
	for (var i = 0; i < schema["enum"].length; i++) {
		var enumVal = schema["enum"][i];
		if (recursiveCompare(data, enumVal)) {
			return null;
		}
	}
	return new ValidationError(ErrorCodes.ENUM_MISMATCH, "No enum match for: " + JSON.stringify(data));
}
ValidatorContext.prototype.validateNumeric = function validateNumeric(data, schema) {
	return this.validateMultipleOf(data, schema)
		|| this.validateMinMax(data, schema)
		|| null;
}

ValidatorContext.prototype.validateMultipleOf = function validateMultipleOf(data, schema) {
	var multipleOf = schema.multipleOf || schema.divisibleBy;
	if (multipleOf == undefined) {
		return null;
	}
	if (typeof data == "number") {
		if (data%multipleOf != 0) {
			return new ValidationError(ErrorCodes.NUMBER_MULTIPLE_OF, "Value " + data + " is not a multiple of " + multipleOf);
		}
	}
	return null;
}

ValidatorContext.prototype.validateMinMax = function validateMinMax(data, schema) {
	if (typeof data != "number") {
		return null;
	}
	if (schema.minimum != undefined) {
		if (data < schema.minimum) {
			return new ValidationError(ErrorCodes.NUMBER_MINIMUM, "Value " + data + " is less than minimum " + schema.minimum).prefixWith(null, "minimum");
		}
		if (schema.exclusiveMinimum && data == schema.minimum) {
			return new ValidationError(ErrorCodes.NUMBER_MINIMUM_EXCLUSIVE, "Value "+ data + " is equal to exclusive minimum " + schema.minimum).prefixWith(null, "exclusiveMinimum");
		}
	}
	if (schema.maximum != undefined) {
		if (data > schema.maximum) {
			return new ValidationError(ErrorCodes.NUMBER_MAXIMUM, "Value " + data + " is greater than maximum " + schema.maximum).prefixWith(null, "maximum");
		}
		if (schema.exclusiveMaximum && data == schema.maximum) {
			return new ValidationError(ErrorCodes.NUMBER_MAXIMUM_EXCLUSIVE, "Value "+ data + " is equal to exclusive maximum " + schema.maximum).prefixWith(null, "exclusiveMaximum");
		}
	}
	return null;
}
ValidatorContext.prototype.validateString = function validateString(data, schema) {
	return this.validateStringLength(data, schema)
		|| this.validateStringPattern(data, schema)
		|| null;
}

ValidatorContext.prototype.validateStringLength = function validateStringLength(data, schema) {
	if (typeof data != "string") {
		return null;
	}
	if (schema.minLength != undefined) {
		if (data.length < schema.minLength) {
			return new ValidationError(ErrorCodes.STRING_LENGTH_SHORT, "String is too short (" + data.length + " chars), minimum " + schema.minLength).prefixWith(null, "minLength");
		}
	}
	if (schema.maxLength != undefined) {
		if (data.length > schema.maxLength) {
			return new ValidationError(ErrorCodes.STRING_LENGTH_LONG, "String is too long (" + data.length + " chars), maximum " + schema.maxLength).prefixWith(null, "maxLength");
		}
	}
	return null;
}

ValidatorContext.prototype.validateStringPattern = function validateStringPattern(data, schema) {
	if (typeof data != "string" || schema.pattern == undefined) {
		return null;
	}
	var regexp = new RegExp(schema.pattern);
	if (!regexp.test(data)) {
		return new ValidationError(ErrorCodes.STRING_PATTERN, "String does not match pattern").prefixWith(null, "pattern");
	}
	return null;
}
ValidatorContext.prototype.validateArray = function validateArray(data, schema) {
	if (!Array.isArray(data)) {
		return null;
	}
	return this.validateArrayLength(data, schema)
		|| this.validateArrayUniqueItems(data, schema)
		|| this.validateArrayItems(data, schema)
		|| null;
}

ValidatorContext.prototype.validateArrayLength = function validateArrayLength(data, schema) {
	if (schema.minItems != undefined) {
		if (data.length < schema.minItems) {
			var error = (new ValidationError(ErrorCodes.ARRAY_LENGTH_SHORT, "Array is too short (" + data.length + "), minimum " + schema.minItems)).prefixWith(null, "minItems");
			if (this.handleError(error)) {
				return error;
			}
		}
	}
	if (schema.maxItems != undefined) {
		if (data.length > schema.maxItems) {
			var error = (new ValidationError(ErrorCodes.ARRAY_LENGTH_LONG, "Array is too long (" + data.length + " chars), maximum " + schema.maxItems)).prefixWith(null, "maxItems");
			if (this.handleError(error)) {
				return error;
			}
		}
	}
	return null;
}

ValidatorContext.prototype.validateArrayUniqueItems = function validateArrayUniqueItems(data, schema) {
	if (schema.uniqueItems) {
		for (var i = 0; i < data.length; i++) {
			for (var j = i + 1; j < data.length; j++) {
				if (recursiveCompare(data[i], data[j])) {
					var error = (new ValidationError(ErrorCodes.ARRAY_UNIQUE, "Array items are not unique (indices " + i + " and " + j + ")")).prefixWith(null, "uniqueItems");
					if (this.handleError(error)) {
						return error;
					}
				}
			}
		}
	}
	return null;
}

ValidatorContext.prototype.validateArrayItems = function validateArrayItems(data, schema) {
	if (schema.items == undefined) {
		return null;
	}
	var error;
	if (Array.isArray(schema.items)) {
		for (var i = 0; i < data.length; i++) {
			if (i < schema.items.length) {
				if (error = this.validateAll(data[i], schema.items[i], [i], ["items", i])) {
					return error;
				}
			} else if (schema.additionalItems != undefined) {
				if (typeof schema.additionalItems == "boolean") {
					if (!schema.additionalItems) {
						error = (new ValidationError(ErrorCodes.ARRAY_ADDITIONAL_ITEMS, "Additional items not allowed")).prefixWith("" + i, "additionalItems");
						if (this.handleError(error)) {
							return error;
						}
					}
				} else if (error = this.validateAll(data[i], schema.additionalItems, [i], ["additionalItems"])) {
					return error;
				}
			}
		}
	} else {
		for (var i = 0; i < data.length; i++) {
			if (error = this.validateAll(data[i], schema.items, [i], ["items"])) {
				return error;
			}
		}
	}
	return null;
}
ValidatorContext.prototype.validateObject = function validateObject(data, schema) {
	if (typeof data != "object" || data == null || Array.isArray(data)) {
		return null;
	}
	return this.validateObjectMinMaxProperties(data, schema)
		|| this.validateObjectRequiredProperties(data, schema)
		|| this.validateObjectProperties(data, schema)
		|| this.validateObjectDependencies(data, schema)
		|| null;
}

ValidatorContext.prototype.validateObjectMinMaxProperties = function validateObjectMinMaxProperties(data, schema) {
	var keys = Object.keys(data);
	if (schema.minProperties != undefined) {
		if (keys.length < schema.minProperties) {
			var error = new ValidationError(ErrorCodes.OBJECT_PROPERTIES_MINIMUM, "Too few properties defined (" + keys.length + "), minimum " + schema.minProperties).prefixWith(null, "minProperties");
			if (this.handleError(error)) {
				return error;
			}
		}
	}
	if (schema.maxProperties != undefined) {
		if (keys.length > schema.maxProperties) {
			var error = new ValidationError(ErrorCodes.OBJECT_PROPERTIES_MAXIMUM, "Too many properties defined (" + keys.length + "), maximum " + schema.maxProperties).prefixWith(null, "maxProperties");
			if (this.handleError(error)) {
				return error;
			}
		}
	}
	return null;
}

ValidatorContext.prototype.validateObjectRequiredProperties = function validateObjectRequiredProperties(data, schema) {
	if (schema.required != undefined) {
		for (var i = 0; i < schema.required.length; i++) {
			var key = schema.required[i];
			if (data[key] === undefined) {
				var error = new ValidationError(ErrorCodes.OBJECT_REQUIRED, "Missing required property: " + key).prefixWith(null, "" + i).prefixWith(null, "required");
				if (this.handleError(error)) {
					return error;
				}
			}
		}
	}
	return null;
}

ValidatorContext.prototype.validateObjectProperties = function validateObjectProperties(data, schema) {
	var error;
	for (var key in data) {
		var foundMatch = false;
		if (schema.properties != undefined && schema.properties[key] != undefined) {
			foundMatch = true;
			if (error = this.validateAll(data[key], schema.properties[key], [key], ["properties", key])) {
				return error;
			}
		}
		if (schema.patternProperties != undefined) {
			for (var patternKey in schema.patternProperties) {
				var regexp = new RegExp(patternKey);
				if (regexp.test(key)) {
					foundMatch = true;
					if (error = this.validateAll(data[key], schema.patternProperties[patternKey], [key], ["patternProperties", patternKey])) {
						return error;
					}
				}
			}
		}
		if (!foundMatch && schema.additionalProperties != undefined) {
			if (typeof schema.additionalProperties == "boolean") {
				if (!schema.additionalProperties) {
					error = new ValidationError(ErrorCodes.OBJECT_ADDITIONAL_PROPERTIES, "Additional properties not allowed").prefixWith(key, "additionalProperties");
					if (this.handleError(error)) {
						return error;
					}
				}
			} else {
				if (error = this.validateAll(data[key], schema.additionalProperties, [key], ["additionalProperties"])) {
					return error;
				}
			}
		}
	}
	return null;
}

ValidatorContext.prototype.validateObjectDependencies = function validateObjectDependencies(data, schema) {
	var error;
	if (schema.dependencies != undefined) {
		for (var depKey in schema.dependencies) {
			if (data[depKey] !== undefined) {
				var dep = schema.dependencies[depKey];
				if (typeof dep == "string") {
					if (data[dep] === undefined) {
						error = new ValidationError(ErrorCodes.OBJECT_DEPENDENCY_KEY, "Dependency failed - key must exist: " + dep).prefixWith(null, depKey).prefixWith(null, "dependencies");
						if (this.handleError(error)) {
							return error;
						}
					}
				} else if (Array.isArray(dep)) {
					for (var i = 0; i < dep.length; i++) {
						var requiredKey = dep[i];
						if (data[requiredKey] === undefined) {
							error = new ValidationError(ErrorCodes.OBJECT_DEPENDENCY_KEY, "Dependency failed - key must exist: " + requiredKey).prefixWith(null, "" + i).prefixWith(null, depKey).prefixWith(null, "dependencies");
							if (this.handleError(error)) {
								return error;
							}
						}
					}
				} else {
					if (error = this.validateAll(data, dep, [], ["dependencies", depKey])) {
						return error;
					}
				}
			}
		}
	}
	return null;
}

ValidatorContext.prototype.validateCombinations = function validateCombinations(data, schema) {
	var error;
	return this.validateAllOf(data, schema)
		|| this.validateAnyOf(data, schema)
		|| this.validateOneOf(data, schema)
		|| this.validateNot(data, schema)
		|| null;
}

ValidatorContext.prototype.validateAllOf = function validateAllOf(data, schema) {
	if (schema.allOf == undefined) {
		return null;
	}
	var error;
	for (var i = 0; i < schema.allOf.length; i++) {
		var subSchema = schema.allOf[i];
		if (error = this.validateAll(data, subSchema, [], ["allOf", i])) {
			return error;
		}
	}
	return null;
}

ValidatorContext.prototype.validateAnyOf = function validateAnyOf(data, schema) {
	if (schema.anyOf == undefined) {
		return null;
	}
	var errors = [];
	var startErrorCount = this.errors.length;
	for (var i = 0; i < schema.anyOf.length; i++) {
		var subSchema = schema.anyOf[i];

		var errorCount = this.errors.length;
		var error = this.validateAll(data, subSchema, [], ["anyOf", i]);

		if (error == null && errorCount == this.errors.length) {
			this.errors = this.errors.slice(0, startErrorCount);
			return null;
		}
		if (error) {
			errors.push(error.prefixWith(null, "" + i).prefixWith(null, "anyOf"));
		}
	}
	errors = errors.concat(this.errors.slice(startErrorCount));
	this.errors = this.errors.slice(0, startErrorCount);
	return new ValidationError(ErrorCodes.ANY_OF_MISSING, "Data does not match any schemas from \"anyOf\"", "", "/anyOf", errors);
}

ValidatorContext.prototype.validateOneOf = function validateOneOf(data, schema) {
	if (schema.oneOf == undefined) {
		return null;
	}
	var validIndex = null;
	var errors = [];
	var startErrorCount = this.errors.length;
	for (var i = 0; i < schema.oneOf.length; i++) {
		var subSchema = schema.oneOf[i];
		
		var errorCount = this.errors.length;
		var error = this.validateAll(data, subSchema, [], ["oneOf", i]);
		
		if (error == null && errorCount == this.errors.length) {
			if (validIndex == null) {
				validIndex = i;
			} else {
				this.errors = this.errors.slice(0, startErrorCount);
				return new ValidationError(ErrorCodes.ONE_OF_MULTIPLE, "Data is valid against more than one schema from \"oneOf\": indices " + validIndex + " and " + i, "", "/oneOf");
			}
		} else if (error) {
			errors.push(error.prefixWith(null, "" + i).prefixWith(null, "oneOf"));
		}
	}
	if (validIndex == null) {
		errors = errors.concat(this.errors.slice(startErrorCount));
		this.errors = this.errors.slice(0, startErrorCount);
		return new ValidationError(ErrorCodes.ONE_OF_MISSING, "Data does not match any schemas from \"oneOf\"", "", "/oneOf", errors);
	} else {
		this.errors = this.errors.slice(0, startErrorCount);
	}
	return null;
}

ValidatorContext.prototype.validateNot = function validateNot(data, schema) {
	if (schema.not == undefined) {
		return null;
	}
	var oldErrorCount = this.errors.length;
	var error = this.validateAll(data, schema.not);
	var notErrors = this.errors.slice(oldErrorCount);
	this.errors = this.errors.slice(0, oldErrorCount);
	if (error == null && notErrors.length == 0) {
		return new ValidationError(ErrorCodes.NOT_PASSED, "Data matches schema from \"not\"", "", "/not")
	}
	return null;
}

// parseURI() and resolveUrl() are from https://gist.github.com/1088850
//   -  released as public domain by author ("Yaffle") - see comments on gist

function parseURI(url) {
	var m = String(url).replace(/^\s+|\s+$/g, '').match(/^([^:\/?#]+:)?(\/\/(?:[^:@]*(?::[^:@]*)?@)?(([^:\/?#]*)(?::(\d*))?))?([^?#]*)(\?[^#]*)?(#[\s\S]*)?/);
	// authority = '//' + user + ':' + pass '@' + hostname + ':' port
	return (m ? {
		href     : m[0] || '',
		protocol : m[1] || '',
		authority: m[2] || '',
		host     : m[3] || '',
		hostname : m[4] || '',
		port     : m[5] || '',
		pathname : m[6] || '',
		search   : m[7] || '',
		hash     : m[8] || ''
	} : null);
}

function resolveUrl(base, href) {// RFC 3986

	function removeDotSegments(input) {
		var output = [];
		input.replace(/^(\.\.?(\/|$))+/, '')
			.replace(/\/(\.(\/|$))+/g, '/')
			.replace(/\/\.\.$/, '/../')
			.replace(/\/?[^\/]*/g, function (p) {
				if (p === '/..') {
					output.pop();
				} else {
					output.push(p);
				}
		});
		return output.join('').replace(/^\//, input.charAt(0) === '/' ? '/' : '');
	}

	href = parseURI(href || '');
	base = parseURI(base || '');

	return !href || !base ? null : (href.protocol || base.protocol) +
		(href.protocol || href.authority ? href.authority : base.authority) +
		removeDotSegments(href.protocol || href.authority || href.pathname.charAt(0) === '/' ? href.pathname : (href.pathname ? ((base.authority && !base.pathname ? '/' : '') + base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1) + href.pathname) : base.pathname)) +
		(href.protocol || href.authority || href.pathname ? href.search : (href.search || base.search)) +
		href.hash;
}

function normSchema(schema, baseUri) {
	if (baseUri == undefined) {
		baseUri = schema.id;
	} else if (typeof schema.id == "string") {
		baseUri = resolveUrl(baseUri, schema.id);
		schema.id = baseUri;
	}
	if (typeof schema == "object") {
		if (Array.isArray(schema)) {
			for (var i = 0; i < schema.length; i++) {
				normSchema(schema[i], baseUri);
			}
		} else if (typeof schema['$ref'] == "string") {
			schema['$ref'] = resolveUrl(baseUri, schema['$ref']);
		} else {
			for (var key in schema) {
				if (key != "enum") {
					normSchema(schema[key], baseUri);
				}
			}
		}
	}
}

var ErrorCodes = {
	INVALID_TYPE: 0,
	ENUM_MISMATCH: 1,
	ANY_OF_MISSING: 10,
	ONE_OF_MISSING: 11,
	ONE_OF_MULTIPLE: 12,
	NOT_PASSED: 13,
	// Numeric errors
	NUMBER_MULTIPLE_OF: 100,
	NUMBER_MINIMUM: 101,
	NUMBER_MINIMUM_EXCLUSIVE: 102,
	NUMBER_MAXIMUM: 103,
	NUMBER_MAXIMUM_EXCLUSIVE: 104,
	// String errors
	STRING_LENGTH_SHORT: 200,
	STRING_LENGTH_LONG: 201,
	STRING_PATTERN: 202,
	// Object errors
	OBJECT_PROPERTIES_MINIMUM: 300,
	OBJECT_PROPERTIES_MAXIMUM: 301,
	OBJECT_REQUIRED: 302,
	OBJECT_ADDITIONAL_PROPERTIES: 303,
	OBJECT_DEPENDENCY_KEY: 304,
	// Array errors
	ARRAY_LENGTH_SHORT: 400,
	ARRAY_LENGTH_LONG: 401,
	ARRAY_UNIQUE: 402,
	ARRAY_ADDITIONAL_ITEMS: 403
};

function ValidationError(code, message, dataPath, schemaPath, subErrors) {
	if (code == undefined) {
		throw new Error ("No code supplied for error: "+ message);
	}
	this.code = code;
	this.message = message;
	this.dataPath = dataPath ? dataPath : "";
	this.schemaPath = schemaPath ? schemaPath : "";
	this.subErrors = subErrors ? subErrors : null;
}
ValidationError.prototype = {
	prefixWith: function (dataPrefix, schemaPrefix) {
		if (dataPrefix != null) {
			dataPrefix = dataPrefix.replace("~", "~0").replace("/", "~1");
			this.dataPath = "/" + dataPrefix + this.dataPath;
		}
		if (schemaPrefix != null) {
			schemaPrefix = schemaPrefix.replace("~", "~0").replace("/", "~1");
			this.schemaPath = "/" + schemaPrefix + this.schemaPath;
		}
		if (this.subErrors != null) {
			for (var i = 0; i < this.subErrors.length; i++) {
				this.subErrors[i].prefixWith(dataPrefix, schemaPrefix);
			}
		}
		return this;
	}
};

function searchForTrustedSchemas(map, schema, url) {
	if (typeof schema.id == "string") {
		if (schema.id.substring(0, url.length) == url) {
			var remainder = schema.id.substring(url.length);
			if ((url.length > 0 && url.charAt(url.length - 1) == "/")
				|| remainder.charAt(0) == "#"
				|| remainder.charAt(0) == "?") {
				if (map[schema.id] == undefined) {
					map[schema.id] = schema;
				}
			}
		}
	}
	if (typeof schema == "object") {
		for (var key in schema) {
			if (key != "enum" && typeof schema[key] == "object") {
				searchForTrustedSchemas(map, schema[key], url);
			}
		}
	}
	return map;
}

var globalContext = new ValidatorContext();

var publicApi = {
	validate: function (data, schema) {
		var context = new ValidatorContext(globalContext);
		if (typeof schema == "string") {
			schema = {"$ref": schema};
		}
		var added = context.addSchema("", schema);
		var error = context.validateAll(data, schema);
		this.error = error;
		this.missing = context.missing;
		this.valid = (error == null);
		return this.valid;
	},
	validateResult: function () {
		var result = {};
		this.validate.apply(result, arguments);
		return result;
	},
	validateMultiple: function (data, schema) {
		var context = new ValidatorContext(globalContext, true);
		if (typeof schema == "string") {
			schema = {"$ref": schema};
		}
		context.addSchema("", schema);
		context.validateAll(data, schema);
		var result = {};
		result.errors = context.errors;
		result.missing = context.missing;
		result.valid = (result.errors.length == 0);
		return result;
	},
	addSchema: function (url, schema) {
		return globalContext.addSchema(url, schema);
	},
	getSchema: function (url) {
		return globalContext.getSchema(url);
	},
	missing: [],
	error: null,
	normSchema: normSchema,
	resolveUrl: resolveUrl,
	errorCodes: ErrorCodes
};

global.tv4 = publicApi;

})(typeof(window) != 'undefined' ? window : global);



/** FILE: lib/Math.uuid.js **/
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


/** FILE: src/baseclient.js **/
(function (global) {

  function deprecate(thing, replacement) {
    console.log('WARNING: ' + thing + ' is deprecated. Use ' +
                replacement + ' instead.');
  }

  var RS = RemoteStorage;

  /**
   * Class: RemoteStorage.BaseClient
   *
   * Provides a high-level interface to access data below a given root path.
   *
   * A BaseClient deals with three types of data: folders, objects and files.
   *
   * <getListing> returns a mapping of all items within a folder. Items that
   * end with a forward slash ("/") are child folders. For instance:
   * {
   *   'folder/': true,
   *   'document.txt': true
   * }
   *
   * <getObject> / <storeObject> operate on JSON objects. Each object has a type.
   *
   * <getFile> / <storeFile> operates on files. Each file has a MIME type.
   *
   * <remove> operates on either objects or files (but not folders, folders are
   * created and removed implictly).
   */
  RS.BaseClient = function (storage, base) {
    if (base[base.length - 1] !== '/') {
      throw "Not a folder: " + base;
    }

    if (base === '/') {
      // allow absolute and relative paths for the root scope.
      this.makePath = function (path) {
        return (path[0] === '/' ? '' : '/') + path;
      };
    }

    /**
     * Property: storage
     *
     * The <RemoteStorage> instance this <BaseClient> operates on.
     */
    this.storage = storage;

    /**
     * Property: base
     *
     * Base path this <BaseClient> operates on.
     *
     * For the module's privateClient this would be /<moduleName>/, for the
     * corresponding publicClient /public/<moduleName>/.
     */
    this.base = base;

    var parts = this.base.split('/');
    if (parts.length > 2) {
      this.moduleName = parts[1];
    } else {
      this.moduleName = 'root';
    }

    // Defined in baseclient/types.js
    /**
     * Property: schemas
     *
     * Contains schema objects of all types known to the BaseClient instance
     **/

    /**
     * Event: change
     *
     * Emitted when a node changes
     *
     * Arguments:
     *   event - Event object containing information about the changed node
     *
     * (start code)
     * {
     *    path: path, // Absolute path of the changed node, from the storage root
     *    relativePath: relativePath, // Path of the changed node, relative to this baseclient's scope root
     *    origin: 'window', 'local', 'remote', or 'conflict' // emitted by user action within the app, local data store, remote sync, or versioning conflicts
     *    oldValue: oldBody, // Old body of the changed node (local version in conflicts; undefined if creation)
     *    newValue: newBody, // New body of the changed node (remote version in conflicts; undefined if deletion)
     *    lastCommonValue: lastCommonValue, //most recent known common ancestor body of 'yours' and 'theirs' in case of conflict
     *    oldContentType: oldContentType, // Old contentType of the changed node ('yours' for conflicts; undefined if creation)
     *    newContentType: newContentType, // New contentType of the changed node ('theirs' for conflicts; undefined if deletion)
     *    lastCommonContentType: lastCommonContentType // Most recent known common ancestor contentType of 'yours' and 'theirs' in case of conflict
     *  }
     * (end code)
     *
     * Example of an event with origin 'local' (fired on page load):
     *
     * (start code)
     * {
     *    path: '/public/design/color.txt',
     *    relativePath: 'color.txt',
     *    origin: 'local',
     *    oldValue: undefined,
     *    newValue: 'white',
     *    oldContentType: undefined,
     *    newContentType: 'text/plain'
     *  }
     * (end code)
     *
     * Example of a conflict:
     * Say you changed 'color.txt' from 'white' to 'blue'; if you have set `RemoteStorage.config.changeEvents.window` to `true`,
     * then you will receive:
     *
     * (start code)
     * {
     *    path: '/public/design/color.txt',
     *    relativePath: 'color.txt',
     *    origin: 'window',
     *    oldValue: 'white',
     *    newValue: 'blue',
     *    oldContentType: 'text/plain',
     *    newContentType: 'text/plain'
     *  }
     * (end code)
     *
     * But when this change is pushed out by asynchronous synchronization, this change may rejected by the
     * server, if the remote version has in the meantime changed from 'white' to  for instance 'red'; this will then lead to a change
     * event with origin 'conflict' (usually a few seconds after the event with origin 'window', if you had that activated). Note
     * that since you already changed it from 'white' to 'blue' in the local version a few seconds ago, `oldValue` is now your local
     * value of 'blue':
     *
     * (start code)
     * {
     *    path: '/public/design/color.txt',
     *    relativePath: 'color.txt',
     *    origin: 'conflict',
     *    oldValue: 'blue',
     *    newValue: 'red',
     *    lastCommonValue: 'white',
     *    oldContentType: 'text/plain,
     *    newContentType: 'text/plain'
     *    lastCommonContentType: 'text/plain'
     *  }
     * (end code)
     *
     * In practice, you should always redraw your views to display the content of the `newValue` field when a change event is received,
     * regardless of its origin. Events with origin 'local' are fired conveniently during the page load, so that you can fill your views
     * when the page loads. Events with origin 'window' are fired whenever you change a value by calling a method on the baseClient;
     * these are disabled by default. Events with origin 'remote' are fired when remote changes are discovered during sync (only for caching
     * startegies 'SEEN' and 'ALL'). Events with origin 'conflict' are fired when a conflict occurs while pushing out your local changes to
     * the remote store in asynchronous synchronization (see example above).
     **/

    RS.eventHandling(this, 'change');
    this.on = this.on.bind(this);
    storage.onChange(this.base, this._fireChange.bind(this));
  };

  RS.BaseClient.prototype = {

    extend: function (object) {
      for (var key in object) {
        this[key] = object[key];
      }
      return this;
    },

    /**
     * Method: scope
     *
     * Returns a new <BaseClient> operating on a subpath of the current <base> path.
     */
    scope: function (path) {
      return new RS.BaseClient(this.storage, this.makePath(path));
    },

    // folder operations

    /**
     * Method: getListing
     *
     * Get a list of child nodes below a given path.
     *
     * The callback semantics of getListing are identical to those of getObject.
     *
     * Parameters:
     *   path   - The path to query. It MUST end with a forward slash.
     *   maxAge - Either false or the maximum age of cached listing in
     *            milliseconds. Defaults to false in anonymous mode and to
     *            2*syncInterval in connected mode.
     *
     * Returns:
     *
     *   A promise for an object, representing child nodes. If the maxAge
     *   requirement cannot be met because of network problems, this promise
     *   will be rejected. If the maxAge requirement is set to false, the
     *   promise will always be fulfilled with data from the local store.
     *
     *   Keys ending in a forward slash represent *folder nodes*, while all
     *   other keys represent *data nodes*.
     *
     *   For spec versions <= 01, the data node information will contain only
     *   the item's ETag. For later spec versions, it will also contain the
     *   content type and -length of the item.
     *
     * Example:
     *   (start code)
     *   client.getListing('', false).then(function (listing) {
     *     // listing is for instance:
     *     // {
     *     //   'folder/': true,
     *     //   'document.txt': true
     *     // }
     *   });
     *   (end code)
     */
    getListing: function (path, maxAge) {
      if (typeof(path) !== 'string') {
        path = '';
      } else if (path.length > 0 && path[path.length - 1] !== '/') {
        Promise.reject("Not a folder: " + path);
      }
      return this.storage.get(this.makePath(path), maxAge).then(
        function (r) {
          return (r.statusCode === 404) ? {} : r.body;
        }
      );
    },

    /**
     * Method: getAll
     *
     * Get all objects directly below a given path.
     *
     * Parameters:
     *   path   - Path to the folder.
     *   maxAge - Either false or the maximum age of cached objects in
     *            milliseconds. Defaults to false in anonymous mode and to
     *            2*syncInterval in connected mode.
     *
     * Returns:
     *   A promise for an object in the form { path : object, ... }. If the
     *   maxAge requirement cannot be met because of network problems, this
     *   promise will be rejected. If the maxAge requirement is set to false,
     *   the promise will always be fulfilled with data from the local store.
     *
     *   For items that are not JSON-stringified objects (e.g. stored using
     *   `storeFile` instead of `storeObject`), the object's value is filled in
     *   with `true`.
     *
     * Example:
     *   (start code)
     *   client.getAll('', false).then(function (objects) {
     *     for (var key in objects) {
     *       console.log('- ' + key + ': ', objects[key]);
     *     }
     *   });
     *   (end code)
     */
    getAll: function (path, maxAge) {
      if (typeof(path) !== 'string') {
        path = '';
      } else if (path.length > 0 && path[path.length - 1] !== '/') {
        return Promise.reject("Not a folder: " + path);
      }

      return this.storage.get(this.makePath(path), maxAge).then(function (r) {
        if (r.statusCode === 404) { return {}; }
        if (typeof(r.body) === 'object') {
          var keys = Object.keys(r.body);
          if (keys.length === 0) {
            // treat this like 404. it probably means a folder listing that
            // has changes that haven't been pushed out yet.
            return {};
          }

          var calls = keys.map(function (key) {
            return this.storage.get(this.makePath(path + key), maxAge)
              .then(function (o) {
                if (typeof(o.body) === 'string') {
                  try {
                    o.body = JSON.parse(o.body);
                  } catch (e) {
                  }
                }
                if (typeof(o.body) === 'object') {
                  r.body[key] = o.body;
                }
              });
          }.bind(this));
          return Promise.all(calls).then(function () {
            return r.body;
          });
        }
      }.bind(this));
    },

    // file operations

    /**
     * Method: getFile
     *
     * Get the file at the given path. A file is raw data, as opposed to
     * a JSON object (use <getObject> for that).
     *
     * Except for the return value structure, getFile works exactly like
     * getObject.
     *
     * Parameters:
     *   path   - See getObject.
     *   maxAge - Either false or the maximum age of cached file in
     *            milliseconds. Defaults to false in anonymous mode and to
     *            2*syncInterval in connected mode.
     *
     * Returns:
     *   A promise for an object:
     *
     *   mimeType - String representing the MIME Type of the document.
     *   data     - Raw data of the document (either a string or an ArrayBuffer)
     *
     *   If the maxAge requirement cannot be met because of network problems, this
     *   promise will be rejected. If the maxAge requirement is set to false, the
     *   promise will always be fulfilled with data from the local store.
     *
     * Example:
     *   (start code)
     *   // Display an image:
     *   client.getFile('path/to/some/image', false).then(function (file) {
     *     var blob = new Blob([file.data], { type: file.mimeType });
     *     var targetElement = document.findElementById('my-image-element');
     *     targetElement.src = window.URL.createObjectURL(blob);
     *   });
     *   (end code)
     */
    getFile: function (path, maxAge) {
      if (typeof(path) !== 'string') {
        return Promise.reject('Argument \'path\' of baseClient.getFile must be a string');
      }
      return this.storage.get(this.makePath(path), maxAge).then(function (r) {
        return {
          data: r.body,
          contentType: r.contentType,
          revision: r.revision // (this is new)
        };
      });
    },

    /**
     * Method: storeFile
     *
     * Store raw data at a given path.
     *
     * Parameters:
     *   mimeType - MIME media type of the data being stored
     *   path     - path relative to the module root. MAY NOT end in a forward slash.
     *   data     - string, ArrayBuffer or ArrayBufferView of raw data to store
     *
     * The given mimeType will later be returned, when retrieving the data
     * using <getFile>.
     *
     * Example (UTF-8 data):
     *   (start code)
     *   client.storeFile('text/html', 'index.html', '<h1>Hello World!</h1>');
     *   (end code)
     *
     * Example (Binary data):
     *   (start code)
     *   // MARKUP:
     *   <input type="file" id="file-input">
     *   // CODE:
     *   var input = document.getElementById('file-input');
     *   var file = input.files[0];
     *   var fileReader = new FileReader();
     *
     *   fileReader.onload = function () {
     *     client.storeFile(file.type, file.name, fileReader.result);
     *   };
     *
     *   fileReader.readAsArrayBuffer(file);
     *   (end code)
     *
     */
    storeFile: function (mimeType, path, body) {
      if (typeof(mimeType) !== 'string') {
        return Promise.reject('Argument \'mimeType\' of baseClient.storeFile must be a string');
      }
      if (typeof(path) !== 'string') {
        return Promise.reject('Argument \'path\' of baseClient.storeFile must be a string');
      }
      if (typeof(body) !== 'string' && typeof(body) !== 'object') {
        return Promise.reject('Argument \'body\' of baseClient.storeFile must be a string, ArrayBuffer, or ArrayBufferView');
      }
      if (!this.storage.access.checkPathPermission(this.makePath(path), 'rw')) {
        console.warn('WARNING: Editing a document to which only read access (\'r\') was claimed');
      }

      return this.storage.put(this.makePath(path), body, mimeType).then(function (r) {
        if (r.statusCode === 200 || r.statusCode === 201) {
          return r.revision;
        } else {
          return Promise.reject("Request (PUT " + this.makePath(path) + ") failed with status: " + r.statusCode);
        }
      }.bind(this));
    },

    // object operations

    /**
     * Method: getObject
     *
     * Get a JSON object from given path.
     *
     * Parameters:
     *   path   - Relative path from the module root (without leading slash).
     *   maxAge - Either false or the maximum age of cached object in
     *            milliseconds. Defaults to false in anonymous mode and to
     *            2*syncInterval in connected mode.
     *
     * Returns:
     *   A promise for the object. If the maxAge requirement cannot be met
     *   because of network problems, this promise will be rejected. If the
     *   maxAge requirement is set to false, the promise will always be
     *   fulfilled with data from the local store.
     *
     * Example:
     *   (start code)
     *   client.getObject('/path/to/object', false).
     *     then(function (object) {
     *       // object is either an object or null
     *     });
     *   (end code)
     */
    getObject: function (path, maxAge) {
      if (typeof(path) !== 'string') {
        return Promise.reject('Argument \'path\' of baseClient.getObject must be a string');
      }
      return this.storage.get(this.makePath(path), maxAge).then(function (r) {
        if (typeof(r.body) === 'object') { // will be the case for documents stored with rs.js <= 0.10.0-beta2
          return r.body;
        } else if (typeof(r.body) === 'string') {
          try {
            return JSON.parse(r.body);
          } catch (e) {
            throw "Not valid JSON: " + this.makePath(path);
          }
        } else if (typeof(r.body) !== 'undefined' && r.statusCode === 200) {
          return Promise.reject("Not an object: " + this.makePath(path));
        }
      }.bind(this));
    },

    /**
     * Method: storeObject
     *
     * Store object at given path. Triggers synchronization.
     *
     * Parameters:
     *
     *   type     - unique type of this object within this module. See description below.
     *   path     - path relative to the module root.
     *   object   - an object to be saved to the given node. It must be serializable as JSON.
     *
     * Returns:
     *   A promise to store the object. The promise fails with a ValidationError, when validations fail.
     *
     *
     * What about the type?:
     *
     *   A great thing about having data on the web, is to be able to link to
     *   it and rearrange it to fit the current circumstances. To facilitate
     *   that, eventually you need to know how the data at hand is structured.
     *   For documents on the web, this is usually done via a MIME type. The
     *   MIME type of JSON objects however, is always application/json.
     *   To add that extra layer of "knowing what this object is", remoteStorage
     *   aims to use <JSON-LD at http://json-ld.org/>.
     *   A first step in that direction, is to add a *@context attribute* to all
     *   JSON data put into remoteStorage.
     *   Now that is what the *type* is for.
     *
     *   Within remoteStorage.js, @context values are built using three components:
     *     http://remotestorage.io/spec/modules/ - A prefix to guarantee uniqueness
     *     the module name     - module names should be unique as well
     *     the type given here - naming this particular kind of object within this module
     *
     *   In retrospect that means, that whenever you introduce a new "type" in calls to
     *   storeObject, you should make sure that once your code is in the wild, future
     *   versions of the code are compatible with the same JSON structure.
     *
     * How to define types?:
     *
     *   See <declareType> for examples.
     */
    storeObject: function (typeAlias, path, object) {
      if (typeof(typeAlias) !== 'string') {
        return Promise.reject('Argument \'typeAlias\' of baseClient.storeObject must be a string');
      }
      if (typeof(path) !== 'string') {
        return Promise.reject('Argument \'path\' of baseClient.storeObject must be a string');
      }
      if (typeof(object) !== 'object') {
        return Promise.reject('Argument \'object\' of baseClient.storeObject must be an object');
      }

      this._attachType(object, typeAlias);

      try {
        var validationResult = this.validate(object);
        if (! validationResult.valid) {
          return Promise.reject(validationResult);
        }
      } catch(exc) {
        return Promise.reject(exc);
      }

      return this.storage.put(this.makePath(path), JSON.stringify(object), 'application/json; charset=UTF-8').then(function (r) {
        if (r.statusCode === 200 || r.statusCode === 201) {
          return r.revision;
        } else {
          return Promise.reject("Request (PUT " + this.makePath(path) + ") failed with status: " + r.statusCode);
        }
      }.bind(this));
    },

    // generic operations

    /**
     * Method: remove
     *
     * Remove node at given path from storage. Triggers synchronization.
     *
     * Parameters:
     *   path     - Path relative to the module root.
     */
    remove: function (path) {
      if (typeof(path) !== 'string') {
        return Promise.reject('Argument \'path\' of baseClient.remove must be a string');
      }
      if (!this.storage.access.checkPathPermission(this.makePath(path), 'rw')) {
        console.warn('WARNING: Removing a document to which only read access (\'r\') was claimed');
      }

      return this.storage.delete(this.makePath(path));
    },


    cache: function (path, strategy) {
      if (typeof(path) !== 'string') {
        throw 'Argument \'path\' of baseClient.cache must be a string';
      }
      if (strategy === false) {
        deprecate('caching strategy <false>', '<"FLUSH">');
        strategy = 'FLUSH';
      } else if (strategy === undefined) {
        strategy = 'ALL';
      } else if (typeof(strategy) !== 'string') {
        deprecate('that caching strategy', '<"ALL">');
        strategy = 'ALL';
      }
      if (strategy !== 'FLUSH' &&
          strategy !== 'SEEN' &&
          strategy !== 'ALL') {
        throw 'Argument \'strategy\' of baseclient.cache must be one of '
            + '["FLUSH", "SEEN", "ALL"]';
      }
      this.storage.caching.set(this.makePath(path), strategy);
      return this;
    },

    flush: function (path) {
      return this.storage.local.flush(path);
    },

    makePath: function (path) {
      return this.base + (path || '');
    },

    _fireChange: function (event) {
      if (RemoteStorage.config.changeEvents[event.origin]) {
        ['new', 'old', 'lastCommon'].forEach(function (fieldNamePrefix) {
          if ((!event[fieldNamePrefix+'ContentType'])
              || (/^application\/(.*)json(.*)/.exec(event[fieldNamePrefix+'ContentType']))) {
            if (typeof(event[fieldNamePrefix+'Value']) === 'string') {
              try {
                event[fieldNamePrefix+'Value'] = JSON.parse(event[fieldNamePrefix+'Value']);
              } catch(e) {
              }
            }
          }
        });
        this._emit('change', event);
      }
    },

    _cleanPath: RS.WireClient.cleanPath,

    /**
     * Method: getItemURL
     *
     * Retrieve full URL of item
     *
     * Parameters:
     *   path     - Path relative to the module root.
     */
    getItemURL: function (path) {
      if (typeof(path) !== 'string') {
        throw 'Argument \'path\' of baseClient.getItemURL must be a string';
      }
      if (this.storage.connected) {
        path = this._cleanPath( this.makePath(path) );
        return this.storage.remote.href + path;
      } else {
        return undefined;
      }
    },

    uuid: function () {
      return Math.uuid();
    }

  };

  /**
   * Method: RS#scope
   *
   * Returns a new <RS.BaseClient> scoped to the given path.
   *
   * Parameters:
   *   path - Root path of new BaseClient.
   *
   *
   * Example:
   *   (start code)
   *
   *   var foo = remoteStorage.scope('/foo/');
   *
   *   // PUTs data "baz" to path /foo/bar
   *   foo.storeFile('text/plain', 'bar', 'baz');
   *
   *   var something = foo.scope('something/');
   *
   *   // GETs listing from path /foo/something/bla/
   *   something.getListing('bla/');
   *
   *   (end code)
   *
   */
  RS.BaseClient._rs_init = function () {
    RS.prototype.scope = function (path) {
      if (typeof(path) !== 'string') {
        throw 'Argument \'path\' of baseClient.scope must be a string';
      }

      if (!this.access.checkPathPermission(path, 'r')) {
        var escapedPath = path.replace(/(['\\])/g, '\\$1');
        console.warn('WARNING: please call remoteStorage.access.claim(\'' + escapedPath + '\', \'r\') (read only) or remoteStorage.access.claim(\'' + escapedPath + '\', \'rw\') (read/write) first');
      }
      return new RS.BaseClient(this, path);
    };
  };

  /* e.g.:
  remoteStorage.defineModule('locations', function (priv, pub) {
    return {
      exports: {
        features: priv.scope('features/').defaultType('feature'),
        collections: priv.scope('collections/').defaultType('feature-collection');
      }
    };
  });
  */

  // Defined in baseclient/types.js
  /**
   * Method: declareType
   *
   * Declare a remoteStorage object type using a JSON schema. See
   * <RemoteStorage.BaseClient.Types>
   **/

})(typeof(window) !== 'undefined' ? window : global);

/** FILE: src/baseclient/types.js **/
(function(global) {

  /**
   * Class: RemoteStorage.BaseClient.Types
   *
   * - Manages and validates types of remoteStorage objects, using JSON-LD and
   *   JSON Schema
   * - Adds schema declaration/validation methods to BaseClient instances.
   **/
  RemoteStorage.BaseClient.Types = {
    // <alias> -> <uri>
    uris: {},
    // <uri> -> <schema>
    schemas: {},
    // <uri> -> <alias>
    aliases: {},

    declare: function(moduleName, alias, uri, schema) {
      var fullAlias = moduleName + '/' + alias;

      if (schema.extends) {
        var extendedAlias;
        var parts = schema.extends.split('/');
        if (parts.length === 1) {
          extendedAlias = moduleName + '/' + parts.shift();
        } else {
          extendedAlias = parts.join('/');
        }
        var extendedUri = this.uris[extendedAlias];
        if (! extendedUri) {
          throw "Type '" + fullAlias + "' tries to extend unknown schema '" + extendedAlias + "'";
        }
        schema.extends = this.schemas[extendedUri];
      }

      this.uris[fullAlias] = uri;
      this.aliases[uri] = fullAlias;
      this.schemas[uri] = schema;
    },

    resolveAlias: function(alias) {
      return this.uris[alias];
    },

    getSchema: function(uri) {
      return this.schemas[uri];
    },

    inScope: function(moduleName) {
      var ml = moduleName.length;
      var schemas = {};
      for (var alias in this.uris) {
        if (alias.substr(0, ml + 1) === moduleName + '/') {
          var uri = this.uris[alias];
          schemas[uri] = this.schemas[uri];
        }
      }
      return schemas;
    }
  };

  var SchemaNotFound = function(uri) {
    var error = new Error("Schema not found: " + uri);
    error.name = "SchemaNotFound";
    return error;
  };

  SchemaNotFound.prototype = Error.prototype;

  RemoteStorage.BaseClient.Types.SchemaNotFound = SchemaNotFound;

  /**
   * Class: RemoteStorage.BaseClient
   **/
  RemoteStorage.BaseClient.prototype.extend({
    /**
     * Method: declareType
     *
     * Declare a remoteStorage object type using a JSON schema.
     *
     * Parameters:
     *   alias  - A type alias/shortname
     *   uri    - (optional) JSON-LD URI of the schema. Automatically generated if none given
     *   schema - A JSON Schema object describing the object type
     *
     * Example:
     *
     * (start code)
     * client.declareType('todo-item', {
     *   "type": "object",
     *   "properties": {
     *     "id": {
     *       "type": "string"
     *     },
     *     "title": {
     *       "type": "string"
     *     },
     *     "finished": {
     *       "type": "boolean"
     *       "default": false
     *     },
     *     "createdAt": {
     *       "type": "date"
     *     }
     *   },
     *   "required": ["id", "title"]
     * })
     * (end code)
     *
     * Visit <http://json-schema.org> for details on how to use JSON Schema.
     **/
    declareType: function(alias, uri, schema) {
      if (! schema) {
        schema = uri;
        uri = this._defaultTypeURI(alias);
      }
      RemoteStorage.BaseClient.Types.declare(this.moduleName, alias, uri, schema);
    },

    /**
     * Method: validate
     *
     * Validate an object against the associated schema.
     *
     * Parameters:
     *  object - Object to validate. Must have a @context property.
     *
     * Returns:
     *   An object containing information about validation errors
     **/
    validate: function(object) {
      var schema = RemoteStorage.BaseClient.Types.getSchema(object['@context']);
      if (schema) {
        return tv4.validateResult(object, schema);
      } else {
        throw new SchemaNotFound(object['@context']);
      }
    },

    _defaultTypeURI: function(alias) {
      return 'http://remotestorage.io/spec/modules/' + encodeURIComponent(this.moduleName) + '/' + encodeURIComponent(alias);
    },

    _attachType: function(object, alias) {
      object['@context'] = RemoteStorage.BaseClient.Types.resolveAlias(this.moduleName + '/' + alias) || this._defaultTypeURI(alias);
    }
  });

  // Documented in baseclient.js
  Object.defineProperty(RemoteStorage.BaseClient.prototype, 'schemas', {
    configurable: true,
    get: function() {
      return RemoteStorage.BaseClient.Types.inScope(this.moduleName);
    }
  });

})(typeof(window) !== 'undefined' ? window : global);


/** FILE: src/caching.js **/
  /**
   * Class: RemoteStorage.Caching
   *
   * Holds/manages caching configuration.
   *
   * Caching strategies:
   *
   *   For each subtree, you can set the caching strategy to 'ALL',
   *   'SEEN' (default), and 'FLUSH'.
   *
   *   - 'ALL' means that once all outgoing changes have been pushed, sync
   *         will start retrieving nodes to cache pro-actively. If a local
   *         copy exists of everything, it will check on each sync whether
   *         the ETag of the root folder changed, and retrieve remote changes
   *         if they exist.
   *   - 'SEEN' does this only for documents and folders that have been either
   *         read from or written to at least once since connecting to the current
   *         remote backend, plus their parent/ancestor folders up to the root
   *         (to make tree-based sync possible).
   *   - 'FLUSH' will only cache outgoing changes, and forget them as soon as
   *         they have been saved to remote successfully.
   *
   **/

(function (global) {
  var SETTINGS_KEY = "remotestorage:caching";

  var containingFolder = RemoteStorage.util.containingFolder;

  RemoteStorage.Caching = function () {
    this.reset();
  };

  RemoteStorage.Caching.prototype = {
    pendingActivations: [],

    /**
     * Method: set
     *
     * Set the caching strategy for a given path explicitly.
     *
     * Not needed when using <enable>/<disable>.
     *
     * Parameters:
     *   path  - Path to cache
     *   value - Caching strategy. One of 'ALL', 'SEEN', or 'FLUSH'.
     *
     * Example:
     *   (start code)
     *   remoteStorage.caching.set('/bookmarks/archive')
     */
    set: function (path, value) {
      if (typeof(path) !== 'string') {
        throw new Error('path should be a string');
      }
      if (typeof(value) === 'undefined') {
        throw new Error("value should be 'FLUSH', 'SEEN', or 'ALL'");
      }

      this._rootPaths[path] = value;

      if (value === 'ALL') {
        if (this.activateHandler) {
          this.activateHandler(path);
        } else {
          this.pendingActivations.push(path);
        }
      }
    },

    /**
     * Method: enable
     *
     * Enable caching for a given path.
     *
     * Uses caching strategy 'ALL'.
     *
     * Parameters:
     *   path - Path to enable caching for
     */
    enable: function (path) {
      this.set(path, 'ALL');
    },

    /**
     * Method: disable
     *
     * Disable caching for a given path.
     *
     * Uses caching strategy 'FLUSH' (meaning items are only cached until
     * successfully pushed to the remote).
     *
     * Parameters:
     *   path - Path to disable caching for
     */
    disable: function (path) {
      this.set(path, 'FLUSH');
    },

    /**
     * Method: onActivate
     *
     * Set a callback for when caching is activated for a path.
     *
     * Parameters:
     *   callback - Callback function
     */
    onActivate: function (cb) {
      var i;
      RemoteStorage.log('[Caching] Setting activate handler', cb, this.pendingActivations);
      this.activateHandler = cb;
      for (i=0; i<this.pendingActivations.length; i++) {
        cb(this.pendingActivations[i]);
      }
      delete this.pendingActivations;
    },

    /**
     * Method: checkPath
     *
     * Retrieve caching setting for a given path, or its next parent
     * with a caching strategy set.
     *
     * Parameters:
     *   path - Path to retrieve setting for
     **/
    checkPath: function (path) {
      if (this._rootPaths[path] !== undefined) {
        return this._rootPaths[path];
      } else if (path === '/') {
        return 'SEEN';
      } else {
        return this.checkPath(containingFolder(path));
      }
    },

    /**
     * Method: reset
     *
     * Reset the state of caching by deleting all caching information.
     **/
    reset: function () {
      this._rootPaths = {};
    }
  };

  // TODO clean up/harmonize how modules are loaded and/or document this architecture properly
  //
  // At this point the global remoteStorage object has not been created yet.
  // Only its prototype exists so far, so we define a self-constructing
  // property on there:
  Object.defineProperty(RemoteStorage.prototype, 'caching', {
    configurable: true,
    get: function () {
      var caching = new RemoteStorage.Caching();
      Object.defineProperty(this, 'caching', {
        value: caching
      });
      return caching;
    }
  });

  RemoteStorage.Caching._rs_init = function () {};

})(typeof(window) !== 'undefined' ? window : global);


/** FILE: src/sync.js **/
(function (global) {

  var syncInterval = 10000,
      backgroundSyncInterval = 60000,
      isBackground = false;

  var isFolder = RemoteStorage.util.isFolder;
  var isDocument = RemoteStorage.util.isDocument;
  var equal = RemoteStorage.util.equal;
  var deepClone = RemoteStorage.util.deepClone;
  var pathsFromRoot = RemoteStorage.util.pathsFromRoot;

  function taskFor(action, path, promise) {
    return {
      action:  action,
      path:    path,
      promise: promise
    };
  }

  function isStaleChild(node) {
    return node.remote && node.remote.revision && !node.remote.itemsMap && !node.remote.body;
  }

  function hasCommonRevision(node) {
    return node.common && node.common.revision;
  }

  function handleVisibility() {
    var hidden,
        visibilityChange,
        rs = this;

    function handleVisibilityChange(fg) {
      var oldValue, newValue;
      oldValue = rs.getCurrentSyncInterval();
      isBackground = !fg;
      newValue = rs.getCurrentSyncInterval();
      rs._emit('sync-interval-change', {oldValue: oldValue, newValue: newValue});
    }

    RemoteStorage.Env.on("background", function () {
      handleVisibilityChange(false);
    });

    RemoteStorage.Env.on("foreground", function () {
      handleVisibilityChange(true);
    });
  }

  /**
   * Check if interval is valid: numeric and between 1000ms and 3600000ms
   *
   */
  function isValidInterval(interval) {
    return (typeof interval === 'number' && interval > 1000 && interval < 3600000);
  }

  /**
   * Class: RemoteStorage.Sync
   **/
  RemoteStorage.Sync = function (setLocal, setRemote, setAccess, setCaching) {
    this.local = setLocal;
    this.local.onDiff(function (path) {
      this.addTask(path);
      this.doTasks();
    }.bind(this));
    this.remote = setRemote;
    this.access = setAccess;
    this.caching = setCaching;
    this._tasks = {};
    this._running = {};
    this._timeStarted = {};
    RemoteStorage.eventHandling(this, 'done', 'req-done');
    this.caching.onActivate(function (path) {
      this.addTask(path);
      this.doTasks();
    }.bind(this));
  };

  RemoteStorage.Sync.prototype = {

    now: function () {
      return new Date().getTime();
    },

    queueGetRequest: function (path) {
      var pending = Promise.defer();
      if (!this.remote.connected) {
        pending.reject('cannot fulfill maxAge requirement - remote is not connected');
      } else if (!this.remote.online) {
        pending.reject('cannot fulfill maxAge requirement - remote is not online');
      } else {
        this.addTask(path, function () {
          this.local.get(path).then(function (r) {
            return pending.resolve(r);
          });
        }.bind(this));

        this.doTasks();
      }
      return pending.promise;
    },

    corruptServerItemsMap: function (itemsMap, force02) {
      if ((typeof(itemsMap) !== 'object') || (Array.isArray(itemsMap))) {
        return true;
      }

      for (var itemName in itemsMap) {
        var item = itemsMap[itemName];

        if (typeof(item) !== 'object') {
          return true;
        }
        if (typeof(item.ETag) !== 'string') {
          return true;
        }
        if (isFolder(itemName)) {
          if (itemName.substring(0, itemName.length-1).indexOf('/') !== -1) {
            return true;
          }
        } else {
          if (itemName.indexOf('/') !== -1) {
            return true;
          }
          if (force02) {
            if (typeof(item['Content-Type']) !== 'string') {
              return true;
            }
            if (typeof(item['Content-Length']) !== 'number') {
              return true;
            }
          }
        }
      }

      return false;
    },

    corruptItemsMap: function (itemsMap) {
      if ((typeof(itemsMap) !== 'object') || (Array.isArray(itemsMap))) {
        return true;
      }

      for (var itemName in itemsMap) {
        if (typeof(itemsMap[itemName]) !== 'boolean') {
          return true;
        }
      }

      return false;
    },

    corruptRevision: function (rev) {
      return ((typeof(rev) !== 'object') ||
              (Array.isArray(rev)) ||
              (rev.revision && typeof(rev.revision) !== 'string') ||
              (rev.body && typeof(rev.body) !== 'string' && typeof(rev.body) !== 'object') ||
              (rev.contentType && typeof(rev.contentType) !== 'string') ||
              (rev.contentLength && typeof(rev.contentLength) !== 'number') ||
              (rev.timestamp && typeof(rev.timestamp) !== 'number') ||
              (rev.itemsMap && this.corruptItemsMap(rev.itemsMap)));
    },

    isCorrupt: function (node) {
      return ((typeof(node) !== 'object') ||
              (Array.isArray(node)) ||
              (typeof(node.path) !== 'string') ||
              (this.corruptRevision(node.common)) ||
              (node.local && this.corruptRevision(node.local)) ||
              (node.remote && this.corruptRevision(node.remote)) ||
              (node.push && this.corruptRevision(node.push)));
    },

    hasTasks: function () {
      return Object.getOwnPropertyNames(this._tasks).length > 0;
    },

    collectDiffTasks: function () {
      var num = 0;

      return this.local.forAllNodes(function (node) {

        if (num > 100) {
          return;
        }

        if (this.isCorrupt(node)) {
          RemoteStorage.log('[Sync] WARNING: corrupt node in local cache', node);
          if (typeof(node) === 'object' && node.path) {
            this.addTask(node.path);
            num++;
          }
        } else if (this.needsFetch(node) && this.access.checkPathPermission(node.path, 'r')) {
          this.addTask(node.path);
          num++;
        } else if (isDocument(node.path) && this.needsPush(node) &&
                   this.access.checkPathPermission(node.path, 'rw')) {
          this.addTask(node.path);
          num++;
        }
      }.bind(this)).then(function () {
        return num;
      }, function (err) {
        throw err;
      });
    },

    inConflict: function (node) {
      return (node.local && node.remote &&
              (node.remote.body !== undefined || node.remote.itemsMap));
    },

    needsRefresh: function (node) {
      if (node.common) {
        if (!node.common.timestamp) {
          return true;
        }
        return (this.now() - node.common.timestamp > syncInterval);
      }
      return false;
    },

    needsFetch: function (node) {
      if (this.inConflict(node)) {
        return true;
      }
      if (node.common && node.common.itemsMap === undefined && node.common.body === undefined) {
        return true;
      }
      if (node.remote && node.remote.itemsMap === undefined && node.remote.body === undefined) {
        return true;
      }
      return false;
    },

    needsPush: function (node) {
      if (this.inConflict(node)) {
        return false;
      }
      if (node.local && !node.push) {
        return true;
      }
    },

    needsRemotePut: function (node) {
      return node.local && node.local.body;
    },

    needsRemoteDelete: function (node) {
      return node.local && node.local.body === false;
    },

    getParentPath: function (path) {
      var parts = path.match(/^(.*\/)([^\/]+\/?)$/);

      if (parts) {
        return parts[1];
      } else {
        throw new Error('Not a valid path: "'+path+'"');
      }
    },

    deleteChildPathsFromTasks: function () {
      for (var path in this._tasks) {
        paths = pathsFromRoot(path);

        for (var i=1; i<paths.length; i++) {
          if (this._tasks[paths[i]]) {
            delete this._tasks[path];
          }
        }
      }
    },

    collectRefreshTasks: function () {
      return this.local.forAllNodes(function (node) {
        var parentPath;
        if (this.needsRefresh(node)) {
          try {
            parentPath = this.getParentPath(node.path);
          } catch(e) {
            // node.path is already '/', can't take parentPath
          }
          if (parentPath && this.access.checkPathPermission(parentPath, 'r')) {
            this.addTask(parentPath);
          } else if (this.access.checkPathPermission(node.path, 'r')) {
            this.addTask(node.path);
          }
        }
      }.bind(this)).then(function () {
        this.deleteChildPathsFromTasks();
      }.bind(this), function (err) {
        throw err;
      });
    },

    flush: function (nodes) {
      for (var path in nodes) {
        // Strategy is 'FLUSH' and no local changes exist
        if (this.caching.checkPath(path) === 'FLUSH' && nodes[path] && !nodes[path].local) {
          RemoteStorage.log('[Sync] Flushing', path);
          nodes[path] = undefined; // Cause node to be flushed from cache
        }
      }
      return nodes;
    },

    doTask: function (path) {
      return this.local.getNodes([path]).then(function (nodes) {
        var node = nodes[path];
        // First fetch:
        if (typeof(node) === 'undefined') {
          return taskFor('get', path, this.remote.get(path));
        }
        // Fetch known-stale child:
        else if (isStaleChild(node)) {
          return taskFor('get', path, this.remote.get(path));
        }
        // Push PUT:
        else if (this.needsRemotePut(node)) {
          node.push = deepClone(node.local);
          node.push.timestamp = this.now();

          return this.local.setNodes(this.flush(nodes)).then(function () {
            var options;
            if (hasCommonRevision(node)) {
              options = { ifMatch: node.common.revision };
            } else {
              // Initial PUT (fail if something is already there)
              options = { ifNoneMatch: '*' };
            }

            return taskFor('put', path,
              this.remote.put(path, node.push.body, node.push.contentType, options)
            );
          }.bind(this));
        }
        // Push DELETE:
        else if (this.needsRemoteDelete(node)) {
          node.push = { body: false, timestamp: this.now() };

          return this.local.setNodes(this.flush(nodes)).then(function () {
            if (hasCommonRevision(node)) {
              return taskFor('delete', path,
                this.remote.delete(path, { ifMatch: node.common.revision })
              );
            } else { // Ascertain current common or remote revision first
              return taskFor('get', path, this.remote.get(path));
            }
          }.bind(this));
        }
        // Conditional refresh:
        else if (hasCommonRevision(node)) {
          return taskFor('get', path,
            this.remote.get(path, { ifNoneMatch: node.common.revision })
          );
        }
        else {
          return taskFor('get', path, this.remote.get(path));
        }
      }.bind(this));
    },

    autoMergeFolder: function (node) {
      if (node.remote.itemsMap) {
        node.common = node.remote;
        delete node.remote;

        if (node.common.itemsMap) {
          for (var itemName in node.common.itemsMap) {
            if (!node.local.itemsMap[itemName]) {
              // Indicates the node is either newly being fetched
              // has been deleted locally (whether or not leading to conflict);
              // before listing it in local listings, check if a local deletion
              // exists.
              node.local.itemsMap[itemName] = false;
            }
          }

          if (equal(node.local.itemsMap, node.common.itemsMap)) {
            delete node.local;
          }
        }
      }
      return node;
    },

    autoMergeDocument: function (node) {
      hasNoRemoteChanges = function (node) {
        if (node.remote && node.remote.revision && node.remote.revision !== node.common.revision) {
          return false;
        }
        return (node.common.body === undefined && node.remote.body === false) ||
               (node.remote.body === node.common.body &&
                node.remote.contentType === node.common.contentType);
      };
      mergeMutualDeletion = function (node) {
        if (node.remote && node.remote.body === false
            && node.local && node.local.body === false) {
           delete node.local;
        }
        return node;
      };

      if (hasNoRemoteChanges(node)) {
        node = mergeMutualDeletion(node);
        delete node.remote;
      } else if (node.remote.body !== undefined) {
        // keep/revert:
        RemoteStorage.log('[Sync] Emitting keep/revert');

        this.local._emitChange({
          origin:         'conflict',
          path:           node.path,
          oldValue:       node.local.body,
          newValue:       node.remote.body,
          lastCommonValue: node.common.body,
          oldContentType: node.local.contentType,
          newContentType: node.remote.contentType,
          lastCommonContentType: node.common.contentType
        });

        if (node.remote.body) {
          node.common = node.remote;
        } else {
          node.common = {};
        }
        delete node.remote;
        delete node.local;
      }
      return node;
    },

    autoMerge: function (node) {
      if (node.remote) {
        if (node.local) {
          if (isFolder(node.path)) {
            return this.autoMergeFolder(node);
          } else {
            return this.autoMergeDocument(node);
          }
        } else { // no local changes
          if (isFolder(node.path)) {
            if (node.remote.itemsMap !== undefined) {
              node.common = node.remote;
              delete node.remote;
            }
          } else {
            if (node.remote.body !== undefined) {
              var change = {
                origin:   'remote',
                path:     node.path,
                oldValue: (node.common.body === false ? undefined : node.common.body),
                newValue: (node.remote.body === false ? undefined : node.remote.body),
                oldContentType: node.common.contentType,
                newContentType: node.remote.contentType
              };
              if (change.oldValue || change.newValue) {
                this.local._emitChange(change);
              }

              if (!node.remote.body) { // no remote, so delete/don't create
                return;
              }

              node.common = node.remote;
              delete node.remote;
            }
          }
        }
      } else {
        if (node.common.body) {
          this.local._emitChange({
            origin:   'remote',
            path:     node.path,
            oldValue: node.common.body,
            newValue: undefined,
            oldContentType: node.common.contentType,
            newContentType: undefined
          });
        }

        return undefined;
      }
      return node;
    },

    updateCommonTimestamp: function (path, revision) {
      return this.local.getNodes([path]).then(function (nodes) {
        if (nodes[path] && nodes[path].common && nodes[path].common.revision === revision) {
          nodes[path].common.timestamp = this.now();
        }
        return this.local.setNodes(this.flush(nodes));
      }.bind(this));
    },

    markChildren: function (path, itemsMap, changedNodes, missingChildren) {
      var paths = [];
      var meta = {};
      var recurse = {};

      for (var item in itemsMap) {
        paths.push(path+item);
        meta[path+item] = itemsMap[item];
      }
      for (var childName in missingChildren) {
        paths.push(path+childName);
      }

      return this.local.getNodes(paths).then(function (nodes) {
        var cachingStrategy;
        var node;

        nodeChanged = function (node, etag) {
          return node.common.revision !== etag && (!node.remote || node.remote.revision !== etag);
        };

        for (var nodePath in nodes) {
          node = nodes[nodePath];

          if (meta[nodePath]) {
            if (node && node.common) {
              if (nodeChanged(node, meta[nodePath].ETag)) {
                changedNodes[nodePath] = deepClone(node);
                changedNodes[nodePath].remote = {
                  revision:  meta[nodePath].ETag,
                  timestamp: this.now()
                };
                changedNodes[nodePath] = this.autoMerge(changedNodes[nodePath]);
              }
            } else {
              cachingStrategy = this.caching.checkPath(nodePath);
              if (cachingStrategy === 'ALL') {
                changedNodes[nodePath] = {
                  path: nodePath,
                  common: {
                    timestamp: this.now()
                  },
                  remote: {
                    revision: meta[nodePath].ETag,
                    timestamp: this.now()
                  }
                };
              }
            }

            if (changedNodes[nodePath] && meta[nodePath]['Content-Type']) {
              changedNodes[nodePath].remote.contentType = meta[nodePath]['Content-Type'];
            }

            if (changedNodes[nodePath] && meta[nodePath]['Content-Length']) {
              changedNodes[nodePath].remote.contentLength = meta[nodePath]['Content-Length'];
            }
          } else if (missingChildren[nodePath.substring(path.length)] && node && node.common) {
            if (node.common.itemsMap) {
              for (var commonItem in node.common.itemsMap) {
                recurse[nodePath+commonItem] = true;
              }
            }

            if (node.local && node.local.itemsMap) {
              for (var localItem in node.local.itemsMap) {
                recurse[nodePath+localItem] = true;
              }
            }

            if (node.remote || isFolder(nodePath)) {
              changedNodes[nodePath] = undefined;
            } else {
              changedNodes[nodePath] = this.autoMerge(node);

              if (typeof changedNodes[nodePath] === 'undefined') {
                var parentPath = this.getParentPath(nodePath);
                var parentNode = changedNodes[parentPath];
                var itemName = nodePath.substring(path.length);
                if (parentNode && parentNode.local) {
                  delete parentNode.local.itemsMap[itemName];

                  if (equal(parentNode.local.itemsMap, parentNode.common.itemsMap)) {
                    delete parentNode.local;
                  }
                }
              }
            }
          }
        }

        return this.deleteRemoteTrees(Object.keys(recurse), changedNodes).then(function (changedObjs2) {
          return this.local.setNodes(this.flush(changedObjs2));
        }.bind(this));
      }.bind(this));
    },

    deleteRemoteTrees: function (paths, changedNodes) {
      if (paths.length === 0) {
        return Promise.resolve(changedNodes);
      }

      return this.local.getNodes(paths).then(function (nodes) {
        var subPaths = {};

        collectSubPaths = function (folder, path) {
          if (folder && folder.itemsMap) {
            for (var itemName in folder.itemsMap) {
              subPaths[path+itemName] = true;
            }
          }
        };

        for (var path in nodes) {
          var node = nodes[path];

          // TODO Why check for the node here? I don't think this check ever applies
          if (!node) {
            continue;
          }

          if (isFolder(path)) {
            collectSubPaths(node.common, path);
            collectSubPaths(node.local, path);
          } else {
            if (node.common && typeof(node.common.body) !== undefined) {
              changedNodes[path] = deepClone(node);
              changedNodes[path].remote = {
                body:      false,
                timestamp: this.now()
              };
              changedNodes[path] = this.autoMerge(changedNodes[path]);
            }
          }
        }

        // Recurse whole tree depth levels at once:
        return this.deleteRemoteTrees(Object.keys(subPaths), changedNodes).then(function (changedNodes2) {
          return this.local.setNodes(this.flush(changedNodes2));
        }.bind(this));
      }.bind(this));
    },

    completeFetch: function (path, bodyOrItemsMap, contentType, revision) {
      var paths;
      var parentPath;
      var pathsFromRootArr = pathsFromRoot(path);

      if (isFolder(path)) {
        paths = [path];
      } else {
        parentPath = pathsFromRootArr[1];
        paths = [path, parentPath];
      }

      return this.local.getNodes(paths).then(function (nodes) {
        var itemName;
        var missingChildren = {};
        var node = nodes[path];
        var parentNode;

        collectMissingChildren = function (folder) {
          if (folder && folder.itemsMap) {
            for (var itemName in folder.itemsMap) {
              if (!bodyOrItemsMap[itemName]) {
                missingChildren[itemName] = true;
              }
            }
          }
        };

        if (typeof(node) !== 'object'  || node.path !== path ||
            typeof(node.common) !== 'object') {
          node = {
            path: path,
            common: {}
          };
          nodes[path] = node;
        }

        node.remote = {
          revision: revision,
          timestamp: this.now()
        };

        if (isFolder(path)) {
          collectMissingChildren(node.common);
          collectMissingChildren(node.remote);

          node.remote.itemsMap = {};
          for (itemName in bodyOrItemsMap) {
            node.remote.itemsMap[itemName] = true;
          }
        } else {
          node.remote.body = bodyOrItemsMap;
          node.remote.contentType = contentType;

          parentNode = nodes[parentPath];
          if (parentNode && parentNode.local && parentNode.local.itemsMap) {
            itemName = path.substring(parentPath.length);
            parentNode.local.itemsMap[itemName] = true;
            if (equal(parentNode.local.itemsMap, parentNode.common.itemsMap)) {
              delete parentNode.local;
            }
          }
        }

        nodes[path] = this.autoMerge(node);
        return {
          toBeSaved:       nodes,
          missingChildren: missingChildren
        };
      }.bind(this));
    },

    completePush: function (path, action, conflict, revision) {
      return this.local.getNodes([path]).then(function (nodes) {
        var node = nodes[path];

        if (!node.push) {
          this.stopped = true;
          throw new Error('completePush called but no push version!');
        }

        if (conflict) {
          RemoteStorage.log('[Sync] We have a conflict');

          if (!node.remote || node.remote.revision !== revision) {
            node.remote = {
              revision:  revision || 'conflict',
              timestamp: this.now()
            };
            delete node.push;
          }

          nodes[path] = this.autoMerge(node);
        } else {
          node.common = {
            revision:  revision,
            timestamp: this.now()
          };

          if (action === 'put') {
            node.common.body = node.push.body;
            node.common.contentType = node.push.contentType;

            if (equal(node.local.body, node.push.body) &&
                node.local.contentType === node.push.contentType) {
              delete node.local;
            }

            delete node.push;
          } else if (action === 'delete') {
            if (node.local.body === false) { // No new local changes since push; flush it.
              nodes[path] = undefined;
            } else {
              delete node.push;
            }
          }
        }

        return this.local.setNodes(this.flush(nodes));
      }.bind(this));
    },

    dealWithFailure: function (path, action, statusMeaning) {
      return this.local.getNodes([path]).then(function (nodes) {
        if (nodes[path]) {
          delete nodes[path].push;
          return this.local.setNodes(this.flush(nodes));
        }
      }.bind(this));
    },

    interpretStatus: function (statusCode) {
      // if (typeof statusCode.length === 'number') {
      //   statusCode = statusCode[0];
      // }
      if (statusCode === 'offline' || statusCode === 'timeout') {
        return {
          successful:      false,
          networkProblems: true,
          statusCode: statusCode
        };
      }

      var series = Math.floor(statusCode / 100);

      return {
        successful: (series === 2 || statusCode === 304 || statusCode === 412 || statusCode === 404),
        conflict:   (statusCode === 412),
        unAuth:     ((statusCode === 401 && this.remote.token !== RemoteStorage.Authorize.IMPLIED_FAKE_TOKEN) ||
                     statusCode === 402 || statusCode === 403),
        notFound:   (statusCode === 404),
        changed:    (statusCode !== 304),
        statusCode: statusCode
      };
    },

    handleGetResponse: function (path, status, bodyOrItemsMap, contentType, revision) {
      if (status.notFound) {
        if (isFolder(path)) {
          bodyOrItemsMap = {};
        } else {
          bodyOrItemsMap = false;
        }
      }

      if (status.changed) {
        return this.completeFetch(path, bodyOrItemsMap, contentType, revision).then(function (dataFromFetch) {
          if (isFolder(path)) {
            if (this.corruptServerItemsMap(bodyOrItemsMap)) {
              RemoteStorage.log('[Sync] WARNING: Discarding corrupt folder description from server for ' + path);
              return false;
            } else {
              return this.markChildren(path, bodyOrItemsMap, dataFromFetch.toBeSaved, dataFromFetch.missingChildren).then(function () {
                return true;
              });
            }
          } else {
            return this.local.setNodes(this.flush(dataFromFetch.toBeSaved)).then(function () {
              return true;
            });
          }
        }.bind(this));
      } else {
        return this.updateCommonTimestamp(path, revision).then(function () {
          return true;
        });
      }
    },

    handleResponse: function (path, action, r) {
      var status = this.interpretStatus(r.statusCode);
      if (status.successful) {
        if (action === 'get') {
          return this.handleGetResponse(path, status, r.body, r.contentType, r.revision);
        } else if (action === 'put' || action === 'delete') {
          return this.completePush(path, action, status.conflict, r.revision).then(function () {
            return true;
          });
        } else {
          throw new Error('cannot handle response for unknown action', action);
        }
      } else {
      // Unsuccessful
        var error;
        if (status.unAuth) {
          error = new RemoteStorage.Unauthorized();
        } else if (status.networkProblems) {
          error = new RemoteStorage.SyncError('Network request failed.');
          this.remote.online = false;
        } else {
          error = new Error('HTTP response code ' + status.statusCode + ' received.');
        }

        return this.dealWithFailure(path, action, status).then(function () {
          remoteStorage._emit('error', error);
          throw error;
        });
      }
    },

    numThreads: 10,

    finishTask: function (task) {
      if (task.action === undefined) {
        delete this._running[task.path];
        return;
      }
      var self = this;

      return task.promise.then(function (r) {
        return self.handleResponse(task.path, task.action, r);
      }, function (err) {
        RemoteStorage.log('[Sync] wireclient rejects its promise!', task.path, task.action, err);
        return self.handleResponse(task.path, task.action, {statusCode: 'offline'});
      })

      .then(function (completed) {
        delete self._timeStarted[task.path];
        delete self._running[task.path];
        self.remote.online = true;

        if (completed) {
          if (self._tasks[task.path]) {
            for (i=0; i<self._tasks[task.path].length; i++) {
              self._tasks[task.path][i]();
            }
            delete self._tasks[task.path];
          }
        }

        self._emit('req-done');

        self.collectTasks(false).then(function () {
          // See if there are any more tasks that are not refresh tasks
          if (!self.hasTasks() || self.stopped) {
            RemoteStorage.log('[Sync] Sync is done! Reschedule?', Object.getOwnPropertyNames(self._tasks).length, self.stopped);
            if (!self.done) {
              self.done = true;
              self._emit('done');
            }
          } else {
            // Use a 10ms timeout to let the JavaScript runtime catch its breath
            // (and hopefully force an IndexedDB auto-commit?), and also to cause
            // the threads to get staggered and get a good spread over time:
            setTimeout(function () {
              self.doTasks();
            }, 10);
          }
        });
      }, function (err) {
        console.error('[Sync] Error', err);
        delete self._timeStarted[task.path];
        delete self._running[task.path];
        self._emit('req-done');
        if (!self.done) {
          self.done = true;
          self._emit('done');
        }
      });
    },

    doTasks: function () {
      var numToHave, numAdded = 0, numToAdd, path;
      if (this.remote.connected) {
        if (this.remote.online) {
          numToHave = this.numThreads;
        } else {
          numToHave = 1;
        }
      } else {
        numToHave = 0;
      }
      numToAdd = numToHave - Object.getOwnPropertyNames(this._running).length;
      if (numToAdd <= 0) {
        return true;
      }
      for (path in this._tasks) {
        if (!this._running[path]) {
          this._timeStarted = this.now();
          this._running[path] = this.doTask(path);
          this._running[path].then(this.finishTask.bind(this));
          numAdded++;
          if (numAdded >= numToAdd) {
            return true;
          }
        }
      }
      return (numAdded >= numToAdd);
    },

    collectTasks: function (alsoCheckRefresh) {
      if (this.hasTasks() || this.stopped) {
        return Promise.resolve();
      }

      return this.collectDiffTasks().then(function (numDiffs) {
        if (numDiffs || alsoCheckRefresh === false) {
          return Promise.resolve();
        } else {
          return this.collectRefreshTasks();
        }
      }.bind(this), function (err) {
        throw err;
      });
    },

    addTask: function (path, cb) {
      if (!this._tasks[path]) {
        this._tasks[path] = [];
      }
      if (typeof(cb) === 'function') {
        this._tasks[path].push(cb);
      }
    },

    /**
     * Method: sync
     **/
    sync: function () {
      this.done = false;

      if (!this.doTasks()) {
        return this.collectTasks().then(function () {
          try {
            this.doTasks();
          } catch(e) {
            console.error('[Sync] doTasks error', e);
          }
        }.bind(this), function (e) {
          console.error('[Sync] Sync error', e);
          throw new Error('Local cache unavailable');
        });
      } else {
        return Promise.resolve();
      }
    },
  };

  /**
   * Method: getSyncInterval
   *
   * Get the value of the sync interval when application is in the foreground
   *
   * Returns a number of milliseconds
   *
   */
  RemoteStorage.prototype.getSyncInterval = function () {
    return syncInterval;
  };

  /**
   * Method: setSyncInterval
   *
   * Set the value of the sync interval when application is in the foreground
   *
   * Parameters:
   *   interval - sync interval in milliseconds
   *
   */
  RemoteStorage.prototype.setSyncInterval = function (interval) {
    if (!isValidInterval(interval)) {
      throw interval + " is not a valid sync interval";
    }
    var oldValue = syncInterval;
    syncInterval = parseInt(interval, 10);
    this._emit('sync-interval-change', {oldValue: oldValue, newValue: interval});
  };

  /**
   * Method: getBackgroundSyncInterval
   *
   * Get the value of the sync interval when application is in the background
   *
   * Returns a number of milliseconds
   *
   */
  RemoteStorage.prototype.getBackgroundSyncInterval = function () {
    return backgroundSyncInterval;
  };

  /**
   * Method: setBackgroundSyncInterval
   *
   * Set the value of the sync interval when the application is in the background
   *
   * Parameters:
   *   interval - sync interval in milliseconds
   *
   */
  RemoteStorage.prototype.setBackgroundSyncInterval = function (interval) {
    if(!isValidInterval(interval)) {
      throw interval + " is not a valid sync interval";
    }
    var oldValue = backgroundSyncInterval;
    backgroundSyncInterval = parseInt(interval, 10);
    this._emit('sync-interval-change', {oldValue: oldValue, newValue: interval});
  };

  /**
   * Method: getCurrentSyncInterval
   *
   * Get the value of the current sync interval
   *
   * Returns a number of milliseconds
   *
   */
  RemoteStorage.prototype.getCurrentSyncInterval = function () {
    return isBackground ? backgroundSyncInterval : syncInterval;
  };

  var SyncError = function (originalError) {
    var msg = 'Sync failed: ';
    if (typeof(originalError) === 'object' && 'message' in originalError) {
      msg += originalError.message;
    } else {
      msg += originalError;
    }
    this.originalError = originalError;
    this.message = msg;
  };

  SyncError.prototype = new Error();
  SyncError.prototype.constructor = SyncError;

  RemoteStorage.SyncError = SyncError;

  RemoteStorage.prototype.syncCycle = function () {
    if (this.sync.stopped) {
      return;
    }

    this.sync.on('done', function () {
      RemoteStorage.log('[Sync] Sync done. Setting timer to', this.getCurrentSyncInterval());
      if (!this.sync.stopped) {
        if (this._syncTimer) {
          clearTimeout(this._syncTimer);
        }
        this._syncTimer = setTimeout(this.sync.sync.bind(this.sync), this.getCurrentSyncInterval());
      }
    }.bind(this));

    this.sync.sync();
  };

  RemoteStorage.prototype.stopSync = function () {
    if (this.sync) {
      RemoteStorage.log('[Sync] Stopping sync');
      this.sync.stopped = true;
    } else {
      // TODO When is this ever the case and what is syncStopped for then?
      RemoteStorage.log('[Sync] Will instantiate sync stopped');
      this.syncStopped = true;
    }
  };

  RemoteStorage.prototype.startSync = function () {
    this.sync.stopped = false;
    this.syncStopped = false;
    this.sync.sync();
  };

  var syncCycleCb;

  RemoteStorage.Sync._rs_init = function (remoteStorage) {
    syncCycleCb = function () {
      RemoteStorage.log('[Sync] syncCycleCb calling syncCycle');
      if (RemoteStorage.Env.isBrowser()) {
        handleVisibility.bind(remoteStorage)();
      }
      if (!remoteStorage.sync) {
        // Call this now that all other modules are also ready:
        remoteStorage.sync = new RemoteStorage.Sync(
            remoteStorage.local, remoteStorage.remote, remoteStorage.access,
            remoteStorage.caching);

        if (remoteStorage.syncStopped) {
          RemoteStorage.log('[Sync] Instantiating sync stopped');
          remoteStorage.sync.stopped = true;
          delete remoteStorage.syncStopped;
        }
      }

      RemoteStorage.log('[Sync] syncCycleCb calling syncCycle');
      remoteStorage.syncCycle();
    };

    remoteStorage.on('ready', syncCycleCb);
  };

  RemoteStorage.Sync._rs_cleanup = function (remoteStorage) {
    remoteStorage.stopSync();
    remoteStorage.removeEventListener('ready', syncCycleCb);
  };

})(typeof(window) !== 'undefined' ? window : global);


/** FILE: src/cachinglayer.js **/
(function () {
  /**
   * Interface: cachinglayer
   *
   * This module defines functions that are mixed into remoteStorage.local when
   * it is instantiated (currently one of indexeddb.js, localstorage.js, or
   * inmemorystorage.js).
   *
   * All remoteStorage.local implementations should therefore implement
   * this.getNodes, this.setNodes, and this.forAllNodes. The rest is blended in
   * here to create a GPD (get/put/delete) interface which the BaseClient can
   * talk to.
   */

  var isFolder = RemoteStorage.util.isFolder;
  var isDocument = RemoteStorage.util.isDocument;
  var deepClone = RemoteStorage.util.deepClone;
  var equal = RemoteStorage.util.equal;

  function getLatest(node) {
    if (typeof(node) !== 'object' || typeof(node.path) !== 'string') {
      return;
    }
    if (isFolder(node.path)) {
      if (node.local && node.local.itemsMap) {
        return node.local;
      }
      if (node.common && node.common.itemsMap) {
        return node.common;
      }
    } else {
      if (node.local && node.local.body && node.local.contentType) {
        return node.local;
      }
      if (node.common && node.common.body && node.common.contentType) {
        return node.common;
      }
      // Migration code! Once all apps use at least this version of the lib, we
      // can publish clean-up code that migrates over any old-format data, and
      // stop supporting it. For now, new apps will support data in both
      // formats, thanks to this:
      if (node.body && node.contentType) {
        return {
          body: node.body,
          contentType: node.contentType
        };
      }
    }
  }

  function isOutdated(nodes, maxAge) {
    var path, node;
    for (path in nodes) {
      if (nodes[path] && nodes[path].remote) {
        return true;
      }
      nodeVersion = getLatest(nodes[path]);
      if (nodeVersion && nodeVersion.timestamp && (new Date().getTime()) - nodeVersion.timestamp <= maxAge) {
        return false;
      } else if (!nodeVersion) {
        return true;
      }
    }
    return true;
  }

  var pathsFromRoot = RemoteStorage.util.pathsFromRoot;

  function makeNode(path) {
    var node = { path: path, common: { } };

    if (isFolder(path)) {
      node.common.itemsMap = {};
    }
    return node;
  }

  function updateFolderNodeWithItemName(node, itemName) {
    if (!node.common) {
      node.common = {
        itemsMap: {}
      };
    }
    if (!node.common.itemsMap) {
      node.common.itemsMap = {};
    }
    if (!node.local) {
      node.local = deepClone(node.common);
    }
    if (!node.local.itemsMap) {
      node.local.itemsMap = node.common.itemsMap;
    }
    node.local.itemsMap[itemName] = true;

    return node;
  }

  var methods = {

    // TODO: improve our code structure so that this function
    // could call sync.queueGetRequest directly instead of needing
    // this hacky third parameter as a callback
    get: function (path, maxAge, queueGetRequest) {
      var self = this;
      if (typeof(maxAge) === 'number') {
        return self.getNodes(pathsFromRoot(path))
        .then(function (objs) {
          var node = getLatest(objs[path]);
          if (isOutdated(objs, maxAge)) {
            return queueGetRequest(path);
          } else if (node) {
            return {statusCode: 200, body: node.body || node.itemsMap, contentType: node.contentType};
          } else {
            return {statusCode: 404};
          }
        });
      } else {
        return self.getNodes([path])
        .then(function (objs) {
          var node = getLatest(objs[path]);
          if (node) {
            if (isFolder(path)) {
              for (var i in node.itemsMap) {
                // the hasOwnProperty check here is only because our jshint settings require it:
                if (node.itemsMap.hasOwnProperty(i) && node.itemsMap[i] === false) {
                  delete node.itemsMap[i];
                }
              }
            }
            return {statusCode: 200, body: node.body || node.itemsMap, contentType: node.contentType};
          } else {
            return {statusCode: 404};
          }
        });
      }
    },

    put: function (path, body, contentType) {
      var paths = pathsFromRoot(path);
      var self = this;

      function _processNodes(paths, nodes) {
        try {
          for (var i = 0, len = paths.length; i < len; i++) {
            var path = paths[i];
            var node = nodes[path];
            var previous;

            if (!node) {
              nodes[path] = node = makeNode(path);
            }

            // Document
            if (i === 0) {
              previous = getLatest(node);
              node.local = {
                body:                body,
                contentType:         contentType,
                previousBody:        (previous ? previous.body : undefined),
                previousContentType: (previous ? previous.contentType : undefined),
              };
            }
            // Folder
            else {
              var itemName = paths[i-1].substring(path.length);
              node = updateFolderNodeWithItemName(node, itemName);
            }
          }
          return nodes;
        } catch (e) {
          RemoteStorage.log('[Cachinglayer] Error during PUT', nodes, i, e);
          throw e;
        }
      }
      return this._updateNodes(paths, _processNodes);
    },

    delete: function (path) {
      var paths = pathsFromRoot(path);

      return this._updateNodes(paths, function (paths, nodes) {
        for (var i = 0, len = paths.length; i < len; i++) {
          var path = paths[i];
          var node = nodes[path];
          if (!node) {
            throw new Error('Cannot delete non-existing node '+path);
          }

          if (i === 0) {
          // Document
            previous = getLatest(node);
            node.local = {
              body:                false,
              previousBody:        (previous ? previous.body : undefined),
              previousContentType: (previous ? previous.contentType : undefined),
            };
          } else {
          // Folder
            if (!node.local) {
              node.local = deepClone(node.common);
            }
            var itemName = paths[i-1].substring(path.length);
            delete node.local.itemsMap[itemName];

            if (Object.getOwnPropertyNames(node.local.itemsMap).length > 0) {
              // This folder still contains other items, don't remove any further ancestors
              break;
            }
          }
        }
        return nodes;
      });
    },

    flush: function (path) {
      var self = this;
      return self._getAllDescendentPaths(path).then(function (paths) {
        return self.getNodes(paths);
      }).then(function (nodes) {
        for (var path in nodes) {
          var node = nodes[path];

          if (node && node.common && node.local) {
            self._emitChange({
              path:     node.path,
              origin:   'local',
              oldValue: (node.local.body === false ? undefined : node.local.body),
              newValue: (node.common.body === false ? undefined : node.common.body)
            });
          }
          nodes[path] = undefined;
        }
        return self.setNodes(nodes);
      });
    },

    _emitChange: function (obj) {
      if (RemoteStorage.config.changeEvents[obj.origin]) {
        this._emit('change', obj);
      }
    },

    fireInitial: function () {
      if (!RemoteStorage.config.changeEvents.local) {
        return;
      }
      var self = this;
      self.forAllNodes(function (node) {
        var latest;
        if (isDocument(node.path)) {
          latest = getLatest(node);
          if (latest) {
            self._emitChange({
              path:           node.path,
              origin:         'local',
              oldValue:       undefined,
              oldContentType: undefined,
              newValue:       latest.body,
              newContentType: latest.contentType
            });
          }
        }
      }).then(function () {
        self._emit('local-events-done');
      });
    },

    onDiff: function (diffHandler) {
      this.diffHandler = diffHandler;
    },

    migrate: function (node) {
      if (typeof(node) === 'object' && !node.common) {
        node.common = {};
        if (typeof(node.path) === 'string') {
          if (node.path.substr(-1) === '/' && typeof(node.body) === 'object') {
            node.common.itemsMap = node.body;
          }
        } else {
          //save legacy content of document node as local version
          if (!node.local) {
            node.local = {};
          }
          node.local.body = node.body;
          node.local.contentType = node.contentType;
        }
      }
      return node;
    },

    // FIXME
    // this process of updating nodes needs to be heavily documented first, then
    // refactored. Right now it's almost impossible to refactor as there's no
    // explanation of why things are implemented certain ways or what the goal(s)
    // of the behavior are. -slvrbckt
    _updateNodesRunning: false,
    _updateNodesQueued: [],
    _updateNodes: function (paths, _processNodes) {
      var pending = Promise.defer();
      this._doUpdateNodes(paths, _processNodes, pending);
      return pending.promise;
    },
    _doUpdateNodes: function (paths, _processNodes, promise) {
      var self = this;

      if (self._updateNodesRunning) {
        self._updateNodesQueued.push({
          paths: paths,
          cb: _processNodes,
          promise: promise
        });
        return;
      } else {
        self._updateNodesRunning = true;
      }

      self.getNodes(paths).then(function (nodes) {
        var existingNodes = deepClone(nodes);
        var changeEvents = [];
        var node;
        nodes = _processNodes(paths, nodes);

        for (var path in nodes) {
          node = nodes[path];
          if (equal(node, existingNodes[path])) {
            delete nodes[path];
          }
          else if (isDocument(path)) {
            changeEvents.push({
              path:           path,
              origin:         'window',
              oldValue:       node.local.previousBody,
              newValue:       node.local.body === false ? undefined : node.local.body,
              oldContentType: node.local.previousContentType,
              newContentType: node.local.contentType
            });
            delete node.local.previousBody;
            delete node.local.previousContentType;
          }
        }

        self.setNodes(nodes).then(function () {
          self._emitChangeEvents(changeEvents);
          promise.resolve({statusCode: 200});
        });
      }).then(function () {
        return Promise.resolve();
      }, function (err) {
        promise.reject(err);
      }).then(function () {
        self._updateNodesRunning = false;
        var nextJob = self._updateNodesQueued.shift();
        if (nextJob) {
          self._doUpdateNodes(nextJob.paths, nextJob.cb, nextJob.promise);
        }
      });
    },

    _emitChangeEvents: function (events) {
      for (var i = 0, len = events.length; i < len; i++) {
        this._emitChange(events[i]);
        if (this.diffHandler) {
          this.diffHandler(events[i].path);
        }
      }
    },

    _getAllDescendentPaths: function (path) {
      var self = this;
      if (isFolder(path)) {
        return self.getNodes([path]).then(function (nodes) {
          var allPaths = [path];
          var latest = getLatest(nodes[path]);

          var itemNames = Object.keys(latest.itemsMap);
          var calls = itemNames.map(function (itemName) {
            return self._getAllDescendentPaths(path+itemName).then(function (paths) {
              for (var i = 0, len = paths.length; i < len; i++) {
                allPaths.push(paths[i]);
              }
            });
          });
          return Promise.all(calls).then(function () {
            return allPaths;
          });
        });
      } else {
        return Promise.resolve([path]);
      }
    },

    _getInternals: function () {
      return {
        getLatest: getLatest,
        makeNode: makeNode,
        isOutdated: isOutdated
      };
    }
  };

  /**
   * Function: cachingLayer
   *
   * Mixes common caching layer functionality into an object.
   *
   * The first parameter is always the object to be extended.
   *
   * Example:
   *   (start code)
   *   var MyConstructor = function () {
   *     cachingLayer(this);
   *   };
   *   (end code)
   */
  RemoteStorage.cachingLayer = function (object) {
    for (var key in methods) {
      object[key] = methods[key];
    }
  };
})();

/** FILE: src/indexeddb.js **/
(function (global) {

  /**
   * Class: RemoteStorage.IndexedDB
   *
   *
   * IndexedDB Interface
   * -------------------
   *
   * TODO rewrite, doesn't expose GPD anymore, it's in cachinglayer now
   *
   * This file exposes a get/put/delete interface, accessing data in an IndexedDB.
   *
   * There are multiple parts to this interface:
   *
   *   The RemoteStorage integration:
   *     - RemoteStorage.IndexedDB._rs_supported() determines if IndexedDB support
   *       is available. If it isn't, RemoteStorage won't initialize the feature.
   *     - RemoteStorage.IndexedDB._rs_init() initializes the feature. It returns
   *       a promise that is fulfilled as soon as the database has been opened and
   *       migrated.
   *
   *   The storage interface (RemoteStorage.IndexedDB object):
   *     - Usually this is accessible via "remoteStorage.local"
   *     - #get() takes a path and returns a promise.
   *     - #put() takes a path, body and contentType and also returns a promise.
   *     - #delete() takes a path and also returns a promise.
   *     - #on('change', ...) events, being fired whenever something changes in
   *       the storage. Change events roughly follow the StorageEvent pattern.
   *       They have "oldValue" and "newValue" properties, which can be used to
   *       distinguish create/update/delete operations and analyze changes in
   *       change handlers. In addition they carry a "origin" property, which
   *       is either "window", "local", or "remote". "remote" events are fired
   *       whenever a change comes in from RemoteStorage.Sync.
   *
   *   The sync interface (also on RemoteStorage.IndexedDB object):
   *     - #getNodes([paths]) returns the requested nodes in a promise.
   *     - #setNodes(map) stores all the nodes given in the (path -> node) map.
   *
   */

  var RS = RemoteStorage;

  var DB_VERSION = 2;

  var DEFAULT_DB_NAME = 'remotestorage';
  var DEFAULT_DB;

  RS.IndexedDB = function (database) {
    this.db = database || DEFAULT_DB;

    if (!this.db) {
      RemoteStorage.log("[IndexedDB] Failed to open DB");
      return undefined;
    }

    RS.cachingLayer(this);
    RS.eventHandling(this, 'change', 'local-events-done');

    this.getsRunning = 0;
    this.putsRunning = 0;

    /**
     * Property: changesQueued
     *
     * Given a node for which uncommitted changes exist, this cache
     * stores either the entire uncommitted node, or false for a deletion.
     * The node's path is used as the key.
     *
     * changesQueued stores changes for which no IndexedDB transaction has
     * been started yet.
     */
    this.changesQueued = {};

    /**
     * Property: changesRunning
     *
     * Given a node for which uncommitted changes exist, this cache
     * stores either the entire uncommitted node, or false for a deletion.
     * The node's path is used as the key.
     *
     * At any time there is at most one IndexedDB transaction running.
     * changesRunning stores the changes that are included in that currently
     * running IndexedDB transaction, or if none is running, of the last one
     * that ran.
     */
    this.changesRunning = {};
  };

  RS.IndexedDB.prototype = {
    getNodes: function (paths) {
      var misses = [], fromCache = {};
      for (var i = 0, len = paths.length; i < len; i++) {
        if (this.changesQueued[paths[i]] !== undefined) {
          fromCache[paths[i]] = RemoteStorage.util.deepClone(this.changesQueued[paths[i]] || undefined);
        } else if(this.changesRunning[paths[i]] !== undefined) {
          fromCache[paths[i]] = RemoteStorage.util.deepClone(this.changesRunning[paths[i]] || undefined);
        } else {
          misses.push(paths[i]);
        }
      }
      if (misses.length > 0) {
        return this.getNodesFromDb(misses).then(function (nodes) {
          for (var i in fromCache) {
            nodes[i] = fromCache[i];
          }
          return nodes;
        });
      } else {
        return Promise.resolve(fromCache);
      }
    },

    setNodes: function (nodes) {
      for (var i in nodes) {
        this.changesQueued[i] = nodes[i] || false;
      }
      this.maybeFlush();
      return Promise.resolve();
    },

    maybeFlush: function () {
      if (this.putsRunning === 0) {
        this.flushChangesQueued();
      } else {
        if (!this.commitSlownessWarning) {
          this.commitSlownessWarning = setInterval(function () {
            console.log('WARNING: waited more than 10 seconds for previous commit to finish');
          }, 10000);
        }
      }
    },

    flushChangesQueued: function () {
      if (this.commitSlownessWarning) {
        clearInterval(this.commitSlownessWarning);
        this.commitSlownessWarning = null;
      }
      if (Object.keys(this.changesQueued).length > 0) {
        this.changesRunning = this.changesQueued;
        this.changesQueued = {};
        this.setNodesInDb(this.changesRunning).then(this.flushChangesQueued.bind(this));
      }
    },

    getNodesFromDb: function (paths) {
      var pending = Promise.defer();
      var transaction = this.db.transaction(['nodes'], 'readonly');
      var nodes = transaction.objectStore('nodes');
      var retrievedNodes = {};
      var startTime = new Date().getTime();

      this.getsRunning++;

      paths.map(function (path, i) {
        nodes.get(path).onsuccess = function (evt) {
          retrievedNodes[path] = evt.target.result;
        };
      });

      transaction.oncomplete = function () {
        pending.resolve(retrievedNodes);
        this.getsRunning--;
      }.bind(this);

      transaction.onerror = transaction.onabort = function () {
        pending.reject('get transaction error/abort');
        this.getsRunning--;
      }.bind(this);

      return pending.promise;
    },

    setNodesInDb: function (nodes) {
      var pending = Promise.defer();
      var transaction = this.db.transaction(['nodes'], 'readwrite');
      var nodesStore = transaction.objectStore('nodes');
      var startTime = new Date().getTime();

      this.putsRunning++;

      RemoteStorage.log('[IndexedDB] Starting put', nodes, this.putsRunning);

      for (var path in nodes) {
        var node = nodes[path];
        if(typeof(node) === 'object') {
          try {
            nodesStore.put(node);
          } catch(e) {
            RemoteStorage.log('[IndexedDB] Error while putting', node, e);
            throw e;
          }
        } else {
          try {
            nodesStore.delete(path);
          } catch(e) {
            RemoteStorage.log('[IndexedDB] Error while removing', nodesStore, node, e);
            throw e;
          }
        }
      }

      transaction.oncomplete = function () {
        this.putsRunning--;
        RemoteStorage.log('[IndexedDB] Finished put', nodes, this.putsRunning, (new Date().getTime() - startTime)+'ms');
        pending.resolve();
      }.bind(this);

      transaction.onerror = function () {
        this.putsRunning--;
        pending.reject('transaction error');
      }.bind(this);

      transaction.onabort = function () {
        pending.reject('transaction abort');
        this.putsRunning--;
      }.bind(this);

      return pending.promise;
    },

    reset: function (callback) {
      var dbName = this.db.name;
      var self = this;

      this.db.close();

      RS.IndexedDB.clean(this.db.name, function() {
        RS.IndexedDB.open(dbName, function (err, other) {
          if (err) {
            RemoteStorage.log('[IndexedDB] Error while resetting local storage', err);
          } else {
            // hacky!
            self.db = other;
          }
          if (typeof callback === 'function') { callback(self); }
        });
      });
    },

    forAllNodes: function (cb) {
      var pending = Promise.defer();
      var transaction = this.db.transaction(['nodes'], 'readonly');
      var cursorReq = transaction.objectStore('nodes').openCursor();

      cursorReq.onsuccess = function (evt) {
        var cursor = evt.target.result;

        if (cursor) {
          cb(this.migrate(cursor.value));
          cursor.continue();
        } else {
          pending.resolve();
        }
      }.bind(this);

      return pending.promise;
    },

    closeDB: function () {
      this.db.close();
    }

  };

  RS.IndexedDB.open = function (name, callback) {
    var timer = setTimeout(function () {
      callback("timeout trying to open db");
    }, 10000);

    var req = indexedDB.open(name, DB_VERSION);

    req.onerror = function () {
      RemoteStorage.log('[IndexedDB] Opening DB failed', req);

      clearTimeout(timer);
      callback(req.error);
    };

    req.onupgradeneeded = function (event) {
      var db = req.result;

      RemoteStorage.log("[IndexedDB] Upgrade: from ", event.oldVersion, " to ", event.newVersion);

      if (event.oldVersion !== 1) {
        RemoteStorage.log("[IndexedDB] Creating object store: nodes");
        db.createObjectStore('nodes', { keyPath: 'path' });
      }

      RemoteStorage.log("[IndexedDB] Creating object store: changes");

      db.createObjectStore('changes', { keyPath: 'path' });
    };

    req.onsuccess = function () {
      clearTimeout(timer);
      callback(null, req.result);
    };
  };

  RS.IndexedDB.clean = function (databaseName, callback) {
    var req = indexedDB.deleteDatabase(databaseName);

    req.onsuccess = function () {
      RemoteStorage.log('[IndexedDB] Done removing DB');
      callback();
    };

    req.onerror = req.onabort = function (evt) {
      console.error('Failed to remove database "' + databaseName + '"', evt);
    };
  };

  RS.IndexedDB._rs_init = function (remoteStorage) {
    var pending = Promise.defer();

    RS.IndexedDB.open(DEFAULT_DB_NAME, function (err, db) {
      if (err) {
        pending.reject(err);
      } else {
        DEFAULT_DB = db;
        db.onerror = function () { remoteStorage._emit('error', err); };
        pending.resolve();
      }
    });

    return pending.promise;
  };

  RS.IndexedDB._rs_supported = function () {
    var pending = Promise.defer();

    if ('indexedDB' in global) {
      try {
        var check = indexedDB.open("rs-check");
        check.onerror = function (event) {
          pending.reject();
        };
        check.onsuccess = function (event) {
          indexedDB.deleteDatabase("rs-check");
          pending.resolve();
        };
      } catch(e) {
        pending.reject();
      }
    } else {
      pending.reject();
    }

    return pending.promise;
  };

  RS.IndexedDB._rs_cleanup = function (remoteStorage) {
    var pending = Promise.defer();

    if (remoteStorage.local) {
      remoteStorage.local.closeDB();
    }

    RS.IndexedDB.clean(DEFAULT_DB_NAME, function () {
      pending.resolve();
    });

    return pending.promise;
  };

})(typeof(window) !== 'undefined' ? window : global);

/** FILE: src/localstorage.js **/
(function (global) {
  /**
   * Class: RemoteStorage.LocalStorage
   *
   * localStorage caching adapter. Used when no IndexedDB available.
   **/

  var NODES_PREFIX = "remotestorage:cache:nodes:";
  var CHANGES_PREFIX = "remotestorage:cache:changes:";

  RemoteStorage.LocalStorage = function () {
    RemoteStorage.cachingLayer(this);
    RemoteStorage.log('[LocalStorage] Registering events');
    RemoteStorage.eventHandling(this, 'change', 'local-events-done');
  };

  function b64ToUint6(nChr) {
    return nChr > 64 && nChr < 91 ?
      nChr - 65
      : nChr > 96 && nChr < 123 ?
      nChr - 71
      : nChr > 47 && nChr < 58 ?
      nChr + 4
      : nChr === 43 ?
      62
      : nChr === 47 ?
      63
      :
      0;
  }

  function base64DecToArr(sBase64, nBlocksSize) {
    var
    sB64Enc = sBase64.replace(/[^A-Za-z0-9\+\/]/g, ""), nInLen = sB64Enc.length,
    nOutLen = nBlocksSize ? Math.ceil((nInLen * 3 + 1 >> 2) / nBlocksSize) * nBlocksSize : nInLen * 3 + 1 >> 2, taBytes = new Uint8Array(nOutLen);

    for (var nMod3, nMod4, nUint24 = 0, nOutIdx = 0, nInIdx = 0; nInIdx < nInLen; nInIdx++) {
      nMod4 = nInIdx & 3;
      nUint24 |= b64ToUint6(sB64Enc.charCodeAt(nInIdx)) << 18 - 6 * nMod4;
      if (nMod4 === 3 || nInLen - nInIdx === 1) {
        for (nMod3 = 0; nMod3 < 3 && nOutIdx < nOutLen; nMod3++, nOutIdx++) {
          taBytes[nOutIdx] = nUint24 >>> (16 >>> nMod3 & 24) & 255;
        }
        nUint24 = 0;
      }
    }
    return taBytes;
  }

  function isBinary(node) {
    return node.match(/charset=binary/);
  }

  function isRemoteStorageKey(key) {
    return key.substr(0, NODES_PREFIX.length) === NODES_PREFIX ||
           key.substr(0, CHANGES_PREFIX.length) === CHANGES_PREFIX;
  }

  function isNodeKey(key) {
    return key.substr(0, NODES_PREFIX.length) === NODES_PREFIX;
  }

  RemoteStorage.LocalStorage.prototype = {

    getNodes: function (paths) {
      var nodes = {};

      for(var i = 0, len = paths.length; i < len; i++) {
        try {
          nodes[paths[i]] = JSON.parse(localStorage[NODES_PREFIX+paths[i]]);
        } catch(e) {
          nodes[paths[i]] = undefined;
        }
      }

      return Promise.resolve(nodes);
    },

    setNodes: function (nodes) {
      for (var path in nodes) {
        // TODO shouldn't we use getItem/setItem?
        localStorage[NODES_PREFIX+path] = JSON.stringify(nodes[path]);
      }

      return Promise.resolve();
    },

    forAllNodes: function (cb) {
      var node;

      for(var i = 0, len = localStorage.length; i < len; i++) {
        if (isNodeKey(localStorage.key(i))) {
          try {
            node = this.migrate(JSON.parse(localStorage[localStorage.key(i)]));
          } catch(e) {
            node = undefined;
          }
          if (node) {
            cb(node);
          }
        }
      }
      return Promise.resolve();
    }

  };

  RemoteStorage.LocalStorage._rs_init = function () {};

  RemoteStorage.LocalStorage._rs_supported = function () {
    return 'localStorage' in global;
  };

  // TODO tests missing!
  RemoteStorage.LocalStorage._rs_cleanup = function () {
    var keys = [];

    for (var i = 0, len = localStorage.length; i < len; i++) {
      var key = localStorage.key(i);
      if (isRemoteStorageKey(key)) {
        keys.push(key);
      }
    }

    keys.forEach(function (key) {
      RemoteStorage.log('[LocalStorage] Removing', key);
      delete localStorage[key];
    });
  };
})(typeof(window) !== 'undefined' ? window : global);

/** FILE: src/inmemorystorage.js **/
(function (global) {
  /**
   * Class: RemoteStorage.InMemoryStorage
   *
   * In-memory caching adapter. Used when no IndexedDB or localStorage
   * available.
   **/

  RemoteStorage.InMemoryStorage = function () {
    RemoteStorage.cachingLayer(this);
    RemoteStorage.log('[InMemoryStorage] Registering events');
    RemoteStorage.eventHandling(this, 'change', 'local-events-done');

    this._storage = {};
  };

  RemoteStorage.InMemoryStorage.prototype = {

    getNodes: function (paths) {
      var nodes = {};

      for(var i = 0, len = paths.length; i < len; i++) {
        nodes[paths[i]] = this._storage[paths[i]];
      }

      return Promise.resolve(nodes);
    },

    setNodes: function (nodes) {
      for (var path in nodes) {
        if (nodes[path] === undefined) {
          delete this._storage[path];
        } else {
          this._storage[path] = nodes[path];
        }
      }

      return Promise.resolve();
    },

    forAllNodes: function (cb) {
      for (var path in this._storage) {
        cb(this.migrate(this._storage[path]));
      }
      return Promise.resolve();
    }

  };

  RemoteStorage.InMemoryStorage._rs_init = function () {};

  RemoteStorage.InMemoryStorage._rs_supported = function () {
    // In-memory storage is always supported
    return true;
  };

  RemoteStorage.InMemoryStorage._rs_cleanup = function () {};
})(typeof(window) !== 'undefined' ? window : global);

/** FILE: src/modules.js **/
(function () {

  RemoteStorage.MODULES = {};

  /*
   * Method: RemoteStorage.defineModule
   *
   * Method for defining a new remoteStorage data module
   *
   * Parameters:
   *   moduleName - Name of the module
   *   builder    - Builder function defining the module
   *
   * The module builder function should return an object containing another
   * object called exports, which will be exported to any <RemoteStorage>
   * instance under the module's name. So when defining a locations module,
   * like in the example below, it would be accessible via
   * `remoteStorage.locations`, which would in turn have a `features` and a
   * `collections` property.
   *
   * The function receives a private and a public client, which are both
   * instances of <RemoteStorage.BaseClient>. In the following example, the
   * scope of privateClient is `/locations` and the scope of publicClient is
   * `/public/locations`.
   *
   * Example:
   *   (start code)
   *   RemoteStorage.defineModule('locations', function (privateClient, publicClient) {
   *     return {
   *       exports: {
   *         features: privateClient.scope('features/').defaultType('feature'),
   *         collections: privateClient.scope('collections/').defaultType('feature-collection')
   *       }
   *     };
   *   });
   * (end code)
  */

  RemoteStorage.defineModule = function (moduleName, builder) {
    RemoteStorage.MODULES[moduleName] = builder;

    Object.defineProperty(RemoteStorage.prototype, moduleName, {
      configurable: true,
      get: function () {
        var instance = this._loadModule(moduleName);
        Object.defineProperty(this, moduleName, {
          value: instance
        });
        return instance;
      }
    });

    if (moduleName.indexOf('-') !== -1) {
      var camelizedName = moduleName.replace(/\-[a-z]/g, function (s) {
        return s[1].toUpperCase();
      });
      Object.defineProperty(RemoteStorage.prototype, camelizedName, {
        get: function () {
          return this[moduleName];
        }
      });
    }
  };

  RemoteStorage.prototype._loadModule = function (moduleName) {
    var builder = RemoteStorage.MODULES[moduleName];
    if (builder) {
      var module = builder(new RemoteStorage.BaseClient(this, '/' + moduleName + '/'),
                           new RemoteStorage.BaseClient(this, '/public/' + moduleName + '/'));
      return module.exports;
    } else {
      throw "Unknown module: " + moduleName;
    }
  };

  RemoteStorage.prototype.defineModule = function (moduleName) {
    console.log("remoteStorage.defineModule is deprecated, use RemoteStorage.defineModule instead!");
    RemoteStorage.defineModule.apply(RemoteStorage, arguments);
  };

})();


/** FILE: src/nodejs_ext.js **/
(function (global) {
  global.XMLHttpRequest = require('xhr2');

  RemoteStorage.WireClient.readBinaryData = function (content, mimeType, callback) {
    callback(content);
  };
}(global));

if(typeof(define) == 'function' && define.amd) define([], function() { return RemoteStorage }); else module.exports = RemoteStorage;
