(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define("RemoteStorage", [], factory);
	else if(typeof exports === 'object')
		exports["RemoteStorage"] = factory();
	else
		root["RemoteStorage"] = factory();
})(this, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 0);
/******/ })
/************************************************************************/
/******/ ({

/***/ "./node_modules/base64-js/index.js":
/*!*****************************************!*\
  !*** ./node_modules/base64-js/index.js ***!
  \*****************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  var i
  for (i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}


/***/ }),

/***/ "./node_modules/buffer/index.js":
/*!**************************************!*\
  !*** ./node_modules/buffer/index.js ***!
  \**************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(global) {/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */



var base64 = __webpack_require__(/*! base64-js */ "./node_modules/base64-js/index.js")
var ieee754 = __webpack_require__(/*! ieee754 */ "./node_modules/ieee754/index.js")
var isArray = __webpack_require__(/*! isarray */ "./node_modules/isarray/index.js")

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

/*
 * Export kMaxLength after typed array support is determined.
 */
exports.kMaxLength = kMaxLength()

function typedArraySupport () {
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42 && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

function createBuffer (that, length) {
  if (kMaxLength() < length) {
    throw new RangeError('Invalid typed array length')
  }
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    if (that === null) {
      that = new Buffer(length)
    }
    that.length = length
  }

  return that
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
    return new Buffer(arg, encodingOrOffset, length)
  }

  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(this, arg)
  }
  return from(this, arg, encodingOrOffset, length)
}

Buffer.poolSize = 8192 // not used by this implementation

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype
  return arr
}

function from (that, value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(that, value, encodingOrOffset)
  }

  return fromObject(that, value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(null, value, encodingOrOffset, length)
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
  if (typeof Symbol !== 'undefined' && Symbol.species &&
      Buffer[Symbol.species] === Buffer) {
    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
    Object.defineProperty(Buffer, Symbol.species, {
      value: null,
      configurable: true
    })
  }
}

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (that, size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(that, size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(that, size).fill(fill, encoding)
      : createBuffer(that, size).fill(fill)
  }
  return createBuffer(that, size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(null, size, fill, encoding)
}

function allocUnsafe (that, size) {
  assertSize(size)
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; ++i) {
      that[i] = 0
    }
  }
  return that
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(null, size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(null, size)
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  that = createBuffer(that, length)

  var actual = that.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    that = that.slice(0, actual)
  }

  return that
}

function fromArrayLike (that, array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  that = createBuffer(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array, byteOffset, length) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  if (byteOffset === undefined && length === undefined) {
    array = new Uint8Array(array)
  } else if (length === undefined) {
    array = new Uint8Array(array, byteOffset)
  } else {
    array = new Uint8Array(array, byteOffset, length)
  }

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = array
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromArrayLike(that, array)
  }
  return that
}

function fromObject (that, obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    that = createBuffer(that, len)

    if (that.length === 0) {
      return that
    }

    obj.copy(that, 0, 0, len)
    return that
  }

  if (obj) {
    if ((typeof ArrayBuffer !== 'undefined' &&
        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(that, 0)
      }
      return fromArrayLike(that, obj)
    }

    if (obj.type === 'Buffer' && isArray(obj.data)) {
      return fromArrayLike(that, obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < kMaxLength()` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset  // Coerce to Number.
  if (isNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (Buffer.TYPED_ARRAY_SUPPORT &&
        typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end)
    newBuf.__proto__ = Buffer.prototype
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; ++i) {
      newBuf[i] = this[i + start]
    }
  }

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : utf8ToBytes(new Buffer(val, encoding).toString())
    var len = bytes.length
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

function isnan (val) {
  return val !== val // eslint-disable-line no-self-compare
}

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./../webpack/buildin/global.js */ "./node_modules/webpack/buildin/global.js")))

/***/ }),

/***/ "./node_modules/ieee754/index.js":
/*!***************************************!*\
  !*** ./node_modules/ieee754/index.js ***!
  \***************************************/
/*! no static exports found */
/***/ (function(module, exports) {

/*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}


/***/ }),

/***/ "./node_modules/isarray/index.js":
/*!***************************************!*\
  !*** ./node_modules/isarray/index.js ***!
  \***************************************/
/*! no static exports found */
/***/ (function(module, exports) {

var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};


/***/ }),

/***/ "./node_modules/tv4/tv4.js":
/*!*********************************!*\
  !*** ./node_modules/tv4/tv4.js ***!
  \*********************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_FACTORY__, __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;/*
Author: Geraint Luff and others
Year: 2013

This code is released into the "public domain" by its author(s).  Anybody may use, alter and distribute the code without restriction.  The author makes no guarantees, and takes no liability of any kind for use of this code.

If you find a bug or make an improvement, it would be courteous to let the author know, but it is not compulsory.
*/
(function (global, factory) {
  if (true) {
    // AMD. Register as an anonymous module.
    !(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_FACTORY__ = (factory),
				__WEBPACK_AMD_DEFINE_RESULT__ = (typeof __WEBPACK_AMD_DEFINE_FACTORY__ === 'function' ?
				(__WEBPACK_AMD_DEFINE_FACTORY__.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__)) : __WEBPACK_AMD_DEFINE_FACTORY__),
				__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
  } else {}
}(this, function () {

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys?redirectlocale=en-US&redirectslug=JavaScript%2FReference%2FGlobal_Objects%2FObject%2Fkeys
if (!Object.keys) {
	Object.keys = (function () {
		var hasOwnProperty = Object.prototype.hasOwnProperty,
			hasDontEnumBug = !({toString: null}).propertyIsEnumerable('toString'),
			dontEnums = [
				'toString',
				'toLocaleString',
				'valueOf',
				'hasOwnProperty',
				'isPrototypeOf',
				'propertyIsEnumerable',
				'constructor'
			],
			dontEnumsLength = dontEnums.length;

		return function (obj) {
			if (typeof obj !== 'object' && typeof obj !== 'function' || obj === null) {
				throw new TypeError('Object.keys called on non-object');
			}

			var result = [];

			for (var prop in obj) {
				if (hasOwnProperty.call(obj, prop)) {
					result.push(prop);
				}
			}

			if (hasDontEnumBug) {
				for (var i=0; i < dontEnumsLength; i++) {
					if (hasOwnProperty.call(obj, dontEnums[i])) {
						result.push(dontEnums[i]);
					}
				}
			}
			return result;
		};
	})();
}
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create
if (!Object.create) {
	Object.create = (function(){
		function F(){}

		return function(o){
			if (arguments.length !== 1) {
				throw new Error('Object.create implementation only accepts one parameter.');
			}
			F.prototype = o;
			return new F();
		};
	})();
}
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray?redirectlocale=en-US&redirectslug=JavaScript%2FReference%2FGlobal_Objects%2FArray%2FisArray
if(!Array.isArray) {
	Array.isArray = function (vArg) {
		return Object.prototype.toString.call(vArg) === "[object Array]";
	};
}
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/indexOf?redirectlocale=en-US&redirectslug=JavaScript%2FReference%2FGlobal_Objects%2FArray%2FindexOf
if (!Array.prototype.indexOf) {
	Array.prototype.indexOf = function (searchElement /*, fromIndex */ ) {
		if (this === null) {
			throw new TypeError();
		}
		var t = Object(this);
		var len = t.length >>> 0;

		if (len === 0) {
			return -1;
		}
		var n = 0;
		if (arguments.length > 1) {
			n = Number(arguments[1]);
			if (n !== n) { // shortcut for verifying if it's NaN
				n = 0;
			} else if (n !== 0 && n !== Infinity && n !== -Infinity) {
				n = (n > 0 || -1) * Math.floor(Math.abs(n));
			}
		}
		if (n >= len) {
			return -1;
		}
		var k = n >= 0 ? n : Math.max(len - Math.abs(n), 0);
		for (; k < len; k++) {
			if (k in t && t[k] === searchElement) {
				return k;
			}
		}
		return -1;
	};
}

// Grungey Object.isFrozen hack
if (!Object.isFrozen) {
	Object.isFrozen = function (obj) {
		var key = "tv4_test_frozen_key";
		while (obj.hasOwnProperty(key)) {
			key += Math.random();
		}
		try {
			obj[key] = true;
			delete obj[key];
			return false;
		} catch (e) {
			return true;
		}
	};
}
// Based on: https://github.com/geraintluff/uri-templates, but with all the de-substitution stuff removed

var uriTemplateGlobalModifiers = {
	"+": true,
	"#": true,
	".": true,
	"/": true,
	";": true,
	"?": true,
	"&": true
};
var uriTemplateSuffices = {
	"*": true
};

function notReallyPercentEncode(string) {
	return encodeURI(string).replace(/%25[0-9][0-9]/g, function (doubleEncoded) {
		return "%" + doubleEncoded.substring(3);
	});
}

function uriTemplateSubstitution(spec) {
	var modifier = "";
	if (uriTemplateGlobalModifiers[spec.charAt(0)]) {
		modifier = spec.charAt(0);
		spec = spec.substring(1);
	}
	var separator = "";
	var prefix = "";
	var shouldEscape = true;
	var showVariables = false;
	var trimEmptyString = false;
	if (modifier === '+') {
		shouldEscape = false;
	} else if (modifier === ".") {
		prefix = ".";
		separator = ".";
	} else if (modifier === "/") {
		prefix = "/";
		separator = "/";
	} else if (modifier === '#') {
		prefix = "#";
		shouldEscape = false;
	} else if (modifier === ';') {
		prefix = ";";
		separator = ";";
		showVariables = true;
		trimEmptyString = true;
	} else if (modifier === '?') {
		prefix = "?";
		separator = "&";
		showVariables = true;
	} else if (modifier === '&') {
		prefix = "&";
		separator = "&";
		showVariables = true;
	}

	var varNames = [];
	var varList = spec.split(",");
	var varSpecs = [];
	var varSpecMap = {};
	for (var i = 0; i < varList.length; i++) {
		var varName = varList[i];
		var truncate = null;
		if (varName.indexOf(":") !== -1) {
			var parts = varName.split(":");
			varName = parts[0];
			truncate = parseInt(parts[1], 10);
		}
		var suffices = {};
		while (uriTemplateSuffices[varName.charAt(varName.length - 1)]) {
			suffices[varName.charAt(varName.length - 1)] = true;
			varName = varName.substring(0, varName.length - 1);
		}
		var varSpec = {
			truncate: truncate,
			name: varName,
			suffices: suffices
		};
		varSpecs.push(varSpec);
		varSpecMap[varName] = varSpec;
		varNames.push(varName);
	}
	var subFunction = function (valueFunction) {
		var result = "";
		var startIndex = 0;
		for (var i = 0; i < varSpecs.length; i++) {
			var varSpec = varSpecs[i];
			var value = valueFunction(varSpec.name);
			if (value === null || value === undefined || (Array.isArray(value) && value.length === 0) || (typeof value === 'object' && Object.keys(value).length === 0)) {
				startIndex++;
				continue;
			}
			if (i === startIndex) {
				result += prefix;
			} else {
				result += (separator || ",");
			}
			if (Array.isArray(value)) {
				if (showVariables) {
					result += varSpec.name + "=";
				}
				for (var j = 0; j < value.length; j++) {
					if (j > 0) {
						result += varSpec.suffices['*'] ? (separator || ",") : ",";
						if (varSpec.suffices['*'] && showVariables) {
							result += varSpec.name + "=";
						}
					}
					result += shouldEscape ? encodeURIComponent(value[j]).replace(/!/g, "%21") : notReallyPercentEncode(value[j]);
				}
			} else if (typeof value === "object") {
				if (showVariables && !varSpec.suffices['*']) {
					result += varSpec.name + "=";
				}
				var first = true;
				for (var key in value) {
					if (!first) {
						result += varSpec.suffices['*'] ? (separator || ",") : ",";
					}
					first = false;
					result += shouldEscape ? encodeURIComponent(key).replace(/!/g, "%21") : notReallyPercentEncode(key);
					result += varSpec.suffices['*'] ? '=' : ",";
					result += shouldEscape ? encodeURIComponent(value[key]).replace(/!/g, "%21") : notReallyPercentEncode(value[key]);
				}
			} else {
				if (showVariables) {
					result += varSpec.name;
					if (!trimEmptyString || value !== "") {
						result += "=";
					}
				}
				if (varSpec.truncate != null) {
					value = value.substring(0, varSpec.truncate);
				}
				result += shouldEscape ? encodeURIComponent(value).replace(/!/g, "%21"): notReallyPercentEncode(value);
			}
		}
		return result;
	};
	subFunction.varNames = varNames;
	return {
		prefix: prefix,
		substitution: subFunction
	};
}

function UriTemplate(template) {
	if (!(this instanceof UriTemplate)) {
		return new UriTemplate(template);
	}
	var parts = template.split("{");
	var textParts = [parts.shift()];
	var prefixes = [];
	var substitutions = [];
	var varNames = [];
	while (parts.length > 0) {
		var part = parts.shift();
		var spec = part.split("}")[0];
		var remainder = part.substring(spec.length + 1);
		var funcs = uriTemplateSubstitution(spec);
		substitutions.push(funcs.substitution);
		prefixes.push(funcs.prefix);
		textParts.push(remainder);
		varNames = varNames.concat(funcs.substitution.varNames);
	}
	this.fill = function (valueFunction) {
		var result = textParts[0];
		for (var i = 0; i < substitutions.length; i++) {
			var substitution = substitutions[i];
			result += substitution(valueFunction);
			result += textParts[i + 1];
		}
		return result;
	};
	this.varNames = varNames;
	this.template = template;
}
UriTemplate.prototype = {
	toString: function () {
		return this.template;
	},
	fillFromObject: function (obj) {
		return this.fill(function (varName) {
			return obj[varName];
		});
	}
};
var ValidatorContext = function ValidatorContext(parent, collectMultiple, errorReporter, checkRecursive, trackUnknownProperties) {
	this.missing = [];
	this.missingMap = {};
	this.formatValidators = parent ? Object.create(parent.formatValidators) : {};
	this.schemas = parent ? Object.create(parent.schemas) : {};
	this.collectMultiple = collectMultiple;
	this.errors = [];
	this.handleError = collectMultiple ? this.collectError : this.returnError;
	if (checkRecursive) {
		this.checkRecursive = true;
		this.scanned = [];
		this.scannedFrozen = [];
		this.scannedFrozenSchemas = [];
		this.scannedFrozenValidationErrors = [];
		this.validatedSchemasKey = 'tv4_validation_id';
		this.validationErrorsKey = 'tv4_validation_errors_id';
	}
	if (trackUnknownProperties) {
		this.trackUnknownProperties = true;
		this.knownPropertyPaths = {};
		this.unknownPropertyPaths = {};
	}
	this.errorReporter = errorReporter || defaultErrorReporter('en');
	if (typeof this.errorReporter === 'string') {
		throw new Error('debug');
	}
	this.definedKeywords = {};
	if (parent) {
		for (var key in parent.definedKeywords) {
			this.definedKeywords[key] = parent.definedKeywords[key].slice(0);
		}
	}
};
ValidatorContext.prototype.defineKeyword = function (keyword, keywordFunction) {
	this.definedKeywords[keyword] = this.definedKeywords[keyword] || [];
	this.definedKeywords[keyword].push(keywordFunction);
};
ValidatorContext.prototype.createError = function (code, messageParams, dataPath, schemaPath, subErrors, data, schema) {
	var error = new ValidationError(code, messageParams, dataPath, schemaPath, subErrors);
	error.message = this.errorReporter(error, data, schema);
	return error;
};
ValidatorContext.prototype.returnError = function (error) {
	return error;
};
ValidatorContext.prototype.collectError = function (error) {
	if (error) {
		this.errors.push(error);
	}
	return null;
};
ValidatorContext.prototype.prefixErrors = function (startIndex, dataPath, schemaPath) {
	for (var i = startIndex; i < this.errors.length; i++) {
		this.errors[i] = this.errors[i].prefixWith(dataPath, schemaPath);
	}
	return this;
};
ValidatorContext.prototype.banUnknownProperties = function (data, schema) {
	for (var unknownPath in this.unknownPropertyPaths) {
		var error = this.createError(ErrorCodes.UNKNOWN_PROPERTY, {path: unknownPath}, unknownPath, "", null, data, schema);
		var result = this.handleError(error);
		if (result) {
			return result;
		}
	}
	return null;
};

ValidatorContext.prototype.addFormat = function (format, validator) {
	if (typeof format === 'object') {
		for (var key in format) {
			this.addFormat(key, format[key]);
		}
		return this;
	}
	this.formatValidators[format] = validator;
};
ValidatorContext.prototype.resolveRefs = function (schema, urlHistory) {
	if (schema['$ref'] !== undefined) {
		urlHistory = urlHistory || {};
		if (urlHistory[schema['$ref']]) {
			return this.createError(ErrorCodes.CIRCULAR_REFERENCE, {urls: Object.keys(urlHistory).join(', ')}, '', '', null, undefined, schema);
		}
		urlHistory[schema['$ref']] = true;
		schema = this.getSchema(schema['$ref'], urlHistory);
	}
	return schema;
};
ValidatorContext.prototype.getSchema = function (url, urlHistory) {
	var schema;
	if (this.schemas[url] !== undefined) {
		schema = this.schemas[url];
		return this.resolveRefs(schema, urlHistory);
	}
	var baseUrl = url;
	var fragment = "";
	if (url.indexOf('#') !== -1) {
		fragment = url.substring(url.indexOf("#") + 1);
		baseUrl = url.substring(0, url.indexOf("#"));
	}
	if (typeof this.schemas[baseUrl] === 'object') {
		schema = this.schemas[baseUrl];
		var pointerPath = decodeURIComponent(fragment);
		if (pointerPath === "") {
			return this.resolveRefs(schema, urlHistory);
		} else if (pointerPath.charAt(0) !== "/") {
			return undefined;
		}
		var parts = pointerPath.split("/").slice(1);
		for (var i = 0; i < parts.length; i++) {
			var component = parts[i].replace(/~1/g, "/").replace(/~0/g, "~");
			if (schema[component] === undefined) {
				schema = undefined;
				break;
			}
			schema = schema[component];
		}
		if (schema !== undefined) {
			return this.resolveRefs(schema, urlHistory);
		}
	}
	if (this.missing[baseUrl] === undefined) {
		this.missing.push(baseUrl);
		this.missing[baseUrl] = baseUrl;
		this.missingMap[baseUrl] = baseUrl;
	}
};
ValidatorContext.prototype.searchSchemas = function (schema, url) {
	if (Array.isArray(schema)) {
		for (var i = 0; i < schema.length; i++) {
			this.searchSchemas(schema[i], url);
		}
	} else if (schema && typeof schema === "object") {
		if (typeof schema.id === "string") {
			if (isTrustedUrl(url, schema.id)) {
				if (this.schemas[schema.id] === undefined) {
					this.schemas[schema.id] = schema;
				}
			}
		}
		for (var key in schema) {
			if (key !== "enum") {
				if (typeof schema[key] === "object") {
					this.searchSchemas(schema[key], url);
				} else if (key === "$ref") {
					var uri = getDocumentUri(schema[key]);
					if (uri && this.schemas[uri] === undefined && this.missingMap[uri] === undefined) {
						this.missingMap[uri] = uri;
					}
				}
			}
		}
	}
};
ValidatorContext.prototype.addSchema = function (url, schema) {
	//overload
	if (typeof url !== 'string' || typeof schema === 'undefined') {
		if (typeof url === 'object' && typeof url.id === 'string') {
			schema = url;
			url = schema.id;
		}
		else {
			return;
		}
	}
	if (url === getDocumentUri(url) + "#") {
		// Remove empty fragment
		url = getDocumentUri(url);
	}
	this.schemas[url] = schema;
	delete this.missingMap[url];
	normSchema(schema, url);
	this.searchSchemas(schema, url);
};

ValidatorContext.prototype.getSchemaMap = function () {
	var map = {};
	for (var key in this.schemas) {
		map[key] = this.schemas[key];
	}
	return map;
};

ValidatorContext.prototype.getSchemaUris = function (filterRegExp) {
	var list = [];
	for (var key in this.schemas) {
		if (!filterRegExp || filterRegExp.test(key)) {
			list.push(key);
		}
	}
	return list;
};

ValidatorContext.prototype.getMissingUris = function (filterRegExp) {
	var list = [];
	for (var key in this.missingMap) {
		if (!filterRegExp || filterRegExp.test(key)) {
			list.push(key);
		}
	}
	return list;
};

ValidatorContext.prototype.dropSchemas = function () {
	this.schemas = {};
	this.reset();
};
ValidatorContext.prototype.reset = function () {
	this.missing = [];
	this.missingMap = {};
	this.errors = [];
};

ValidatorContext.prototype.validateAll = function (data, schema, dataPathParts, schemaPathParts, dataPointerPath) {
	var topLevel;
	schema = this.resolveRefs(schema);
	if (!schema) {
		return null;
	} else if (schema instanceof ValidationError) {
		this.errors.push(schema);
		return schema;
	}

	var startErrorCount = this.errors.length;
	var frozenIndex, scannedFrozenSchemaIndex = null, scannedSchemasIndex = null;
	if (this.checkRecursive && data && typeof data === 'object') {
		topLevel = !this.scanned.length;
		if (data[this.validatedSchemasKey]) {
			var schemaIndex = data[this.validatedSchemasKey].indexOf(schema);
			if (schemaIndex !== -1) {
				this.errors = this.errors.concat(data[this.validationErrorsKey][schemaIndex]);
				return null;
			}
		}
		if (Object.isFrozen(data)) {
			frozenIndex = this.scannedFrozen.indexOf(data);
			if (frozenIndex !== -1) {
				var frozenSchemaIndex = this.scannedFrozenSchemas[frozenIndex].indexOf(schema);
				if (frozenSchemaIndex !== -1) {
					this.errors = this.errors.concat(this.scannedFrozenValidationErrors[frozenIndex][frozenSchemaIndex]);
					return null;
				}
			}
		}
		this.scanned.push(data);
		if (Object.isFrozen(data)) {
			if (frozenIndex === -1) {
				frozenIndex = this.scannedFrozen.length;
				this.scannedFrozen.push(data);
				this.scannedFrozenSchemas.push([]);
			}
			scannedFrozenSchemaIndex = this.scannedFrozenSchemas[frozenIndex].length;
			this.scannedFrozenSchemas[frozenIndex][scannedFrozenSchemaIndex] = schema;
			this.scannedFrozenValidationErrors[frozenIndex][scannedFrozenSchemaIndex] = [];
		} else {
			if (!data[this.validatedSchemasKey]) {
				try {
					Object.defineProperty(data, this.validatedSchemasKey, {
						value: [],
						configurable: true
					});
					Object.defineProperty(data, this.validationErrorsKey, {
						value: [],
						configurable: true
					});
				} catch (e) {
					//IE 7/8 workaround
					data[this.validatedSchemasKey] = [];
					data[this.validationErrorsKey] = [];
				}
			}
			scannedSchemasIndex = data[this.validatedSchemasKey].length;
			data[this.validatedSchemasKey][scannedSchemasIndex] = schema;
			data[this.validationErrorsKey][scannedSchemasIndex] = [];
		}
	}

	var errorCount = this.errors.length;
	var error = this.validateBasic(data, schema, dataPointerPath)
		|| this.validateNumeric(data, schema, dataPointerPath)
		|| this.validateString(data, schema, dataPointerPath)
		|| this.validateArray(data, schema, dataPointerPath)
		|| this.validateObject(data, schema, dataPointerPath)
		|| this.validateCombinations(data, schema, dataPointerPath)
		|| this.validateHypermedia(data, schema, dataPointerPath)
		|| this.validateFormat(data, schema, dataPointerPath)
		|| this.validateDefinedKeywords(data, schema, dataPointerPath)
		|| null;

	if (topLevel) {
		while (this.scanned.length) {
			var item = this.scanned.pop();
			delete item[this.validatedSchemasKey];
		}
		this.scannedFrozen = [];
		this.scannedFrozenSchemas = [];
	}

	if (error || errorCount !== this.errors.length) {
		while ((dataPathParts && dataPathParts.length) || (schemaPathParts && schemaPathParts.length)) {
			var dataPart = (dataPathParts && dataPathParts.length) ? "" + dataPathParts.pop() : null;
			var schemaPart = (schemaPathParts && schemaPathParts.length) ? "" + schemaPathParts.pop() : null;
			if (error) {
				error = error.prefixWith(dataPart, schemaPart);
			}
			this.prefixErrors(errorCount, dataPart, schemaPart);
		}
	}

	if (scannedFrozenSchemaIndex !== null) {
		this.scannedFrozenValidationErrors[frozenIndex][scannedFrozenSchemaIndex] = this.errors.slice(startErrorCount);
	} else if (scannedSchemasIndex !== null) {
		data[this.validationErrorsKey][scannedSchemasIndex] = this.errors.slice(startErrorCount);
	}

	return this.handleError(error);
};
ValidatorContext.prototype.validateFormat = function (data, schema) {
	if (typeof schema.format !== 'string' || !this.formatValidators[schema.format]) {
		return null;
	}
	var errorMessage = this.formatValidators[schema.format].call(null, data, schema);
	if (typeof errorMessage === 'string' || typeof errorMessage === 'number') {
		return this.createError(ErrorCodes.FORMAT_CUSTOM, {message: errorMessage}, '', '/format', null, data, schema);
	} else if (errorMessage && typeof errorMessage === 'object') {
		return this.createError(ErrorCodes.FORMAT_CUSTOM, {message: errorMessage.message || "?"}, errorMessage.dataPath || '', errorMessage.schemaPath || "/format", null, data, schema);
	}
	return null;
};
ValidatorContext.prototype.validateDefinedKeywords = function (data, schema, dataPointerPath) {
	for (var key in this.definedKeywords) {
		if (typeof schema[key] === 'undefined') {
			continue;
		}
		var validationFunctions = this.definedKeywords[key];
		for (var i = 0; i < validationFunctions.length; i++) {
			var func = validationFunctions[i];
			var result = func(data, schema[key], schema, dataPointerPath);
			if (typeof result === 'string' || typeof result === 'number') {
				return this.createError(ErrorCodes.KEYWORD_CUSTOM, {key: key, message: result}, '', '', null, data, schema).prefixWith(null, key);
			} else if (result && typeof result === 'object') {
				var code = result.code;
				if (typeof code === 'string') {
					if (!ErrorCodes[code]) {
						throw new Error('Undefined error code (use defineError): ' + code);
					}
					code = ErrorCodes[code];
				} else if (typeof code !== 'number') {
					code = ErrorCodes.KEYWORD_CUSTOM;
				}
				var messageParams = (typeof result.message === 'object') ? result.message : {key: key, message: result.message || "?"};
				var schemaPath = result.schemaPath || ("/" + key.replace(/~/g, '~0').replace(/\//g, '~1'));
				return this.createError(code, messageParams, result.dataPath || null, schemaPath, null, data, schema);
			}
		}
	}
	return null;
};

function recursiveCompare(A, B) {
	if (A === B) {
		return true;
	}
	if (A && B && typeof A === "object" && typeof B === "object") {
		if (Array.isArray(A) !== Array.isArray(B)) {
			return false;
		} else if (Array.isArray(A)) {
			if (A.length !== B.length) {
				return false;
			}
			for (var i = 0; i < A.length; i++) {
				if (!recursiveCompare(A[i], B[i])) {
					return false;
				}
			}
		} else {
			var key;
			for (key in A) {
				if (B[key] === undefined && A[key] !== undefined) {
					return false;
				}
			}
			for (key in B) {
				if (A[key] === undefined && B[key] !== undefined) {
					return false;
				}
			}
			for (key in A) {
				if (!recursiveCompare(A[key], B[key])) {
					return false;
				}
			}
		}
		return true;
	}
	return false;
}

ValidatorContext.prototype.validateBasic = function validateBasic(data, schema, dataPointerPath) {
	var error;
	if (error = this.validateType(data, schema, dataPointerPath)) {
		return error.prefixWith(null, "type");
	}
	if (error = this.validateEnum(data, schema, dataPointerPath)) {
		return error.prefixWith(null, "type");
	}
	return null;
};

ValidatorContext.prototype.validateType = function validateType(data, schema) {
	if (schema.type === undefined) {
		return null;
	}
	var dataType = typeof data;
	if (data === null) {
		dataType = "null";
	} else if (Array.isArray(data)) {
		dataType = "array";
	}
	var allowedTypes = schema.type;
	if (!Array.isArray(allowedTypes)) {
		allowedTypes = [allowedTypes];
	}

	for (var i = 0; i < allowedTypes.length; i++) {
		var type = allowedTypes[i];
		if (type === dataType || (type === "integer" && dataType === "number" && (data % 1 === 0))) {
			return null;
		}
	}
	return this.createError(ErrorCodes.INVALID_TYPE, {type: dataType, expected: allowedTypes.join("/")}, '', '', null, data, schema);
};

ValidatorContext.prototype.validateEnum = function validateEnum(data, schema) {
	if (schema["enum"] === undefined) {
		return null;
	}
	for (var i = 0; i < schema["enum"].length; i++) {
		var enumVal = schema["enum"][i];
		if (recursiveCompare(data, enumVal)) {
			return null;
		}
	}
	return this.createError(ErrorCodes.ENUM_MISMATCH, {value: (typeof JSON !== 'undefined') ? JSON.stringify(data) : data}, '', '', null, data, schema);
};

ValidatorContext.prototype.validateNumeric = function validateNumeric(data, schema, dataPointerPath) {
	return this.validateMultipleOf(data, schema, dataPointerPath)
		|| this.validateMinMax(data, schema, dataPointerPath)
		|| this.validateNaN(data, schema, dataPointerPath)
		|| null;
};

var CLOSE_ENOUGH_LOW = Math.pow(2, -51);
var CLOSE_ENOUGH_HIGH = 1 - CLOSE_ENOUGH_LOW;
ValidatorContext.prototype.validateMultipleOf = function validateMultipleOf(data, schema) {
	var multipleOf = schema.multipleOf || schema.divisibleBy;
	if (multipleOf === undefined) {
		return null;
	}
	if (typeof data === "number") {
		var remainder = (data/multipleOf)%1;
		if (remainder >= CLOSE_ENOUGH_LOW && remainder < CLOSE_ENOUGH_HIGH) {
			return this.createError(ErrorCodes.NUMBER_MULTIPLE_OF, {value: data, multipleOf: multipleOf}, '', '', null, data, schema);
		}
	}
	return null;
};

ValidatorContext.prototype.validateMinMax = function validateMinMax(data, schema) {
	if (typeof data !== "number") {
		return null;
	}
	if (schema.minimum !== undefined) {
		if (data < schema.minimum) {
			return this.createError(ErrorCodes.NUMBER_MINIMUM, {value: data, minimum: schema.minimum}, '', '/minimum', null, data, schema);
		}
		if (schema.exclusiveMinimum && data === schema.minimum) {
			return this.createError(ErrorCodes.NUMBER_MINIMUM_EXCLUSIVE, {value: data, minimum: schema.minimum}, '', '/exclusiveMinimum', null, data, schema);
		}
	}
	if (schema.maximum !== undefined) {
		if (data > schema.maximum) {
			return this.createError(ErrorCodes.NUMBER_MAXIMUM, {value: data, maximum: schema.maximum}, '', '/maximum', null, data, schema);
		}
		if (schema.exclusiveMaximum && data === schema.maximum) {
			return this.createError(ErrorCodes.NUMBER_MAXIMUM_EXCLUSIVE, {value: data, maximum: schema.maximum}, '', '/exclusiveMaximum', null, data, schema);
		}
	}
	return null;
};

ValidatorContext.prototype.validateNaN = function validateNaN(data, schema) {
	if (typeof data !== "number") {
		return null;
	}
	if (isNaN(data) === true || data === Infinity || data === -Infinity) {
		return this.createError(ErrorCodes.NUMBER_NOT_A_NUMBER, {value: data}, '', '/type', null, data, schema);
	}
	return null;
};

ValidatorContext.prototype.validateString = function validateString(data, schema, dataPointerPath) {
	return this.validateStringLength(data, schema, dataPointerPath)
		|| this.validateStringPattern(data, schema, dataPointerPath)
		|| null;
};

ValidatorContext.prototype.validateStringLength = function validateStringLength(data, schema) {
	if (typeof data !== "string") {
		return null;
	}
	if (schema.minLength !== undefined) {
		if (data.length < schema.minLength) {
			return this.createError(ErrorCodes.STRING_LENGTH_SHORT, {length: data.length, minimum: schema.minLength}, '', '/minLength', null, data, schema);
		}
	}
	if (schema.maxLength !== undefined) {
		if (data.length > schema.maxLength) {
			return this.createError(ErrorCodes.STRING_LENGTH_LONG, {length: data.length, maximum: schema.maxLength}, '', '/maxLength', null, data, schema);
		}
	}
	return null;
};

ValidatorContext.prototype.validateStringPattern = function validateStringPattern(data, schema) {
	if (typeof data !== "string" || (typeof schema.pattern !== "string" && !(schema.pattern instanceof RegExp))) {
		return null;
	}
	var regexp;
	if (schema.pattern instanceof RegExp) {
	  regexp = schema.pattern;
	}
	else {
	  var body, flags = '';
	  // Check for regular expression literals
	  // @see http://www.ecma-international.org/ecma-262/5.1/#sec-7.8.5
	  var literal = schema.pattern.match(/^\/(.+)\/([img]*)$/);
	  if (literal) {
	    body = literal[1];
	    flags = literal[2];
	  }
	  else {
	    body = schema.pattern;
	  }
	  regexp = new RegExp(body, flags);
	}
	if (!regexp.test(data)) {
		return this.createError(ErrorCodes.STRING_PATTERN, {pattern: schema.pattern}, '', '/pattern', null, data, schema);
	}
	return null;
};

ValidatorContext.prototype.validateArray = function validateArray(data, schema, dataPointerPath) {
	if (!Array.isArray(data)) {
		return null;
	}
	return this.validateArrayLength(data, schema, dataPointerPath)
		|| this.validateArrayUniqueItems(data, schema, dataPointerPath)
		|| this.validateArrayItems(data, schema, dataPointerPath)
		|| null;
};

ValidatorContext.prototype.validateArrayLength = function validateArrayLength(data, schema) {
	var error;
	if (schema.minItems !== undefined) {
		if (data.length < schema.minItems) {
			error = this.createError(ErrorCodes.ARRAY_LENGTH_SHORT, {length: data.length, minimum: schema.minItems}, '', '/minItems', null, data, schema);
			if (this.handleError(error)) {
				return error;
			}
		}
	}
	if (schema.maxItems !== undefined) {
		if (data.length > schema.maxItems) {
			error = this.createError(ErrorCodes.ARRAY_LENGTH_LONG, {length: data.length, maximum: schema.maxItems}, '', '/maxItems', null, data, schema);
			if (this.handleError(error)) {
				return error;
			}
		}
	}
	return null;
};

ValidatorContext.prototype.validateArrayUniqueItems = function validateArrayUniqueItems(data, schema) {
	if (schema.uniqueItems) {
		for (var i = 0; i < data.length; i++) {
			for (var j = i + 1; j < data.length; j++) {
				if (recursiveCompare(data[i], data[j])) {
					var error = this.createError(ErrorCodes.ARRAY_UNIQUE, {match1: i, match2: j}, '', '/uniqueItems', null, data, schema);
					if (this.handleError(error)) {
						return error;
					}
				}
			}
		}
	}
	return null;
};

ValidatorContext.prototype.validateArrayItems = function validateArrayItems(data, schema, dataPointerPath) {
	if (schema.items === undefined) {
		return null;
	}
	var error, i;
	if (Array.isArray(schema.items)) {
		for (i = 0; i < data.length; i++) {
			if (i < schema.items.length) {
				if (error = this.validateAll(data[i], schema.items[i], [i], ["items", i], dataPointerPath + "/" + i)) {
					return error;
				}
			} else if (schema.additionalItems !== undefined) {
				if (typeof schema.additionalItems === "boolean") {
					if (!schema.additionalItems) {
						error = (this.createError(ErrorCodes.ARRAY_ADDITIONAL_ITEMS, {}, '/' + i, '/additionalItems', null, data, schema));
						if (this.handleError(error)) {
							return error;
						}
					}
				} else if (error = this.validateAll(data[i], schema.additionalItems, [i], ["additionalItems"], dataPointerPath + "/" + i)) {
					return error;
				}
			}
		}
	} else {
		for (i = 0; i < data.length; i++) {
			if (error = this.validateAll(data[i], schema.items, [i], ["items"], dataPointerPath + "/" + i)) {
				return error;
			}
		}
	}
	return null;
};

ValidatorContext.prototype.validateObject = function validateObject(data, schema, dataPointerPath) {
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		return null;
	}
	return this.validateObjectMinMaxProperties(data, schema, dataPointerPath)
		|| this.validateObjectRequiredProperties(data, schema, dataPointerPath)
		|| this.validateObjectProperties(data, schema, dataPointerPath)
		|| this.validateObjectDependencies(data, schema, dataPointerPath)
		|| null;
};

ValidatorContext.prototype.validateObjectMinMaxProperties = function validateObjectMinMaxProperties(data, schema) {
	var keys = Object.keys(data);
	var error;
	if (schema.minProperties !== undefined) {
		if (keys.length < schema.minProperties) {
			error = this.createError(ErrorCodes.OBJECT_PROPERTIES_MINIMUM, {propertyCount: keys.length, minimum: schema.minProperties}, '', '/minProperties', null, data, schema);
			if (this.handleError(error)) {
				return error;
			}
		}
	}
	if (schema.maxProperties !== undefined) {
		if (keys.length > schema.maxProperties) {
			error = this.createError(ErrorCodes.OBJECT_PROPERTIES_MAXIMUM, {propertyCount: keys.length, maximum: schema.maxProperties}, '', '/maxProperties', null, data, schema);
			if (this.handleError(error)) {
				return error;
			}
		}
	}
	return null;
};

ValidatorContext.prototype.validateObjectRequiredProperties = function validateObjectRequiredProperties(data, schema) {
	if (schema.required !== undefined) {
		for (var i = 0; i < schema.required.length; i++) {
			var key = schema.required[i];
			if (data[key] === undefined) {
				var error = this.createError(ErrorCodes.OBJECT_REQUIRED, {key: key}, '', '/required/' + i, null, data, schema);
				if (this.handleError(error)) {
					return error;
				}
			}
		}
	}
	return null;
};

ValidatorContext.prototype.validateObjectProperties = function validateObjectProperties(data, schema, dataPointerPath) {
	var error;
	for (var key in data) {
		var keyPointerPath = dataPointerPath + "/" + key.replace(/~/g, '~0').replace(/\//g, '~1');
		var foundMatch = false;
		if (schema.properties !== undefined && schema.properties[key] !== undefined) {
			foundMatch = true;
			if (error = this.validateAll(data[key], schema.properties[key], [key], ["properties", key], keyPointerPath)) {
				return error;
			}
		}
		if (schema.patternProperties !== undefined) {
			for (var patternKey in schema.patternProperties) {
				var regexp = new RegExp(patternKey);
				if (regexp.test(key)) {
					foundMatch = true;
					if (error = this.validateAll(data[key], schema.patternProperties[patternKey], [key], ["patternProperties", patternKey], keyPointerPath)) {
						return error;
					}
				}
			}
		}
		if (!foundMatch) {
			if (schema.additionalProperties !== undefined) {
				if (this.trackUnknownProperties) {
					this.knownPropertyPaths[keyPointerPath] = true;
					delete this.unknownPropertyPaths[keyPointerPath];
				}
				if (typeof schema.additionalProperties === "boolean") {
					if (!schema.additionalProperties) {
						error = this.createError(ErrorCodes.OBJECT_ADDITIONAL_PROPERTIES, {key: key}, '', '/additionalProperties', null, data, schema).prefixWith(key, null);
						if (this.handleError(error)) {
							return error;
						}
					}
				} else {
					if (error = this.validateAll(data[key], schema.additionalProperties, [key], ["additionalProperties"], keyPointerPath)) {
						return error;
					}
				}
			} else if (this.trackUnknownProperties && !this.knownPropertyPaths[keyPointerPath]) {
				this.unknownPropertyPaths[keyPointerPath] = true;
			}
		} else if (this.trackUnknownProperties) {
			this.knownPropertyPaths[keyPointerPath] = true;
			delete this.unknownPropertyPaths[keyPointerPath];
		}
	}
	return null;
};

ValidatorContext.prototype.validateObjectDependencies = function validateObjectDependencies(data, schema, dataPointerPath) {
	var error;
	if (schema.dependencies !== undefined) {
		for (var depKey in schema.dependencies) {
			if (data[depKey] !== undefined) {
				var dep = schema.dependencies[depKey];
				if (typeof dep === "string") {
					if (data[dep] === undefined) {
						error = this.createError(ErrorCodes.OBJECT_DEPENDENCY_KEY, {key: depKey, missing: dep}, '', '', null, data, schema).prefixWith(null, depKey).prefixWith(null, "dependencies");
						if (this.handleError(error)) {
							return error;
						}
					}
				} else if (Array.isArray(dep)) {
					for (var i = 0; i < dep.length; i++) {
						var requiredKey = dep[i];
						if (data[requiredKey] === undefined) {
							error = this.createError(ErrorCodes.OBJECT_DEPENDENCY_KEY, {key: depKey, missing: requiredKey}, '', '/' + i, null, data, schema).prefixWith(null, depKey).prefixWith(null, "dependencies");
							if (this.handleError(error)) {
								return error;
							}
						}
					}
				} else {
					if (error = this.validateAll(data, dep, [], ["dependencies", depKey], dataPointerPath)) {
						return error;
					}
				}
			}
		}
	}
	return null;
};

ValidatorContext.prototype.validateCombinations = function validateCombinations(data, schema, dataPointerPath) {
	return this.validateAllOf(data, schema, dataPointerPath)
		|| this.validateAnyOf(data, schema, dataPointerPath)
		|| this.validateOneOf(data, schema, dataPointerPath)
		|| this.validateNot(data, schema, dataPointerPath)
		|| null;
};

ValidatorContext.prototype.validateAllOf = function validateAllOf(data, schema, dataPointerPath) {
	if (schema.allOf === undefined) {
		return null;
	}
	var error;
	for (var i = 0; i < schema.allOf.length; i++) {
		var subSchema = schema.allOf[i];
		if (error = this.validateAll(data, subSchema, [], ["allOf", i], dataPointerPath)) {
			return error;
		}
	}
	return null;
};

ValidatorContext.prototype.validateAnyOf = function validateAnyOf(data, schema, dataPointerPath) {
	if (schema.anyOf === undefined) {
		return null;
	}
	var errors = [];
	var startErrorCount = this.errors.length;
	var oldUnknownPropertyPaths, oldKnownPropertyPaths;
	if (this.trackUnknownProperties) {
		oldUnknownPropertyPaths = this.unknownPropertyPaths;
		oldKnownPropertyPaths = this.knownPropertyPaths;
	}
	var errorAtEnd = true;
	for (var i = 0; i < schema.anyOf.length; i++) {
		if (this.trackUnknownProperties) {
			this.unknownPropertyPaths = {};
			this.knownPropertyPaths = {};
		}
		var subSchema = schema.anyOf[i];

		var errorCount = this.errors.length;
		var error = this.validateAll(data, subSchema, [], ["anyOf", i], dataPointerPath);

		if (error === null && errorCount === this.errors.length) {
			this.errors = this.errors.slice(0, startErrorCount);

			if (this.trackUnknownProperties) {
				for (var knownKey in this.knownPropertyPaths) {
					oldKnownPropertyPaths[knownKey] = true;
					delete oldUnknownPropertyPaths[knownKey];
				}
				for (var unknownKey in this.unknownPropertyPaths) {
					if (!oldKnownPropertyPaths[unknownKey]) {
						oldUnknownPropertyPaths[unknownKey] = true;
					}
				}
				// We need to continue looping so we catch all the property definitions, but we don't want to return an error
				errorAtEnd = false;
				continue;
			}

			return null;
		}
		if (error) {
			errors.push(error.prefixWith(null, "" + i).prefixWith(null, "anyOf"));
		}
	}
	if (this.trackUnknownProperties) {
		this.unknownPropertyPaths = oldUnknownPropertyPaths;
		this.knownPropertyPaths = oldKnownPropertyPaths;
	}
	if (errorAtEnd) {
		errors = errors.concat(this.errors.slice(startErrorCount));
		this.errors = this.errors.slice(0, startErrorCount);
		return this.createError(ErrorCodes.ANY_OF_MISSING, {}, "", "/anyOf", errors, data, schema);
	}
};

ValidatorContext.prototype.validateOneOf = function validateOneOf(data, schema, dataPointerPath) {
	if (schema.oneOf === undefined) {
		return null;
	}
	var validIndex = null;
	var errors = [];
	var startErrorCount = this.errors.length;
	var oldUnknownPropertyPaths, oldKnownPropertyPaths;
	if (this.trackUnknownProperties) {
		oldUnknownPropertyPaths = this.unknownPropertyPaths;
		oldKnownPropertyPaths = this.knownPropertyPaths;
	}
	for (var i = 0; i < schema.oneOf.length; i++) {
		if (this.trackUnknownProperties) {
			this.unknownPropertyPaths = {};
			this.knownPropertyPaths = {};
		}
		var subSchema = schema.oneOf[i];

		var errorCount = this.errors.length;
		var error = this.validateAll(data, subSchema, [], ["oneOf", i], dataPointerPath);

		if (error === null && errorCount === this.errors.length) {
			if (validIndex === null) {
				validIndex = i;
			} else {
				this.errors = this.errors.slice(0, startErrorCount);
				return this.createError(ErrorCodes.ONE_OF_MULTIPLE, {index1: validIndex, index2: i}, "", "/oneOf", null, data, schema);
			}
			if (this.trackUnknownProperties) {
				for (var knownKey in this.knownPropertyPaths) {
					oldKnownPropertyPaths[knownKey] = true;
					delete oldUnknownPropertyPaths[knownKey];
				}
				for (var unknownKey in this.unknownPropertyPaths) {
					if (!oldKnownPropertyPaths[unknownKey]) {
						oldUnknownPropertyPaths[unknownKey] = true;
					}
				}
			}
		} else if (error) {
			errors.push(error);
		}
	}
	if (this.trackUnknownProperties) {
		this.unknownPropertyPaths = oldUnknownPropertyPaths;
		this.knownPropertyPaths = oldKnownPropertyPaths;
	}
	if (validIndex === null) {
		errors = errors.concat(this.errors.slice(startErrorCount));
		this.errors = this.errors.slice(0, startErrorCount);
		return this.createError(ErrorCodes.ONE_OF_MISSING, {}, "", "/oneOf", errors, data, schema);
	} else {
		this.errors = this.errors.slice(0, startErrorCount);
	}
	return null;
};

ValidatorContext.prototype.validateNot = function validateNot(data, schema, dataPointerPath) {
	if (schema.not === undefined) {
		return null;
	}
	var oldErrorCount = this.errors.length;
	var oldUnknownPropertyPaths, oldKnownPropertyPaths;
	if (this.trackUnknownProperties) {
		oldUnknownPropertyPaths = this.unknownPropertyPaths;
		oldKnownPropertyPaths = this.knownPropertyPaths;
		this.unknownPropertyPaths = {};
		this.knownPropertyPaths = {};
	}
	var error = this.validateAll(data, schema.not, null, null, dataPointerPath);
	var notErrors = this.errors.slice(oldErrorCount);
	this.errors = this.errors.slice(0, oldErrorCount);
	if (this.trackUnknownProperties) {
		this.unknownPropertyPaths = oldUnknownPropertyPaths;
		this.knownPropertyPaths = oldKnownPropertyPaths;
	}
	if (error === null && notErrors.length === 0) {
		return this.createError(ErrorCodes.NOT_PASSED, {}, "", "/not", null, data, schema);
	}
	return null;
};

ValidatorContext.prototype.validateHypermedia = function validateCombinations(data, schema, dataPointerPath) {
	if (!schema.links) {
		return null;
	}
	var error;
	for (var i = 0; i < schema.links.length; i++) {
		var ldo = schema.links[i];
		if (ldo.rel === "describedby") {
			var template = new UriTemplate(ldo.href);
			var allPresent = true;
			for (var j = 0; j < template.varNames.length; j++) {
				if (!(template.varNames[j] in data)) {
					allPresent = false;
					break;
				}
			}
			if (allPresent) {
				var schemaUrl = template.fillFromObject(data);
				var subSchema = {"$ref": schemaUrl};
				if (error = this.validateAll(data, subSchema, [], ["links", i], dataPointerPath)) {
					return error;
				}
			}
		}
	}
};

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

function getDocumentUri(uri) {
	return uri.split('#')[0];
}
function normSchema(schema, baseUri) {
	if (schema && typeof schema === "object") {
		if (baseUri === undefined) {
			baseUri = schema.id;
		} else if (typeof schema.id === "string") {
			baseUri = resolveUrl(baseUri, schema.id);
			schema.id = baseUri;
		}
		if (Array.isArray(schema)) {
			for (var i = 0; i < schema.length; i++) {
				normSchema(schema[i], baseUri);
			}
		} else {
			if (typeof schema['$ref'] === "string") {
				schema['$ref'] = resolveUrl(baseUri, schema['$ref']);
			}
			for (var key in schema) {
				if (key !== "enum") {
					normSchema(schema[key], baseUri);
				}
			}
		}
	}
}

function defaultErrorReporter(language) {
	language = language || 'en';

	var errorMessages = languages[language];

	return function (error) {
		var messageTemplate = errorMessages[error.code] || ErrorMessagesDefault[error.code];
		if (typeof messageTemplate !== 'string') {
			return "Unknown error code " + error.code + ": " + JSON.stringify(error.messageParams);
		}
		var messageParams = error.params;
		// Adapted from Crockford's supplant()
		return messageTemplate.replace(/\{([^{}]*)\}/g, function (whole, varName) {
			var subValue = messageParams[varName];
			return typeof subValue === 'string' || typeof subValue === 'number' ? subValue : whole;
		});
	};
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
	NUMBER_NOT_A_NUMBER: 105,
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
	ARRAY_ADDITIONAL_ITEMS: 403,
	// Custom/user-defined errors
	FORMAT_CUSTOM: 500,
	KEYWORD_CUSTOM: 501,
	// Schema structure
	CIRCULAR_REFERENCE: 600,
	// Non-standard validation options
	UNKNOWN_PROPERTY: 1000
};
var ErrorCodeLookup = {};
for (var key in ErrorCodes) {
	ErrorCodeLookup[ErrorCodes[key]] = key;
}
var ErrorMessagesDefault = {
	INVALID_TYPE: "Invalid type: {type} (expected {expected})",
	ENUM_MISMATCH: "No enum match for: {value}",
	ANY_OF_MISSING: "Data does not match any schemas from \"anyOf\"",
	ONE_OF_MISSING: "Data does not match any schemas from \"oneOf\"",
	ONE_OF_MULTIPLE: "Data is valid against more than one schema from \"oneOf\": indices {index1} and {index2}",
	NOT_PASSED: "Data matches schema from \"not\"",
	// Numeric errors
	NUMBER_MULTIPLE_OF: "Value {value} is not a multiple of {multipleOf}",
	NUMBER_MINIMUM: "Value {value} is less than minimum {minimum}",
	NUMBER_MINIMUM_EXCLUSIVE: "Value {value} is equal to exclusive minimum {minimum}",
	NUMBER_MAXIMUM: "Value {value} is greater than maximum {maximum}",
	NUMBER_MAXIMUM_EXCLUSIVE: "Value {value} is equal to exclusive maximum {maximum}",
	NUMBER_NOT_A_NUMBER: "Value {value} is not a valid number",
	// String errors
	STRING_LENGTH_SHORT: "String is too short ({length} chars), minimum {minimum}",
	STRING_LENGTH_LONG: "String is too long ({length} chars), maximum {maximum}",
	STRING_PATTERN: "String does not match pattern: {pattern}",
	// Object errors
	OBJECT_PROPERTIES_MINIMUM: "Too few properties defined ({propertyCount}), minimum {minimum}",
	OBJECT_PROPERTIES_MAXIMUM: "Too many properties defined ({propertyCount}), maximum {maximum}",
	OBJECT_REQUIRED: "Missing required property: {key}",
	OBJECT_ADDITIONAL_PROPERTIES: "Additional properties not allowed",
	OBJECT_DEPENDENCY_KEY: "Dependency failed - key must exist: {missing} (due to key: {key})",
	// Array errors
	ARRAY_LENGTH_SHORT: "Array is too short ({length}), minimum {minimum}",
	ARRAY_LENGTH_LONG: "Array is too long ({length}), maximum {maximum}",
	ARRAY_UNIQUE: "Array items are not unique (indices {match1} and {match2})",
	ARRAY_ADDITIONAL_ITEMS: "Additional items not allowed",
	// Format errors
	FORMAT_CUSTOM: "Format validation failed ({message})",
	KEYWORD_CUSTOM: "Keyword failed: {key} ({message})",
	// Schema structure
	CIRCULAR_REFERENCE: "Circular $refs: {urls}",
	// Non-standard validation options
	UNKNOWN_PROPERTY: "Unknown property (not in schema)"
};

function ValidationError(code, params, dataPath, schemaPath, subErrors) {
	Error.call(this);
	if (code === undefined) {
		throw new Error ("No error code supplied: " + schemaPath);
	}
	this.message = '';
	this.params = params;
	this.code = code;
	this.dataPath = dataPath || "";
	this.schemaPath = schemaPath || "";
	this.subErrors = subErrors || null;

	var err = new Error(this.message);
	this.stack = err.stack || err.stacktrace;
	if (!this.stack) {
		try {
			throw err;
		}
		catch(err) {
			this.stack = err.stack || err.stacktrace;
		}
	}
}
ValidationError.prototype = Object.create(Error.prototype);
ValidationError.prototype.constructor = ValidationError;
ValidationError.prototype.name = 'ValidationError';

ValidationError.prototype.prefixWith = function (dataPrefix, schemaPrefix) {
	if (dataPrefix !== null) {
		dataPrefix = dataPrefix.replace(/~/g, "~0").replace(/\//g, "~1");
		this.dataPath = "/" + dataPrefix + this.dataPath;
	}
	if (schemaPrefix !== null) {
		schemaPrefix = schemaPrefix.replace(/~/g, "~0").replace(/\//g, "~1");
		this.schemaPath = "/" + schemaPrefix + this.schemaPath;
	}
	if (this.subErrors !== null) {
		for (var i = 0; i < this.subErrors.length; i++) {
			this.subErrors[i].prefixWith(dataPrefix, schemaPrefix);
		}
	}
	return this;
};

function isTrustedUrl(baseUrl, testUrl) {
	if(testUrl.substring(0, baseUrl.length) === baseUrl){
		var remainder = testUrl.substring(baseUrl.length);
		if ((testUrl.length > 0 && testUrl.charAt(baseUrl.length - 1) === "/")
			|| remainder.charAt(0) === "#"
			|| remainder.charAt(0) === "?") {
			return true;
		}
	}
	return false;
}

var languages = {};
function createApi(language) {
	var globalContext = new ValidatorContext();
	var currentLanguage;
	var customErrorReporter;
	var api = {
		setErrorReporter: function (reporter) {
			if (typeof reporter === 'string') {
				return this.language(reporter);
			}
			customErrorReporter = reporter;
			return true;
		},
		addFormat: function () {
			globalContext.addFormat.apply(globalContext, arguments);
		},
		language: function (code) {
			if (!code) {
				return currentLanguage;
			}
			if (!languages[code]) {
				code = code.split('-')[0]; // fall back to base language
			}
			if (languages[code]) {
				currentLanguage = code;
				return code; // so you can tell if fall-back has happened
			}
			return false;
		},
		addLanguage: function (code, messageMap) {
			var key;
			for (key in ErrorCodes) {
				if (messageMap[key] && !messageMap[ErrorCodes[key]]) {
					messageMap[ErrorCodes[key]] = messageMap[key];
				}
			}
			var rootCode = code.split('-')[0];
			if (!languages[rootCode]) { // use for base language if not yet defined
				languages[code] = messageMap;
				languages[rootCode] = messageMap;
			} else {
				languages[code] = Object.create(languages[rootCode]);
				for (key in messageMap) {
					if (typeof languages[rootCode][key] === 'undefined') {
						languages[rootCode][key] = messageMap[key];
					}
					languages[code][key] = messageMap[key];
				}
			}
			return this;
		},
		freshApi: function (language) {
			var result = createApi();
			if (language) {
				result.language(language);
			}
			return result;
		},
		validate: function (data, schema, checkRecursive, banUnknownProperties) {
			var def = defaultErrorReporter(currentLanguage);
			var errorReporter = customErrorReporter ? function (error, data, schema) {
				return customErrorReporter(error, data, schema) || def(error, data, schema);
			} : def;
			var context = new ValidatorContext(globalContext, false, errorReporter, checkRecursive, banUnknownProperties);
			if (typeof schema === "string") {
				schema = {"$ref": schema};
			}
			context.addSchema("", schema);
			var error = context.validateAll(data, schema, null, null, "");
			if (!error && banUnknownProperties) {
				error = context.banUnknownProperties(data, schema);
			}
			this.error = error;
			this.missing = context.missing;
			this.valid = (error === null);
			return this.valid;
		},
		validateResult: function () {
			var result = {toString: function () {
				return this.valid ? 'valid' : this.error.message;
			}};
			this.validate.apply(result, arguments);
			return result;
		},
		validateMultiple: function (data, schema, checkRecursive, banUnknownProperties) {
			var def = defaultErrorReporter(currentLanguage);
			var errorReporter = customErrorReporter ? function (error, data, schema) {
				return customErrorReporter(error, data, schema) || def(error, data, schema);
			} : def;
			var context = new ValidatorContext(globalContext, true, errorReporter, checkRecursive, banUnknownProperties);
			if (typeof schema === "string") {
				schema = {"$ref": schema};
			}
			context.addSchema("", schema);
			context.validateAll(data, schema, null, null, "");
			if (banUnknownProperties) {
				context.banUnknownProperties(data, schema);
			}
			var result = {toString: function () {
				return this.valid ? 'valid' : this.error.message;
			}};
			result.errors = context.errors;
			result.missing = context.missing;
			result.valid = (result.errors.length === 0);
			return result;
		},
		addSchema: function () {
			return globalContext.addSchema.apply(globalContext, arguments);
		},
		getSchema: function () {
			return globalContext.getSchema.apply(globalContext, arguments);
		},
		getSchemaMap: function () {
			return globalContext.getSchemaMap.apply(globalContext, arguments);
		},
		getSchemaUris: function () {
			return globalContext.getSchemaUris.apply(globalContext, arguments);
		},
		getMissingUris: function () {
			return globalContext.getMissingUris.apply(globalContext, arguments);
		},
		dropSchemas: function () {
			globalContext.dropSchemas.apply(globalContext, arguments);
		},
		defineKeyword: function () {
			globalContext.defineKeyword.apply(globalContext, arguments);
		},
		defineError: function (codeName, codeNumber, defaultMessage) {
			if (typeof codeName !== 'string' || !/^[A-Z]+(_[A-Z]+)*$/.test(codeName)) {
				throw new Error('Code name must be a string in UPPER_CASE_WITH_UNDERSCORES');
			}
			if (typeof codeNumber !== 'number' || codeNumber%1 !== 0 || codeNumber < 10000) {
				throw new Error('Code number must be an integer > 10000');
			}
			if (typeof ErrorCodes[codeName] !== 'undefined') {
				throw new Error('Error already defined: ' + codeName + ' as ' + ErrorCodes[codeName]);
			}
			if (typeof ErrorCodeLookup[codeNumber] !== 'undefined') {
				throw new Error('Error code already used: ' + ErrorCodeLookup[codeNumber] + ' as ' + codeNumber);
			}
			ErrorCodes[codeName] = codeNumber;
			ErrorCodeLookup[codeNumber] = codeName;
			ErrorMessagesDefault[codeName] = ErrorMessagesDefault[codeNumber] = defaultMessage;
			for (var langCode in languages) {
				var language = languages[langCode];
				if (language[codeName]) {
					language[codeNumber] = language[codeNumber] || language[codeName];
				}
			}
		},
		reset: function () {
			globalContext.reset();
			this.error = null;
			this.missing = [];
			this.valid = true;
		},
		missing: [],
		error: null,
		valid: true,
		normSchema: normSchema,
		resolveUrl: resolveUrl,
		getDocumentUri: getDocumentUri,
		errorCodes: ErrorCodes
	};
	api.language(language || 'en');
	return api;
}

var tv4 = createApi();
tv4.addLanguage('en-gb', ErrorMessagesDefault);

//legacy property
tv4.tv4 = tv4;

return tv4; // used by _header.js to globalise.

}));

/***/ }),

/***/ "./node_modules/webfinger.js/src/webfinger.js":
/*!****************************************************!*\
  !*** ./node_modules/webfinger.js/src/webfinger.js ***!
  \****************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;/* global define */
/*!
 * webfinger.js
 *   http://github.com/silverbucket/webfinger.js
 *
 * Developed and Maintained by:
 *   Nick Jennings <nick@silverbucket.net>
 *
 * webfinger.js is released under the AGPL (see LICENSE).
 *
 * You don't have to do anything special to choose one license or the other and you don't
 * have to notify anyone which license you are using.
 * Please see the corresponding license file for details of these licenses.
 * You are free to use, modify and distribute this software, but all copyright
 * information must remain.
 *
 */

if (typeof fetch !== 'function' && typeof XMLHttpRequest !== 'function') {
  // XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
  XMLHttpRequest = __webpack_require__(/*! xhr2 */ "./node_modules/xhr2/lib/browser.js");
}

(function (global) {

  // URI to property name map
  var LINK_URI_MAPS = {
    'http://webfist.org/spec/rel': 'webfist',
    'http://webfinger.net/rel/avatar': 'avatar',
    'remotestorage': 'remotestorage',
    'http://tools.ietf.org/id/draft-dejong-remotestorage': 'remotestorage',
    'remoteStorage': 'remotestorage',
    'http://www.packetizer.com/rel/share': 'share',
    'http://webfinger.net/rel/profile-page': 'profile',
    'me': 'profile',
    'vcard': 'vcard',
    'blog': 'blog',
    'http://packetizer.com/rel/blog': 'blog',
    'http://schemas.google.com/g/2010#updates-from': 'updates',
    'https://camlistore.org/rel/server': 'camilstore'
  };

  var LINK_PROPERTIES = {
    'avatar': [],
    'remotestorage': [],
    'blog': [],
    'vcard': [],
    'updates': [],
    'share': [],
    'profile': [],
    'webfist': [],
    'camlistore': []
  };

  // list of endpoints to try, fallback from beginning to end.
  var URIS = ['webfinger', 'host-meta', 'host-meta.json'];

  function generateErrorObject(obj) {
    obj.toString = function () {
      return this.message;
    };
    return obj;
  }

  // given a URL ensures it's HTTPS.
  // returns false for null string or non-HTTPS URL.
  function isSecure(url) {
    if (typeof url !== 'string') {
      return false;
    }
    var parts = url.split('://');
    if (parts[0] === 'https') {
      return true;
    }
    return false;
  }

  /**
   * Function: WebFinger
   *
   * WebFinger constructor
   *
   * Returns:
   *
   *   return WebFinger object
   */
  function WebFinger(config) {
    if (typeof config !== 'object') {
      config = {};
    }

    this.config = {
      tls_only:         (typeof config.tls_only !== 'undefined') ? config.tls_only : true,
      webfist_fallback: (typeof config.webfist_fallback !== 'undefined') ? config.webfist_fallback : false,
      uri_fallback:     (typeof config.uri_fallback !== 'undefined') ? config.uri_fallback : false,
      request_timeout:  (typeof config.request_timeout !== 'undefined') ? config.request_timeout : 10000
    };
  }

  // make an http request and look for JRD response, fails if request fails
  // or response not json.
  WebFinger.prototype.__fetchJRD = function (url, errorHandler, successHandler) {
    if (typeof fetch === 'function') {
        return this.__fetchJRD_fetch(url, errorHandler, successHandler);
    } else if (typeof XMLHttpRequest === 'function') {
      return this.__fetchJRD_XHR(url, errorHandler, successHandler);
    } else {
      throw new Error("add a polyfill for fetch or XMLHttpRequest");
    }
  };
  WebFinger.prototype.__fetchJRD_fetch = function (url, errorHandler, successHandler) {
    var webfinger = this;
    var abortController;
    if (typeof AbortController === 'function') {
      abortController = new AbortController();
    }
    var networkPromise = fetch(url, {
      headers: {'Accept': 'application/jrd+json, application/json'},
      signal: abortController ? abortController.signal : undefined
    }).
    then(function (response) {
      if (response.ok) {
        return response.text();
      } else if (response.status === 404) {
        throw generateErrorObject({
          message: 'resource not found',
          url: url,
          status: response.status
        });
      } else {   // other HTTP status (redirects are handled transparently)
        throw generateErrorObject({
          message: 'error during request',
          url: url,
          status: response.status
        });
      }
    },
    function (err) {   // connection refused, etc.
      throw generateErrorObject({
        message: 'error during request',
        url: url,
        status: undefined,
        err: err
      })
    }).
    then(function (responseText) {
      if (webfinger.__isValidJSON(responseText)) {
        return responseText;
      } else {
        throw generateErrorObject({
          message: 'invalid json',
          url: url,
          status: undefined
        });
      }
    });

    var timeoutPromise = new Promise(function (resolve, reject) {
      setTimeout(function () {
        reject(generateErrorObject({
          message: 'request timed out',
          url: url,
          status: undefined
        }));
        if (abortController) {
          abortController.abort();
        }
      }, webfinger.config.request_timeout);
    });

    Promise.race([networkPromise, timeoutPromise]).
    then(function (responseText) {
      successHandler(responseText);
    }).catch(function (err) {
      errorHandler(err);
    });
  };
  WebFinger.prototype.__fetchJRD_XHR = function (url, errorHandler, successHandler) {
    var self = this;
    var handlerSpent = false;
    var xhr = new XMLHttpRequest();

    function __processState() {
      if (handlerSpent){
        return;
      }else{
        handlerSpent = true;
      }

      if (xhr.status === 200) {
        if (self.__isValidJSON(xhr.responseText)) {
          return successHandler(xhr.responseText);
        } else {
          return errorHandler(generateErrorObject({
            message: 'invalid json',
            url: url,
            status: xhr.status
          }));
        }
      } else if (xhr.status === 404) {
        return errorHandler(generateErrorObject({
          message: 'resource not found',
          url: url,
          status: xhr.status
        }));
      } else if ((xhr.status >= 301) && (xhr.status <= 302)) {
        var location = xhr.getResponseHeader('Location');
        if (isSecure(location)) {
          return __makeRequest(location); // follow redirect
        } else {
          return errorHandler(generateErrorObject({
            message: 'no redirect URL found',
            url: url,
            status: xhr.status
          }));
        }
      } else {
        return errorHandler(generateErrorObject({
          message: 'error during request',
          url: url,
          status: xhr.status
        }));
      }
    }

    function __makeRequest() {
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          __processState();
        }
      };

      xhr.onload = function () {
        __processState();
      };

      xhr.ontimeout = function () {
        return errorHandler(generateErrorObject({
          message: 'request timed out',
          url: url,
          status: xhr.status
        }));
      };

      xhr.open('GET', url, true);
      xhr.timeout = self.config.request_timeout;
      xhr.setRequestHeader('Accept', 'application/jrd+json, application/json');
      xhr.send();
    }

    return __makeRequest();
  };

  WebFinger.prototype.__isValidJSON = function (str) {
    try {
      JSON.parse(str);
    } catch (e) {
      return false;
    }
    return true;
  };

  WebFinger.prototype.__isLocalhost = function (host) {
    var local = /^localhost(\.localdomain)?(\:[0-9]+)?$/;
    return local.test(host);
  };

  // processes JRD object as if it's a webfinger response object
  // looks for known properties and adds them to profile datat struct.
  WebFinger.prototype.__processJRD = function (URL, JRD, errorHandler, successHandler) {
    var parsedJRD = JSON.parse(JRD);
    if ((typeof parsedJRD !== 'object') ||
        (typeof parsedJRD.links !== 'object')) {
      if (typeof parsedJRD.error !== 'undefined') {
        return errorHandler(generateErrorObject({ message: parsedJRD.error, request: URL }));
      } else {
        return errorHandler(generateErrorObject({ message: 'unknown response from server', request: URL }));
      }
    }

    var links = parsedJRD.links;
    if (!Array.isArray(links)) {
      links = [];
    }
    var result = {  // webfinger JRD - object, json, and our own indexing
      object: parsedJRD,
      json: JRD,
      idx: {}
    };

    result.idx.properties = {
      'name': undefined
    };
    result.idx.links = JSON.parse(JSON.stringify(LINK_PROPERTIES));

    // process links
    links.map(function (link, i) {
      if (LINK_URI_MAPS.hasOwnProperty(link.rel)) {
        if (result.idx.links[LINK_URI_MAPS[link.rel]]) {
          var entry = {};
          Object.keys(link).map(function (item, n) {
            entry[item] = link[item];
          });
          result.idx.links[LINK_URI_MAPS[link.rel]].push(entry);
        }
      }
    });

    // process properties
    var props = JSON.parse(JRD).properties;
    for (var key in props) {
      if (props.hasOwnProperty(key)) {
        if (key === 'http://packetizer.com/ns/name') {
          result.idx.properties.name = props[key];
        }
      }
    }
    return successHandler(result);
  };

  WebFinger.prototype.lookup = function (address, cb) {
    if (typeof address !== 'string') {
      throw new Error('first parameter must be a user address');
    } else if (typeof cb !== 'function') {
      throw new Error('second parameter must be a callback');
    }

    var self = this;
    var host = '';
    if (address.indexOf('://') > -1) {
      // other uri format
      host = address.replace(/ /g,'').split('/')[2];
    } else {
      // useraddress
      host = address.replace(/ /g,'').split('@')[1];
    }
    var uri_index = 0;      // track which URIS we've tried already
    var protocol = 'https'; // we use https by default

    if (self.__isLocalhost(host)) {
      protocol = 'http';
    }

    function __buildURL() {
      var uri = '';
      if (! address.split('://')[1]) {
        // the URI has not been defined, default to acct
        uri = 'acct:';
      }
      return protocol + '://' + host + '/.well-known/' +
             URIS[uri_index] + '?resource=' + uri + address;
    }

    // control flow for failures, what to do in various cases, etc.
    function __fallbackChecks(err) {
      if ((self.config.uri_fallback) && (host !== 'webfist.org') && (uri_index !== URIS.length - 1)) { // we have uris left to try
        uri_index = uri_index + 1;
        return __call();
      } else if ((!self.config.tls_only) && (protocol === 'https')) { // try normal http
        uri_index = 0;
        protocol = 'http';
        return __call();
      } else if ((self.config.webfist_fallback) && (host !== 'webfist.org')) { // webfist attempt
        uri_index = 0;
        protocol = 'http';
        host = 'webfist.org';
        // webfist will
        // 1. make a query to the webfist server for the users account
        // 2. from the response, get a link to the actual webfinger json data
        //    (stored somewhere in control of the user)
        // 3. make a request to that url and get the json
        // 4. process it like a normal webfinger response
        var URL = __buildURL();
        self.__fetchJRD(URL, cb, function (data) { // get link to users JRD
          self.__processJRD(URL, data, cb, function (result) {
            if ((typeof result.idx.links.webfist === 'object') &&
                (typeof result.idx.links.webfist[0].href === 'string')) {
              self.__fetchJRD(result.idx.links.webfist[0].href, cb, function (JRD) {
                self.__processJRD(URL, JRD, cb, function (result) {
                  return cb(null, cb);
                });
              });
            }
          });
        });
      } else {
        return cb(err);
      }
    }

    function __call() {
      // make request
      var URL = __buildURL();
      self.__fetchJRD(URL, __fallbackChecks, function (JRD) {
        self.__processJRD(URL, JRD, cb, function (result) { cb(null, result); });
      });
    }

    return setTimeout(__call, 0);
  };

  WebFinger.prototype.lookupLink = function (address, rel, cb) {
    if (LINK_PROPERTIES.hasOwnProperty(rel)) {
      this.lookup(address, function (err, p) {
        var links  = p.idx.links[rel];
        if (err) {
          return cb(err);
        } else if (links.length === 0) {
          return cb('no links found with rel="' + rel + '"');
        } else {
          return cb(null, links[0]);
        }
      });
    } else {
      return cb('unsupported rel ' + rel);
    }
  };



  // AMD support
  if (true) {
      !(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_RESULT__ = (function () { return WebFinger; }).apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__),
				__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
  // CommonJS and Node.js module support.
  } else {}
})(this);


/***/ }),

/***/ "./node_modules/webpack/buildin/global.js":
/*!***********************************!*\
  !*** (webpack)/buildin/global.js ***!
  \***********************************/
/*! no static exports found */
/***/ (function(module, exports) {

var g;

// This works in non-strict mode
g = (function() {
	return this;
})();

try {
	// This works if eval is allowed (see CSP)
	g = g || new Function("return this")();
} catch (e) {
	// This works if the window reference is available
	if (typeof window === "object") g = window;
}

// g can still be undefined, but nothing to do about it...
// We return undefined, instead of nothing here, so it's
// easier to handle this case. if(!global) { ...}

module.exports = g;


/***/ }),

/***/ "./node_modules/xhr2/lib/browser.js":
/*!******************************************!*\
  !*** ./node_modules/xhr2/lib/browser.js ***!
  \******************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = XMLHttpRequest;


/***/ }),

/***/ "./src/access.ts":
/*!***********************!*\
  !*** ./src/access.ts ***!
  \***********************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @class Access
 *
 * Keeps track of claimed access and scopes.
 */
class Access {
    constructor() {
        this.reset();
    }
    // TODO create custom type for init function
    static _rs_init() {
        return;
    }
    /**
     * Property: scopes
     *
     * Holds an array of claimed scopes in the form
     * > { name: "<scope-name>", mode: "<mode>" }
     */
    get scopes() {
        return Object.keys(this.scopeModeMap).map((key) => {
            return { name: key, mode: this.scopeModeMap[key] };
        });
    }
    get scopeParameter() {
        return this.scopes.map((scope) => {
            return `${this._scopeNameForParameter(scope)}:${scope.mode}`;
        }).join(' ');
    }
    /**
     * Claim access on a given scope with given mode.
     *
     * @param {string} scope - An access scope, such as "contacts" or "calendar"
     * @param {string} mode - Access mode. Either "r" for read-only or "rw" for read/write
     */
    claim(scope, mode) {
        if (typeof (scope) !== 'string' || scope.indexOf('/') !== -1 || scope.length === 0) {
            throw new Error('Scope should be a non-empty string without forward slashes');
        }
        if (!mode.match(/^rw?$/)) {
            throw new Error('Mode should be either \'r\' or \'rw\'');
        }
        this._adjustRootPaths(scope);
        this.scopeModeMap[scope] = mode;
    }
    /**
     * Get the access mode for a given scope.
     *
     * @param {string} scope - Access scope
     * @returns {string} Access mode
     */
    get(scope) {
        return this.scopeModeMap[scope];
    }
    /**
     * Remove access for the given scope.
     *
     * @param {string} scope - Access scope
     */
    remove(scope) {
        const savedMap = {};
        for (const name in this.scopeModeMap) {
            savedMap[name] = this.scopeModeMap[name];
        }
        this.reset();
        delete savedMap[scope];
        for (const name in savedMap) {
            this.claim(name, savedMap[name]);
        }
    }
    /**
     * Verify permission for a given scope.
     *
     * @param {string} scope - Access scope
     * @param {string} mode - Access mode
     * @returns {boolean} true if the requested access mode is active, false otherwise
     */
    checkPermission(scope, mode) {
        const actualMode = this.get(scope);
        return actualMode && (mode === 'r' || actualMode === 'rw');
    }
    /**
     * Verify permission for a given path.
     *
     * @param {string} path - Path
     * @param {string} mode - Access mode
     * @returns {boolean} true if the requested access mode is active, false otherwise
     */
    checkPathPermission(path, mode) {
        if (this.checkPermission('*', mode)) {
            return true;
        }
        // TODO check if this is reliable
        const scope = this._getModuleName(path);
        return !!this.checkPermission(scope, mode);
    }
    /**
     * Reset all access permissions.
     */
    reset() {
        this.rootPaths = [];
        this.scopeModeMap = {};
    }
    /**
     * Return the module name for a given path.
     */
    _getModuleName(path) {
        if (path[0] !== '/') {
            throw new Error('Path should start with a slash');
        }
        const moduleMatch = path.replace(/^\/public/, '').match(/^\/([^/]*)\//);
        return moduleMatch ? moduleMatch[1] : '*';
    }
    /**
     * TODO: document
     */
    _adjustRootPaths(newScope) {
        if ('*' in this.scopeModeMap || newScope === '*') {
            this.rootPaths = ['/'];
        }
        else if (!(newScope in this.scopeModeMap)) {
            this.rootPaths.push('/' + newScope + '/');
            this.rootPaths.push('/public/' + newScope + '/');
        }
    }
    /**
     * TODO: document
     */
    _scopeNameForParameter(scope) {
        if (scope.name === '*' && this.storageType) {
            if (this.storageType === '2012.04') {
                return '';
            }
            else if (this.storageType.match(/remotestorage-0[01]/)) {
                return 'root';
            }
        }
        return scope.name;
    }
    /**
     * Set the storage type of the remote.
     *
     * @param {string} type - Storage type
     */
    setStorageType(type) {
        this.storageType = type;
    }
}
module.exports = Access;


/***/ }),

/***/ "./src/authorize.ts":
/*!**************************!*\
  !*** ./src/authorize.ts ***!
  \**************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const log_1 = __importDefault(__webpack_require__(/*! ./log */ "./src/log.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
const unauthorized_error_1 = __importDefault(__webpack_require__(/*! ./unauthorized-error */ "./src/unauthorized-error.ts"));
const requests_1 = __webpack_require__(/*! ./requests */ "./src/requests.ts");
// This is set in _rs_init and needed for removal in _rs_cleanup
let onFeaturesLoaded;
function extractParams(url) {
    // FF already decodes the URL fragment in document.location.hash, so use this instead:
    // eslint-disable-next-line
    const location = url || Authorize.getLocation().href;
    const queryParam = {};
    for (const [key, value] of new URL(location).searchParams) {
        queryParam[key] = value;
    }
    const hashPos = location.indexOf('#');
    if (hashPos === -1) {
        return queryParam;
    }
    const urlFragment = location.substring(hashPos + 1);
    // if hash is not of the form #key=val&key=val, it's probably not for us
    if (!urlFragment.includes('=')) {
        return queryParam;
    }
    return urlFragment.split('&').reduce(function (params, kvs) {
        const kv = kvs.split('=');
        if (kv[0] === 'state' && kv[1].match(/rsDiscovery/)) {
            // extract rsDiscovery data from the state param
            let stateValue = decodeURIComponent(kv[1]);
            const encodedData = stateValue.substr(stateValue.indexOf('rsDiscovery='))
                .split('&')[0]
                .split('=')[1];
            params['rsDiscovery'] = JSON.parse(atob(encodedData));
            // remove rsDiscovery param
            stateValue = stateValue.replace(new RegExp('&?rsDiscovery=' + encodedData), '');
            if (stateValue.length > 0) {
                params['state'] = stateValue;
            }
        }
        else {
            params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
        }
        return params;
    }, queryParam);
}
function buildOAuthURL(options) {
    const redirect = new URL(options.redirectUri);
    if (!options.state) {
        options.state = redirect.hash ? redirect.hash.substring(1) : '';
    }
    if (!options.response_type) {
        options.response_type = 'token';
    }
    const url = new URL(options.authURL);
    // We don't add a trailing slash as only pathname to redirectUri.
    url.searchParams.set('redirect_uri', options.redirectUri.replace(/#.*$/, ''));
    url.searchParams.set('scope', options.scope);
    url.searchParams.set('client_id', options.clientId);
    for (const key of ['state', 'response_type', 'code_challenge', 'code_challenge_method', 'token_access_type']) {
        const value = options[key];
        if (value) {
            url.searchParams.set(key, value);
        }
    }
    return url.href;
}
class Authorize {
    /**
     * Navigates browser to provider's OAuth page. When user grants access,
     * browser will navigate back to redirectUri and OAuth will continue
     * with onFeaturesLoaded.
     */
    static authorize(remoteStorage, options) {
        (0, log_1.default)('[Authorize] authURL = ', options.authURL, 'scope = ', options.scope, 'redirectUri = ', options.redirectUri, 'clientId = ', options.clientId, 'response_type =', options.response_type);
        if (!options.scope) {
            throw new Error("Cannot authorize due to undefined or empty scope; did you forget to access.claim()?");
        }
        // TODO add a test for this
        // keep track of the discovery data during redirect if we can't save it in localStorage
        if (!(0, util_1.localStorageAvailable)() && remoteStorage.backend === 'remotestorage') {
            options.redirectUri += options.redirectUri.indexOf('#') > 0 ? '&' : '#';
            const discoveryData = {
                userAddress: remoteStorage.remote.userAddress,
                href: remoteStorage.remote.href,
                storageApi: remoteStorage.remote.storageApi,
                properties: remoteStorage.remote.properties
            };
            options.redirectUri += 'rsDiscovery=' + (0, util_1.toBase64)(JSON.stringify(discoveryData));
        }
        const url = buildOAuthURL(options);
        // FIXME declare potential `cordova` property on global somehow, so we don't have to
        // use a string accessor here.
        if (util_1.globalContext['cordova']) {
            Authorize
                .openWindow(url, options.redirectUri, 'location=yes,clearsessioncache=yes,clearcache=yes')
                .then((authResult) => {
                remoteStorage.remote.configure({ token: authResult.access_token });
            });
            return;
        }
        Authorize.setLocation(url);
    }
    /** On success, calls remote.configure() with new access token */
    static refreshAccessToken(rs, remote, refreshToken) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            yield remote.configure({ token: null, tokenType: null });
            const formValues = new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: remote.clientId,
                refresh_token: refreshToken,
            });
            const xhr = yield (0, requests_1.requestWithTimeout)('POST', remote.TOKEN_URL, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formValues.toString(),
                responseType: 'json'
            });
            if ((xhr === null || xhr === void 0 ? void 0 : xhr.status) === 200) {
                (0, log_1.default)(`[Authorize] access token good for ${(_a = xhr === null || xhr === void 0 ? void 0 : xhr.response) === null || _a === void 0 ? void 0 : _a.expires_in} seconds`);
                const settings = {
                    token: (_b = xhr === null || xhr === void 0 ? void 0 : xhr.response) === null || _b === void 0 ? void 0 : _b.access_token,
                    tokenType: (_c = xhr === null || xhr === void 0 ? void 0 : xhr.response) === null || _c === void 0 ? void 0 : _c.token_type,
                };
                if (settings.token) {
                    yield remote.configure(settings);
                }
                else {
                    throw new Error(`no access_token in "successful" refresh: ${xhr.response}`);
                }
            }
            else {
                yield remote.configure({ refreshToken: null });
                throw new unauthorized_error_1.default("refresh token rejected:" + JSON.stringify(xhr.response));
            }
        });
    }
    /**
     * Set current document location
     *
     * Override this method if access to document.location is forbidden
     */
    static setLocation(location) {
        if (typeof location === 'string') {
            document.location.href = location;
        }
        else if (typeof location === 'object') {
            document.location = location;
        }
        else {
            throw "Invalid location " + location;
        }
    }
    static _rs_supported() {
        return typeof (document) !== 'undefined';
    }
    static _rs_cleanup(remoteStorage) {
        remoteStorage.removeEventListener('features-loaded', onFeaturesLoaded);
    }
}
Authorize.IMPLIED_FAKE_TOKEN = false;
/**
 * Get current document location
 *
 * Override this method if access to document.location is forbidden
 */
Authorize.getLocation = function () {
    return document.location;
};
/**
 * Open new InAppBrowser window for OAuth in Cordova
 */
Authorize.openWindow = function (url, redirectUri, options) {
    return new Promise((resolve, reject) => {
        const newWindow = open(url, '_blank', options);
        if (!newWindow || newWindow.closed) {
            reject('Authorization popup was blocked');
            return;
        }
        function handleExit() {
            reject('Authorization was canceled');
        }
        function handleLoadstart(event) {
            if (event.url.indexOf(redirectUri) !== 0) {
                return;
            }
            newWindow.removeEventListener('exit', handleExit);
            newWindow.close();
            const authResult = extractParams(event.url);
            if (!authResult) {
                reject('Authorization error');
                return;
            }
            resolve(authResult);
        }
        newWindow.addEventListener('loadstart', handleLoadstart);
        newWindow.addEventListener('exit', handleExit);
    });
};
Authorize._rs_init = function (remoteStorage) {
    const params = extractParams();
    let location;
    if (params) {
        location = Authorize.getLocation();
        location.hash = '';
    }
    // eslint-disable-next-line
    onFeaturesLoaded = function () {
        let authParamsUsed = false;
        if (!params) {
            remoteStorage.remote.stopWaitingForToken();
            return;
        }
        if (params.error) {
            if (params.error === 'access_denied') {
                throw new unauthorized_error_1.default('Authorization failed: access denied', { code: 'access_denied' });
            }
            else {
                throw new unauthorized_error_1.default(`Authorization failed: ${params.error}`);
            }
        }
        // rsDiscovery came with the redirect, because it couldn't be
        // saved in localStorage
        if (params.rsDiscovery) {
            remoteStorage.remote.configure(params.rsDiscovery);
        }
        if (params.access_token) {
            remoteStorage.remote.configure({ token: params.access_token });
            authParamsUsed = true;
        }
        if (params.remotestorage) {
            remoteStorage.connect(params.remotestorage);
            authParamsUsed = true;
        }
        if (params.state) {
            location = Authorize.getLocation();
            Authorize.setLocation(location.href.split('#')[0] + '#' + params.state);
        }
        if (params.code) { // OAuth2 code or PKCE flow
            fetchTokens(params.code); // remote.configure() called asynchronously
            authParamsUsed = true;
        }
        if (!authParamsUsed) {
            remoteStorage.remote.stopWaitingForToken();
        }
    };
    // OAuth2 PKCE flow
    function fetchTokens(code) {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function* () {
            const codeVerifier = sessionStorage.getItem('remotestorage:codeVerifier');
            if (!codeVerifier) {
                (0, log_1.default)("[Authorize] Ignoring OAuth code parameter, because no PKCE code verifier found in sessionStorage");
                return;
            }
            location = Authorize.getLocation();
            let redirectUri = location.origin;
            if (location.pathname !== '/') {
                redirectUri += location.pathname;
            }
            const formValues = new URLSearchParams({
                code: code,
                grant_type: 'authorization_code',
                client_id: remoteStorage.remote.clientId,
                redirect_uri: redirectUri,
                code_verifier: codeVerifier
            });
            const xhr = yield (0, requests_1.requestWithTimeout)('POST', remoteStorage.remote.TOKEN_URL, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formValues.toString(),
                responseType: 'json'
            });
            switch (xhr.status) {
                case 200:
                    (0, log_1.default)(`[Authorize] access token good for ${(_a = xhr === null || xhr === void 0 ? void 0 : xhr.response) === null || _a === void 0 ? void 0 : _a.expires_in} seconds`);
                    const settings = {
                        token: (_b = xhr === null || xhr === void 0 ? void 0 : xhr.response) === null || _b === void 0 ? void 0 : _b.access_token,
                        refreshToken: (_c = xhr === null || xhr === void 0 ? void 0 : xhr.response) === null || _c === void 0 ? void 0 : _c.refresh_token,
                        tokenType: (_d = xhr === null || xhr === void 0 ? void 0 : xhr.response) === null || _d === void 0 ? void 0 : _d.token_type,
                    };
                    if (settings.token) {
                        remoteStorage.remote.configure(settings);
                    }
                    else {
                        remoteStorage._emit('error', new Error(`no access_token in "successful" response: ${xhr.response}`));
                    }
                    sessionStorage.removeItem('remotestorage:codeVerifier');
                    break;
                default:
                    remoteStorage._emit('error', new Error(`${xhr.statusText}: ${xhr.response}`));
            }
        });
    }
    remoteStorage.on('features-loaded', onFeaturesLoaded);
};
module.exports = Authorize;


/***/ }),

/***/ "./src/baseclient.ts":
/*!***************************!*\
  !*** ./src/baseclient.ts ***!
  \***************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const tv4_1 = __importDefault(__webpack_require__(/*! tv4 */ "./node_modules/tv4/tv4.js"));
const types_1 = __importDefault(__webpack_require__(/*! ./types */ "./src/types.ts"));
const schema_not_found_error_1 = __importDefault(__webpack_require__(/*! ./schema-not-found-error */ "./src/schema-not-found-error.ts"));
const eventhandling_1 = __importDefault(__webpack_require__(/*! ./eventhandling */ "./src/eventhandling.ts"));
const config_1 = __importDefault(__webpack_require__(/*! ./config */ "./src/config.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
function getModuleNameFromBase(path) {
    const parts = path.split('/');
    return path.length > 2 ? parts[1] : 'root';
}
/**
 * Provides a high-level interface to access data below a given root path.
 */
class BaseClient {
    constructor(storage, base) {
        /**
         * TODO document
         *
         * @private
         */
        this.schemas = {
            configurable: true,
            get() {
                return BaseClient.Types.inScope(this.moduleName);
            }
        };
        if (base[base.length - 1] !== '/') {
            throw "Not a folder: " + base;
        }
        if (base === '/') {
            // allow absolute and relative paths for the root scope.
            this.makePath = (path) => {
                return (path[0] === '/' ? '' : '/') + path;
            };
        }
        this.storage = storage;
        this.base = base;
        this.moduleName = getModuleNameFromBase(this.base);
        this.addEvents(['change']);
        this.on = this.on.bind(this);
        storage.onChange(this.base, this._fireChange.bind(this));
    }
    /**
     * Instantiate a new client, scoped to a subpath of the current client's
     * path.
     *
     * @param path - The path to scope the new client to
     *
     * @returns  A new client operating on a subpath of the current base path
     */
    scope(path) {
        return new BaseClient(this.storage, this.makePath(path));
    }
    /**
     * Get a list of child nodes below a given path.
     *
     * @param {string} path - The path to query. It MUST end with a forward slash.
     * @param {number} maxAge - (optional) Either ``false`` or the maximum age of
     *                          cached listing in milliseconds. See :ref:`max-age`.
     *
     * @returns {Promise} A promise for an object representing child nodes
     */
    // TODO add real return type
    getListing(path, maxAge) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof path !== 'string') {
                path = '';
            }
            else if (path.length > 0 && !(0, util_1.isFolder)(path)) {
                return Promise.reject("Not a folder: " + path);
            }
            return this.storage.get(this.makePath(path), maxAge).then((r) => {
                return r.statusCode === 404 ? {} : r.body;
            });
        });
    }
    /**
     * Get all objects directly below a given path.
     *
     * @param {string} path - Path to the folder. Must end in a forward slash.
     * @param {number} maxAge - (optional) Either ``false`` or the maximum age of
     *                          cached objects in milliseconds. See :ref:`max-age`.
     *
     * @returns {Promise} A promise for an object
     */
    // TODO add real return type
    getAll(path, maxAge) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof path !== 'string') {
                path = '';
            }
            else if (path.length > 0 && !(0, util_1.isFolder)(path)) {
                return Promise.reject("Not a folder: " + path);
            }
            return this.storage.get(this.makePath(path), maxAge).then((r) => {
                if (r.statusCode === 404) {
                    return {};
                }
                if (typeof r.body === 'object') {
                    const keys = Object.keys(r.body);
                    // treat this like 404. it probably means a folder listing that
                    // has changes that haven't been pushed out yet.
                    if (keys.length === 0) {
                        return {};
                    }
                    const calls = keys.map((key) => {
                        return this.storage.get(this.makePath(path + key), maxAge)
                            .then((o) => {
                            if (typeof o.body === 'string') {
                                try {
                                    o.body = JSON.parse(o.body);
                                }
                                catch (e) { /* empty */ }
                            }
                            if (typeof o.body === 'object') {
                                r.body[key] = o.body;
                            }
                        });
                    });
                    return Promise.all(calls).then(() => { return r.body; });
                }
            });
        });
    }
    /**
     * Get the file at the given path. A file is raw data, as opposed to
     * a JSON object (use :func:`getObject` for that).
     *
     * @param {string} path - Relative path from the module root (without leading
     *                        slash).
     * @param {number} maxAge - (optional) Either ``false`` or the maximum age of
     *                          the cached file in milliseconds. See :ref:`max-age`.
     *
     * @returns {Promise} A promise for an object
     */
    // TODO add real return type
    getFile(path, maxAge) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof path !== 'string') {
                return Promise.reject('Argument \'path\' of baseClient.getFile must be a string');
            }
            return this.storage.get(this.makePath(path), maxAge).then((r) => {
                return {
                    data: r.body,
                    contentType: r.contentType,
                    revision: r.revision // (this is new)
                };
            });
        });
    }
    /**
     * Store raw data at a given path.
     *
     * @param {string} mimeType - MIME media type of the data being stored
     * @param {string} path     - Path relative to the module root
     * @param {string|ArrayBuffer|ArrayBufferView} body - Raw data to store
     *
     * @returns {Promise} A promise for the created/updated revision (ETag)
     */
    storeFile(mimeType, path, body) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof mimeType !== 'string') {
                return Promise.reject('Argument \'mimeType\' of baseClient.storeFile must be a string');
            }
            if (typeof path !== 'string') {
                return Promise.reject('Argument \'path\' of baseClient.storeFile must be a string');
            }
            if ((typeof body !== 'string') && (typeof body !== 'object')) {
                return Promise.reject('Argument \'body\' of baseClient.storeFile must be a string, ArrayBuffer, or ArrayBufferView');
            }
            if (!this.storage.access.checkPathPermission(this.makePath(path), 'rw')) {
                console.warn('WARNING: Editing a document to which only read access (\'r\') was claimed');
            }
            return this.storage.put(this.makePath(path), body, mimeType).then((r) => {
                if (r.statusCode === 200 || r.statusCode === 201) {
                    return r.revision;
                }
                else {
                    return Promise.reject("Request (PUT " + this.makePath(path) + ") failed with status: " + r.statusCode);
                }
            });
        });
    }
    /**
     * Get a JSON object from the given path.
     *
     * @param {string} path - Relative path from the module root (without leading
     *                        slash).
     * @param {number} maxAge - (optional) Either ``false`` or the maximum age of
     *                          cached object in milliseconds. See :ref:`max-age`.
     *
     * @returns {Promise} A promise, which resolves with the requested object (or ``null``
     *          if non-existent)
     */
    // TODO add real return type
    getObject(path, maxAge) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof path !== 'string') {
                return Promise.reject('Argument \'path\' of baseClient.getObject must be a string');
            }
            return this.storage.get(this.makePath(path), maxAge).then((r) => {
                if (typeof r.body === 'object') { // will be the case for documents stored with rs.js <= 0.10.0-beta2
                    return r.body;
                }
                else if (typeof r.body === 'string') {
                    try {
                        return JSON.parse(r.body);
                    }
                    catch (e) {
                        throw new Error("Not valid JSON: " + this.makePath(path));
                    }
                }
                else if (typeof r.body !== 'undefined' && r.statusCode === 200) {
                    return Promise.reject("Not an object: " + this.makePath(path));
                }
            });
        });
    }
    /**
     * Store object at given path. Triggers synchronization.
     *
     * See ``declareType()`` and :doc:`data types </data-modules/defining-data-types>`
     * for an explanation of types
     *
     * For any given `path`, must not be called more frequently than once per second.
     *
     * @param {string} typeAlias   - Unique type of this object within this module.
     * @param {string} path   - Path relative to the module root.
     * @param {object} object - A JavaScript object to be stored at the given
     *                          path. Must be serializable as JSON.
     *
     * @returns {Promise} Resolves with revision on success. Rejects with
     *                    a ValidationError, if validations fail.
     */
    // TODO add real return type
    storeObject(typeAlias, path, object) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof typeAlias !== 'string') {
                return Promise.reject('Argument \'typeAlias\' of baseClient.storeObject must be a string');
            }
            if (typeof path !== 'string') {
                return Promise.reject('Argument \'path\' of baseClient.storeObject must be a string');
            }
            if (typeof object !== 'object') {
                return Promise.reject('Argument \'object\' of baseClient.storeObject must be an object');
            }
            this._attachType(object, typeAlias);
            try {
                const validationResult = this.validate(object);
                if (!validationResult.valid) {
                    return Promise.reject(validationResult);
                }
            }
            catch (exc) {
                return Promise.reject(exc);
            }
            return this.storage.put(this.makePath(path), JSON.stringify(object), 'application/json; charset=UTF-8').then((r) => {
                if (r.statusCode === 200 || r.statusCode === 201) {
                    return r.revision;
                }
                else {
                    return Promise.reject("Request (PUT " + this.makePath(path) + ") failed with status: " + r.statusCode);
                }
            });
        });
    }
    /**
     * Remove node at given path from storage. Triggers synchronization.
     *
     * @param {string} path - Path relative to the module root.
     * @returns {Promise}
     */
    // TODO add real return type
    remove(path) {
        if (typeof path !== 'string') {
            return Promise.reject('Argument \'path\' of baseClient.remove must be a string');
        }
        if (!this.storage.access.checkPathPermission(this.makePath(path), 'rw')) {
            console.warn('WARNING: Removing a document to which only read access (\'r\') was claimed');
        }
        return this.storage.delete(this.makePath(path));
    }
    /**
     * Retrieve full URL of a document. Useful for example for sharing the public
     * URL of an item in the ``/public`` folder.
     * TODO: refactor this into the Remote interface
     *
     * @param {string} path - Path relative to the module root.
     * @returns {string} The full URL of the item, including the storage origin
     */
    getItemURL(path) {
        if (typeof path !== 'string') {
            throw 'Argument \'path\' of baseClient.getItemURL must be a string';
        }
        if (this.storage.connected) {
            path = (0, util_1.cleanPath)(this.makePath(path));
            return this.storage.remote.href + path;
        }
        else {
            return undefined;
        }
    }
    /**
     * Set caching strategy for a given path and its children.
     *
     * See :ref:`caching-strategies` for a detailed description of the available
     * strategies.
     *
     * @param {string} path - Path to cache
     * @param {string} strategy - Caching strategy. One of 'ALL', 'SEEN', or
     *                            'FLUSH'. Defaults to 'ALL'.
     *
     * @returns {BaseClient} The same instance this is called on to allow for method chaining
     */
    cache(path, strategy = 'ALL') {
        if (typeof path !== 'string') {
            throw 'Argument \'path\' of baseClient.cache must be a string';
        }
        if (typeof strategy !== 'string') {
            throw 'Argument \'strategy\' of baseClient.cache must be a string or undefined';
        }
        if (strategy !== 'FLUSH' &&
            strategy !== 'SEEN' &&
            strategy !== 'ALL') {
            throw 'Argument \'strategy\' of baseclient.cache must be one of '
                + '["FLUSH", "SEEN", "ALL"]';
        }
        this.storage.caching.set(this.makePath(path), strategy);
        return this;
    }
    /**
     * TODO: document
     *
     * @param {string} path
     */
    // TODO add return type once known
    flush(path) {
        return this.storage.local.flush(path);
    }
    /**
     * Declare a remoteStorage object type using a JSON schema.
     *
     * See :doc:`Defining data types </data-modules/defining-data-types>` for more info.
     *
     * @param {string} alias  - A type alias/shortname
     * @param {uri}    uri    - (optional) JSON-LD URI of the schema. Automatically generated if none given
     * @param {object} schema - A JSON Schema object describing the object type
     **/
    declareType(alias, uriOrSchema, schema) {
        let uri;
        if (schema && typeof uriOrSchema === 'string') {
            uri = uriOrSchema;
        }
        else if (!schema && typeof uriOrSchema !== 'string') {
            schema = uriOrSchema;
            uri = this._defaultTypeURI(alias);
        }
        else if (!schema && typeof uriOrSchema === 'string') {
            throw new Error('declareType() requires a JSON Schema object to be passed, in order to validate object types/formats');
        }
        BaseClient.Types.declare(this.moduleName, alias, uri, schema);
    }
    /**
     * Validate an object against the associated schema.
     *
     * @param {Object} object - JS object to validate. Must have a ``@context`` property.
     *
     * @returns {Object} An object containing information about validation errors
     **/
    validate(object) {
        const schema = BaseClient.Types.getSchema(object['@context']);
        if (schema) {
            return tv4_1.default.validateResult(object, schema);
        }
        else {
            throw new schema_not_found_error_1.default(object['@context']);
        }
    }
    /**
     * The default JSON-LD @context URL for RS types/objects/documents
     *
     * @private
     */
    _defaultTypeURI(alias) {
        return 'http://remotestorage.io/spec/modules/' + encodeURIComponent(this.moduleName) + '/' + encodeURIComponent(alias);
    }
    /**
     * Attaches the JSON-LD @content to an object
     *
     * @private
     */
    _attachType(object, alias) {
        object['@context'] = BaseClient.Types.resolveAlias(this.moduleName + '/' + alias) || this._defaultTypeURI(alias);
    }
    /**
     * TODO: document
     *
     * @private
     */
    makePath(path) {
        return this.base + (path || '');
    }
    /**
     * TODO: document
     *
     * @private
     */
    _fireChange(event) {
        if (config_1.default.changeEvents[event.origin]) {
            ['new', 'old', 'lastCommon'].forEach(function (fieldNamePrefix) {
                if ((!event[fieldNamePrefix + 'ContentType'])
                    || (/^application\/(.*)json(.*)/.exec(event[fieldNamePrefix + 'ContentType']))) {
                    if (typeof event[fieldNamePrefix + 'Value'] === 'string') {
                        try {
                            event[fieldNamePrefix + 'Value'] = JSON.parse(event[fieldNamePrefix + 'Value']);
                        }
                        catch (e) {
                            // empty
                        }
                    }
                }
            });
            this._emit('change', event);
        }
    }
    static _rs_init() {
        return;
    }
}
BaseClient.Types = types_1.default;
(0, util_1.applyMixins)(BaseClient, [eventhandling_1.default]);
module.exports = BaseClient;


/***/ }),

/***/ "./src/caching.ts":
/*!************************!*\
  !*** ./src/caching.ts ***!
  \************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
const log_1 = __importDefault(__webpack_require__(/*! ./log */ "./src/log.ts"));
/**
 * @class Caching
 *
 * Holds/manages caching configuration.
 **/
class Caching {
    constructor() {
        this.pendingActivations = [];
        this.reset();
    }
    /**
     * Configure caching for a given path explicitly.
     *
     * Not needed when using ``enable``/``disable``.
     *
     * @param {string} path - Path to cache
     * @param {string} strategy - Caching strategy. One of 'ALL', 'SEEN', or 'FLUSH'.
     */
    set(path, strategy) {
        if (typeof path !== 'string') {
            throw new Error('path should be a string');
        }
        if (!(0, util_1.isFolder)(path)) {
            throw new Error('path should be a folder');
        }
        // FIXME We need to get to the access instance somehow.  But I'm not sure
        // this check is even necessary in the first place. -raucao
        // if (!this._remoteStorage.access.checkPathPermission(path, 'r')) {
        //   throw new Error('No access to path "' + path + '". You have to claim access to it first.');
        // }
        if (!strategy.match(/^(FLUSH|SEEN|ALL)$/)) {
            throw new Error("strategy should be 'FLUSH', 'SEEN', or 'ALL'");
        }
        this._rootPaths[path] = strategy;
        if (strategy === 'ALL') {
            if (this.activateHandler) {
                this.activateHandler(path);
            }
            else {
                this.pendingActivations.push(path);
            }
        }
    }
    /**
     * Enable caching for a given path.
     *
     * Uses caching strategy ``ALL``.
     *
     * @param {string} path - Path to enable caching for
     */
    enable(path) {
        this.set(path, 'ALL');
    }
    /**
     * Disable caching for a given path.
     *
     * Uses caching strategy ``FLUSH`` (meaning items are only cached until
     * successfully pushed to the remote).
     *
     * @param {string} path - Path to disable caching for
     */
    disable(path) {
        this.set(path, 'FLUSH');
    }
    /**
     * Set a callback for when caching is activated for a path.
     *
     * @param {function} cb - Callback function
     */
    onActivate(cb) {
        (0, log_1.default)('[Caching] Setting activate handler', cb, this.pendingActivations);
        this.activateHandler = cb;
        for (let i = 0; i < this.pendingActivations.length; i++) {
            cb(this.pendingActivations[i]);
        }
        this.pendingActivations = [];
    }
    /**
     * Retrieve caching setting for a given path, or its next parent
     * with a caching strategy set.
     *
     * @param {string} path - Path to retrieve setting for
     * @returns {string} caching strategy for the path
     **/
    checkPath(path) {
        if (this._rootPaths[path] !== undefined) {
            return this._rootPaths[path];
        }
        else if (path === '/') {
            return 'SEEN';
        }
        else {
            return this.checkPath((0, util_1.containingFolder)(path));
        }
    }
    /**
     * Reset the state of caching by deleting all caching information.
     **/
    reset() {
        this._rootPaths = {};
    }
    /**
     * Setup function that is called on initialization.
     *
     * @private
     **/
    static _rs_init( /*remoteStorage*/) {
        return;
    }
}
module.exports = Caching;


/***/ }),

/***/ "./src/cachinglayer.ts":
/*!*****************************!*\
  !*** ./src/cachinglayer.ts ***!
  \*****************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const eventhandling_1 = __importDefault(__webpack_require__(/*! ./eventhandling */ "./src/eventhandling.ts"));
const config_1 = __importDefault(__webpack_require__(/*! ./config */ "./src/config.ts"));
const log_1 = __importDefault(__webpack_require__(/*! ./log */ "./src/log.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
function getLatest(node) {
    if (typeof (node) !== 'object' || typeof (node.path) !== 'string') {
        return;
    }
    if ((0, util_1.isFolder)(node.path)) {
        if (node.local && node.local.itemsMap) {
            return node.local;
        }
        if (node.common && node.common.itemsMap) {
            return node.common;
        }
    }
    else {
        if (node.local) {
            if (node.local.body && node.local.contentType) {
                return node.local;
            }
            if (node.local.body === false) {
                return;
            }
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
    for (const path in nodes) {
        if (nodes[path] && nodes[path].remote) {
            return true;
        }
        const nodeVersion = getLatest(nodes[path]);
        if (nodeVersion && nodeVersion.timestamp && (new Date().getTime()) - nodeVersion.timestamp <= maxAge) {
            return false;
        }
        else if (!nodeVersion) {
            return true;
        }
    }
    return true;
}
function makeNode(path) {
    const node = { path: path, common: {} };
    if ((0, util_1.isFolder)(path)) {
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
        node.local = (0, util_1.deepClone)(node.common);
    }
    if (!node.local.itemsMap) {
        node.local.itemsMap = node.common.itemsMap;
    }
    node.local.itemsMap[itemName] = true;
    return node;
}
/**
 * This module defines functions that are mixed into remoteStorage.local when
 * it is instantiated (currently one of indexeddb.js, localstorage.js, or
 * inmemorystorage.js).
 *
 * All remoteStorage.local implementations should therefore implement
 * this.getNodes, this.setNodes, and this.forAllNodes. The rest is blended in
 * here to create a GPD (get/put/delete) interface which the BaseClient can
 * talk to.
 *
 * @interface
 */
class CachingLayer {
    constructor() {
        // FIXME
        // this process of updating nodes needs to be heavily documented first, then
        // refactored. Right now it's almost impossible to refactor as there's no
        // explanation of why things are implemented certain ways or what the goal(s)
        // of the behavior are. -slvrbckt (+1 -les)
        this._updateNodesRunning = false;
        this._updateNodesQueued = [];
    }
    // --------------------------------------------------
    // TODO: improve our code structure so that this function
    // could call sync.queueGetRequest directly instead of needing
    // this hacky third parameter as a callback
    get(path, maxAge, queueGetRequest) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof (maxAge) === 'number') {
                return this.getNodes((0, util_1.pathsFromRoot)(path))
                    .then((objs) => {
                    const node = getLatest(objs[path]);
                    if (isOutdated(objs, maxAge)) {
                        return queueGetRequest(path);
                    }
                    else if (node) {
                        return {
                            statusCode: 200,
                            body: node.body || node.itemsMap,
                            contentType: node.contentType
                        };
                    }
                    else {
                        return { statusCode: 404 };
                    }
                });
            }
            else {
                return this.getNodes([path])
                    .then((objs) => {
                    const node = getLatest(objs[path]);
                    if (node) {
                        if ((0, util_1.isFolder)(path)) {
                            for (const i in node.itemsMap) {
                                // the hasOwnProperty check here is only because our jshint settings require it:
                                if (node.itemsMap.hasOwnProperty(i) && node.itemsMap[i] === false) {
                                    delete node.itemsMap[i];
                                }
                            }
                        }
                        return {
                            statusCode: 200,
                            body: node.body || node.itemsMap,
                            contentType: node.contentType
                        };
                    }
                    else {
                        return { statusCode: 404 };
                    }
                });
            }
        });
    }
    put(path, body, contentType) {
        return __awaiter(this, void 0, void 0, function* () {
            const paths = (0, util_1.pathsFromRoot)(path);
            function _processNodes(nodePaths, nodes) {
                try {
                    for (let i = 0, len = nodePaths.length; i < len; i++) {
                        const nodePath = nodePaths[i];
                        let node = nodes[nodePath];
                        let previous;
                        if (!node) {
                            nodes[nodePath] = node = makeNode(nodePath);
                        }
                        // Document
                        if (i === 0) {
                            previous = getLatest(node);
                            node.local = {
                                body: body,
                                contentType: contentType,
                                previousBody: (previous ? previous.body : undefined),
                                previousContentType: (previous ? previous.contentType : undefined),
                            };
                        }
                        // Folder
                        else {
                            const itemName = nodePaths[i - 1].substring(nodePath.length);
                            node = updateFolderNodeWithItemName(node, itemName);
                        }
                    }
                    return nodes;
                }
                catch (e) {
                    (0, log_1.default)('[Cachinglayer] Error during PUT', nodes, e);
                    throw e;
                }
            }
            return this._updateNodes(paths, _processNodes);
        });
    }
    delete(path) {
        const paths = (0, util_1.pathsFromRoot)(path);
        return this._updateNodes(paths, function (nodePaths, nodes) {
            for (let i = 0, len = nodePaths.length; i < len; i++) {
                const nodePath = nodePaths[i];
                const node = nodes[nodePath];
                let previous;
                if (!node) {
                    console.error('Cannot delete non-existing node ' + nodePath);
                    continue;
                }
                if (i === 0) {
                    // Document
                    previous = getLatest(node);
                    node.local = {
                        body: false,
                        previousBody: (previous ? previous.body : undefined),
                        previousContentType: (previous ? previous.contentType : undefined),
                    };
                }
                else {
                    // Folder
                    if (!node.local) {
                        node.local = (0, util_1.deepClone)(node.common);
                    }
                    const itemName = nodePaths[i - 1].substring(nodePath.length);
                    delete node.local.itemsMap[itemName];
                    if (Object.getOwnPropertyNames(node.local.itemsMap).length > 0) {
                        // This folder still contains other items, don't remove any further ancestors
                        break;
                    }
                }
            }
            return nodes;
        });
    }
    flush(path) {
        return this._getAllDescendentPaths(path).then((paths) => {
            return this.getNodes(paths);
        }).then((nodes) => {
            for (const nodePath in nodes) {
                const node = nodes[nodePath];
                if (node && node.common && node.local) {
                    this._emitChange({
                        path: node.path,
                        origin: 'local',
                        oldValue: (node.local.body === false ? undefined : node.local.body),
                        newValue: (node.common.body === false ? undefined : node.common.body)
                    });
                }
                nodes[nodePath] = undefined;
            }
            return this.setNodes(nodes);
        });
    }
    _emitChange(obj) {
        if (config_1.default.changeEvents[obj.origin]) {
            this._emit('change', obj);
        }
    }
    fireInitial() {
        if (!config_1.default.changeEvents.local) {
            return;
        }
        this.forAllNodes((node) => {
            if ((0, util_1.isDocument)(node.path)) {
                const latest = getLatest(node);
                if (latest) {
                    this._emitChange({
                        path: node.path,
                        origin: 'local',
                        oldValue: undefined,
                        oldContentType: undefined,
                        newValue: latest.body,
                        newContentType: latest.contentType
                    });
                }
            }
        }).then(() => {
            this._emit('local-events-done');
        });
    }
    // TODO add proper type
    onDiff(diffHandler) {
        this.diffHandler = diffHandler;
    }
    migrate(node) {
        if (typeof (node) === 'object' && !node.common) {
            node.common = {};
            if (typeof (node.path) === 'string') {
                if (node.path.substr(-1) === '/' && typeof (node.body) === 'object') {
                    node.common.itemsMap = node.body;
                }
            }
            else {
                //save legacy content of document node as local version
                if (!node.local) {
                    node.local = {};
                }
                node.local.body = node.body;
                node.local.contentType = node.contentType;
            }
        }
        return node;
    }
    _updateNodes(paths, _processNodes) {
        return new Promise((resolve, reject) => {
            this._doUpdateNodes(paths, _processNodes, {
                resolve: resolve,
                reject: reject
            });
        });
    }
    _doUpdateNodes(paths, _processNodes, promise) {
        if (this._updateNodesRunning) {
            this._updateNodesQueued.push({
                paths: paths,
                cb: _processNodes,
                promise: promise
            });
            return;
        }
        else {
            this._updateNodesRunning = true;
        }
        this.getNodes(paths).then((nodes) => {
            const existingNodes = (0, util_1.deepClone)(nodes);
            const changeEvents = [];
            nodes = _processNodes(paths, nodes);
            for (const path in nodes) {
                const node = nodes[path];
                if ((0, util_1.equal)(node, existingNodes[path])) {
                    delete nodes[path];
                }
                else if ((0, util_1.isDocument)(path)) {
                    if (!(0, util_1.equal)(node.local.body, node.local.previousBody) ||
                        node.local.contentType !== node.local.previousContentType) {
                        changeEvents.push({
                            path: path,
                            origin: 'window',
                            oldValue: node.local.previousBody,
                            newValue: node.local.body === false ? undefined : node.local.body,
                            oldContentType: node.local.previousContentType,
                            newContentType: node.local.contentType
                        });
                    }
                    delete node.local.previousBody;
                    delete node.local.previousContentType;
                }
            }
            this.setNodes(nodes).then(() => {
                this._emitChangeEvents(changeEvents);
                promise.resolve({ statusCode: 200 });
            });
        }).then(() => {
            return Promise.resolve();
        }, (err) => {
            promise.reject(err);
        }).then(() => {
            this._updateNodesRunning = false;
            const nextJob = this._updateNodesQueued.shift();
            if (nextJob) {
                this._doUpdateNodes(nextJob.paths, nextJob.cb, nextJob.promise);
            }
        });
    }
    _emitChangeEvents(events) {
        for (let i = 0, len = events.length; i < len; i++) {
            this._emitChange(events[i]);
            if (this.diffHandler) {
                this.diffHandler(events[i].path);
            }
        }
    }
    _getAllDescendentPaths(path) {
        if ((0, util_1.isFolder)(path)) {
            return this.getNodes([path]).then((nodes) => {
                const allPaths = [path];
                const latest = getLatest(nodes[path]);
                const itemNames = Object.keys(latest.itemsMap);
                const calls = itemNames.map((itemName) => {
                    return this._getAllDescendentPaths(path + itemName).then((paths) => {
                        for (let i = 0, len = paths.length; i < len; i++) {
                            allPaths.push(paths[i]);
                        }
                    });
                });
                return Promise.all(calls).then(() => {
                    return allPaths;
                });
            });
        }
        else {
            return Promise.resolve([path]);
        }
    }
    // treated as private but made public for unit testing
    _getInternals() {
        return {
            getLatest: getLatest,
            makeNode: makeNode,
            isOutdated: isOutdated
        };
    }
}
(0, util_1.applyMixins)(CachingLayer, [eventhandling_1.default]);
module.exports = CachingLayer;


/***/ }),

/***/ "./src/config.ts":
/*!***********************!*\
  !*** ./src/config.ts ***!
  \***********************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * The default config, merged with the object passed to the constructor of the
 * RemoteStorage object
 */
const config = {
    cache: true,
    changeEvents: {
        local: true,
        window: false,
        remote: true,
        conflict: true
    },
    cordovaRedirectUri: undefined,
    logging: false,
    modules: [],
    // the following are not public and will probably be moved away from the
    // default config
    backgroundSyncInterval: 60000,
    disableFeatures: [],
    discoveryTimeout: 10000,
    isBackground: false,
    requestTimeout: 30000,
    syncInterval: 10000
};
module.exports = config;


/***/ }),

/***/ "./src/discover.ts":
/*!*************************!*\
  !*** ./src/discover.ts ***!
  \*************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const webfinger_js_1 = __importDefault(__webpack_require__(/*! webfinger.js */ "./node_modules/webfinger.js/src/webfinger.js"));
const log_1 = __importDefault(__webpack_require__(/*! ./log */ "./src/log.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
// feature detection flags
let haveXMLHttpRequest, hasLocalStorage;
// used to store settings in localStorage
const SETTINGS_KEY = 'remotestorage:discover';
// cache loaded from localStorage
// TODO use class property
let cachedInfo = {};
/**
 * This function deals with the Webfinger lookup, discovering a connecting
 * user's storage details.
 *
 * @param {string} userAddress - user@host or URL
 *
 * @returns {Promise} A promise for an object with the following properties.
 *          href - Storage base URL,
 *          storageApi - RS protocol version,
 *          authUrl - OAuth URL,
 *          properties - Webfinger link properties
 **/
const Discover = function Discover(userAddress) {
    return new Promise((resolve, reject) => {
        if (userAddress in cachedInfo) {
            return resolve(cachedInfo[userAddress]);
        }
        const webFinger = new webfinger_js_1.default({
            tls_only: false,
            uri_fallback: true,
            request_timeout: 5000
        });
        return webFinger.lookup(userAddress, function (err, response) {
            if (err) {
                return reject(err);
            }
            else if ((typeof response.idx.links.remotestorage !== 'object') ||
                (typeof response.idx.links.remotestorage.length !== 'number') ||
                (response.idx.links.remotestorage.length <= 0)) {
                (0, log_1.default)("[Discover] WebFinger record for " + userAddress + " does not have remotestorage defined in the links section ", JSON.stringify(response.json));
                return reject("WebFinger record for " + userAddress + " does not have remotestorage defined in the links section.");
            }
            const rs = response.idx.links.remotestorage[0];
            const authURL = rs.properties['http://tools.ietf.org/html/rfc6749#section-4.2'] ||
                rs.properties['auth-endpoint'];
            const storageApi = rs.properties['http://remotestorage.io/spec/version'] ||
                rs.type;
            // cache fetched data
            cachedInfo[userAddress] = {
                href: rs.href,
                storageApi: storageApi,
                authURL: authURL,
                properties: rs.properties
            };
            if (hasLocalStorage) {
                localStorage[SETTINGS_KEY] = JSON.stringify({ cache: cachedInfo });
            }
            return resolve(cachedInfo[userAddress]);
        });
    });
};
Discover.DiscoveryError = function (message) {
    this.name = 'DiscoveryError';
    this.message = message;
    this.stack = (new Error()).stack;
};
Discover.DiscoveryError.prototype = Object.create(Error.prototype);
Discover.DiscoveryError.prototype.constructor = Discover.DiscoveryError;
Discover._rs_init = function ( /*remoteStorage*/) {
    hasLocalStorage = (0, util_1.localStorageAvailable)();
    if (hasLocalStorage) {
        try {
            const settings = JSON.parse(localStorage[SETTINGS_KEY]);
            cachedInfo = settings.cache;
        }
        catch (e) {
            /* empty */
        }
    }
};
Discover._rs_supported = function () {
    haveXMLHttpRequest = Object.prototype.hasOwnProperty.call(util_1.globalContext, 'XMLHttpRequest');
    return haveXMLHttpRequest;
};
Discover._rs_cleanup = function () {
    if (hasLocalStorage) {
        delete localStorage[SETTINGS_KEY];
    }
};
module.exports = Discover;


/***/ }),

/***/ "./src/dropbox.ts":
/*!************************!*\
  !*** ./src/dropbox.ts ***!
  \************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const eventhandling_1 = __importDefault(__webpack_require__(/*! ./eventhandling */ "./src/eventhandling.ts"));
const baseclient_1 = __importDefault(__webpack_require__(/*! ./baseclient */ "./src/baseclient.ts"));
const revisioncache_1 = __importDefault(__webpack_require__(/*! ./revisioncache */ "./src/revisioncache.ts"));
const sync_error_1 = __importDefault(__webpack_require__(/*! ./sync-error */ "./src/sync-error.ts"));
const unauthorized_error_1 = __importDefault(__webpack_require__(/*! ./unauthorized-error */ "./src/unauthorized-error.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
const requests_1 = __webpack_require__(/*! ./requests */ "./src/requests.ts");
const remote_1 = __webpack_require__(/*! ./remote */ "./src/remote.ts");
const authorize_1 = __importDefault(__webpack_require__(/*! ./authorize */ "./src/authorize.ts"));
/**
 * WORK IN PROGRESS, NOT RECOMMENDED FOR PRODUCTION USE
 *
 * Dropbox backend for RemoteStorage.js
 * This file exposes a get/put/delete interface which is compatible with
 * <WireClient>.
 *
 * When remoteStorage.backend is set to 'dropbox', this backend will
 * initialize and replace remoteStorage.remote with remoteStorage.dropbox.
 *
 * In order to ensure compatibility with the public folder, <BaseClient.getItemURL>
 * gets hijacked to return the Dropbox public share URL.
 *
 * To use this backend, you need to specify the Dropbox app key like so:
 *
 * @example
 * remoteStorage.setApiKeys({
 *   dropbox: 'your-app-key'
 * });
 *
 * An app key can be obtained by registering your app at https://www.dropbox.com/developers/apps
 *
 * Known issues:
 *
 *   - Storing files larger than 150MB is not yet supported
 *   - Listing and deleting folders with more than 10'000 files will cause problems
 *   - Content-Type is not supported; TODO: use file_properties
 *   - Dropbox preserves cases but is not case-sensitive
 *   - getItemURL is asynchronous which means it returns useful values
 *     after the syncCycle
 */
let hasLocalStorage;
const AUTH_URL = 'https://www.dropbox.com/oauth2/authorize';
const ACCOUNT_URL = 'https://api.dropboxapi.com/2/users/get_current_account';
const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const OAUTH_SCOPE = 'account_info.read files.content.read files.content.write files.metadata.read files.metadata.write';
const SETTINGS_KEY = 'remotestorage:dropbox';
const FOLDER_URL = 'https://api.dropboxapi.com/2/files/list_folder';
const CONTINUE_URL = 'https://api.dropboxapi.com/2/files/list_folder/continue';
const DOWNLOAD_URL = 'https://content.dropboxapi.com/2/files/download';
const UPLOAD_URL = 'https://content.dropboxapi.com/2/files/upload';
const DELETE_URL = 'https://api.dropboxapi.com/2/files/delete';
const METADATA_URL = 'https://api.dropboxapi.com/2/files/get_metadata';
const CREATE_SHARED_URL = 'https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings';
const LIST_SHARED_URL = 'https://api.dropbox.com/2/sharing/list_shared_links';
const PATH_PREFIX = '/remotestorage';
const NUM_RETRIES = 3;
/**
 * Maps a remoteStorage path to a path in Dropbox.
 *
 * @param {string} path - Path
 * @returns {string} Actual path in Dropbox
 *
 * @private
 */
function getDropboxPath(path) {
    return (PATH_PREFIX + '/' + path).replace(/\/+$/, '').replace(/\/+/g, '/');
}
// This function is simple and has OK performance compared to more
// complicated ones: https://jsperf.com/json-escape-unicode/4
const charsToEncode = /[\u007f-\uffff]/g;
function httpHeaderSafeJson(obj) {
    return JSON.stringify(obj).replace(charsToEncode, function (c) {
        return '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4);
    });
}
function compareApiError(response, expect) {
    return new RegExp('^' + expect.join('\\/') + '(\\/|$)').test(response.error_summary);
}
function isBinaryData(data) {
    return data instanceof ArrayBuffer || (0, requests_1.isArrayBufferView)(data);
}
/**
 * @class
 */
class Dropbox extends remote_1.RemoteBase {
    constructor(rs) {
        super(rs);
        this.online = true; // TODO implement offline detection on failed request
        this.storageApi = 'draft-dejong-remotestorage-19';
        this._initialFetchDone = false;
        this.addEvents(['connected', 'not-connected']);
        this.clientId = rs.apiKeys.dropbox.appKey;
        this.TOKEN_URL = TOKEN_URL;
        this._revCache = new revisioncache_1.default('rev');
        this._fetchDeltaCursor = null;
        this._fetchDeltaPromise = null;
        this._itemRefs = {};
        hasLocalStorage = (0, util_1.localStorageAvailable)();
        if (hasLocalStorage) {
            const settings = (0, util_1.getJSONFromLocalStorage)(SETTINGS_KEY);
            if (settings) {
                this.configure(settings); // can't await in constructor
            }
            this._itemRefs = (0, util_1.getJSONFromLocalStorage)(`${SETTINGS_KEY}:shares`) || {};
        }
        if (this.connected) {
            setTimeout(this._emit.bind(this), 0, 'connected');
        }
    }
    /**
     * Set the backed to 'dropbox' and start the authentication flow in order
     * to obtain an API token from Dropbox.
     */
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            // TODO handling when token is already present
            try {
                this.rs.setBackend('dropbox');
                if (this.token) {
                    hookIt(this.rs);
                }
                else { // OAuth2 PKCE
                    const { codeVerifier, codeChallenge, state } = yield (0, util_1.generateCodeVerifier)();
                    sessionStorage.setItem('remotestorage:codeVerifier', codeVerifier);
                    sessionStorage.setItem('remotestorage:state', state);
                    this.rs.authorize({
                        authURL: AUTH_URL,
                        scope: OAUTH_SCOPE,
                        clientId: this.clientId,
                        response_type: 'code',
                        state: state,
                        code_challenge: codeChallenge,
                        code_challenge_method: 'S256',
                        token_access_type: 'offline'
                    });
                }
            }
            catch (err) {
                this.rs._emit('error', err);
                this.rs.setBackend(undefined);
                throw err;
            }
        });
    }
    /**
     * Sets the connected flag
     * Accepts its parameters according to the <WireClient>.
     * @param {Object} settings
     * @param {string} [settings.userAddress] - The user's email address
     * @param {string} [settings.token] - Authorization token
     * @param {string} [settings.refreshToken] - OAuth2 PKCE refresh token
     * @param {string} [settings.tokenType] - usually 'bearer' - no support for 'mac' tokens yet
     *
     * @protected
     **/
    configure(settings) {
        return __awaiter(this, void 0, void 0, function* () {
            // We only update this.userAddress if settings.userAddress is set to a string or to null:
            if (typeof settings.userAddress !== 'undefined') {
                this.userAddress = settings.userAddress;
            }
            // Same for this.token. If only one of these two is set, we leave the other one at its existing value:
            if (typeof settings.token !== 'undefined') {
                this.token = settings.token;
            }
            if (typeof settings.refreshToken !== 'undefined') {
                this.refreshToken = settings.refreshToken;
            }
            if (typeof settings.tokenType !== 'undefined') {
                this.tokenType = settings.tokenType;
            }
            const writeSettingsToCache = () => {
                if (hasLocalStorage) {
                    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
                        userAddress: this.userAddress,
                        token: this.token,
                        refreshToken: this.refreshToken,
                        tokenType: this.tokenType,
                    }));
                }
            };
            const handleError = () => {
                this.connected = false;
                if (hasLocalStorage) {
                    localStorage.removeItem(SETTINGS_KEY);
                }
                this.rs.setBackend(undefined);
            };
            if (this.refreshToken || this.token) {
                this.connected = true;
                if (this.userAddress) {
                    this._emit('connected');
                    writeSettingsToCache();
                }
                else {
                    try {
                        const info = yield this.info();
                        this.userAddress = info.email;
                        this._emit('connected');
                        writeSettingsToCache();
                    }
                    catch (err) {
                        this.connected = false;
                        this.rs._emit('error', new Error('Could not fetch user info.'));
                        writeSettingsToCache.apply(this);
                    }
                }
            }
            else {
                handleError();
            }
        });
    }
    /**
     * Get all items in a folder.
     *
     * @param path {string} - path of the folder to get, with leading slash
     * @return {Object}
     *         statusCode - HTTP status code
     *         body - array of the items found
     *         contentType - 'application/json; charset=UTF-8'
     *         revision - revision of the folder
     *
     * @private
     */
    _getFolder(path) {
        const revCache = this._revCache;
        const processResponse = (resp) => {
            let body;
            if (resp.status !== 200 && resp.status !== 409) {
                return Promise.reject('Unexpected response status: ' + resp.status);
            }
            try {
                body = JSON.parse(resp.responseText);
            }
            catch (e) {
                return Promise.reject(e);
            }
            if (resp.status === 409) {
                if (compareApiError(body, ['path', 'not_found'])) {
                    // if the folder is not found, handle it as an empty folder
                    return Promise.resolve({});
                }
                return Promise.reject(new Error('API returned an error: ' + body.error_summary));
            }
            const listing = body.entries.reduce((map, item) => {
                try {
                    const isDir = item['.tag'] === 'folder';
                    const itemName = item.path_display.split('/').slice(-1)[0] + (isDir ? '/' : '');
                    if (isDir) {
                        map[itemName] = { ETag: revCache.get(path + itemName) };
                    }
                    else {
                        const date = new Date(item.server_modified);
                        map[itemName] = { ETag: item.rev, 'Content-Length': item.size, 'Last-Modified': date.toUTCString() };
                        this._revCache.set(path + itemName, item.rev);
                    }
                }
                catch (err) {
                    console.error(`[Dropbox] folder “${path}” has entry ${JSON.stringify(item)}:`, err);
                }
                return map;
            }, {});
            if (body.has_more) {
                return loadNext(body.cursor).then(function (nextListing) {
                    return Object.assign(listing, nextListing);
                });
            }
            return Promise.resolve(listing);
        };
        const loadNext = (cursor) => {
            const params = {
                body: { cursor: cursor }
            };
            return this._request('POST', CONTINUE_URL, params).then(processResponse);
        };
        return this._request('POST', FOLDER_URL, {
            body: {
                path: getDropboxPath(path)
            }
        }).then(processResponse).then(function (listing) {
            return Promise.resolve({
                statusCode: 200,
                body: listing,
                contentType: 'application/json; charset=UTF-8',
                revision: revCache.get(path)
            });
        });
    }
    /**
     * Checks for the path in ``_revCache`` and decides based on that if file
     * has changed. Calls ``_getFolder`` is the path points to a folder.
     *
     * Calls ``Dropbox.share`` afterwards to fill ``_itemRefs``.
     *
     * Compatible with ``WireClient.get``
     *
     * @param path {string} - path of the folder to get, with leading slash
     * @param options {Object}
     *
     * @protected
     */
    get(path, options = {}) {
        if (!this.connected) {
            return Promise.reject("not connected (path: " + path + ")");
        }
        const savedRev = this._revCache.get(path);
        if (savedRev === null) {
            // file was deleted server side
            return Promise.resolve({ statusCode: 404 });
        }
        if (options && options.ifNoneMatch) {
            // We must wait for local revision cache to be initialized before
            // checking if local revision is outdated
            if (!this._initialFetchDone) {
                return this.fetchDelta().then(() => {
                    return this.get(path, options);
                });
            }
            if (savedRev && (savedRev === options.ifNoneMatch)) {
                // nothing changed.
                return Promise.resolve({ statusCode: 304 });
            }
        }
        // use _getFolder for folders
        if (path.slice(-1) === '/') {
            return this._getFolder(path);
        }
        const params = {
            headers: {
                'Dropbox-API-Arg': httpHeaderSafeJson({ path: getDropboxPath(path) }),
            },
            responseType: 'arraybuffer'
        };
        if (options && options.ifNoneMatch) {
            params.headers['If-None-Match'] = options.ifNoneMatch;
        }
        return this._request('GET', DOWNLOAD_URL, params).then(resp => {
            const status = resp.status;
            let meta, body, mime, rev;
            if (status !== 200 && status !== 409) {
                return Promise.resolve({ statusCode: status });
            }
            meta = resp.getResponseHeader('Dropbox-API-Result');
            //first encode the response as text, and later check if
            //text appears to actually be binary data
            return (0, util_1.getTextFromArrayBuffer)(resp.response, 'UTF-8').then(responseText => {
                body = responseText;
                if (status === 409) {
                    meta = body;
                }
                try {
                    meta = JSON.parse(meta);
                }
                catch (e) {
                    return Promise.reject(e);
                }
                if (status === 409) {
                    if (compareApiError(meta, ['path', 'not_found'])) {
                        return { statusCode: 404 };
                    }
                    return Promise.reject(new Error('API error while downloading file ("' + path + '"): ' + meta.error_summary));
                }
                mime = resp.getResponseHeader('Content-Type');
                rev = meta.rev;
                this._revCache.set(path, rev);
                this._shareIfNeeded(path); // There doesn't appear to be a need to await this.
                if ((0, util_1.shouldBeTreatedAsBinary)(responseText, mime)) {
                    // return unprocessed response
                    body = resp.response;
                }
                else {
                    // handling json (always try)
                    try {
                        body = JSON.parse(body);
                        mime = 'application/json; charset=UTF-8';
                    }
                    catch (e) {
                        //Failed parsing Json, assume it is something else then
                    }
                }
                return {
                    statusCode: status,
                    body: body,
                    contentType: mime,
                    revision: rev
                };
            });
        });
    }
    /**
     * Checks for the path in ``_revCache`` and decides based on that if file
     * has changed.
     *
     * Compatible with ``WireClient``
     *
     * Calls ``Dropbox.share`` afterwards to fill ``_itemRefs``.
     *
     * @param {string} path - path of the folder to put, with leading slash
     * @param {XMLHttpRequestBodyInit} body - Blob | BufferSource | FormData | URLSearchParams | string
     * @param {string} contentType - MIME type of body
     * @param {Object} options
     * @param {string} options.ifNoneMatch - When *, only create or update the file if it doesn't yet exist
     * @param {string} options.ifMatch - Only saves if this matches current revision
     * @returns {Promise} Resolves with an object containing the status code,
     *                    content-type and revision
     * @protected
     */
    put(path, body, contentType, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.connected) {
                throw new Error("not connected (path: " + path + ")");
            }
            // check if file has changed and return 412
            const savedRev = this._revCache.get(path);
            if (options && options.ifMatch &&
                savedRev && (savedRev !== options.ifMatch)) {
                return { statusCode: 412, revision: savedRev };
            }
            if (options && (options.ifNoneMatch === '*') &&
                savedRev && (savedRev !== 'rev')) {
                return { statusCode: 412, revision: savedRev };
            }
            if ((!contentType.match(/charset=/)) && isBinaryData(body)) {
                contentType += '; charset=binary';
            }
            if (body.length > 150 * 1024 * 1024) {
                //https://www.dropbox.com/developers/core/docs#chunked-upload
                throw new Error("Cannot upload file larger than 150MB");
            }
            const needsMetadata = options && (options.ifMatch || (options.ifNoneMatch === '*'));
            const uploadParams = {
                body: body,
                contentType: contentType,
                path: path
            };
            if (needsMetadata) {
                const metadata = yield this._getMetadata(path);
                if (options && (options.ifNoneMatch === '*') && metadata) {
                    // if !!metadata === true, the file exists
                    return {
                        statusCode: 412,
                        revision: metadata.rev
                    };
                }
                if (options && options.ifMatch && metadata && (metadata.rev !== options.ifMatch)) {
                    return {
                        statusCode: 412,
                        revision: metadata.rev
                    };
                }
            }
            const result = yield this._uploadSimple(uploadParams);
            this._shareIfNeeded(path); // There doesn't appear to be a need to await this.
            return result;
        });
    }
    /**
     * Checks for the path in ``_revCache`` and decides based on that if file
     * has changed.
     *
     * Compatible with ``WireClient.delete``
     *
     * Calls ``Dropbox.share`` afterwards to fill ``_itemRefs``.
     *
     * @param {string} path - path of the folder to delete, with leading slash
     * @param {Object} options
     *
     * @protected
     */
    'delete'(path, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.connected) {
                throw new Error("not connected (path: " + path + ")");
            }
            // check if file has changed and return 412
            const savedRev = this._revCache.get(path);
            if ((options === null || options === void 0 ? void 0 : options.ifMatch) && savedRev && (options.ifMatch !== savedRev)) {
                return { statusCode: 412, revision: savedRev };
            }
            if (options === null || options === void 0 ? void 0 : options.ifMatch) {
                const metadata = yield this._getMetadata(path);
                if ((options === null || options === void 0 ? void 0 : options.ifMatch) && metadata && (metadata.rev !== options.ifMatch)) {
                    return {
                        statusCode: 412,
                        revision: metadata.rev
                    };
                }
            }
            return this._deleteSimple(path);
        });
    }
    /**
     * Calls share, if the provided path resides in a public folder.
     * @private
     */
    _shareIfNeeded(path) {
        if (path.match(/^\/public\/.*[^/]$/) && this._itemRefs[path] === undefined) {
            return this.share(path);
        }
    }
    /**
     * Gets a publicly-accessible URL for the path from Dropbox and stores it
     * in ``_itemRefs``.
     *
     * @return {Promise} a promise for the URL
     *
     * @private
     */
    share(path) {
        const options = {
            body: { path: getDropboxPath(path) }
        };
        return this._request('POST', CREATE_SHARED_URL, options).then((response) => {
            if (response.status !== 200 && response.status !== 409) {
                return Promise.reject(new Error('Invalid response status:' + response.status));
            }
            let body;
            try {
                body = JSON.parse(response.responseText);
            }
            catch (e) {
                return Promise.reject(new Error('Invalid response body: ' + response.responseText));
            }
            if (response.status === 409) {
                if (compareApiError(body, ['shared_link_already_exists'])) {
                    return this._getSharedLink(path);
                }
                return Promise.reject(new Error('API error: ' + body.error_summary));
            }
            return Promise.resolve(body.url);
        }).then((link) => {
            this._itemRefs[path] = link;
            if (hasLocalStorage) {
                localStorage.setItem(SETTINGS_KEY + ':shares', JSON.stringify(this._itemRefs));
            }
            return Promise.resolve(link);
        }, (error) => {
            error.message = 'Sharing Dropbox file or folder ("' + path + '") failed: ' + error.message;
            return Promise.reject(error);
        });
    }
    /**
     * Fetches the user's info from dropbox and returns a promise for it.
     *
     * @return {Promise} a promise for user info object (email - the user's email address)
     *
     * @protected
     */
    info() {
        return this._request('POST', ACCOUNT_URL, {}).then(function (response) {
            let email;
            try {
                const info = JSON.parse(response.responseText);
                email = info === null || info === void 0 ? void 0 : info.email;
            }
            catch (e) {
                return Promise.reject(new Error('Could not query current account info: Invalid API response: ' + response.responseText));
            }
            return Promise.resolve({
                email: email
            });
        });
    }
    /**
     * Makes a network request.
     *
     * @param {string} method - Request method
     * @param {string} url - Target URL
     * @param {object} options - Request options
     * @param {number} numAttempts - # of times same request repeated
     * @returns {Promise} Resolves with the response of the network request
     *
     * @private
     */
    _request(method, url, options, numAttempts = 1) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isForbiddenRequestMethod(method, url)) {
                throw `Don't use ${method} on directories!`;
            }
            if (!this.token) {
                throw new unauthorized_error_1.default("No access token");
            }
            if (!options.headers) {
                options.headers = {};
            }
            options.headers['Authorization'] = 'Bearer ' + this.token;
            if (typeof options.body === 'object' && !isBinaryData(options.body)) {
                options.body = JSON.stringify(options.body);
                options.headers['Content-Type'] = 'application/json; charset=UTF-8';
            }
            this.rs._emit('wire-busy', {
                method: method,
                isFolder: (0, util_1.isFolder)(url)
            });
            try {
                const xhr = yield (0, requests_1.requestWithTimeout)(method, url, options);
                if (!this.online) {
                    this.online = true;
                    this.rs._emit('network-online');
                }
                this.rs._emit('wire-done', {
                    method: method,
                    isFolder: (0, util_1.isFolder)(url),
                    success: true
                });
                if ((xhr === null || xhr === void 0 ? void 0 : xhr.status) === 401 && this.refreshToken) {
                    if (numAttempts >= NUM_RETRIES) {
                        console.error(`Abandoned after ${numAttempts} attempts: ${method} ${url}`);
                        return xhr;
                    }
                    else {
                        this.rs._emit('wire-busy', {
                            method: method,
                            isFolder: (0, util_1.isFolder)(url)
                        });
                        yield authorize_1.default.refreshAccessToken(this.rs, this, this.refreshToken);
                        this.rs._emit('wire-done', {
                            method: method,
                            isFolder: (0, util_1.isFolder)(url),
                            success: true
                        });
                        // re-runs original request
                        return this._request(method, url, options, numAttempts + 1);
                    }
                }
                else if ([503, 429].includes(xhr === null || xhr === void 0 ? void 0 : xhr.status)) {
                    // 503 Service Unavailable; 429 Too Many Requests
                    if (this.online) {
                        this.online = false;
                        this.rs._emit('network-offline');
                    }
                    if (numAttempts >= NUM_RETRIES) {
                        console.warn(`Abandoned after ${numAttempts} attempts: ${method} ${url}`);
                        return xhr;
                    }
                    else {
                        yield new Promise(resolve => setTimeout(resolve, (0, requests_1.retryAfterMs)(xhr)));
                        // re-runs original request
                        return this._request(method, url, options, numAttempts + 1);
                    }
                }
                else {
                    return xhr;
                }
            }
            catch (error) {
                if (this.online) {
                    this.online = false;
                    this.rs._emit('network-offline');
                }
                this.rs._emit('wire-done', {
                    method: method,
                    isFolder: (0, util_1.isFolder)(url),
                    success: false
                });
                throw error;
            }
        });
    }
    /**
     * Fetches the revision of all the files from dropbox API and puts them
     * into ``_revCache``. These values can then be used to determine if
     * something has changed.
     *
     * @private
     */
    fetchDelta(...args) {
        // If fetchDelta was already called, and didn't finish, return the existing
        // promise instead of calling Dropbox API again
        if (this._fetchDeltaPromise) {
            return this._fetchDeltaPromise;
        }
        /** This should resolve (with no value) on success, and reject on error. */
        const fetch = (cursor) => __awaiter(this, void 0, void 0, function* () {
            let url;
            let requestBody;
            if (typeof cursor === 'string') {
                url = CONTINUE_URL;
                requestBody = { cursor };
            }
            else {
                url = FOLDER_URL;
                requestBody = {
                    path: PATH_PREFIX,
                    recursive: true,
                    include_deleted: true
                };
            }
            try {
                const response = yield this._request('POST', url, { body: requestBody });
                if (response.status === 401) {
                    throw new unauthorized_error_1.default();
                }
                if (response.status !== 200 && response.status !== 409) {
                    throw new Error('Invalid response status: ' + response.status);
                }
                let responseBody;
                try {
                    responseBody = JSON.parse(response.responseText);
                }
                catch (e) {
                    throw new Error('Invalid response body: ' + response.responseText);
                }
                if (response.status === 409) {
                    if (compareApiError(responseBody, ['path', 'not_found'])) {
                        responseBody = {
                            cursor: null,
                            entries: [],
                            has_more: false
                        };
                    }
                    else {
                        throw new Error('API returned an error: ' + responseBody.error_summary);
                    }
                }
                if (!cursor) {
                    //we are doing a complete fetch, so propagation would introduce unnecessary overhead
                    this._revCache.deactivatePropagation();
                }
                responseBody.entries.forEach(entry => {
                    const path = entry.path_display.slice(PATH_PREFIX.length);
                    if (entry['.tag'] === 'deleted') {
                        // there's no way to know whether the entry was a file or a folder
                        this._revCache.delete(path);
                        this._revCache.delete(path + '/');
                    }
                    else if (entry['.tag'] === 'file') {
                        this._revCache.set(path, entry.rev);
                    }
                });
                this._fetchDeltaCursor = responseBody.cursor;
                if (responseBody.has_more) {
                    return fetch(responseBody.cursor);
                }
                else {
                    this._revCache.activatePropagation();
                    this._initialFetchDone = true;
                }
            }
            catch (error) {
                if (error === 'timeout') {
                    // Offline is handled elsewhere already, just ignore it here
                    return;
                }
                else {
                    throw error;
                }
            }
        });
        this._fetchDeltaPromise = fetch(this._fetchDeltaCursor).catch(error => {
            if (typeof (error) === 'object' && 'message' in error) {
                error.message = 'Dropbox: fetchDelta: ' + error.message;
            }
            else {
                error = `Dropbox: fetchDelta: ${error}`;
            }
            this.rs._emit('error', error);
            this._fetchDeltaPromise = null;
            return Promise.reject(error);
        }).then(() => {
            this._fetchDeltaPromise = null;
            return Promise.resolve(args);
        });
        return this._fetchDeltaPromise;
    }
    /**
     * Gets metadata for a path (can point to either a file or a folder).
     *
     * @param {string} path - the path to get metadata for
     *
     * @returns {Promise} A promise for the metadata
     *
     * @private
     */
    _getMetadata(path) {
        const requestBody = {
            path: getDropboxPath(path)
        };
        return this._request('POST', METADATA_URL, { body: requestBody }).then((response) => {
            if (response.status !== 200 && response.status !== 409) {
                return Promise.reject(new Error('Invalid response status:' + response.status));
            }
            let responseBody;
            try {
                responseBody = JSON.parse(response.responseText);
            }
            catch (e) {
                return Promise.reject(new Error('Invalid response body: ' + response.responseText));
            }
            if (response.status === 409) {
                if (compareApiError(responseBody, ['path', 'not_found'])) {
                    return Promise.resolve();
                }
                return Promise.reject(new Error('API error: ' + responseBody.error_summary));
            }
            return Promise.resolve(responseBody);
        }).then(undefined, (error) => {
            error.message = 'Could not load metadata for file or folder ("' + path + '"): ' + error.message;
            return Promise.reject(error);
        });
    }
    /**
     * Upload a simple file (the size is no more than 150MB).
     *
     * @param {Object} params
     * @param {string} params.ifMatch - Only update the file if its ETag
     *                                   matches this string
     * @param {string} params.path - path of the file
     * @param {string} params.body - contents of the file to upload
     * @param {string} params.contentType - mime type of the file   *
     * @return {Promise} A promise for an object with the following structure:
     *         statusCode - HTTP status code
     *         revision - revision of the newly-created file, if any
     *
     * @private
     */
    _uploadSimple(params) {
        const args = {
            path: getDropboxPath(params.path),
            mode: { '.tag': 'overwrite', update: undefined },
            mute: true
        };
        if (params.ifMatch) {
            args.mode = { '.tag': 'update', update: params.ifMatch };
        }
        return this._request('POST', UPLOAD_URL, {
            body: params.body,
            headers: {
                'Content-Type': 'application/octet-stream',
                'Dropbox-API-Arg': httpHeaderSafeJson(args)
            }
        }).then(response => {
            if (response.status !== 200 && response.status !== 409) {
                return Promise.resolve({ statusCode: response.status });
            }
            let body;
            try {
                body = JSON.parse(response.responseText);
            }
            catch (e) {
                return Promise.reject(new Error('Invalid API result: ' + response.responseText));
            }
            if (response.status === 409) {
                if (compareApiError(body, ['path', 'conflict'])) {
                    return this._getMetadata(params.path).then(function (metadata) {
                        return Promise.resolve({
                            statusCode: 412,
                            revision: metadata.rev
                        });
                    });
                }
                this.rs._emit('error', new Error(body.error_summary));
                return Promise.resolve({ statusCode: response.status });
            }
            this._revCache.set(params.path, body.rev);
            return Promise.resolve({ statusCode: response.status, revision: body.rev });
        });
    }
    /**
     * Deletes a file or a folder.
     *
     * @param {string} path - the path to delete
     *
     * @returns {Promise} A promise for an object with the following structure:
     *          statusCode - HTTP status code
     *
     * @private
     */
    _deleteSimple(path) {
        const requestBody = { path: getDropboxPath(path) };
        return this._request('POST', DELETE_URL, { body: requestBody }).then((response) => {
            if (response.status !== 200 && response.status !== 409) {
                return Promise.resolve({ statusCode: response.status });
            }
            let responseBody;
            try {
                responseBody = JSON.parse(response.responseText);
            }
            catch (e) {
                return Promise.reject(new Error('Invalid response body: ' + response.responseText));
            }
            if (response.status === 409) {
                if (compareApiError(responseBody, ['path_lookup', 'not_found'])) {
                    return Promise.resolve({ statusCode: 404 });
                }
                this.rs._emit('error', new Error(responseBody.error_summary));
            }
            return Promise.resolve({ statusCode: response.status });
        }).then(result => {
            if (result.statusCode === 200 || result.statusCode === 404) {
                this._revCache.delete(path);
                delete this._itemRefs[path];
            }
            return Promise.resolve(result);
        }, (error) => {
            error.message = 'Could not delete Dropbox file or folder ("' + path + '"): ' + error.message;
            return Promise.reject(error);
        });
    }
    /**
     * Requests the link for an already-shared file or folder.
     *
     * @param {string} path - path to the file or folder
     *
     * @returns {Promise} A promise for the shared link
     *
     * @private
     */
    _getSharedLink(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const options = {
                body: {
                    path: getDropboxPath(path),
                    direct_only: true
                }
            };
            return this._request('POST', LIST_SHARED_URL, options).then((response) => {
                if (response.status !== 200 && response.status !== 409) {
                    return Promise.reject(new Error('Invalid response status: ' + response.status));
                }
                let body;
                try {
                    body = JSON.parse(response.responseText);
                }
                catch (e) {
                    return Promise.reject(new Error('Invalid response body: ' + response.responseText));
                }
                if (response.status === 409) {
                    return Promise.reject(new Error('API error: ' + (body === null || body === void 0 ? void 0 : body.error_summary) || false));
                }
                if (!body.links.length) {
                    return Promise.reject(new Error('No links returned'));
                }
                return Promise.resolve(body.links[0].url);
            }, error => {
                error.message = 'Could not get link to a shared file or folder ("' + path + '"): ' + error.message;
                return Promise.reject(error);
            });
        });
    }
    /**
     * Initialize the Dropbox backend.
     *
     * @param {object} rs - RemoteStorage instance
     *
     * @protected
     */
    static _rs_init(rs) {
        hasLocalStorage = (0, util_1.localStorageAvailable)();
        if (rs.apiKeys.dropbox) {
            rs.dropbox = new Dropbox(rs);
        }
        if (rs.backend === 'dropbox') {
            hookIt(rs);
        }
    }
    /**
     * Inform about the availability of the Dropbox backend.
     *
     * @returns {Boolean}
     *
     * @protected
     */
    static _rs_supported() {
        return true;
    }
    /**
     * Remove Dropbox as a backend.
     *
     * @param {object} rs - RemoteStorage instance
     *
     * @protected
     */
    static _rs_cleanup(rs) {
        unHookIt(rs);
        if (hasLocalStorage) {
            localStorage.removeItem(SETTINGS_KEY);
        }
        rs.setBackend(undefined);
    }
}
/**
 * Hooking the sync
 *
 * TODO: document
 */
function hookSync(rs, ...args) {
    if (rs._dropboxOrigSync) {
        return;
    } // already hooked
    rs._dropboxOrigSync = rs.sync.sync.bind(rs.sync);
    rs.sync.sync = function () {
        return this.dropbox.fetchDelta(rs, ...args).
            then(rs._dropboxOrigSync, function (err) {
            rs._emit('error', new sync_error_1.default(err));
            rs._emit('sync-done');
        });
    }.bind(rs);
}
/**
 * Unhooking the sync
 *
 * TODO: document
 */
function unHookSync(rs) {
    if (!rs._dropboxOrigSync) {
        return;
    } // not hooked
    rs.sync.sync = rs._dropboxOrigSync;
    delete rs._dropboxOrigSync;
}
/**
 * Hook RemoteStorage.syncCycle as it's the first function called
 * after RemoteStorage.sync is initialized, so we can then hook
 * the sync function
 * @param {object} rs RemoteStorage instance
 * @param {array} args remaining arguments
 */
function hookSyncCycle(rs, ...args) {
    if (rs._dropboxOrigSyncCycle) {
        return;
    } // already hooked
    rs._dropboxOrigSyncCycle = rs.syncCycle;
    rs.syncCycle = () => {
        if (rs.sync) {
            hookSync(rs);
            rs._dropboxOrigSyncCycle(rs, ...args);
            unHookSyncCycle(rs);
        }
        else {
            throw new Error('expected sync to be initialized by now');
        }
    };
}
/**
 * Restore RemoteStorage's syncCycle original implementation
 * @param {object} rs RemoteStorage instance
 */
function unHookSyncCycle(rs) {
    if (!rs._dropboxOrigSyncCycle) {
        return;
    } // not hooked
    rs.syncCycle = rs._dropboxOrigSyncCycle;
    delete rs._dropboxOrigSyncCycle;
}
/**
 * Overwrite BaseClient's getItemURL with our own implementation
 *
 * TODO: getItemURL still needs to be implemented
 *
 * @param {object} rs - RemoteStorage instance
 *
 * @private
 */
function hookGetItemURL(rs) {
    if (rs._origBaseClientGetItemURL) {
        return;
    }
    rs._origBaseClientGetItemURL = baseclient_1.default.prototype.getItemURL;
    baseclient_1.default.prototype.getItemURL = function ( /*path*/) {
        throw new Error('getItemURL is not implemented for Dropbox yet');
    };
}
/**
 * Restore BaseClient's getItemURL original implementation
 *
 * @param {object} rs - RemoteStorage instance
 *
 * @private
 */
function unHookGetItemURL(rs) {
    if (!rs._origBaseClientGetItemURL) {
        return;
    }
    baseclient_1.default.prototype.getItemURL = rs._origBaseClientGetItemURL;
    delete rs._origBaseClientGetItemURL;
}
/**
 * TODO: document
 */
function hookRemote(rs) {
    if (rs._origRemote) {
        return;
    }
    rs._origRemote = rs.remote;
    rs.remote = rs.dropbox;
}
/**
 * TODO: document
 */
function unHookRemote(rs) {
    if (rs._origRemote) {
        rs.remote = rs._origRemote;
        delete rs._origRemote;
    }
}
/**
 * TODO: document
 */
function hookIt(rs) {
    hookRemote(rs);
    if (rs.sync) {
        hookSync(rs);
    }
    else {
        // when sync is not available yet, we hook the syncCycle function which is called
        // right after sync is initialized
        hookSyncCycle(rs);
    }
    hookGetItemURL(rs);
}
/**
 * TODO: document
 */
function unHookIt(rs) {
    unHookRemote(rs);
    unHookSync(rs);
    unHookGetItemURL(rs);
    unHookSyncCycle(rs);
}
(0, util_1.applyMixins)(Dropbox, [eventhandling_1.default]);
module.exports = Dropbox;


/***/ }),

/***/ "./src/env.ts":
/*!********************!*\
  !*** ./src/env.ts ***!
  \********************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const eventhandling_1 = __importDefault(__webpack_require__(/*! ./eventhandling */ "./src/eventhandling.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
class Env {
    constructor() {
        this.addEvents(["background", "foreground"]);
        this.mode = typeof (window) !== 'undefined' ? 'browser' : 'node';
        if (this.mode === 'browser') {
            this.setBrowserPrefixedNames();
            document.addEventListener(this.visibilityChangeEvent, this.setVisibility.bind(this), false);
            this.setVisibility();
        }
    }
    setBrowserPrefixedNames() {
        if (this.mode !== 'browser') {
            return;
        }
        if (typeof document.hidden !== "undefined") {
            this.hiddenProperty = "hidden";
            this.visibilityChangeEvent = "visibilitychange";
        }
        else if (typeof document["mozHidden"] !== "undefined") {
            this.hiddenProperty = "mozHidden";
            this.visibilityChangeEvent = "mozvisibilitychange";
        }
        else if (typeof document["msHidden"] !== "undefined") {
            this.hiddenProperty = "msHidden";
            this.visibilityChangeEvent = "msvisibilitychange";
        }
        else if (typeof document["webkitHidden"] !== "undefined") {
            this.hiddenProperty = "webkitHidden";
            this.visibilityChangeEvent = "webkitvisibilitychange";
        }
    }
    setVisibility() {
        if (document[this.hiddenProperty]) {
            this.goBackground();
        }
        else {
            this.goForeground();
        }
    }
    isBrowser() {
        return this.mode === "browser";
    }
    isNode() {
        return this.mode === "node";
    }
    goBackground() {
        this._emit("background");
    }
    goForeground() {
        this._emit("foreground");
    }
    static _rs_init( /* remoteStorage */) {
        return;
    }
    static _rs_cleanup( /* remoteStorage */) {
        return;
    }
}
(0, util_1.applyMixins)(Env, [eventhandling_1.default]);
module.exports = Env;


/***/ }),

/***/ "./src/eventhandling.ts":
/*!******************************!*\
  !*** ./src/eventhandling.ts ***!
  \******************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const log_1 = __importDefault(__webpack_require__(/*! ./log */ "./src/log.ts"));
class EventHandling {
    /**
     * Register event names
     *
     * TODO see if necessary, or can be done on the fly in addEventListener
     */
    addEvents(additionalEvents) {
        additionalEvents.forEach(evName => this._addEvent(evName));
    }
    /**
     * Install an event handler for the given event name
     */
    addEventListener(eventName, handler) {
        // Check type for public consumption of API
        if (typeof (eventName) !== 'string') {
            throw new Error('Argument eventName should be a string');
        }
        if (typeof (handler) !== 'function') {
            throw new Error('Argument handler should be a function');
        }
        (0, log_1.default)('[EventHandling] Adding event listener', eventName);
        this._validateEvent(eventName);
        this._handlers[eventName].push(handler);
    }
    /*
     * Alias for addEventListener
     */
    on(eventName, handler) {
        return this.addEventListener(eventName, handler);
    }
    /**
     * Remove a previously installed event handler
     */
    removeEventListener(eventName, handler) {
        this._validateEvent(eventName);
        const hl = this._handlers[eventName].length;
        for (let i = 0; i < hl; i++) {
            if (this._handlers[eventName][i] === handler) {
                this._handlers[eventName].splice(i, 1);
                return;
            }
        }
    }
    _emit(eventName, ...args) {
        this._validateEvent(eventName);
        this._handlers[eventName].slice().forEach((handler) => {
            handler.apply(this, args);
        });
    }
    _validateEvent(eventName) {
        if (!(eventName in this._handlers)) {
            throw new Error("Unknown event: " + eventName);
        }
    }
    _delegateEvent(eventName, target) {
        target.on(eventName, (event) => {
            this._emit(eventName, event);
        });
    }
    _addEvent(eventName) {
        if (typeof this._handlers === 'undefined') {
            this._handlers = {};
        }
        this._handlers[eventName] = [];
    }
}
module.exports = EventHandling;


/***/ }),

/***/ "./src/features.ts":
/*!*************************!*\
  !*** ./src/features.ts ***!
  \*************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const config_1 = __importDefault(__webpack_require__(/*! ./config */ "./src/config.ts"));
const env_1 = __importDefault(__webpack_require__(/*! ./env */ "./src/env.ts"));
const log_1 = __importDefault(__webpack_require__(/*! ./log */ "./src/log.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
const syncedgetputdelete_1 = __importDefault(__webpack_require__(/*! ./syncedgetputdelete */ "./src/syncedgetputdelete.ts"));
const access_1 = __importDefault(__webpack_require__(/*! ./access */ "./src/access.ts"));
const authorize_1 = __importDefault(__webpack_require__(/*! ./authorize */ "./src/authorize.ts"));
const discover_1 = __importDefault(__webpack_require__(/*! ./discover */ "./src/discover.ts"));
const baseclient_1 = __importDefault(__webpack_require__(/*! ./baseclient */ "./src/baseclient.ts"));
const googledrive_1 = __importDefault(__webpack_require__(/*! ./googledrive */ "./src/googledrive.ts"));
const dropbox_1 = __importDefault(__webpack_require__(/*! ./dropbox */ "./src/dropbox.ts"));
const wireclient_1 = __importDefault(__webpack_require__(/*! ./wireclient */ "./src/wireclient.ts"));
const sync_1 = __importDefault(__webpack_require__(/*! ./sync */ "./src/sync.ts"));
// Caching
const caching_1 = __importDefault(__webpack_require__(/*! ./caching */ "./src/caching.ts"));
const indexeddb_1 = __importDefault(__webpack_require__(/*! ./indexeddb */ "./src/indexeddb.ts"));
const localstorage_1 = __importDefault(__webpack_require__(/*! ./localstorage */ "./src/localstorage.ts"));
const inmemorystorage_1 = __importDefault(__webpack_require__(/*! ./inmemorystorage */ "./src/inmemorystorage.ts"));
const Features = {
    features: [],
    featuresDone: 0,
    readyFired: false,
    loadFeatures() {
        this.features = [];
        this.featuresDone = 0;
        this.readyFired = false;
        this.featureModules = {
            'WireClient': wireclient_1.default,
            'Dropbox': dropbox_1.default,
            'GoogleDrive': googledrive_1.default,
            'Access': access_1.default,
            'Discover': discover_1.default,
            'Authorize': authorize_1.default,
            'BaseClient': baseclient_1.default,
            'Env': env_1.default
        };
        // enable caching related modules if needed
        if (config_1.default.cache) {
            // TODO replace util.extend with modern JS {...object, ...object}
            (0, util_1.extend)(this.featureModules, {
                'Caching': caching_1.default,
                'IndexedDB': indexeddb_1.default,
                'LocalStorage': localstorage_1.default,
                'InMemoryStorage': inmemorystorage_1.default,
                'Sync': sync_1.default
            });
        }
        // disable features set in the config object passed to the RemoteStorage
        // constructor
        // For example: ['IndexedDB']
        config_1.default.disableFeatures.forEach(feature => {
            if (this.featureModules[feature]) {
                // this.featureModules[feature] = undefined
                delete this.featureModules[feature];
            }
        });
        this._allLoaded = false;
        for (const featureName in this.featureModules) {
            // FIXME: this has to push the promised return value into an
            // array of promises and use Promise.all to emit `ready`
            // instead of increment a counter of loaded features. -les
            this.loadFeature(featureName);
        }
    },
    /**
     * Method: hasFeature
     *
     * Checks whether a feature is enabled or not within remoteStorage.
     * Returns a boolean.
     *
     * Parameters:
     *   name - Capitalized name of the feature. e.g. Authorize, or IndexedDB
     *
     * Example:
     *   (start code)
     *   if (remoteStorage.hasFeature('LocalStorage')) {
     *     console.log('LocalStorage is enabled!');
     *   }
     *   (end code)
     *
     */
    hasFeature(feature) {
        for (let i = this.features.length - 1; i >= 0; i--) {
            if (this.features[i].name === feature) {
                return this.features[i].supported;
            }
        }
        return false;
    },
    loadFeature(featureName) {
        const feature = this.featureModules[featureName];
        const supported = !feature._rs_supported || feature._rs_supported();
        (0, log_1.default)(`[RemoteStorage] [FEATURE ${featureName}] initializing ...`);
        if (typeof supported === 'object') {
            supported.then(() => {
                this.featureSupported(featureName, true);
                this.initFeature(featureName);
            }, () => {
                this.featureSupported(featureName, false);
            });
        }
        else if (typeof supported === 'boolean') {
            this.featureSupported(featureName, supported);
            if (supported) {
                this.initFeature(featureName);
            }
        }
        else {
            this.featureSupported(featureName, false);
        }
    },
    initFeature(featureName) {
        const feature = this.featureModules[featureName];
        let initResult;
        try {
            initResult = feature._rs_init(this);
        }
        catch (e) {
            this.featureFailed(featureName, e);
            return;
        }
        if (typeof (initResult) === 'object' && typeof (initResult.then) === 'function') {
            initResult.then(() => { this.featureInitialized(featureName); }, (err) => { this.featureFailed(featureName, err); });
        }
        else {
            this.featureInitialized(featureName);
        }
    },
    featureFailed(featureName, err) {
        (0, log_1.default)(`[RemoteStorage] [FEATURE ${featureName}] initialization failed (${err})`);
        this.featureDone();
    },
    featureSupported(featureName, success) {
        (0, log_1.default)(`[RemoteStorage] [FEATURE ${featureName}]${success ? '' : 'not '} supported`);
        if (!success) {
            this.featureDone();
        }
    },
    featureInitialized(featureName) {
        (0, log_1.default)(`[RemoteStorage] [FEATURE ${featureName}] initialized`);
        this.features.push({
            name: featureName,
            init: this.featureModules[featureName]._rs_init,
            supported: true,
            cleanup: this.featureModules[featureName]._rs_cleanup
        });
        this.featureDone();
    },
    featureDone() {
        this.featuresDone++;
        if (this.featuresDone === Object.keys(this.featureModules).length) {
            setTimeout(this.featuresLoaded.bind(this), 0);
        }
    },
    _setCachingModule() {
        const cachingModules = ['IndexedDB', 'LocalStorage', 'InMemoryStorage'];
        cachingModules.some(cachingLayer => {
            if (this.features.some(feature => feature.name === cachingLayer)) {
                this.features.local = this.featureModules[cachingLayer];
                return true;
            }
        });
    },
    _fireReady() {
        try {
            if (!this.readyFired) {
                this._emit('ready');
                this.readyFired = true;
            }
        }
        catch (e) {
            console.error("'ready' failed: ", e, e.stack);
            this._emit('error', e);
        }
    },
    featuresLoaded() {
        (0, log_1.default)(`[RemoteStorage] All features loaded`);
        this._setCachingModule();
        // eslint-disable-next-line new-cap
        this.local = config_1.default.cache && this.features.local && new this.features.local();
        // this.remote set by WireClient._rs_init as lazy property on
        // RS.prototype
        if (this.local && this.remote) {
            this._setGPD(syncedgetputdelete_1.default, this);
            this._bindChange(this.local);
        }
        else if (this.remote) {
            this._setGPD(this.remote, this.remote);
        }
        if (this.remote) {
            this.remote.on('connected', () => {
                this._fireReady();
                this._emit('connected');
            });
            this.remote.on('not-connected', () => {
                this._fireReady();
                this._emit('not-connected');
            });
            if (this.remote.connected) {
                this._fireReady();
                this._emit('connected');
            }
            if (!this.hasFeature('Authorize')) {
                this.remote.stopWaitingForToken();
            }
        }
        this._collectCleanupFunctions();
        try {
            this._allLoaded = true;
            this._emit('features-loaded');
        }
        catch (exc) {
            (0, util_1.logError)(exc);
            this._emit('error', exc);
        }
        this._processPending();
    },
    _collectCleanupFunctions() {
        this._cleanups = [];
        for (let i = 0; i < this.features.length; i++) {
            const cleanup = this.features[i].cleanup;
            if (typeof (cleanup) === 'function') {
                this._cleanups.push(cleanup);
            }
        }
    }
};
module.exports = Features;


/***/ }),

/***/ "./src/googledrive.ts":
/*!****************************!*\
  !*** ./src/googledrive.ts ***!
  \****************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const baseclient_1 = __importDefault(__webpack_require__(/*! ./baseclient */ "./src/baseclient.ts"));
const eventhandling_1 = __importDefault(__webpack_require__(/*! ./eventhandling */ "./src/eventhandling.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
const requests_1 = __webpack_require__(/*! ./requests */ "./src/requests.ts");
const remote_1 = __webpack_require__(/*! ./remote */ "./src/remote.ts");
const BASE_URL = 'https://www.googleapis.com';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/auth';
const AUTH_SCOPE = 'https://www.googleapis.com/auth/drive';
const SETTINGS_KEY = 'remotestorage:googledrive';
const PATH_PREFIX = '/remotestorage';
const GD_DIR_MIME_TYPE = 'application/vnd.google-apps.folder';
const RS_DIR_MIME_TYPE = 'application/json; charset=UTF-8';
let hasLocalStorage;
/**
 * Produce a title from a filename for metadata.
 *
 * @param {string} filename
 * @returns {string} title
 *
 * @private
 */
function metaTitleFromFileName(filename) {
    if (filename.substr(-1) === '/') {
        filename = filename.substr(0, filename.length - 1);
    }
    return decodeURIComponent(filename);
}
/**
 * Get the parent directory for the given path.
 *
 * @param {string} path
 * @returns {string} parent directory
 *
 * @private
 */
function parentPath(path) {
    return path.replace(/[^\/]+\/?$/, '');
}
/**
 * Get only the filename from a full path.
 *
 * @param {string} path
 * @returns {string} filename
 *
 * @private
 */
function baseName(path) {
    const parts = path.split('/');
    if (path.substr(-1) === '/') {
        return parts[parts.length - 2] + '/';
    }
    else {
        return parts[parts.length - 1];
    }
}
/**
 * Prepend the path with the remoteStorage base directory.
 *
 * @param {string} path - Path
 * @returns {string} Actual path on Google Drive
 *
 * @private
 */
function googleDrivePath(path) {
    return (0, util_1.cleanPath)(`${PATH_PREFIX}/${path}`);
}
/**
 * Internal cache object for storing Google file IDs.
 *
 * @param {number} maxAge - Maximum age (in seconds) the content should be cached for
 */
class FileIdCache {
    constructor(maxAge) {
        this._items = {};
        this.maxAge = maxAge;
        this._items = {};
    }
    get(key) {
        const item = this._items[key];
        const now = new Date().getTime();
        return (item && item.t >= (now - this.maxAge)) ? item.v : undefined;
    }
    set(key, value) {
        this._items[key] = {
            v: value,
            t: new Date().getTime()
        };
    }
}
/**
 * Overwrite BaseClient's getItemURL with our own implementation
 *
 * TODO: Still needs to be implemented. At the moment it just throws
 * and error saying that it's not implemented yet.
 *
 * @param {object} rs - RemoteStorage instance
 *
 * @private
 */
function hookGetItemURL(rs) {
    if (rs._origBaseClientGetItemURL) {
        return;
    }
    rs._origBaseClientGetItemURL = baseclient_1.default.prototype.getItemURL;
    baseclient_1.default.prototype.getItemURL = function ( /* path */) {
        throw new Error('getItemURL is not implemented for Google Drive yet');
    };
}
/**
 * Restore BaseClient's getItemURL original implementation
 *
 * @param {object} rs - RemoteStorage instance
 *
 * @private
 */
function unHookGetItemURL(rs) {
    if (!rs._origBaseClientGetItemURL) {
        return;
    }
    baseclient_1.default.prototype.getItemURL = rs._origBaseClientGetItemURL;
    delete rs._origBaseClientGetItemURL;
}
/**
 * @class GoogleDrive
 *
 * To use this backend, you need to specify the app's client ID like so:
 *
 * @example
 * remoteStorage.setApiKeys({
 *   googledrive: 'your-client-id'
 * });
 *
 * A client ID can be obtained by registering your app in the Google
 * Developers Console: https://console.developers.google.com/flows/enableapi?apiid=drive
 *
 * Docs: https://developers.google.com/drive/v3/web/quickstart/js
**/
class GoogleDrive extends remote_1.RemoteBase {
    constructor(remoteStorage, clientId) {
        super(remoteStorage);
        this.online = true;
        this.storageApi = 'draft-dejong-remotestorage-19';
        this.addEvents(['connected', 'not-connected']);
        this.clientId = clientId;
        this._fileIdCache = new FileIdCache(60 * 5); // IDs expire after 5 minutes (is this a good idea?)
        hasLocalStorage = (0, util_1.localStorageAvailable)();
        if (hasLocalStorage) {
            const settings = (0, util_1.getJSONFromLocalStorage)(SETTINGS_KEY);
            if (settings) {
                this.configure(settings);
            }
        }
    }
    /**
     * Configure the Google Drive backend.
     *
     * Fetches the user info from Google when no ``userAddress`` is given.
     *
     * @param {Object} settings
     * @param {string} [settings.userAddress] - The user's email address
     * @param {string} [settings.token] - Authorization token
     *
     * @protected
     */
    configure(settings) {
        // We only update this.userAddress if settings.userAddress is set to a string or to null
        if (typeof settings.userAddress !== 'undefined') {
            this.userAddress = settings.userAddress;
        }
        // Same for this.token. If only one of these two is set, we leave the other one at its existing value
        if (typeof settings.token !== 'undefined') {
            this.token = settings.token;
        }
        const writeSettingsToCache = function () {
            if (hasLocalStorage) {
                localStorage.setItem(SETTINGS_KEY, JSON.stringify({
                    userAddress: this.userAddress,
                    token: this.token
                }));
            }
        };
        const handleError = function () {
            this.connected = false;
            delete this.token;
            if (hasLocalStorage) {
                localStorage.removeItem(SETTINGS_KEY);
            }
        };
        if (this.token) {
            this.connected = true;
            if (this.userAddress) {
                this._emit('connected');
                writeSettingsToCache.apply(this);
            }
            else {
                this.info().then((info) => {
                    this.userAddress = info.user.emailAddress;
                    this._emit('connected');
                    writeSettingsToCache.apply(this);
                }).catch(() => {
                    handleError.apply(this);
                    this.rs._emit('error', new Error('Could not fetch user info.'));
                });
            }
        }
        else {
            handleError.apply(this);
        }
    }
    /**
     * Initiate the authorization flow's OAuth dance.
     */
    connect() {
        this.rs.setBackend('googledrive');
        this.rs.authorize({ authURL: AUTH_URL, scope: AUTH_SCOPE, clientId: this.clientId });
    }
    /**
     * Request a resource (file or directory).
     *
     * @param {string} path - Path of the resource
     * @param {Object} options - Request options
     * @returns {Promise} Resolves with an object containing the status code,
     *                    body, content-type and revision
     *
     * @protected
     */
    get(path, options = {}) {
        if ((0, util_1.isFolder)(path)) {
            return this._getFolder(googleDrivePath(path));
        }
        else {
            return this._getFile(googleDrivePath(path), options);
        }
    }
    /**
     * Create or update a file.
     *
     * @param {string} path - File path
     * @param body - File content
     * @param {string} contentType - File content-type
     * @param {Object} options
     * @param {string} options.ifNoneMatch - Only create of update the file if the
     *                                       current ETag doesn't match this string
     * @returns {Promise} Resolves with an object containing the status code,
     *                    content-type and revision
     *
     * @protected
     */
    put(path, body, contentType, options = {}) {
        const fullPath = googleDrivePath(path);
        function putDone(response) {
            if (response.status >= 200 && response.status < 300) {
                const meta = JSON.parse(response.responseText);
                const etagWithoutQuotes = this.stripQuotes(meta.etag);
                return Promise.resolve({ statusCode: 200, contentType: meta.mimeType, revision: etagWithoutQuotes });
            }
            else if (response.status === 412) {
                return Promise.resolve({ statusCode: 412, revision: 'conflict' });
            }
            else {
                return Promise.reject("PUT failed with status " + response.status + " (" + response.responseText + ")");
            }
        }
        return this._getFileId(fullPath).then((id) => {
            if (id) {
                if (options && (options.ifNoneMatch === '*')) {
                    return putDone({ status: 412 });
                }
                return this._updateFile(id, fullPath, body, contentType, options).then(putDone);
            }
            else {
                return this._createFile(fullPath, body, contentType).then(putDone);
            }
        });
    }
    /**
     * Delete a file.
     *
     * @param {string} path - File path
     * @param {Object} options
     * @param {string} options.ifMatch - only delete the file if it's ETag
     *                                   matches this string
     * @returns {Promise} Resolves with an object containing the status code
     *
     * @protected
     */
    delete(path, options = {}) {
        const fullPath = googleDrivePath(path);
        return this._getFileId(fullPath).then((id) => {
            if (!id) {
                // File doesn't exist. Ignore.
                return Promise.resolve({ statusCode: 200 });
            }
            return this._getMeta(id).then((meta) => {
                let etagWithoutQuotes;
                if ((typeof meta === 'object') && (typeof meta.etag === 'string')) {
                    etagWithoutQuotes = this.stripQuotes(meta.etag);
                }
                if (options && options.ifMatch && (options.ifMatch !== etagWithoutQuotes)) {
                    return { statusCode: 412, revision: etagWithoutQuotes };
                }
                return this._request('DELETE', BASE_URL + '/drive/v2/files/' + id, {}).then((response) => {
                    if (response.status === 200 || response.status === 204) {
                        return { statusCode: 200 };
                    }
                    else {
                        return Promise.reject("Delete failed: " + response.status + " (" + response.responseText + ")");
                    }
                });
            });
        });
    }
    /**
     * Fetch the user's info from Google.
     *
     * @returns {Promise} resolves with the user's info.
     *
     * @protected
     */
    info() {
        const url = BASE_URL + '/drive/v2/about?fields=user';
        // requesting user info(mainly for userAdress)
        return this._request('GET', url, {}).then(function (resp) {
            try {
                const info = JSON.parse(resp.responseText);
                return Promise.resolve(info);
            }
            catch (e) {
                return Promise.reject(e);
            }
        });
    }
    /**
     * Update an existing file.
     *
     * @param {string} id - File ID
     * @param {string} path - File path
     * @param body - File content
     * @param {string} contentType - File content-type
     * @param {Object} options
     * @param {string} options.ifMatch - Only update the file if its ETag
     *                                   matches this string
     * @returns {Promise} Resolves with the response of the network request
     *
     * @private
     */
    _updateFile(id, path, body, contentType, options) {
        const metadata = {
            mimeType: contentType
        };
        const headers = {
            'Content-Type': 'application/json; charset=UTF-8'
        };
        if (options && options.ifMatch) {
            headers['If-Match'] = this.addQuotes(options.ifMatch);
        }
        return this._request('PUT', BASE_URL + '/upload/drive/v2/files/' + id + '?uploadType=resumable', {
            body: JSON.stringify(metadata),
            headers: headers
        }).then((response) => {
            if (response.status === 412) {
                return (response);
            }
            else {
                return this._request('PUT', response.getResponseHeader('Location'), {
                    body: contentType.match(/^application\/json/) ? JSON.stringify(body) : body
                });
            }
        });
    }
    /**
     * Create a new file.
     *
     * @param {string} path - File path
     * @param body - File content
     * @param {string} contentType - File content-type
     * @returns {Promise} Resolves with the response of the network request
     *
     * @private
     */
    _createFile(path, body, contentType) {
        return this._getParentId(path).then((parentId) => {
            const fileName = baseName(path);
            const metadata = {
                title: metaTitleFromFileName(fileName),
                mimeType: contentType,
                parents: [{
                        kind: "drive#fileLink",
                        id: parentId
                    }]
            };
            return this._request('POST', BASE_URL + '/upload/drive/v2/files?uploadType=resumable', {
                body: JSON.stringify(metadata),
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8'
                }
            }).then((response) => {
                return this._request('POST', response.getResponseHeader('Location'), {
                    body: contentType.match(/^application\/json/) ? JSON.stringify(body) : body
                });
            });
        });
    }
    /**
     * Request a file.
     *
     * @param {string} path - File path
     * @param {Object} options
     * @param {string} [options.ifNoneMath] - Only return the file if its ETag
     *                                        doesn't match the given string
     * @returns {Promise} Resolves with an object containing the status code,
     *                    body, content-type and revision
     *
     * @private
     */
    _getFile(path, options) {
        return this._getFileId(path).then((id) => {
            return this._getMeta(id).then((meta) => {
                let etagWithoutQuotes;
                if (typeof (meta) === 'object' && typeof (meta.etag) === 'string') {
                    etagWithoutQuotes = this.stripQuotes(meta.etag);
                }
                if (options && options.ifNoneMatch && (etagWithoutQuotes === options.ifNoneMatch)) {
                    return Promise.resolve({ statusCode: 304 });
                }
                if (!meta.downloadUrl) {
                    if (meta.exportLinks && meta.exportLinks['text/html']) {
                        // Documents that were generated inside GoogleDocs have no
                        // downloadUrl, but you can export them to text/html instead:
                        meta.mimeType += ';export=text/html';
                        meta.downloadUrl = meta.exportLinks['text/html'];
                    }
                    else {
                        // empty file
                        return Promise.resolve({ statusCode: 200, body: '', contentType: meta.mimeType, revision: etagWithoutQuotes });
                    }
                }
                const params = {
                    responseType: 'arraybuffer'
                };
                return this._request('GET', meta.downloadUrl, params).then((response) => {
                    //first encode the response as text, and later check if
                    //text appears to actually be binary data
                    return (0, util_1.getTextFromArrayBuffer)(response.response, 'UTF-8').then(function (responseText) {
                        let body = responseText;
                        if (meta.mimeType.match(/^application\/json/)) {
                            try {
                                body = JSON.parse(body);
                            }
                            catch (e) {
                                // body couldn't be parsed as JSON, so we'll just return it as is
                            }
                        }
                        else if ((0, util_1.shouldBeTreatedAsBinary)(responseText, meta.mimeType)) {
                            //return unprocessed response
                            body = response.response;
                        }
                        return {
                            statusCode: 200,
                            body: body,
                            contentType: meta.mimeType,
                            revision: etagWithoutQuotes
                        };
                    });
                });
            });
        });
    }
    /**
     * Request a directory.
     *
     * @param {string} path - Directory path
     * @returns {Promise} Resolves with an object containing the status code,
     *                    body and content-type
     *
     * @private
     */
    _getFolder(path) {
        return this._getFileId(path).then((id) => {
            let data, etagWithoutQuotes, itemsMap;
            if (!id) {
                return Promise.resolve({ statusCode: 404 });
            }
            const query = '\'' + id + '\' in parents';
            const fields = 'items(downloadUrl,etag,fileSize,id,mimeType,title,labels)';
            return this._request('GET', BASE_URL + '/drive/v2/files?'
                + 'q=' + encodeURIComponent(query)
                + '&fields=' + encodeURIComponent(fields)
                + '&maxResults=1000'
                + '&trashed=false', {})
                .then((response) => {
                var _a;
                if (response.status !== 200) {
                    return Promise.reject('request failed or something: ' + response.status);
                }
                try {
                    data = JSON.parse(response.responseText);
                }
                catch (e) {
                    return Promise.reject('non-JSON response from GoogleDrive');
                }
                itemsMap = {};
                for (const item of data.items) {
                    if ((_a = item.labels) === null || _a === void 0 ? void 0 : _a.trashed) {
                        continue;
                    } // ignore deleted files
                    etagWithoutQuotes = this.stripQuotes(item.etag);
                    if (item.mimeType === GD_DIR_MIME_TYPE) {
                        this._fileIdCache.set(path + (0, util_1.cleanPath)(item.title) + '/', item.id);
                        itemsMap[item.title + '/'] = {
                            ETag: etagWithoutQuotes
                        };
                    }
                    else {
                        this._fileIdCache.set(path + (0, util_1.cleanPath)(item.title), item.id);
                        itemsMap[item.title] = {
                            ETag: etagWithoutQuotes,
                            'Content-Type': item.mimeType,
                            'Content-Length': item.fileSize
                        };
                    }
                }
                // FIXME: add revision of folder!
                return Promise.resolve({ statusCode: 200, body: itemsMap, contentType: RS_DIR_MIME_TYPE, revision: undefined });
            });
        });
    }
    /**
     * Get the ID of a parent path.
     *
     * Creates the directory if it doesn't exist yet.
     *
     * @param {string} path - Full path of a directory or file
     * @returns {Promise} Resolves with ID of the parent directory.
     *
     * @private
     */
    _getParentId(path) {
        const foldername = parentPath(path);
        return this._getFileId(foldername).then((parentId) => {
            if (parentId) {
                return Promise.resolve(parentId);
            }
            else {
                return this._createFolder(foldername);
            }
        });
    }
    /**
     * Create a directory.
     *
     * Creates all parent directories as well if any of them didn't exist yet.
     *
     * @param {string} path - Directory path
     * @returns {Promise} Resolves with the ID of the new directory
     *
     * @private
     */
    _createFolder(path) {
        return this._getParentId(path).then((parentId) => {
            return this._request('POST', BASE_URL + '/drive/v2/files', {
                body: JSON.stringify({
                    title: metaTitleFromFileName(baseName(path)),
                    mimeType: GD_DIR_MIME_TYPE,
                    parents: [{
                            id: parentId
                        }]
                }),
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8'
                }
            }).then((response) => {
                const meta = JSON.parse(response.responseText);
                return Promise.resolve(meta.id);
            });
        });
    }
    /**
     * Get the ID of a file.
     *
     * @param {string} path - File path
     * @returns {Promise} Resolves with the ID
     *
     * @private
     */
    _getFileId(path) {
        let id;
        if (path === '/') {
            // "root" is a special alias for the fileId of the root folder
            return Promise.resolve('root');
        }
        else if ((id = this._fileIdCache.get(path))) {
            // id is cached.
            return Promise.resolve(id);
        }
        // id is not cached (or file doesn't exist).
        // load parent folder listing to propagate / update id cache.
        return this._getFolder(parentPath(path)).then(() => {
            id = this._fileIdCache.get(path);
            if (!id) {
                if (path.substr(-1) === '/') {
                    return this._createFolder(path).then(() => {
                        return this._getFileId(path);
                    });
                }
                else {
                    return Promise.resolve();
                }
            }
            return Promise.resolve(id);
        });
    }
    /**
     * Get the metadata for a given file ID.
     *
     * @param {string} id - File ID
     * @returns {Promise} Resolves with an object containing the metadata
     *
     * @private
     */
    _getMeta(id) {
        return this._request('GET', BASE_URL + '/drive/v2/files/' + id, {}).then(function (response) {
            if (response.status === 200) {
                return Promise.resolve(JSON.parse(response.responseText));
            }
            else {
                return Promise.reject("request (getting metadata for " + id + ") failed with status: " + response.status);
            }
        });
    }
    /**
     * Make a network request.
     *
     * @param {string} method - Request method
     * @param {string} url - Target URL
     * @param {Object} options - Request options
     * @returns {Promise} Resolves with the response of the network request
     *
     * @private
     */
    _request(method, url, options) {
        if (this.isForbiddenRequestMethod(method, url)) {
            return Promise.reject(`Don't use ${method} on directories!`);
        }
        if (!options.headers) {
            options.headers = {};
        }
        options.headers['Authorization'] = 'Bearer ' + this.token;
        this.rs._emit('wire-busy', {
            method: method,
            isFolder: (0, util_1.isFolder)(url)
        });
        return (0, requests_1.requestWithTimeout)(method, url, options).then((xhr) => {
            // Google tokens expire from time to time...
            if (xhr && xhr.status === 401) {
                this.connect();
                return;
            }
            else {
                if (!this.online) {
                    this.online = true;
                    this.rs._emit('network-online');
                }
                this.rs._emit('wire-done', {
                    method: method,
                    isFolder: (0, util_1.isFolder)(url),
                    success: true
                });
                return Promise.resolve(xhr);
            }
        }, (error) => {
            if (this.online) {
                this.online = false;
                this.rs._emit('network-offline');
            }
            this.rs._emit('wire-done', {
                method: method,
                isFolder: (0, util_1.isFolder)(url),
                success: false
            });
            return Promise.reject(error);
        });
    }
    /**
     * Initialize the Google Drive backend.
     *
     * @param {Object} remoteStorage - RemoteStorage instance
     *
     * @protected
     */
    static _rs_init(remoteStorage) {
        const config = remoteStorage.apiKeys.googledrive;
        if (config) {
            remoteStorage.googledrive = new GoogleDrive(remoteStorage, config.clientId);
            if (remoteStorage.backend === 'googledrive') {
                remoteStorage._origRemote = remoteStorage.remote;
                remoteStorage.remote = remoteStorage.googledrive;
                hookGetItemURL(remoteStorage);
            }
        }
    }
    /**
     * Inform about the availability of the Google Drive backend.
     *
     * @returns {Boolean}
     *
     * @protected
     */
    static _rs_supported() {
        return true;
    }
    /**
     * Remove Google Drive as a backend.
     *
     * @param {Object} remoteStorage - RemoteStorage instance
     *
     * @protected
     */
    static _rs_cleanup(remoteStorage) {
        remoteStorage.setBackend(undefined);
        if (remoteStorage._origRemote) {
            remoteStorage.remote = remoteStorage._origRemote;
            delete remoteStorage._origRemote;
        }
        unHookGetItemURL(remoteStorage);
    }
}
(0, util_1.applyMixins)(GoogleDrive, [eventhandling_1.default]);
module.exports = GoogleDrive;


/***/ }),

/***/ "./src/indexeddb.ts":
/*!**************************!*\
  !*** ./src/indexeddb.ts ***!
  \**************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(global) {
/**
 * TODO rewrite, doesn't expose GPD anymore, it's in cachinglayer now
 *
 * This file exposes a get/put/delete interface, accessing data in an IndexedDB.
 *
 * There are multiple parts to this interface:
 *
 *   The RemoteStorage integration:
 *     - IndexedDB._rs_supported() determines if IndexedDB support
 *       is available. If it isn't, RemoteStorage won't initialize the feature.
 *     - IndexedDB._rs_init() initializes the feature. It returns
 *       a promise that is fulfilled as soon as the database has been opened and
 *       migrated.
 *
 *   The storage interface (IndexedDB object):
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
 *       whenever a change comes in from Sync.
 *
 *   The sync interface (also on IndexedDB object):
 *     - #getNodes([paths]) returns the requested nodes in a promise.
 *     - #setNodes(map) stores all the nodes given in the (path -> node) map.
 *
 * @interface
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const eventhandling_1 = __importDefault(__webpack_require__(/*! ./eventhandling */ "./src/eventhandling.ts"));
const cachinglayer_1 = __importDefault(__webpack_require__(/*! ./cachinglayer */ "./src/cachinglayer.ts"));
const log_1 = __importDefault(__webpack_require__(/*! ./log */ "./src/log.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
const DB_VERSION = 2;
const DEFAULT_DB_NAME = 'remotestorage';
// TODO very weird that this is re-assigned
let DEFAULT_DB;
class IndexedDB extends cachinglayer_1.default {
    constructor(database) {
        super();
        this.addEvents(['change', 'local-events-done']);
        this.db = database || DEFAULT_DB;
        if (!this.db) {
            // TODO shouldn't this throw an error?
            (0, log_1.default)("[IndexedDB] Failed to open DB");
            return undefined;
        }
        this.getsRunning = 0;
        this.putsRunning = 0;
        /**
         * Given a node for which uncommitted changes exist, this cache
         * stores either the entire uncommitted node, or false for a deletion.
         * The node's path is used as the key.
         *
         * changesQueued stores changes for which no IndexedDB transaction has
         * been started yet.
         */
        this.changesQueued = {};
        /**
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
        // TODO document
        this.commitSlownessWarning = null;
    }
    /**
     * TODO: Document
     */
    getNodes(paths) {
        return __awaiter(this, void 0, void 0, function* () {
            const misses = [], fromCache = {};
            for (let i = 0, len = paths.length; i < len; i++) {
                if (this.changesQueued[paths[i]] !== undefined) {
                    fromCache[paths[i]] = (0, util_1.deepClone)(this.changesQueued[paths[i]] || undefined);
                }
                else if (this.changesRunning[paths[i]] !== undefined) {
                    fromCache[paths[i]] = (0, util_1.deepClone)(this.changesRunning[paths[i]] || undefined);
                }
                else {
                    misses.push(paths[i]);
                }
            }
            if (misses.length > 0) {
                return this.getNodesFromDb(misses).then(function (nodes) {
                    for (const i in fromCache) {
                        nodes[i] = fromCache[i];
                    }
                    return nodes;
                });
            }
            else {
                return Promise.resolve(fromCache);
            }
        });
    }
    /**
     * TODO: Document
     */
    setNodes(nodes) {
        return __awaiter(this, void 0, void 0, function* () {
            for (const i in nodes) {
                this.changesQueued[i] = nodes[i] || false;
            }
            this.maybeFlush();
            return Promise.resolve();
        });
    }
    /**
     * TODO: Document
     */
    maybeFlush() {
        if (this.putsRunning === 0) {
            this.flushChangesQueued();
        }
        else {
            if (!this.commitSlownessWarning) {
                this.commitSlownessWarning = global.setInterval(function () {
                    console.warn('WARNING: waited more than 10 seconds for previous commit to finish');
                }, 10000);
            }
        }
    }
    /**
     * TODO: Document
     */
    flushChangesQueued() {
        if (this.commitSlownessWarning) {
            clearInterval(this.commitSlownessWarning);
            this.commitSlownessWarning = null;
        }
        if (Object.keys(this.changesQueued).length > 0) {
            this.changesRunning = this.changesQueued;
            this.changesQueued = {};
            this.setNodesInDb(this.changesRunning).then(this.flushChangesQueued.bind(this));
        }
    }
    /**
     * TODO: Document
     */
    getNodesFromDb(paths) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['nodes'], 'readonly');
            const nodes = transaction.objectStore('nodes');
            const retrievedNodes = {};
            this.getsRunning++;
            paths.map((path) => {
                nodes.get(path).onsuccess = (evt) => {
                    retrievedNodes[path] = evt.target.result;
                };
            });
            transaction.oncomplete = () => {
                resolve(retrievedNodes);
                this.getsRunning--;
            };
            transaction.onerror = transaction.onabort = () => {
                reject('get transaction error/abort');
                this.getsRunning--;
            };
        });
    }
    /**
     * TODO: Document
     */
    setNodesInDb(nodes) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['nodes'], 'readwrite');
                const nodesStore = transaction.objectStore('nodes');
                const startTime = new Date().getTime();
                this.putsRunning++;
                (0, log_1.default)('[IndexedDB] Starting put', nodes, this.putsRunning);
                for (const path in nodes) {
                    const node = nodes[path];
                    if (typeof (node) === 'object') {
                        try {
                            nodesStore.put(node);
                        }
                        catch (e) {
                            (0, log_1.default)('[IndexedDB] Error while putting', node, e);
                            throw e;
                        }
                    }
                    else {
                        try {
                            nodesStore.delete(path);
                        }
                        catch (e) {
                            (0, log_1.default)('[IndexedDB] Error while removing', nodesStore, node, e);
                            throw e;
                        }
                    }
                }
                transaction.oncomplete = () => {
                    this.putsRunning--;
                    (0, log_1.default)('[IndexedDB] Finished put', nodes, this.putsRunning, (new Date().getTime() - startTime) + 'ms');
                    resolve();
                };
                transaction.onerror = () => {
                    this.putsRunning--;
                    reject('transaction error');
                };
                transaction.onabort = () => {
                    reject('transaction abort');
                    this.putsRunning--;
                };
            });
        });
    }
    /**
     * TODO: Document
     */
    // TODO add real types once known
    reset(callback) {
        const dbName = this.db.name;
        this.db.close();
        IndexedDB.clean(this.db.name, () => {
            IndexedDB.open(dbName, (err, other) => {
                if (err) {
                    (0, log_1.default)('[IndexedDB] Error while resetting local storage', err);
                }
                else {
                    // hacky!
                    this.db = other;
                }
                if (typeof callback === 'function') {
                    callback(self);
                }
            });
        });
    }
    /**
     * TODO: Document
     */
    forAllNodes(cb) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve /*, reject*/) => {
                const transaction = this.db.transaction(['nodes'], 'readonly');
                const cursorReq = transaction.objectStore('nodes').openCursor();
                cursorReq.onsuccess = (evt) => {
                    const cursor = evt.target.result;
                    if (cursor) {
                        cb(this.migrate(cursor.value));
                        cursor.continue();
                    }
                    else {
                        resolve();
                    }
                };
            });
        });
    }
    closeDB() {
        if (this.putsRunning === 0) { // check if we are currently writing to the DB
            this.db.close();
        }
        else {
            setTimeout(this.closeDB.bind(this), 100); // try again a little later
        }
    }
    /**
     * TODO: Document
     */
    // TODO add real types once known
    static open(name, callback) {
        const timer = setTimeout(function () {
            callback("timeout trying to open db");
        }, 10000);
        try {
            const req = indexedDB.open(name, DB_VERSION);
            req.onerror = function () {
                (0, log_1.default)('[IndexedDB] Opening DB failed', req);
                clearTimeout(timer);
                callback(req.error);
            };
            req.onupgradeneeded = function (event) {
                const db = req.result;
                (0, log_1.default)("[IndexedDB] Upgrade: from ", event.oldVersion, " to ", event.newVersion);
                if (event.oldVersion !== 1) {
                    (0, log_1.default)("[IndexedDB] Creating object store: nodes");
                    db.createObjectStore('nodes', { keyPath: 'path' });
                }
                (0, log_1.default)("[IndexedDB] Creating object store: changes");
                db.createObjectStore('changes', { keyPath: 'path' });
            };
            req.onsuccess = function () {
                clearTimeout(timer);
                // check if all object stores exist
                const db = req.result;
                if (!db.objectStoreNames.contains('nodes') || !db.objectStoreNames.contains('changes')) {
                    (0, log_1.default)("[IndexedDB] Missing object store. Resetting the database.");
                    IndexedDB.clean(name, function () {
                        IndexedDB.open(name, callback);
                    });
                    return;
                }
                callback(null, req.result);
            };
        }
        catch (error) {
            (0, log_1.default)("[IndexedDB] Failed to open database: " + error);
            (0, log_1.default)("[IndexedDB] Resetting database and trying again.");
            clearTimeout(timer);
            IndexedDB.clean(name, function () {
                IndexedDB.open(name, callback);
            });
        }
    }
    /**
     * TODO: Document
     */
    static clean(databaseName, callback) {
        const req = indexedDB.deleteDatabase(databaseName);
        req.onsuccess = function () {
            (0, log_1.default)('[IndexedDB] Done removing DB');
            callback();
        };
        // TODO check if this does anything as onabort does not exist on type according to ts
        req.onerror = req.onabort = function (evt) {
            console.error('Failed to remove database "' + databaseName + '"', evt);
        };
    }
    /**
     * Initialize the IndexedDB backend.
     *
     * @param {Object} remoteStorage - RemoteStorage instance
     *
     * @protected
     */
    // TODO add real type once known
    static _rs_init(remoteStorage) {
        return new Promise((resolve, reject) => {
            IndexedDB.open(DEFAULT_DB_NAME, function (err, db) {
                if (err) {
                    reject(err);
                }
                else {
                    DEFAULT_DB = db;
                    // TODO remove once real type once known
                    db.onerror = () => {
                        remoteStorage._emit('error', err);
                    };
                    resolve();
                }
            });
        });
    }
    /**
     * Inform about the availability of the IndexedDB backend.
     *
     * @param {Object} rs - RemoteStorage instance
     * @returns {Boolean}
     *
     * @protected
     */
    static _rs_supported() {
        return new Promise((resolve, reject) => {
            const context = (0, util_1.getGlobalContext)();
            // FIXME: this is causing an error in chrome
            // context.indexedDB = context.indexedDB    || context.webkitIndexedDB ||
            //                    context.mozIndexedDB || context.oIndexedDB      ||
            //                    context.msIndexedDB;
            // Detect browsers with known IndexedDb issues (e.g. Android pre-4.4)
            let poorIndexedDbSupport = false;
            if (typeof navigator !== 'undefined' &&
                navigator.userAgent.match(/Android (2|3|4\.[0-3])/)) {
                // Chrome and Firefox support IndexedDB
                if (!navigator.userAgent.match(/Chrome|Firefox/)) {
                    poorIndexedDbSupport = true;
                }
            }
            if ('indexedDB' in context && !poorIndexedDbSupport) {
                try {
                    const check = indexedDB.open("rs-check");
                    check.onerror = function ( /* event */) {
                        reject();
                    };
                    check.onsuccess = function ( /* event */) {
                        check.result.close();
                        indexedDB.deleteDatabase("rs-check");
                        resolve();
                    };
                }
                catch (e) {
                    reject();
                }
            }
            else {
                reject();
            }
        });
    }
    /**
     * Remove IndexedDB as a backend.
     *
     * @param {Object} remoteStorage - RemoteStorage instance
     *
     * @protected
     */
    static _rs_cleanup(remoteStorage) {
        return new Promise((resolve /*, reject*/) => {
            if (remoteStorage.local) {
                remoteStorage.local.closeDB();
            }
            IndexedDB.clean(DEFAULT_DB_NAME, resolve);
        });
    }
    diffHandler() {
        // empty
    }
}
(0, util_1.applyMixins)(IndexedDB, [eventhandling_1.default]);
module.exports = IndexedDB;

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./../node_modules/webpack/buildin/global.js */ "./node_modules/webpack/buildin/global.js")))

/***/ }),

/***/ "./src/inmemorystorage.ts":
/*!********************************!*\
  !*** ./src/inmemorystorage.ts ***!
  \********************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const eventhandling_1 = __importDefault(__webpack_require__(/*! ./eventhandling */ "./src/eventhandling.ts"));
const cachinglayer_1 = __importDefault(__webpack_require__(/*! ./cachinglayer */ "./src/cachinglayer.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
/**
 * In-memory caching adapter. Used when no IndexedDB or localStorage
 * available.
 *
 * @class
 **/
class InMemoryStorage extends cachinglayer_1.default {
    constructor() {
        super();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this._storage = {};
        this.addEvents(['change', 'local-events-done']);
    }
    getNodes(paths) {
        const nodes = {};
        for (let i = 0, len = paths.length; i < len; i++) {
            // Should use a clone of whatever we are retrieving to prevent
            // mutation, also to follow the same behavior as localStorage
            // and indexeddb.
            nodes[paths[i]] = (0, util_1.deepClone)(this._storage[paths[i]]);
        }
        return Promise.resolve(nodes);
    }
    setNodes(nodes) {
        for (const path in nodes) {
            if (nodes[path] === undefined) {
                delete this._storage[path];
            }
            else {
                this._storage[path] = nodes[path];
            }
        }
        return Promise.resolve();
    }
    forAllNodes(cb) {
        for (const path in this._storage) {
            cb(this.migrate(this._storage[path]));
        }
        return Promise.resolve();
    }
    diffHandler() {
        // empty
    }
    /**
     * Initialize the InMemoryStorage backend.
     *
     * @param {Object} remoteStorage - RemoteStorage instance
     *
     * @protected
     */
    static _rs_init() {
        // empty
    }
    /**
     * Inform about the availability of the InMemoryStorage backend.
     *
     * @returns {Boolean}
     *
     * @protected
     */
    static _rs_supported() {
        // In-memory storage is always supported
        return true;
    }
    /**
     * Remove InMemoryStorage as a backend.
     *
     * @protected
     */
    static _rs_cleanup() {
        // empty
    }
}
(0, util_1.applyMixins)(InMemoryStorage, [eventhandling_1.default]);
module.exports = InMemoryStorage;


/***/ }),

/***/ "./src/localstorage.ts":
/*!*****************************!*\
  !*** ./src/localstorage.ts ***!
  \*****************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const cachinglayer_1 = __importDefault(__webpack_require__(/*! ./cachinglayer */ "./src/cachinglayer.ts"));
const eventhandling_1 = __importDefault(__webpack_require__(/*! ./eventhandling */ "./src/eventhandling.ts"));
const log_1 = __importDefault(__webpack_require__(/*! ./log */ "./src/log.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
/**
 * localStorage caching adapter. Used when no IndexedDB available.
 **/
const NODES_PREFIX = "remotestorage:cache:nodes:";
const CHANGES_PREFIX = "remotestorage:cache:changes:";
function isRemoteStorageKey(key) {
    return key.substr(0, NODES_PREFIX.length) === NODES_PREFIX ||
        key.substr(0, CHANGES_PREFIX.length) === CHANGES_PREFIX;
}
function isNodeKey(key) {
    return key.substr(0, NODES_PREFIX.length) === NODES_PREFIX;
}
class LocalStorage extends cachinglayer_1.default {
    constructor() {
        super();
        this.addEvents(['change', 'local-events-done']);
    }
    // TODO fix this
    diffHandler(...args) {
        return;
    }
    getNodes(paths) {
        const nodes = {};
        for (let i = 0, len = paths.length; i < len; i++) {
            try {
                nodes[paths[i]] = JSON.parse(localStorage[NODES_PREFIX + paths[i]]);
            }
            catch (e) {
                nodes[paths[i]] = undefined;
            }
        }
        return Promise.resolve(nodes);
    }
    setNodes(nodes) {
        for (const path in nodes) {
            // TODO shouldn't we use getItem/setItem?
            localStorage[NODES_PREFIX + path] = JSON.stringify(nodes[path]);
        }
        return Promise.resolve();
    }
    forAllNodes(cb) {
        let node;
        for (let i = 0, len = localStorage.length; i < len; i++) {
            if (isNodeKey(localStorage.key(i))) {
                try {
                    // NOTE: this is coming from caching layer todo fix via interface or similar
                    node = this.migrate(JSON.parse(localStorage[localStorage.key(i)]));
                }
                catch (e) {
                    node = undefined;
                }
                if (node) {
                    cb(node);
                }
            }
        }
        return Promise.resolve();
    }
    /**
     * Initialize the LocalStorage backend.
     *
     * @protected
     */
    static _rs_init() {
        return;
    }
    /**
     * Inform about the availability of the LocalStorage backend.
     *
     * @protected
     */
    static _rs_supported() {
        return (0, util_1.localStorageAvailable)();
    }
    /**
     * Remove LocalStorage as a backend.
     *
     * @protected
     *
     * TODO: tests missing!
     */
    static _rs_cleanup() {
        const keys = [];
        for (let i = 0, len = localStorage.length; i < len; i++) {
            const key = localStorage.key(i);
            if (isRemoteStorageKey(key)) {
                keys.push(key);
            }
        }
        keys.forEach((key) => {
            (0, log_1.default)('[LocalStorage] Removing', key);
            delete localStorage[key];
        });
    }
}
(0, util_1.applyMixins)(LocalStorage, [eventhandling_1.default]);
module.exports = LocalStorage;


/***/ }),

/***/ "./src/log.ts":
/*!********************!*\
  !*** ./src/log.ts ***!
  \********************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const config_1 = __importDefault(__webpack_require__(/*! ./config */ "./src/config.ts"));
/**
 * Log using console.log, when remoteStorage logging is enabled.
 *
 * You can enable logging with ``RemoteStorage#enableLog``.
 *
 * (You can also enable logging during remoteStorage object creation. See:
 * {@link RemoteStorage}).
 */
function log(...args) {
    if (config_1.default.logging) {
        // eslint-disable-next-line no-console
        console.log(...args);
    }
}
module.exports = log;


/***/ }),

/***/ "./src/remote.ts":
/*!***********************!*\
  !*** ./src/remote.ts ***!
  \***********************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoteBase = void 0;
const eventhandling_1 = __importDefault(__webpack_require__(/*! ./eventhandling */ "./src/eventhandling.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
/**
 * The ancestor for WireClient, GoogleDrive & Dropbox
 */
class RemoteBase extends eventhandling_1.default {
    constructor(rs) {
        super();
        this.rs = rs;
        this.connected = false;
        // TODO: Should `online` be set true or false for all, here or in configure?
    }
    stopWaitingForToken() {
        if (!this.connected) {
            this._emit('not-connected');
        }
    }
    addQuotes(str) {
        if (typeof (str) !== 'string') {
            return str;
        }
        if (str === '*') {
            return '*';
        }
        return '"' + str + '"';
    }
    stripQuotes(str) {
        if (typeof (str) !== 'string') {
            return str;
        }
        return str.replace(/^["']|["']$/g, '');
    }
    isForbiddenRequestMethod(method, uri) {
        if (method === 'PUT' || method === 'DELETE') {
            return (0, util_1.isFolder)(uri);
        }
        else {
            return false;
        }
    }
}
exports.RemoteBase = RemoteBase;


/***/ }),

/***/ "./src/remotestorage.ts":
/*!******************************!*\
  !*** ./src/remotestorage.ts ***!
  \******************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const config_1 = __importDefault(__webpack_require__(/*! ./config */ "./src/config.ts"));
const log_1 = __importDefault(__webpack_require__(/*! ./log */ "./src/log.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
const access_1 = __importDefault(__webpack_require__(/*! ./access */ "./src/access.ts"));
const authorize_1 = __importDefault(__webpack_require__(/*! ./authorize */ "./src/authorize.ts"));
const baseclient_1 = __importDefault(__webpack_require__(/*! ./baseclient */ "./src/baseclient.ts"));
const caching_1 = __importDefault(__webpack_require__(/*! ./caching */ "./src/caching.ts"));
const eventhandling_1 = __importDefault(__webpack_require__(/*! ./eventhandling */ "./src/eventhandling.ts"));
const googledrive_1 = __importDefault(__webpack_require__(/*! ./googledrive */ "./src/googledrive.ts"));
const dropbox_1 = __importDefault(__webpack_require__(/*! ./dropbox */ "./src/dropbox.ts"));
const solid_1 = __importDefault(__webpack_require__(/*! ./solid */ "./src/solid.ts"));
const discover_1 = __importDefault(__webpack_require__(/*! ./discover */ "./src/discover.ts"));
const sync_error_1 = __importDefault(__webpack_require__(/*! ./sync-error */ "./src/sync-error.ts"));
const unauthorized_error_1 = __importDefault(__webpack_require__(/*! ./unauthorized-error */ "./src/unauthorized-error.ts"));
const features_1 = __importDefault(__webpack_require__(/*! ./features */ "./src/features.ts"));
// TODO this is assigned to RemoteStorage.util later; check if still needed
const util = __importStar(__webpack_require__(/*! ./util */ "./src/util.ts"));
const globalContext = (0, util_1.getGlobalContext)();
// declare global {
//   interface Window { cordova: any };
// }
let hasLocalStorage;
// TODO document and/or refactor (seems weird)
function emitUnauthorized(r) {
    if (r.statusCode === 403 || r.statusCode === 401) {
        this._emit('error', new unauthorized_error_1.default());
    }
    return Promise.resolve(r);
}
/**
* Check if interval is valid: numeric and between 2s and 1hr inclusive
*/
function isValidInterval(interval) {
    return (typeof interval === 'number' &&
        interval >= 2000 &&
        interval <= 3600000);
}
/**
 * Constructor for the remoteStorage object/instance
 *
 * This class primarily contains feature detection code and convenience API.
 *
 * Depending on which features are built in, it contains different attributes
 * and functions. See the individual features for more information.
 *
 * @param {object} config - an optional configuration object
 * @class
 */
class RemoteStorage {
    constructor(cfg) {
        /**
         * Pending get/put/delete calls
         * @private
         */
        this._pending = [];
        /**
         * TODO: document
         */
        this._cleanups = [];
        /**
         * TODO: document
         */
        this._pathHandlers = { change: {} };
        /**
         * Holds OAuth app keys for Dropbox, Google Drive
         */
        this.apiKeys = {};
        //
        // FEATURES INITIALIZATION
        //
        this._init = features_1.default.loadFeatures;
        this.features = features_1.default.features;
        this.loadFeature = features_1.default.loadFeature;
        this.featureSupported = features_1.default.featureSupported;
        this.featureDone = features_1.default.featureDone;
        this.featuresDone = features_1.default.featuresDone;
        this.featuresLoaded = features_1.default.featuresLoaded;
        this.featureInitialized = features_1.default.featureInitialized;
        this.featureFailed = features_1.default.featureFailed;
        this.hasFeature = features_1.default.hasFeature;
        this._setCachingModule = features_1.default._setCachingModule;
        this._collectCleanupFunctions = features_1.default._collectCleanupFunctions;
        this._fireReady = features_1.default._fireReady;
        this.initFeature = features_1.default.initFeature;
        // Initial configuration property settings.
        // TODO use modern JS to merge object properties
        if (typeof cfg === 'object') {
            (0, util_1.extend)(config_1.default, cfg);
        }
        this.addEvents([
            'ready', 'authing', 'connecting', 'connected', 'disconnected',
            'not-connected', 'conflict', 'error', 'features-loaded',
            'sync-interval-change', 'sync-req-done', 'sync-done',
            'wire-busy', 'wire-done', 'network-offline', 'network-online'
        ]);
        this._setGPD({
            get: this._pendingGPD('get'),
            put: this._pendingGPD('put'),
            delete: this._pendingGPD('delete')
        });
        hasLocalStorage = (0, util_1.localStorageAvailable)();
        if (hasLocalStorage) {
            this.apiKeys = (0, util_1.getJSONFromLocalStorage)('remotestorage:api-keys') || {};
            this.setBackend(localStorage.getItem('remotestorage:backend') || 'remotestorage');
        }
        // Keep a reference to the orginal `on` function
        const origOn = this.on;
        /**
         * Register an event handler. See :ref:`rs-events` for available event names.
         *
         * @param {string} eventName - Name of the event
         * @param {function} handler - Event handler
         */
        this.on = function (eventName, handler) {
            if (this._allLoaded) {
                // check if the handler should be called immediately, because the
                // event has happened already
                switch (eventName) {
                    case 'features-loaded':
                        setTimeout(handler, 0);
                        break;
                    case 'ready':
                        if (this.remote) {
                            setTimeout(handler, 0);
                        }
                        break;
                    case 'connected':
                        if (this.remote && this.remote.connected) {
                            setTimeout(handler, 0);
                        }
                        break;
                    case 'not-connected':
                        if (this.remote && !this.remote.connected) {
                            setTimeout(handler, 0);
                        }
                        break;
                }
            }
            return origOn.call(this, eventName, handler);
        };
        // load all features and emit `ready`
        this._init();
        /**
         * TODO: document
         */
        this.fireInitial = function () {
            if (this.local) {
                setTimeout(this.local.fireInitial.bind(this.local), 0);
            }
        }.bind(this);
        this.on('ready', this.fireInitial.bind(this));
        this.loadModules();
    }
    /**
     * Indicating if remoteStorage is currently connected.
     */
    get connected() {
        return this.remote.connected;
    }
    /**
     * Load all modules passed as arguments
     * @private
     */
    loadModules() {
        config_1.default.modules.forEach(this.addModule.bind(this));
    }
    /**
     * Initiate the OAuth authorization flow.
     *
     * This function is called by custom storage backend implementations
     * (e.g. Dropbox, Google Drive or Solid).
     *
     * @param {object} options
     * @param {string} options.authURL - URL of the authorization endpoint
     * @param {string} [options.scope] - access scope
     * @param {string} [options.clientId] - client identifier (defaults to the
     *                                      origin of the redirectUri)
     * @private
     */
    authorize(options) {
        this.access.setStorageType(this.remote.storageApi);
        if (typeof options.scope === 'undefined') {
            options.scope = this.access.scopeParameter;
        }
        if (globalContext.cordova) {
            options.redirectUri = config_1.default.cordovaRedirectUri;
        }
        else {
            const location = authorize_1.default.getLocation();
            let redirectUri = location.origin;
            if (location.pathname !== '/') {
                redirectUri += location.pathname;
            }
            options.redirectUri = redirectUri;
        }
        if (typeof options.clientId === 'undefined') {
            options.clientId = options.redirectUri.match(/^(https?:\/\/[^/]+)/)[0];
        }
        authorize_1.default.authorize(this, options);
    }
    /**
     * TODO: document
     * @private
     */
    impliedauth(storageApi, redirectUri) {
        // TODO shouldn't these be default argument values?
        storageApi = storageApi || this.remote.storageApi;
        redirectUri = redirectUri || String(document.location);
        (0, log_1.default)('ImpliedAuth proceeding due to absent authURL; storageApi = ' + storageApi + ' redirectUri = ' + redirectUri);
        // Set a fixed access token, signalling to not send it as Bearer
        this.remote.configure({
            token: authorize_1.default.IMPLIED_FAKE_TOKEN
        });
        document.location.href = redirectUri;
    }
    /**
     * @property {object} remote
     *
     * Depending on the chosen backend, this is either an instance of ``WireClient``,
     * ``Dropbox``, ``GoogleDrive`` or ``Solid``.
     *
     * @property {boolean} remote.connected - Whether or not a remote store is connected
     * @property {boolean} remote.online - Whether last sync action was successful or not
     * @property {string} remote.userAddress - The user address of the connected user
     * @property {string} remote.properties - The properties of the WebFinger link
     */
    /**
     * Connect to a remoteStorage server.
     *
     * Discovers the WebFinger profile of the given user address and initiates
     * the OAuth dance.
     *
     * This method must be called *after* all required access has been claimed.
     * When using the connect widget, it will call this method itself.
     *
     * Special cases:
     *
     * 1. If a bearer token is supplied as second argument, the OAuth dance
     *    will be skipped and the supplied token be used instead. This is
     *    useful outside of browser environments, where the token has been
     *    acquired in a different way.
     *
     * 2. If the Webfinger profile for the given user address doesn't contain
     *    an auth URL, the library will assume that client and server have
     *    established authorization among themselves, which will omit bearer
     *    tokens in all requests later on. This is useful for example when using
     *    Kerberos and similar protocols.
     *
     * @param {string} userAddress - The user address (user@host) or URL to connect to.
     * @param {string} token       - (optional) A bearer token acquired beforehand
     */
    connect(userAddress, token) {
        this.setBackend('remotestorage');
        if (userAddress.indexOf('@') < 0 && !userAddress.match(/^(https?:\/\/)?[^\s\/$\.?#]+\.[^\s]*$/)) {
            this._emit('error', new RemoteStorage.DiscoveryError("Not a valid user address or URL."));
            return;
        }
        // Prefix URL with https:// if it's missing
        if (userAddress.indexOf('@') < 0 && !userAddress.match(/^https?:\/\//)) {
            userAddress = `https://${userAddress}`;
        }
        if (globalContext.cordova) {
            if (typeof config_1.default.cordovaRedirectUri !== 'string') {
                this._emit('error', new RemoteStorage.DiscoveryError("Please supply a custom HTTPS redirect URI for your Cordova app"));
                return;
            }
            if (!globalContext.cordova.InAppBrowser) {
                this._emit('error', new RemoteStorage.DiscoveryError("Please include the InAppBrowser Cordova plugin to enable OAuth"));
                return;
            }
        }
        this.remote.configure({
            userAddress: userAddress
        });
        this._emit('connecting');
        const discoveryTimeout = setTimeout(() => {
            this._emit('error', new RemoteStorage.DiscoveryError("No storage information found for this user address."));
        }, config_1.default.discoveryTimeout);
        (0, discover_1.default)(userAddress).then((info) => {
            clearTimeout(discoveryTimeout);
            this._emit('authing');
            info.userAddress = userAddress;
            this.remote.configure(info);
            if (!this.remote.connected) {
                if (info.authURL) {
                    if (typeof token === 'undefined') {
                        // Normal authorization step; the default way to connect
                        this.authorize({ authURL: info.authURL });
                    }
                    else if (typeof token === 'string') {
                        // Token supplied directly by app/developer/user
                        (0, log_1.default)('Skipping authorization sequence and connecting with known token');
                        this.remote.configure({ token: token });
                    }
                    else {
                        throw new Error("Supplied bearer token must be a string");
                    }
                }
                else {
                    // In lieu of an excplicit authURL, assume that the browser and
                    // server handle any authorization needs; for instance, TLS may
                    // trigger the browser to use a client certificate, or a 401 Not
                    // Authorized response may make the browser send a Kerberos ticket
                    // using the SPNEGO method.
                    this.impliedauth();
                }
            }
        }, ( /*err*/) => {
            clearTimeout(discoveryTimeout);
            this._emit('error', new RemoteStorage.DiscoveryError("No storage information found for this user address."));
        });
    }
    /**
     * Reconnect the remote server to get a new authorization.
     */
    reconnect() {
        this.remote.configure({ token: null });
        if (this.backend === 'remotestorage') {
            this.connect(this.remote.userAddress);
        }
        else {
            this.remote.connect();
        }
    }
    /**
     * "Disconnect" from remote server to terminate current session.
     *
     * This method clears all stored settings and deletes the entire local
     * cache.
     */
    disconnect() {
        if (this.remote) {
            this.remote.configure({
                userAddress: null,
                href: null,
                storageApi: null,
                token: null,
                properties: null
            });
        }
        this._setGPD({
            get: this._pendingGPD('get'),
            put: this._pendingGPD('put'),
            delete: this._pendingGPD('delete')
        });
        const n = this._cleanups.length;
        let i = 0;
        const oneDone = () => {
            i++;
            if (i >= n) {
                this._init();
                // FIXME Re-enable when modules are all imports
                // log('Done cleaning up, emitting disconnected and disconnect events');
                this._emit('disconnected');
            }
        };
        if (n > 0) {
            this._cleanups.forEach((cleanup) => {
                const cleanupResult = cleanup(this);
                if (typeof (cleanupResult) === 'object' && typeof (cleanupResult.then) === 'function') {
                    cleanupResult.then(oneDone);
                }
                else {
                    oneDone();
                }
            });
        }
        else {
            oneDone();
        }
    }
    /**
     * TODO: document
     * @private
     */
    setBackend(what) {
        this.backend = what;
        if (hasLocalStorage) {
            if (what) {
                localStorage.setItem('remotestorage:backend', what);
            }
            else {
                localStorage.removeItem('remotestorage:backend');
            }
        }
    }
    /**
     * Add a "change" event handler to the given path. Whenever a "change"
     * happens (as determined by the backend, such as e.g.
     * <RemoteStorage.IndexedDB>) and the affected path is equal to or below the
     * given 'path', the given handler is called.
     *
     * You should usually not use this method directly, but instead use the
     * "change" events provided by :doc:`BaseClient </js-api/base-client>`
     *
     * @param {string} path - Absolute path to attach handler to
     * @param {function} handler - Handler function
     */
    onChange(path, handler) {
        if (!this._pathHandlers.change[path]) {
            this._pathHandlers.change[path] = [];
        }
        this._pathHandlers.change[path].push(handler);
    }
    /**
     * TODO: do we still need this, now that we always instantiate the prototype?
     *
     * Enable remoteStorage logging.
     */
    enableLog() {
        config_1.default.logging = true;
    }
    /**
     * TODO: do we still need this, now that we always instantiate the prototype?
     *
     * Disable remoteStorage logging
     */
    disableLog() {
        config_1.default.logging = false;
    }
    /**
     * log
     *
     * The same as <RemoteStorage.log>.
     */
    log(...args) {
        log_1.default.apply(RemoteStorage, args);
    }
    setSolidAuthURL(authURL) {
        if (!authURL) {
            return;
        }
        solid_1.default._rs_init(this);
        this.solid.setAuthURL(authURL);
        if (hasLocalStorage) {
            localStorage.setItem('remotestorage:solid-auth-url', authURL); // TODO
        }
    }
    /**
     * Set the OAuth key/ID for either GoogleDrive, Dropbox or Solid backend support.
     *
     * @param {Object} apiKeys - A config object with these properties:
     * @param {string} [apiKeys.type] - Backend type: 'googledrive' or 'dropbox'
     * @param {string} [apiKeys.key] - Client ID for GoogleDrive, or app key for Dropbox
     */
    setApiKeys(apiKeys) {
        const validTypes = [ApiKeyType.GOOGLE, ApiKeyType.DROPBOX];
        if (typeof apiKeys !== 'object' || !Object.keys(apiKeys).every(type => validTypes.includes(type))) {
            console.error('setApiKeys() was called with invalid arguments');
            return false;
        }
        Object.keys(apiKeys).forEach(type => {
            const key = apiKeys[type];
            if (!key) {
                delete this.apiKeys[type];
                return;
            }
            switch (type) {
                case ApiKeyType.DROPBOX:
                    this.apiKeys[ApiKeyType.DROPBOX] = { appKey: key };
                    if (typeof this.dropbox === 'undefined' ||
                        this.dropbox.clientId !== key) {
                        dropbox_1.default._rs_init(this);
                    }
                    break;
                case ApiKeyType.GOOGLE:
                    this.apiKeys[ApiKeyType.GOOGLE] = { clientId: key };
                    if (typeof this.googledrive === 'undefined' ||
                        this.googledrive.clientId !== key) {
                        googledrive_1.default._rs_init(this);
                    }
                    break;
            }
            return true;
        });
        if (hasLocalStorage) {
            localStorage.setItem('remotestorage:api-keys', JSON.stringify(this.apiKeys));
        }
    }
    /**
     * Set redirect URI to be used for the OAuth redirect within the
     * in-app-browser window in Cordova apps.
     *
     * @param uri - A valid HTTP(S) URI
     */
    setCordovaRedirectUri(uri) {
        if (typeof uri !== 'string' || !uri.match(/http(s)?:\/\//)) {
            throw new Error("Cordova redirect URI must be a URI string");
        }
        config_1.default.cordovaRedirectUri = uri;
    }
    //
    // GET/PUT/DELETE INTERFACE HELPERS
    //
    /**
     * TODO: document
     * @private
     */
    _setGPD(impl, context) {
        function wrap(func) {
            return function (...args) {
                return func.apply(context, args)
                    .then(emitUnauthorized.bind(this));
            };
        }
        this.get = wrap(impl.get);
        this.put = wrap(impl.put);
        this.delete = wrap(impl.delete);
    }
    /**
     * TODO: document
     * @private
     */
    _pendingGPD(methodName) {
        return (...args) => {
            const methodArguments = Array.prototype.slice.call(args);
            return new Promise((resolve, reject) => {
                this._pending.push({
                    method: methodName,
                    args: methodArguments,
                    promise: {
                        resolve: resolve,
                        reject: reject
                    }
                });
            });
        };
    }
    /**
     * TODO: document
     * @private
     */
    _processPending() {
        this._pending.forEach((pending) => {
            try {
                this[pending.method](...pending.args).then(pending.promise.resolve, pending.promise.reject);
            }
            catch (e) {
                pending.promise.reject(e);
            }
        });
        this._pending = [];
    }
    //
    // CHANGE EVENT HANDLING
    //
    /**
     * TODO: document
     * @private
     */
    _bindChange(object) {
        object.on('change', this._dispatchEvent.bind(this, 'change'));
    }
    /**
     * TODO: document
     * @private
     */
    _dispatchEvent(eventName, event) {
        Object.keys(this._pathHandlers[eventName]).forEach((path) => {
            const pl = path.length;
            if (event.path.substr(0, pl) === path) {
                this._pathHandlers[eventName][path].forEach((handler) => {
                    const ev = {};
                    for (const key in event) {
                        ev[key] = event[key];
                    }
                    ev.relativePath = event.path.replace(new RegExp('^' + path), '');
                    try {
                        handler(ev);
                    }
                    catch (e) {
                        console.error("'change' handler failed: ", e, e.stack);
                        this._emit('error', e);
                    }
                });
            }
        });
    }
    /**
     * This method enables you to quickly instantiate a BaseClient, which you can
     * use to directly read and manipulate data in the connected storage account.
     *
     * Please use this method only for debugging and development, and choose or
     * create a :doc:`data module </data-modules>` for your app to use.
     *
     * @param path - The base directory of the BaseClient that will be returned
     *               (with a leading and a trailing slash)
     *
     * @returns A client with the specified scope (category/base directory)
     */
    scope(path) {
        if (typeof (path) !== 'string') {
            throw 'Argument \'path\' of baseClient.scope must be a string';
        }
        if (!this.access.checkPathPermission(path, 'r')) {
            console.warn('WARNING: Please use remoteStorage.access.claim() to ask for access permissions first: https://remotestoragejs.readthedocs.io/en/latest/js-api/access.html#claim');
        }
        return new baseclient_1.default(this, path);
    }
    /**
     * Get the value of the sync interval when application is in the foreground
     *
     * @returns {number} A number of milliseconds
     */
    getSyncInterval() {
        return config_1.default.syncInterval;
    }
    /**
     * Set the value of the sync interval when application is in the foreground
     *
     * @param interval - Sync interval in milliseconds (between 2000 and 3600000 [1 hour])
     */
    setSyncInterval(interval) {
        if (!isValidInterval(interval)) {
            throw interval + " is not a valid sync interval";
        }
        const oldValue = config_1.default.syncInterval;
        config_1.default.syncInterval = interval;
        this._emit('sync-interval-change', { oldValue: oldValue, newValue: interval });
    }
    /**
     * Get the value of the sync interval when application is in the background
     *
     * @returns A number of milliseconds
     */
    getBackgroundSyncInterval() {
        return config_1.default.backgroundSyncInterval;
    }
    /**
     * Set the value of the sync interval when the application is in the
     * background
     *
     * @param interval - Sync interval in milliseconds (between 2000 and 3600000 [1 hour])
     */
    setBackgroundSyncInterval(interval) {
        if (!isValidInterval(interval)) {
            throw interval + " is not a valid sync interval";
        }
        const oldValue = config_1.default.backgroundSyncInterval;
        config_1.default.backgroundSyncInterval = interval;
        this._emit('sync-interval-change', { oldValue: oldValue, newValue: interval });
    }
    /**
     * Get the value of the current sync interval. Can be background or
     * foreground, custom or default.
     *
     * @returns {number} A number of milliseconds
     */
    getCurrentSyncInterval() {
        return config_1.default.isBackground ? config_1.default.backgroundSyncInterval : config_1.default.syncInterval;
    }
    /**
     * Get the value of the current network request timeout
     *
     * @returns {number} A number of milliseconds
     */
    getRequestTimeout() {
        return config_1.default.requestTimeout;
    }
    /**
     * Set the timeout for network requests.
     *
     * @param timeout - Timeout in milliseconds
     */
    setRequestTimeout(timeout) {
        if (typeof timeout !== 'number') {
            throw timeout + " is not a valid request timeout";
        }
        config_1.default.requestTimeout = timeout;
    }
    /**
     * TODO: document
     * @private
     */
    syncCycle() {
        if (!this.sync || this.sync.stopped) {
            return;
        }
        this.on('sync-done', () => {
            // FIXME Re-enable when modules are all imports
            // log('[Sync] Sync done. Setting timer to', this.getCurrentSyncInterval());
            if (this.sync && !this.sync.stopped) {
                if (this._syncTimer) {
                    clearTimeout(this._syncTimer);
                    this._syncTimer = undefined;
                }
                this._syncTimer = setTimeout(this.sync.sync.bind(this.sync), this.getCurrentSyncInterval());
            }
        });
        this.sync.sync();
    }
    /**
     * Start synchronization with remote storage, downloading and uploading any
     * changes within the cached paths.
     *
     * Please consider: local changes will attempt sync immediately, and remote
     * changes should also be synced timely when using library defaults. So
     * this is mostly useful for letting users sync manually, when pressing a
     * sync button for example. This might feel safer to them sometimes, esp.
     * when shifting between offline and online a lot.
     *
     * @returns {Promise} A Promise which resolves when the sync has finished
     */
    startSync() {
        if (!config_1.default.cache) {
            console.warn('Nothing to sync, because caching is disabled.');
            return Promise.resolve();
        }
        this.sync.stopped = false;
        this.syncStopped = false;
        return this.sync.sync();
    }
    /**
     * Stop the periodic synchronization.
     */
    stopSync() {
        clearTimeout(this._syncTimer);
        this._syncTimer = undefined;
        if (this.sync) {
            // FIXME Re-enable when modules are all imports
            // log('[Sync] Stopping sync');
            this.sync.stopped = true;
        }
        else {
            // The sync class has not been initialized yet, so we make sure it will
            // not start the syncing process as soon as it's initialized.
            // FIXME Re-enable when modules are all imports
            // log('[Sync] Will instantiate sync stopped');
            this.syncStopped = true;
        }
    }
    /*
     * Add remoteStorage data module
     *
     * @param {Object} module - module object needs following properies:
     * @param {string} [module.name] - Name of the module
     * @param {function} [module.builder] - Builder function defining the module
     *
     * The module builder function should return an object containing another
     * object called exports, which will be exported to this <RemoteStorage>
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
     * @example
     *   RemoteStorage.addModule({name: 'locations', builder: function (privateClient, publicClient) {
     *     return {
     *       exports: {
     *         features: privateClient.scope('features/').defaultType('feature'),
     *         collections: privateClient.scope('collections/').defaultType('feature-collection')
     *       }
     *     };
     *   }});
    */
    addModule(module) {
        const moduleName = module.name;
        const moduleBuilder = module.builder;
        Object.defineProperty(this, moduleName, {
            configurable: true,
            get: function () {
                const instance = this._loadModule(moduleName, moduleBuilder);
                Object.defineProperty(this, moduleName, {
                    value: instance
                });
                return instance;
            }
        });
        if (moduleName.indexOf('-') !== -1) {
            const camelizedName = moduleName.replace(/\-[a-z]/g, function (s) {
                return s[1].toUpperCase();
            });
            Object.defineProperty(this, camelizedName, {
                get: function () {
                    return this[moduleName];
                }
            });
        }
    }
    /**
     * Load module
     * @private
     */
    _loadModule(moduleName, moduleBuilder) {
        if (moduleBuilder) {
            const module = moduleBuilder(new baseclient_1.default(this, '/' + moduleName + '/'), new baseclient_1.default(this, '/public/' + moduleName + '/'));
            return module.exports;
        }
        else {
            throw "Unknown module: " + moduleName;
        }
    }
}
// FIXME: Instead of doing this, would be better to only
// export setAuthURL / getAuthURL from RemoteStorage prototype
RemoteStorage.Authorize = authorize_1.default;
RemoteStorage.SyncError = sync_error_1.default;
RemoteStorage.Unauthorized = unauthorized_error_1.default;
RemoteStorage.DiscoveryError = discover_1.default.DiscoveryError;
RemoteStorage.util = util;
/**
 * @property access
 *
 * Tracking claimed access scopes. A <RemoteStorage.Access> instance.
*/
Object.defineProperty(RemoteStorage.prototype, 'access', {
    get: function () {
        const access = new access_1.default();
        Object.defineProperty(this, 'access', {
            value: access
        });
        return access;
    },
    configurable: true
});
// TODO Clean up/harmonize how modules are loaded and/or document this architecture properly
//
// At this point the remoteStorage object has not been created yet.
// Only its prototype exists so far, so we define a self-constructing
// property on there:
/**
 * Property: caching
 *
 * Caching settings. A <RemoteStorage.Caching> instance.
 */
// FIXME Was in rs_init of Caching but don't want to require RemoteStorage from there.
Object.defineProperty(RemoteStorage.prototype, 'caching', {
    configurable: true,
    get: function () {
        const caching = new caching_1.default();
        Object.defineProperty(this, 'caching', {
            value: caching
        });
        return caching;
    }
});
(0, util_1.applyMixins)(RemoteStorage, [eventhandling_1.default]);
var ApiKeyType;
(function (ApiKeyType) {
    ApiKeyType["GOOGLE"] = "googledrive";
    ApiKeyType["DROPBOX"] = "dropbox";
})(ApiKeyType || (ApiKeyType = {}));
module.exports = RemoteStorage;


/***/ }),

/***/ "./src/requests.ts":
/*!*************************!*\
  !*** ./src/requests.ts ***!
  \*************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(global) {
/**
 * This file implements an HTTP request with timeout, on top of fetch or XHR.
 * The returned value always looks like an XHR.
 * It is used by authorize.ts, wireclient.ts, googledrive.ts and dropbox.ts.
 * The timeout is set by RemoteStorage#setRequestTimeout(timeout)
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestWithTimeout = exports.isArrayBufferView = exports.retryAfterMs = void 0;
const log_1 = __importDefault(__webpack_require__(/*! ./log */ "./src/log.ts"));
const config_1 = __importDefault(__webpack_require__(/*! ./config */ "./src/config.ts"));
/**
 * Extracts a retry interval from header,
 * defaulting to three tries and a pause, within sync interval
 * */
function retryAfterMs(xhr) {
    const serverMs = parseInt(xhr.getResponseHeader('Retry-After')) * 1000;
    if (serverMs >= 1000) { // sanity check
        return serverMs;
    }
    else { // value is NaN if no such header, or malformed
        // three tries and a pause, within sync interval,
        // with lower & upper bounds
        return Math.max(1500, Math.min(60000, Math.round(config_1.default.syncInterval / (2.9 + Math.random() * 0.2))));
    }
}
exports.retryAfterMs = retryAfterMs;
if (typeof ((global || window).ArrayBufferView) === 'function') {
    exports.isArrayBufferView = function (object) {
        return object && (object instanceof (global || window).ArrayBufferView);
    };
}
else {
    const arrayBufferViews = [
        Int8Array, Uint8Array, Int16Array, Uint16Array,
        Int32Array, Uint32Array, Float32Array, Float64Array
    ];
    exports.isArrayBufferView = function (object) {
        for (let i = 0; i < 8; i++) {
            if (object instanceof arrayBufferViews[i]) {
                return true;
            }
        }
        return false;
    };
}
function requestWithTimeout(method, url, options) {
    return __awaiter(this, void 0, void 0, function* () {
        if (typeof fetch === 'function') {
            return _fetchRequestWithTimeout(method, url, options);
        }
        else if (typeof XMLHttpRequest === 'function') {
            return _xhrRequestWithTimeout(method, url, options);
        }
        else {
            return Promise.reject('[Requests] You need to add a polyfill for fetch or XMLHttpRequest');
        }
    });
}
exports.requestWithTimeout = requestWithTimeout;
function _fetchRequestWithTimeout(method, url, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const abortController = typeof AbortController === 'function' ?
            new AbortController() :
            null;
        let timeoutId;
        const timeoutPromise = new Promise((_resolve, reject) => {
            timeoutId = setTimeout(() => {
                if (abortController) {
                    abortController.abort();
                }
                reject('timeout');
            }, config_1.default.requestTimeout);
        });
        let syntheticXhr;
        const responseHeaders = {};
        const networkPromise = fetch(url, {
            method: method,
            headers: options.headers,
            body: options.body,
            signal: abortController ? abortController.signal : undefined
        }).then((response) => {
            (0, log_1.default)('[requests fetch]', response);
            response.headers.forEach((value, headerName) => {
                responseHeaders[headerName.toUpperCase()] = value;
            });
            syntheticXhr = {
                readyState: 4,
                status: response.status,
                statusText: response.statusText,
                response: undefined,
                getResponseHeader: (headerName) => {
                    return responseHeaders[headerName.toUpperCase()] || null;
                },
                // responseText: 'foo',
                responseType: options.responseType,
                responseURL: url,
            };
            switch (options.responseType) {
                case 'arraybuffer':
                    return response.arrayBuffer();
                case 'blob':
                    return response.blob();
                case 'json':
                    return response.json();
                case undefined:
                case '':
                case 'text':
                    return response.text();
                default: // document
                    throw new Error("responseType 'document' is not currently supported using fetch");
            }
        }).then((processedBody) => {
            syntheticXhr.response = processedBody;
            if (!options.responseType || options.responseType === 'text') {
                syntheticXhr.responseText = processedBody;
            }
            return syntheticXhr;
        }).finally(() => {
            clearTimeout(timeoutId);
        });
        return Promise.race([networkPromise, timeoutPromise]);
    });
}
function _xhrRequestWithTimeout(method, url, options) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            (0, log_1.default)('[requests XHR]', method, url);
            let timedOut = false;
            const timer = setTimeout(() => {
                timedOut = true;
                reject('timeout');
            }, config_1.default.requestTimeout);
            const xhr = new XMLHttpRequest();
            xhr.open(method, url, true);
            if (options.responseType) {
                xhr.responseType = options.responseType;
            }
            if (options.headers) {
                for (const key in options.headers) {
                    xhr.setRequestHeader(key, options.headers[key]);
                }
            }
            xhr.onload = () => {
                if (timedOut) {
                    return;
                }
                clearTimeout(timer);
                resolve(xhr);
            };
            xhr.onerror = (error) => {
                if (timedOut) {
                    return;
                }
                clearTimeout(timer);
                reject(error);
            };
            let body = options.body;
            if (typeof (body) === 'object' && !(0, exports.isArrayBufferView)(body) && body instanceof ArrayBuffer) {
                body = new Uint8Array(body);
            }
            xhr.send(body);
        });
    });
}

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./../node_modules/webpack/buildin/global.js */ "./node_modules/webpack/buildin/global.js")))

/***/ }),

/***/ "./src/revisioncache.ts":
/*!******************************!*\
  !*** ./src/revisioncache.ts ***!
  \******************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * A cache which can propagate changes up to parent folders and generate new
 * revision ids for them. The generated revision id is consistent across
 * different sessions.  The keys for the cache are case-insensitive.
 *
 * @param defaultValue {string} the value that is returned for all keys that
 *                              don't exist in the cache
 * @class
 */
class RevisionCache {
    constructor(defaultValue) {
        this._itemsRev = {};
        this._storage = {};
        this._canPropagate = false;
        this.defaultValue = defaultValue;
        this.activatePropagation();
    }
    /**
     * Get a value from the cache or defaultValue, if the key is not in the
     * cache
     */
    get(key) {
        key = key.toLowerCase();
        let stored = this._storage[key];
        if (typeof stored === 'undefined') {
            stored = this.defaultValue;
            this._storage[key] = stored;
        }
        return stored;
    }
    /**
     * Set a value
     */
    set(key, value) {
        key = key.toLowerCase();
        if (this._storage[key] === value) {
            return value;
        }
        this._storage[key] = value;
        if (!value) {
            delete this._itemsRev[key];
        }
        this._updateParentFolderItemRev(key, value);
        if (this._canPropagate) {
            this._propagate(key);
        }
        return value;
    }
    /**
     * Delete a value
     */
    delete(key) {
        return this.set(key, null);
    }
    /**
     * Disables automatic update of folder revisions when a key value is updated
     */
    deactivatePropagation() {
        this._canPropagate = false;
        return true;
    }
    /**
     * Enables automatic update of folder revisions when a key value is updated
     * and refreshes the folder revision ids for entire tree.
     */
    activatePropagation() {
        if (this._canPropagate) {
            return true;
        }
        this._generateFolderRev("/");
        this._canPropagate = true;
        return true;
    }
    /**
     * Returns a hash code for a string.
     */
    _hashCode(str) {
        let hash = 0;
        if (str.length === 0) {
            return hash;
        }
        for (let i = 0; i < str.length; i++) {
            const chr = str.charCodeAt(i);
            // eslint-disable-next-line no-bitwise
            hash = ((hash << 5) - hash) + chr;
            // eslint-disable-next-line no-bitwise
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }
    /**
     * Takes an array of strings and returns a hash of the items
     */
    _generateHash(items) {
        // We sort the items before joining them to ensure correct hash generation
        // every time
        const files = items.sort().join('|');
        const hash = "" + this._hashCode(files);
        return hash;
    }
    /**
     * Update the revision of a key in it's parent folder data
     */
    _updateParentFolderItemRev(key, rev) {
        if (key !== '/') {
            const parentFolder = this._getParentFolder(key);
            if (!this._itemsRev[parentFolder]) {
                this._itemsRev[parentFolder] = {};
            }
            const parentFolderItemsRev = this._itemsRev[parentFolder];
            if (!rev) {
                delete parentFolderItemsRev[key];
            }
            else {
                parentFolderItemsRev[key] = rev;
            }
            //reset revision until root
            this._updateParentFolderItemRev(parentFolder, this.defaultValue);
        }
    }
    _getParentFolder(key) {
        return key.substr(0, key.lastIndexOf('/', key.length - 2) + 1);
    }
    /**
     * Propagate the changes to the parent folders and generate new revision ids
     * for them
     */
    _propagate(key) {
        if (key !== '/') {
            const parentFolder = this._getParentFolder(key);
            const parentFolderItemsRev = this._itemsRev[parentFolder];
            const hashItems = [];
            for (const path in parentFolderItemsRev) {
                hashItems.push(parentFolderItemsRev[path]);
            }
            const newRev = this._generateHash(hashItems);
            this.set(parentFolder, newRev);
        }
    }
    /**
     * Generate revision id for a folder and it's subfolders, by hashing it's
     * listing
     */
    _generateFolderRev(folder) {
        const itemsRev = this._itemsRev[folder];
        let hash = this.defaultValue;
        if (itemsRev) {
            const hashItems = [];
            for (const path in itemsRev) {
                const isDir = (path.substr(-1) === '/');
                let hashItem;
                if (isDir) {
                    hashItem = this._generateFolderRev(path);
                }
                else {
                    hashItem = itemsRev[path];
                }
                hashItems.push(hashItem);
            }
            if (hashItems.length > 0) {
                hash = this._generateHash(hashItems);
            }
        }
        this.set(folder, hash);
        return hash;
    }
}
module.exports = RevisionCache;


/***/ }),

/***/ "./src/schema-not-found-error.ts":
/*!***************************************!*\
  !*** ./src/schema-not-found-error.ts ***!
  \***************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

class SchemaNotFound extends Error {
    constructor(uri) {
        super();
        const error = new Error("Schema not found: " + uri);
        error.name = "SchemaNotFound";
        return error;
    }
}
module.exports = SchemaNotFound;


/***/ }),

/***/ "./src/solid.ts":
/*!**********************!*\
  !*** ./src/solid.ts ***!
  \**********************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const baseclient_1 = __importDefault(__webpack_require__(/*! ./baseclient */ "./src/baseclient.ts"));
const eventhandling_1 = __importDefault(__webpack_require__(/*! ./eventhandling */ "./src/eventhandling.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
const requests_1 = __webpack_require__(/*! ./requests */ "./src/requests.ts");
const remote_1 = __webpack_require__(/*! ./remote */ "./src/remote.ts");
const BASE_URL = 'https://www.googleapis.com';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/auth';
const AUTH_SCOPE = 'https://www.googleapis.com/auth/drive';
const SETTINGS_KEY = 'remotestorage:googledrive';
const PATH_PREFIX = '/remotestorage';
const GD_DIR_MIME_TYPE = 'application/vnd.google-apps.folder';
const RS_DIR_MIME_TYPE = 'application/json; charset=UTF-8';
let hasLocalStorage;
/**
 * Produce a title from a filename for metadata.
 *
 * @param {string} filename
 * @returns {string} title
 *
 * @private
 */
function metaTitleFromFileName(filename) {
    if (filename.substr(-1) === '/') {
        filename = filename.substr(0, filename.length - 1);
    }
    return decodeURIComponent(filename);
}
/**
 * Get the parent directory for the given path.
 *
 * @param {string} path
 * @returns {string} parent directory
 *
 * @private
 */
function parentPath(path) {
    return path.replace(/[^\/]+\/?$/, '');
}
/**
 * Get only the filename from a full path.
 *
 * @param {string} path
 * @returns {string} filename
 *
 * @private
 */
function baseName(path) {
    const parts = path.split('/');
    if (path.substr(-1) === '/') {
        return parts[parts.length - 2] + '/';
    }
    else {
        return parts[parts.length - 1];
    }
}
/**
 * Prepend the path with the remoteStorage base directory.
 *
 * @param {string} path - Path
 * @returns {string} Actual path on Google Drive
 *
 * @private
 */
function googleDrivePath(path) {
    return (0, util_1.cleanPath)(`${PATH_PREFIX}/${path}`);
}
/**
 * Internal cache object for storing Google file IDs.
 *
 * @param {number} maxAge - Maximum age (in seconds) the content should be cached for
 */
class FileIdCache {
    constructor(maxAge) {
        this._items = {};
        this.maxAge = maxAge;
        this._items = {};
    }
    get(key) {
        const item = this._items[key];
        const now = new Date().getTime();
        return (item && item.t >= (now - this.maxAge)) ? item.v : undefined;
    }
    set(key, value) {
        this._items[key] = {
            v: value,
            t: new Date().getTime()
        };
    }
}
/**
 * Overwrite BaseClient's getItemURL with our own implementation
 *
 * TODO: Still needs to be implemented. At the moment it just throws
 * and error saying that it's not implemented yet.
 *
 * @param {object} rs - RemoteStorage instance
 *
 * @private
 */
function hookGetItemURL(rs) {
    if (rs._origBaseClientGetItemURL) {
        return;
    }
    rs._origBaseClientGetItemURL = baseclient_1.default.prototype.getItemURL;
    baseclient_1.default.prototype.getItemURL = function ( /* path */) {
        throw new Error('getItemURL is not implemented for Google Drive yet');
    };
}
/**
 * Restore BaseClient's getItemURL original implementation
 *
 * @param {object} rs - RemoteStorage instance
 *
 * @private
 */
function unHookGetItemURL(rs) {
    if (!rs._origBaseClientGetItemURL) {
        return;
    }
    baseclient_1.default.prototype.getItemURL = rs._origBaseClientGetItemURL;
    delete rs._origBaseClientGetItemURL;
}
/**
 * @class Solid
 *
 * To use this backend, you need to specify the authURL like so:
 *
 * @example
 * remoteStorage.setAuthURL('https://login.example.com');
 *
 * In order to set the Solid options for the widget you have to specify the valid options like so:
 *
 * @example
 * remoteStorage.setApiKeys({
 *   solid: {
 *     providers: [
 *       {
 *         name: "provider name",
 *         authURL: "auth URL"
 *       }
 *     ],
 *     allowAnyProvider: true|false
 *   }
 * });
**/
class Solid extends remote_1.RemoteBase {
    constructor(remoteStorage) {
        super(remoteStorage);
        this.online = true;
        this.storageApi = 'draft-dejong-remotestorage-19';
        this.addEvents(['connected', 'not-connected']);
        this._fileIdCache = new FileIdCache(60 * 5); // IDs expire after 5 minutes (is this a good idea?)
        hasLocalStorage = (0, util_1.localStorageAvailable)();
        if (hasLocalStorage) {
            const settings = (0, util_1.getJSONFromLocalStorage)(SETTINGS_KEY);
            if (settings) {
                this.configure(settings);
            }
        }
    }
    /**
     * Configure the Google Drive backend.
     *
     * Fetches the user info from Google when no ``userAddress`` is given.
     *
     * @param {Object} settings
     * @param {string} [settings.userAddress] - The user's email address
     * @param {string} [settings.token] - Authorization token
     *
     * @protected
     */
    configure(settings) {
        // We only update this.userAddress if settings.userAddress is set to a string or to null
        if (typeof settings.userAddress !== 'undefined') {
            this.userAddress = settings.userAddress;
        }
        // Same for this.token. If only one of these two is set, we leave the other one at its existing value
        if (typeof settings.token !== 'undefined') {
            this.token = settings.token;
        }
        const writeSettingsToCache = function () {
            if (hasLocalStorage) {
                localStorage.setItem(SETTINGS_KEY, JSON.stringify({
                    userAddress: this.userAddress,
                    token: this.token
                }));
            }
        };
        const handleError = function () {
            this.connected = false;
            delete this.token;
            if (hasLocalStorage) {
                localStorage.removeItem(SETTINGS_KEY);
            }
        };
        if (this.token) {
            this.connected = true;
            if (this.userAddress) {
                this._emit('connected');
                writeSettingsToCache.apply(this);
            }
            else {
                this.info().then((info) => {
                    this.userAddress = info.user.emailAddress;
                    this._emit('connected');
                    writeSettingsToCache.apply(this);
                }).catch(() => {
                    handleError.apply(this);
                    this.rs._emit('error', new Error('Could not fetch user info.'));
                });
            }
        }
        else {
            handleError.apply(this);
        }
    }
    /**
     * Set the auth URL
     * @param {string} authURL - Auth URL
     */
    setAuthURL(authURL) {
        this.authURL = authURL;
    }
    /**
     * Initiate the authorization flow's OAuth dance.
     */
    connect() {
        this.rs.setBackend('solid');
        // TODO authorize
        //this.rs.authorize({ authURL: AUTH_URL, scope: AUTH_SCOPE, clientId: this.clientId });
    }
    /**
     * Request a resource (file or directory).
     *
     * @param {string} path - Path of the resource
     * @param {Object} options - Request options
     * @returns {Promise} Resolves with an object containing the status code,
     *                    body, content-type and revision
     *
     * @protected
     */
    get(path, options = {}) {
        if ((0, util_1.isFolder)(path)) {
            return this._getFolder(googleDrivePath(path));
        }
        else {
            return this._getFile(googleDrivePath(path), options);
        }
    }
    /**
     * Create or update a file.
     *
     * @param {string} path - File path
     * @param body - File content
     * @param {string} contentType - File content-type
     * @param {Object} options
     * @param {string} options.ifNoneMatch - Only create of update the file if the
     *                                       current ETag doesn't match this string
     * @returns {Promise} Resolves with an object containing the status code,
     *                    content-type and revision
     *
     * @protected
     */
    put(path, body, contentType, options = {}) {
        const fullPath = googleDrivePath(path);
        function putDone(response) {
            if (response.status >= 200 && response.status < 300) {
                const meta = JSON.parse(response.responseText);
                const etagWithoutQuotes = this.stripQuotes(meta.etag);
                return Promise.resolve({ statusCode: 200, contentType: meta.mimeType, revision: etagWithoutQuotes });
            }
            else if (response.status === 412) {
                return Promise.resolve({ statusCode: 412, revision: 'conflict' });
            }
            else {
                return Promise.reject("PUT failed with status " + response.status + " (" + response.responseText + ")");
            }
        }
        return this._getFileId(fullPath).then((id) => {
            if (id) {
                if (options && (options.ifNoneMatch === '*')) {
                    return putDone({ status: 412 });
                }
                return this._updateFile(id, fullPath, body, contentType, options).then(putDone);
            }
            else {
                return this._createFile(fullPath, body, contentType).then(putDone);
            }
        });
    }
    /**
     * Delete a file.
     *
     * @param {string} path - File path
     * @param {Object} options
     * @param {string} options.ifMatch - only delete the file if it's ETag
     *                                   matches this string
     * @returns {Promise} Resolves with an object containing the status code
     *
     * @protected
     */
    delete(path, options = {}) {
        const fullPath = googleDrivePath(path);
        return this._getFileId(fullPath).then((id) => {
            if (!id) {
                // File doesn't exist. Ignore.
                return Promise.resolve({ statusCode: 200 });
            }
            return this._getMeta(id).then((meta) => {
                let etagWithoutQuotes;
                if ((typeof meta === 'object') && (typeof meta.etag === 'string')) {
                    etagWithoutQuotes = this.stripQuotes(meta.etag);
                }
                if (options && options.ifMatch && (options.ifMatch !== etagWithoutQuotes)) {
                    return { statusCode: 412, revision: etagWithoutQuotes };
                }
                return this._request('DELETE', BASE_URL + '/drive/v2/files/' + id, {}).then((response) => {
                    if (response.status === 200 || response.status === 204) {
                        return { statusCode: 200 };
                    }
                    else {
                        return Promise.reject("Delete failed: " + response.status + " (" + response.responseText + ")");
                    }
                });
            });
        });
    }
    /**
     * Fetch the user's info from Google.
     *
     * @returns {Promise} resolves with the user's info.
     *
     * @protected
     */
    info() {
        const url = BASE_URL + '/drive/v2/about?fields=user';
        // requesting user info(mainly for userAdress)
        return this._request('GET', url, {}).then(function (resp) {
            try {
                const info = JSON.parse(resp.responseText);
                return Promise.resolve(info);
            }
            catch (e) {
                return Promise.reject(e);
            }
        });
    }
    /**
     * Update an existing file.
     *
     * @param {string} id - File ID
     * @param {string} path - File path
     * @param body - File content
     * @param {string} contentType - File content-type
     * @param {Object} options
     * @param {string} options.ifMatch - Only update the file if its ETag
     *                                   matches this string
     * @returns {Promise} Resolves with the response of the network request
     *
     * @private
     */
    _updateFile(id, path, body, contentType, options) {
        const metadata = {
            mimeType: contentType
        };
        const headers = {
            'Content-Type': 'application/json; charset=UTF-8'
        };
        if (options && options.ifMatch) {
            headers['If-Match'] = this.addQuotes(options.ifMatch);
        }
        return this._request('PUT', BASE_URL + '/upload/drive/v2/files/' + id + '?uploadType=resumable', {
            body: JSON.stringify(metadata),
            headers: headers
        }).then((response) => {
            if (response.status === 412) {
                return (response);
            }
            else {
                return this._request('PUT', response.getResponseHeader('Location'), {
                    body: contentType.match(/^application\/json/) ? JSON.stringify(body) : body
                });
            }
        });
    }
    /**
     * Create a new file.
     *
     * @param {string} path - File path
     * @param body - File content
     * @param {string} contentType - File content-type
     * @returns {Promise} Resolves with the response of the network request
     *
     * @private
     */
    _createFile(path, body, contentType) {
        return this._getParentId(path).then((parentId) => {
            const fileName = baseName(path);
            const metadata = {
                title: metaTitleFromFileName(fileName),
                mimeType: contentType,
                parents: [{
                        kind: "drive#fileLink",
                        id: parentId
                    }]
            };
            return this._request('POST', BASE_URL + '/upload/drive/v2/files?uploadType=resumable', {
                body: JSON.stringify(metadata),
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8'
                }
            }).then((response) => {
                return this._request('POST', response.getResponseHeader('Location'), {
                    body: contentType.match(/^application\/json/) ? JSON.stringify(body) : body
                });
            });
        });
    }
    /**
     * Request a file.
     *
     * @param {string} path - File path
     * @param {Object} options
     * @param {string} [options.ifNoneMath] - Only return the file if its ETag
     *                                        doesn't match the given string
     * @returns {Promise} Resolves with an object containing the status code,
     *                    body, content-type and revision
     *
     * @private
     */
    _getFile(path, options) {
        return this._getFileId(path).then((id) => {
            return this._getMeta(id).then((meta) => {
                let etagWithoutQuotes;
                if (typeof (meta) === 'object' && typeof (meta.etag) === 'string') {
                    etagWithoutQuotes = this.stripQuotes(meta.etag);
                }
                if (options && options.ifNoneMatch && (etagWithoutQuotes === options.ifNoneMatch)) {
                    return Promise.resolve({ statusCode: 304 });
                }
                if (!meta.downloadUrl) {
                    if (meta.exportLinks && meta.exportLinks['text/html']) {
                        // Documents that were generated inside GoogleDocs have no
                        // downloadUrl, but you can export them to text/html instead:
                        meta.mimeType += ';export=text/html';
                        meta.downloadUrl = meta.exportLinks['text/html'];
                    }
                    else {
                        // empty file
                        return Promise.resolve({ statusCode: 200, body: '', contentType: meta.mimeType, revision: etagWithoutQuotes });
                    }
                }
                const params = {
                    responseType: 'arraybuffer'
                };
                return this._request('GET', meta.downloadUrl, params).then((response) => {
                    //first encode the response as text, and later check if
                    //text appears to actually be binary data
                    return (0, util_1.getTextFromArrayBuffer)(response.response, 'UTF-8').then(function (responseText) {
                        let body = responseText;
                        if (meta.mimeType.match(/^application\/json/)) {
                            try {
                                body = JSON.parse(body);
                            }
                            catch (e) {
                                // body couldn't be parsed as JSON, so we'll just return it as is
                            }
                        }
                        else if ((0, util_1.shouldBeTreatedAsBinary)(responseText, meta.mimeType)) {
                            //return unprocessed response
                            body = response.response;
                        }
                        return {
                            statusCode: 200,
                            body: body,
                            contentType: meta.mimeType,
                            revision: etagWithoutQuotes
                        };
                    });
                });
            });
        });
    }
    /**
     * Request a directory.
     *
     * @param {string} path - Directory path
     * @returns {Promise} Resolves with an object containing the status code,
     *                    body and content-type
     *
     * @private
     */
    _getFolder(path) {
        return this._getFileId(path).then((id) => {
            let data, etagWithoutQuotes, itemsMap;
            if (!id) {
                return Promise.resolve({ statusCode: 404 });
            }
            const query = '\'' + id + '\' in parents';
            const fields = 'items(downloadUrl,etag,fileSize,id,mimeType,title,labels)';
            return this._request('GET', BASE_URL + '/drive/v2/files?'
                + 'q=' + encodeURIComponent(query)
                + '&fields=' + encodeURIComponent(fields)
                + '&maxResults=1000'
                + '&trashed=false', {})
                .then((response) => {
                var _a;
                if (response.status !== 200) {
                    return Promise.reject('request failed or something: ' + response.status);
                }
                try {
                    data = JSON.parse(response.responseText);
                }
                catch (e) {
                    return Promise.reject('non-JSON response from GoogleDrive');
                }
                itemsMap = {};
                for (const item of data.items) {
                    if ((_a = item.labels) === null || _a === void 0 ? void 0 : _a.trashed) {
                        continue;
                    } // ignore deleted files
                    etagWithoutQuotes = this.stripQuotes(item.etag);
                    if (item.mimeType === GD_DIR_MIME_TYPE) {
                        this._fileIdCache.set(path + (0, util_1.cleanPath)(item.title) + '/', item.id);
                        itemsMap[item.title + '/'] = {
                            ETag: etagWithoutQuotes
                        };
                    }
                    else {
                        this._fileIdCache.set(path + (0, util_1.cleanPath)(item.title), item.id);
                        itemsMap[item.title] = {
                            ETag: etagWithoutQuotes,
                            'Content-Type': item.mimeType,
                            'Content-Length': item.fileSize
                        };
                    }
                }
                // FIXME: add revision of folder!
                return Promise.resolve({ statusCode: 200, body: itemsMap, contentType: RS_DIR_MIME_TYPE, revision: undefined });
            });
        });
    }
    /**
     * Get the ID of a parent path.
     *
     * Creates the directory if it doesn't exist yet.
     *
     * @param {string} path - Full path of a directory or file
     * @returns {Promise} Resolves with ID of the parent directory.
     *
     * @private
     */
    _getParentId(path) {
        const foldername = parentPath(path);
        return this._getFileId(foldername).then((parentId) => {
            if (parentId) {
                return Promise.resolve(parentId);
            }
            else {
                return this._createFolder(foldername);
            }
        });
    }
    /**
     * Create a directory.
     *
     * Creates all parent directories as well if any of them didn't exist yet.
     *
     * @param {string} path - Directory path
     * @returns {Promise} Resolves with the ID of the new directory
     *
     * @private
     */
    _createFolder(path) {
        return this._getParentId(path).then((parentId) => {
            return this._request('POST', BASE_URL + '/drive/v2/files', {
                body: JSON.stringify({
                    title: metaTitleFromFileName(baseName(path)),
                    mimeType: GD_DIR_MIME_TYPE,
                    parents: [{
                            id: parentId
                        }]
                }),
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8'
                }
            }).then((response) => {
                const meta = JSON.parse(response.responseText);
                return Promise.resolve(meta.id);
            });
        });
    }
    /**
     * Get the ID of a file.
     *
     * @param {string} path - File path
     * @returns {Promise} Resolves with the ID
     *
     * @private
     */
    _getFileId(path) {
        let id;
        if (path === '/') {
            // "root" is a special alias for the fileId of the root folder
            return Promise.resolve('root');
        }
        else if ((id = this._fileIdCache.get(path))) {
            // id is cached.
            return Promise.resolve(id);
        }
        // id is not cached (or file doesn't exist).
        // load parent folder listing to propagate / update id cache.
        return this._getFolder(parentPath(path)).then(() => {
            id = this._fileIdCache.get(path);
            if (!id) {
                if (path.substr(-1) === '/') {
                    return this._createFolder(path).then(() => {
                        return this._getFileId(path);
                    });
                }
                else {
                    return Promise.resolve();
                }
            }
            return Promise.resolve(id);
        });
    }
    /**
     * Get the metadata for a given file ID.
     *
     * @param {string} id - File ID
     * @returns {Promise} Resolves with an object containing the metadata
     *
     * @private
     */
    _getMeta(id) {
        return this._request('GET', BASE_URL + '/drive/v2/files/' + id, {}).then(function (response) {
            if (response.status === 200) {
                return Promise.resolve(JSON.parse(response.responseText));
            }
            else {
                return Promise.reject("request (getting metadata for " + id + ") failed with status: " + response.status);
            }
        });
    }
    /**
     * Make a network request.
     *
     * @param {string} method - Request method
     * @param {string} url - Target URL
     * @param {Object} options - Request options
     * @returns {Promise} Resolves with the response of the network request
     *
     * @private
     */
    _request(method, url, options) {
        if (this.isForbiddenRequestMethod(method, url)) {
            return Promise.reject(`Don't use ${method} on directories!`);
        }
        if (!options.headers) {
            options.headers = {};
        }
        options.headers['Authorization'] = 'Bearer ' + this.token;
        this.rs._emit('wire-busy', {
            method: method,
            isFolder: (0, util_1.isFolder)(url)
        });
        return (0, requests_1.requestWithTimeout)(method, url, options).then((xhr) => {
            // Google tokens expire from time to time...
            if (xhr && xhr.status === 401) {
                this.connect();
                return;
            }
            else {
                if (!this.online) {
                    this.online = true;
                    this.rs._emit('network-online');
                }
                this.rs._emit('wire-done', {
                    method: method,
                    isFolder: (0, util_1.isFolder)(url),
                    success: true
                });
                return Promise.resolve(xhr);
            }
        }, (error) => {
            if (this.online) {
                this.online = false;
                this.rs._emit('network-offline');
            }
            this.rs._emit('wire-done', {
                method: method,
                isFolder: (0, util_1.isFolder)(url),
                success: false
            });
            return Promise.reject(error);
        });
    }
    /**
     * Initialize the Solid backend.
     *
     * @param {Object} remoteStorage - RemoteStorage instance
     *
     * @protected
     */
    static _rs_init(remoteStorage) {
        remoteStorage.solid = new Solid(remoteStorage);
        if (remoteStorage.backend === 'solid') {
            remoteStorage._origRemote = remoteStorage.remote;
            remoteStorage.remote = remoteStorage.solid;
            hookGetItemURL(remoteStorage);
        }
    }
    /**
     * Inform about the availability of the Google Drive backend.
     *
     * @returns {Boolean}
     *
     * @protected
     */
    static _rs_supported() {
        return true;
    }
    /**
     * Remove Google Drive as a backend.
     *
     * @param {Object} remoteStorage - RemoteStorage instance
     *
     * @protected
     */
    static _rs_cleanup(remoteStorage) {
        remoteStorage.setBackend(undefined);
        if (remoteStorage._origRemote) {
            remoteStorage.remote = remoteStorage._origRemote;
            delete remoteStorage._origRemote;
        }
        unHookGetItemURL(remoteStorage);
    }
}
(0, util_1.applyMixins)(Solid, [eventhandling_1.default]); // TODO what is this?
module.exports = Solid;


/***/ }),

/***/ "./src/sync-error.ts":
/*!***************************!*\
  !*** ./src/sync-error.ts ***!
  \***************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

class SyncError extends Error {
    constructor(originalError) {
        super();
        this.name = 'SyncError';
        this.message = 'Sync failed: ';
        if (typeof originalError === 'string') {
            this.message += originalError;
        }
        else {
            this.message += originalError.message;
            this.stack = originalError.stack;
            this.originalError = originalError;
        }
    }
}
module.exports = SyncError;


/***/ }),

/***/ "./src/sync.ts":
/*!*********************!*\
  !*** ./src/sync.ts ***!
  \*********************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const config_1 = __importDefault(__webpack_require__(/*! ./config */ "./src/config.ts"));
const env_1 = __importDefault(__webpack_require__(/*! ./env */ "./src/env.ts"));
const eventhandling_1 = __importDefault(__webpack_require__(/*! ./eventhandling */ "./src/eventhandling.ts"));
const log_1 = __importDefault(__webpack_require__(/*! ./log */ "./src/log.ts"));
const authorize_1 = __importDefault(__webpack_require__(/*! ./authorize */ "./src/authorize.ts"));
const sync_error_1 = __importDefault(__webpack_require__(/*! ./sync-error */ "./src/sync-error.ts"));
const unauthorized_error_1 = __importDefault(__webpack_require__(/*! ./unauthorized-error */ "./src/unauthorized-error.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
let syncCycleCb, syncOnConnect;
function taskFor(action, path, promise) {
    return { action, path, promise };
}
function nodeChanged(node, etag) {
    return node.common.revision !== etag &&
        (!node.remote || node.remote.revision !== etag);
}
function isStaleChild(node) {
    return node.remote && node.remote.revision && !node.remote.itemsMap && !node.remote.body;
}
function hasCommonRevision(node) {
    return node.common && node.common.revision;
}
function hasNoRemoteChanges(node) {
    if (node.remote && node.remote.revision &&
        node.remote.revision !== node.common.revision) {
        return false;
    }
    return (node.common.body === undefined && node.remote.body === false) ||
        (node.remote.body === node.common.body &&
            node.remote.contentType === node.common.contentType);
}
function mergeMutualDeletion(node) {
    if (node.remote && node.remote.body === false &&
        node.local && node.local.body === false) {
        delete node.local;
    }
    return node;
}
function handleVisibility(env, rs) {
    function handleChange(isForeground) {
        const oldValue = rs.getCurrentSyncInterval();
        config_1.default.isBackground = !isForeground;
        const newValue = rs.getCurrentSyncInterval();
        rs._emit('sync-interval-change', { oldValue: oldValue, newValue: newValue });
    }
    env.on('background', () => handleChange(false));
    env.on('foreground', () => handleChange(true));
}
/**
 * Class: RemoteStorage.Sync
 *
 * This class basically does six things:
 *
 * - retrieve the remote version of relevant documents and folders
 * - add all local and remote documents together into one tree
 * - push local documents out if they don't exist remotely
 * - push local changes out to remote documents (conditionally, to avoid race
 *   conditions where both have changed)
 * - adopt the local version of a document to its remote version if both exist
 *   and they differ
 * - delete the local version of a document if it was deleted remotely
 * - if any GET requests were waiting for remote data, resolve them once this
 *   data comes in.
 *
 * It does this using requests to documents and folders. Whenever a folder GET
 * comes in, it gives information about all the documents it contains (this is
 * the `markChildren` function).
 **/
class Sync {
    constructor(remoteStorage) {
        this._finishedTasks = [];
        this.rs = remoteStorage;
        this._tasks = {};
        this._running = {};
        this._timeStarted = {};
        this.numThreads = 10;
        this.rs.local.onDiff(path => {
            this.addTask(path);
            this.doTasks();
        });
        this.rs.caching.onActivate((path) => {
            this.addTask(path);
            this.doTasks();
        });
        this.addEvents(['done', 'req-done']);
    }
    now() {
        return new Date().getTime();
    }
    queueGetRequest(path) {
        return new Promise((resolve, reject) => {
            if (!this.rs.remote.connected) {
                reject('cannot fulfill maxAge requirement - remote is not connected');
            }
            else if (!this.rs.remote.online) {
                reject('cannot fulfill maxAge requirement - remote is not online');
            }
            else {
                this.addTask(path, function () {
                    this.rs.local.get(path).then(r => resolve(r));
                }.bind(this));
                this.doTasks();
            }
        });
    }
    // FIXME force02 sounds like rs spec 02, thus could be removed
    corruptServerItemsMap(itemsMap, force02) {
        if ((typeof (itemsMap) !== 'object') || (Array.isArray(itemsMap))) {
            return true;
        }
        for (const itemName in itemsMap) {
            const item = itemsMap[itemName];
            if (typeof (item) !== 'object') {
                return true;
            }
            if (typeof (item.ETag) !== 'string') {
                return true;
            }
            if ((0, util_1.isFolder)(itemName)) {
                if (itemName.substring(0, itemName.length - 1).indexOf('/') !== -1) {
                    return true;
                }
            }
            else {
                if (itemName.indexOf('/') !== -1) {
                    return true;
                }
                if (force02) {
                    if (typeof (item['Content-Type']) !== 'string') {
                        return true;
                    }
                    if (typeof (item['Content-Length']) !== 'number') {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    corruptItemsMap(itemsMap) {
        if ((typeof (itemsMap) !== 'object') || (Array.isArray(itemsMap))) {
            return true;
        }
        for (const path in itemsMap) {
            if (typeof itemsMap[path] !== 'boolean') {
                return true;
            }
        }
        return false;
    }
    corruptRevision(rev) {
        return ((typeof (rev) !== 'object') ||
            (Array.isArray(rev)) ||
            (rev.revision && typeof (rev.revision) !== 'string') ||
            (rev.body && typeof (rev.body) !== 'string' && typeof (rev.body) !== 'object') ||
            (rev.contentType && typeof (rev.contentType) !== 'string') ||
            (rev.contentLength && typeof (rev.contentLength) !== 'number') ||
            (rev.timestamp && typeof (rev.timestamp) !== 'number') ||
            (rev.itemsMap && this.corruptItemsMap(rev.itemsMap)));
    }
    isCorrupt(node) {
        return ((typeof (node) !== 'object') ||
            (Array.isArray(node)) ||
            (typeof (node.path) !== 'string') ||
            (this.corruptRevision(node.common)) ||
            (node.local && this.corruptRevision(node.local)) ||
            (node.remote && this.corruptRevision(node.remote)) ||
            (node.push && this.corruptRevision(node.push)));
    }
    hasTasks() {
        return Object.getOwnPropertyNames(this._tasks).length > 0;
    }
    collectDiffTasks() {
        return __awaiter(this, void 0, void 0, function* () {
            let num = 0;
            return this.rs.local.forAllNodes((node) => {
                if (num > 100) {
                    return;
                }
                if (this.isCorrupt(node)) {
                    (0, log_1.default)('[Sync] WARNING: corrupt node in local cache', node);
                    if (typeof (node) === 'object' && node.path) {
                        this.addTask(node.path);
                        num++;
                    }
                }
                else if (this.needsFetch(node) && this.rs.access.checkPathPermission(node.path, 'r')) {
                    this.addTask(node.path);
                    num++;
                }
                else if ((0, util_1.isDocument)(node.path) && this.needsPush(node) &&
                    this.rs.access.checkPathPermission(node.path, 'rw')) {
                    this.addTask(node.path);
                    num++;
                }
            })
                .then(() => num)
                .catch(e => { throw e; });
        });
    }
    inConflict(node) {
        return (node.local && node.remote &&
            (node.remote.body !== undefined || node.remote.itemsMap));
    }
    needsRefresh(node) {
        if (node.common) {
            if (!node.common.timestamp) {
                return true;
            }
            return (this.now() - node.common.timestamp > config_1.default.syncInterval);
        }
        return false;
    }
    needsFetch(node) {
        if (this.inConflict(node)) {
            return true;
        }
        if (node.common &&
            node.common.itemsMap === undefined &&
            node.common.body === undefined) {
            return true;
        }
        if (node.remote &&
            node.remote.itemsMap === undefined &&
            node.remote.body === undefined) {
            return true;
        }
        return false;
    }
    needsPush(node) {
        if (this.inConflict(node)) {
            return false;
        }
        if (node.local && !node.push) {
            return true;
        }
    }
    needsRemotePut(node) {
        return node.local && node.local.body;
    }
    needsRemoteDelete(node) {
        return node.local && node.local.body === false;
    }
    getParentPath(path) {
        const parts = path.match(/^(.*\/)([^\/]+\/?)$/);
        if (parts) {
            return parts[1];
        }
        else {
            throw new Error('Not a valid path: "' + path + '"');
        }
    }
    deleteChildPathsFromTasks() {
        for (const path in this._tasks) {
            const paths = (0, util_1.pathsFromRoot)(path);
            for (let i = 1; i < paths.length; i++) {
                if (this._tasks[paths[i]]) {
                    // move pending promises to parent task
                    if (Array.isArray(this._tasks[path]) && this._tasks[path].length) {
                        Array.prototype.push.apply(this._tasks[paths[i]], this._tasks[path]);
                    }
                    delete this._tasks[path];
                }
            }
        }
    }
    collectRefreshTasks() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.rs.local.forAllNodes((node) => {
                let parentPath;
                if (this.needsRefresh(node)) {
                    try {
                        parentPath = this.getParentPath(node.path);
                    }
                    catch (e) {
                        // node.path is already '/', can't take parentPath
                    }
                    if (parentPath && this.rs.access.checkPathPermission(parentPath, 'r')) {
                        this.addTask(parentPath);
                    }
                    else if (this.rs.access.checkPathPermission(node.path, 'r')) {
                        this.addTask(node.path);
                    }
                }
            })
                .then(() => this.deleteChildPathsFromTasks())
                .catch((e) => { throw e; });
        });
    }
    flush(nodes) {
        for (const path in nodes) {
            // Strategy is 'FLUSH' and no local changes exist
            if (this.rs.caching.checkPath(path) === 'FLUSH' &&
                nodes[path] && !nodes[path].local) {
                (0, log_1.default)('[Sync] Flushing', path);
                nodes[path] = undefined; // Cause node to be flushed from cache
            }
        }
        return nodes;
    }
    doTask(path) {
        return this.rs.local.getNodes([path]).then((nodes) => {
            const node = nodes[path];
            // First fetch:
            if (typeof (node) === 'undefined') {
                return taskFor('get', path, this.rs.remote.get(path));
            }
            // Fetch known-stale child:
            else if (isStaleChild(node)) {
                return taskFor('get', path, this.rs.remote.get(path));
            }
            // Push PUT:
            else if (this.needsRemotePut(node)) {
                node.push = (0, util_1.deepClone)(node.local);
                node.push.timestamp = this.now();
                return this.rs.local.setNodes(this.flush(nodes)).then(() => {
                    let options;
                    if (hasCommonRevision(node)) {
                        options = { ifMatch: node.common.revision };
                    }
                    else {
                        // Initial PUT (fail if something is already there)
                        options = { ifNoneMatch: '*' };
                    }
                    return taskFor('put', path, this.rs.remote.put(path, node.push.body, node.push.contentType, options));
                });
            }
            // Push DELETE:
            else if (this.needsRemoteDelete(node)) {
                node.push = { body: false, timestamp: this.now() };
                return this.rs.local.setNodes(this.flush(nodes)).then(() => {
                    if (hasCommonRevision(node)) {
                        return taskFor('delete', path, this.rs.remote.delete(path, { ifMatch: node.common.revision }));
                    }
                    else { // Ascertain current common or remote revision first
                        return taskFor('get', path, this.rs.remote.get(path));
                    }
                });
            }
            // Conditional refresh:
            else if (hasCommonRevision(node)) {
                return taskFor('get', path, this.rs.remote.get(path, { ifNoneMatch: node.common.revision }));
            }
            else {
                return taskFor('get', path, this.rs.remote.get(path));
            }
        });
    }
    autoMergeFolder(node) {
        if (node.remote.itemsMap) {
            node.common = node.remote;
            delete node.remote;
            if (node.common.itemsMap) {
                for (const itemName in node.common.itemsMap) {
                    if (!node.local.itemsMap[itemName]) {
                        // Indicates the node is either newly being fetched
                        // has been deleted locally (whether or not leading to conflict);
                        // before listing it in local listings, check if a local deletion
                        // exists.
                        node.local.itemsMap[itemName] = false;
                    }
                }
                if ((0, util_1.equal)(node.local.itemsMap, node.common.itemsMap)) {
                    delete node.local;
                }
            }
        }
        return node;
    }
    autoMergeDocument(node) {
        if (hasNoRemoteChanges(node)) {
            node = mergeMutualDeletion(node);
            delete node.remote;
        }
        else if (node.remote.body !== undefined) {
            // keep/revert:
            (0, log_1.default)('[Sync] Emitting keep/revert');
            this.rs.local._emitChange({
                origin: 'conflict',
                path: node.path,
                oldValue: node.local.body,
                newValue: node.remote.body,
                lastCommonValue: node.common.body,
                oldContentType: node.local.contentType,
                newContentType: node.remote.contentType,
                lastCommonContentType: node.common.contentType
            });
            if (node.remote.body) {
                node.common = node.remote;
            }
            else {
                node.common = {};
            }
            delete node.remote;
            delete node.local;
        }
        return node;
    }
    autoMerge(node) {
        if (node.remote) {
            if (node.local) {
                if ((0, util_1.isFolder)(node.path)) {
                    return this.autoMergeFolder(node);
                }
                else {
                    return this.autoMergeDocument(node);
                }
            }
            else { // no local changes
                if ((0, util_1.isFolder)(node.path)) {
                    if (node.remote.itemsMap !== undefined) {
                        node.common = node.remote;
                        delete node.remote;
                    }
                }
                else {
                    if (node.remote.body !== undefined) {
                        const change = {
                            origin: 'remote',
                            path: node.path,
                            oldValue: (node.common.body === false ? undefined : node.common.body),
                            newValue: (node.remote.body === false ? undefined : node.remote.body),
                            oldContentType: node.common.contentType,
                            newContentType: node.remote.contentType
                        };
                        if (change.oldValue || change.newValue) {
                            this.rs.local._emitChange(change);
                        }
                        if (!node.remote.body) { // no remote, so delete/don't create
                            return;
                        }
                        node.common = node.remote;
                        delete node.remote;
                    }
                }
            }
        }
        else {
            if (node.common.body) {
                this.rs.local._emitChange({
                    origin: 'remote',
                    path: node.path,
                    oldValue: node.common.body,
                    newValue: undefined,
                    oldContentType: node.common.contentType,
                    newContentType: undefined
                });
            }
            return undefined;
        }
        return node;
    }
    updateCommonTimestamp(path, revision) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.rs.local.getNodes([path]).then((nodes) => {
                if (nodes[path] &&
                    nodes[path].common &&
                    nodes[path].common.revision === revision) {
                    nodes[path].common.timestamp = this.now();
                }
                return this.rs.local.setNodes(this.flush(nodes));
            });
        });
    }
    markChildren(path, itemsMap, changedNodes, missingChildren) {
        return __awaiter(this, void 0, void 0, function* () {
            const paths = [];
            const meta = {};
            const recurse = {};
            for (const item in itemsMap) {
                paths.push(path + item);
                meta[path + item] = itemsMap[item];
            }
            for (const childName in missingChildren) {
                paths.push(path + childName);
            }
            return this.rs.local.getNodes(paths).then((nodes) => {
                let cachingStrategy;
                let node;
                for (const nodePath in nodes) {
                    node = nodes[nodePath];
                    if (meta[nodePath]) {
                        if (node && node.common) {
                            if (nodeChanged(node, meta[nodePath].ETag)) {
                                changedNodes[nodePath] = (0, util_1.deepClone)(node);
                                changedNodes[nodePath].remote = {
                                    revision: meta[nodePath].ETag,
                                    timestamp: this.now()
                                };
                                changedNodes[nodePath] = this.autoMerge(changedNodes[nodePath]);
                            }
                        }
                        else {
                            cachingStrategy = this.rs.caching.checkPath(nodePath);
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
                    }
                    else if (missingChildren[nodePath.substring(path.length)] && node && node.common) {
                        if (node.common.itemsMap) {
                            for (const commonItem in node.common.itemsMap) {
                                recurse[nodePath + commonItem] = true;
                            }
                        }
                        if (node.local && node.local.itemsMap) {
                            for (const localItem in node.local.itemsMap) {
                                recurse[nodePath + localItem] = true;
                            }
                        }
                        if (node.remote || (0, util_1.isFolder)(nodePath)) {
                            changedNodes[nodePath] = undefined;
                        }
                        else {
                            changedNodes[nodePath] = this.autoMerge(node);
                            if (typeof changedNodes[nodePath] === 'undefined') {
                                const parentPath = this.getParentPath(nodePath);
                                const parentNode = changedNodes[parentPath];
                                const itemName = nodePath.substring(path.length);
                                if (parentNode && parentNode.local) {
                                    delete parentNode.local.itemsMap[itemName];
                                    if ((0, util_1.equal)(parentNode.local.itemsMap, parentNode.common.itemsMap)) {
                                        delete parentNode.local;
                                    }
                                }
                            }
                        }
                    }
                }
                return this.deleteRemoteTrees(Object.keys(recurse), changedNodes)
                    .then(changedObjs2 => {
                    return this.rs.local.setNodes(this.flush(changedObjs2));
                });
            });
        });
    }
    deleteRemoteTrees(paths, changedNodes) {
        return __awaiter(this, void 0, void 0, function* () {
            if (paths.length === 0) {
                return Promise.resolve(changedNodes);
            }
            return this.rs.local.getNodes(paths).then((nodes) => __awaiter(this, void 0, void 0, function* () {
                const subPaths = {};
                function collectSubPaths(folder, path) {
                    if (folder && folder.itemsMap) {
                        for (const itemName in folder.itemsMap) {
                            subPaths[path + itemName] = true;
                        }
                    }
                }
                for (const path in nodes) {
                    const node = nodes[path];
                    // TODO Why check for the node here? I don't think this check ever applies
                    if (!node) {
                        continue;
                    }
                    if ((0, util_1.isFolder)(path)) {
                        collectSubPaths(node.common, path);
                        collectSubPaths(node.local, path);
                    }
                    else {
                        if (node.common && typeof (node.common.body) !== undefined) {
                            changedNodes[path] = (0, util_1.deepClone)(node);
                            changedNodes[path].remote = {
                                body: false,
                                timestamp: this.now()
                            };
                            changedNodes[path] = this.autoMerge(changedNodes[path]);
                        }
                    }
                }
                // Recurse whole tree depth levels at once:
                return this.deleteRemoteTrees(Object.keys(subPaths), changedNodes)
                    .then(changedNodes2 => {
                    return this.rs.local.setNodes(this.flush(changedNodes2));
                });
            }));
        });
    }
    completeFetch(path, bodyOrItemsMap, contentType, revision) {
        return __awaiter(this, void 0, void 0, function* () {
            let paths;
            let parentPath;
            const pathsFromRootArr = (0, util_1.pathsFromRoot)(path);
            if ((0, util_1.isFolder)(path)) {
                paths = [path];
            }
            else {
                parentPath = pathsFromRootArr[1];
                paths = [path, parentPath];
            }
            return this.rs.local.getNodes(paths).then((nodes) => {
                let itemName;
                let node = nodes[path];
                let parentNode;
                const missingChildren = {};
                function collectMissingChildren(folder) {
                    if (folder && folder.itemsMap) {
                        for (itemName in folder.itemsMap) {
                            if (!bodyOrItemsMap[itemName]) {
                                missingChildren[itemName] = true;
                            }
                        }
                    }
                }
                if (typeof (node) !== 'object' ||
                    node.path !== path ||
                    typeof (node.common) !== 'object') {
                    node = { path: path, common: {} };
                    nodes[path] = node;
                }
                node.remote = {
                    revision: revision,
                    timestamp: this.now()
                };
                if ((0, util_1.isFolder)(path)) {
                    collectMissingChildren(node.common);
                    collectMissingChildren(node.remote);
                    node.remote.itemsMap = {};
                    for (itemName in bodyOrItemsMap) {
                        node.remote.itemsMap[itemName] = true;
                    }
                }
                else {
                    node.remote.body = bodyOrItemsMap;
                    node.remote.contentType = contentType;
                    parentNode = nodes[parentPath];
                    if (parentNode && parentNode.local && parentNode.local.itemsMap) {
                        itemName = path.substring(parentPath.length);
                        parentNode.local.itemsMap[itemName] = true;
                        if ((0, util_1.equal)(parentNode.local.itemsMap, parentNode.common.itemsMap)) {
                            delete parentNode.local;
                        }
                    }
                }
                nodes[path] = this.autoMerge(node);
                return {
                    toBeSaved: nodes,
                    missingChildren: missingChildren
                };
            });
        });
    }
    completePush(path, action, conflict, revision) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.rs.local.getNodes([path]).then((nodes) => {
                const node = nodes[path];
                if (!node.push) {
                    this.stopped = true;
                    throw new Error('completePush called but no push version!');
                }
                if (conflict) {
                    (0, log_1.default)('[Sync] We have a conflict');
                    if (!node.remote || node.remote.revision !== revision) {
                        node.remote = {
                            revision: revision || 'conflict',
                            timestamp: this.now()
                        };
                        delete node.push;
                    }
                    nodes[path] = this.autoMerge(node);
                }
                else {
                    node.common = {
                        revision: revision,
                        timestamp: this.now()
                    };
                    if (action === 'put') {
                        node.common.body = node.push.body;
                        node.common.contentType = node.push.contentType;
                        if ((0, util_1.equal)(node.local.body, node.push.body) &&
                            node.local.contentType === node.push.contentType) {
                            delete node.local;
                        }
                        delete node.push;
                    }
                    else if (action === 'delete') {
                        if (node.local.body === false) { // No new local changes since push; flush it.
                            nodes[path] = undefined;
                        }
                        else {
                            delete node.push;
                        }
                    }
                }
                return this.rs.local.setNodes(this.flush(nodes));
            });
        });
    }
    dealWithFailure(path) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.rs.local.getNodes([path]).then((nodes) => {
                if (nodes[path]) {
                    delete nodes[path].push;
                    return this.rs.local.setNodes(this.flush(nodes));
                }
            });
        });
    }
    interpretStatus(statusCode) {
        const status = {
            statusCode: statusCode,
            successful: undefined,
            conflict: undefined,
            unAuth: undefined,
            notFound: undefined,
            changed: undefined,
            networkProblems: undefined
        };
        if (typeof statusCode === 'string' &&
            (statusCode === 'offline' || statusCode === 'timeout')) {
            status.successful = false;
            status.networkProblems = true;
            return status;
        }
        else if (typeof statusCode === 'number') {
            const series = Math.floor(statusCode / 100);
            status.successful = (series === 2 ||
                statusCode === 304 ||
                statusCode === 412 ||
                statusCode === 404),
                status.conflict = (statusCode === 412);
            status.unAuth = ((statusCode === 401 && this.rs.remote.token !== authorize_1.default.IMPLIED_FAKE_TOKEN) ||
                statusCode === 402 ||
                statusCode === 403);
            status.notFound = (statusCode === 404);
            status.changed = (statusCode !== 304);
            return status;
        }
    }
    handleGetResponse(path, status, bodyOrItemsMap, contentType, revision) {
        return __awaiter(this, void 0, void 0, function* () {
            if (status.notFound) {
                if ((0, util_1.isFolder)(path)) {
                    bodyOrItemsMap = {};
                }
                else {
                    bodyOrItemsMap = false;
                }
            }
            if (status.changed) {
                return this.completeFetch(path, bodyOrItemsMap, contentType, revision)
                    .then(dataFromFetch => {
                    if ((0, util_1.isFolder)(path)) {
                        if (this.corruptServerItemsMap(bodyOrItemsMap)) {
                            (0, log_1.default)('[Sync] WARNING: Discarding corrupt folder description from server for ' + path);
                            return false;
                        }
                        else {
                            return this.markChildren(path, bodyOrItemsMap, dataFromFetch.toBeSaved, dataFromFetch.missingChildren)
                                .then(() => { return true; });
                        }
                    }
                    else {
                        return this.rs.local.setNodes(this.flush(dataFromFetch.toBeSaved))
                            .then(() => { return true; });
                    }
                });
            }
            else {
                return this.updateCommonTimestamp(path, revision)
                    .then(() => { return true; });
            }
        });
    }
    handleResponse(path, action, r) {
        const status = this.interpretStatus(r.statusCode);
        if (status.successful) {
            if (action === 'get') {
                return this.handleGetResponse(path, status, r.body, r.contentType, r.revision);
            }
            else if (action === 'put' || action === 'delete') {
                return this.completePush(path, action, status.conflict, r.revision).then(function () {
                    return true;
                });
            }
            else {
                throw new Error(`cannot handle response for unknown action ${action}`);
            }
        }
        else {
            // Unsuccessful
            let error;
            if (status.unAuth) {
                error = new unauthorized_error_1.default();
            }
            else if (status.networkProblems) {
                error = new sync_error_1.default('Network request failed.');
            }
            else {
                error = new Error('HTTP response code ' + status.statusCode + ' received.');
            }
            return this.dealWithFailure(path).then(() => {
                this.rs._emit('error', error);
                throw error;
            });
        }
    }
    finishTask(task, queueTask = true) {
        if (task.action === undefined) {
            delete this._running[task.path];
            return;
        }
        if (queueTask) {
            (0, log_1.default)("[Sync] queue finished task:", task.path);
            this._finishedTasks.push(task);
            if (this._finishedTasks.length > 1) {
                (0, log_1.default)("[Sync] delaying finished task:", task.path);
                return;
            }
        }
        (0, log_1.default)("[Sync] run task:", task.path);
        return task.promise
            .then(res => {
            return this.handleResponse(task.path, task.action, res);
        }, err => {
            (0, log_1.default)('[Sync] wireclient rejects its promise!', task.path, task.action, err);
            return this.handleResponse(task.path, task.action, { statusCode: 'offline' });
        })
            .then((completed) => __awaiter(this, void 0, void 0, function* () {
            this._finishedTasks.shift();
            delete this._timeStarted[task.path];
            delete this._running[task.path];
            if (completed) {
                if (this._tasks[task.path]) {
                    for (let i = 0; i < this._tasks[task.path].length; i++) {
                        this._tasks[task.path][i]();
                    }
                    delete this._tasks[task.path];
                }
            }
            this.rs._emit('sync-req-done', {
                tasksRemaining: Object.keys(this._tasks).length
            });
            if (this._finishedTasks.length > 0) {
                this.finishTask(this._finishedTasks[0], false);
                return;
            }
            yield this.collectTasks(false).then(() => {
                // See if there are any more tasks that are not refresh tasks
                if (!this.hasTasks() || this.stopped) {
                    (0, log_1.default)('[Sync] Sync is done! Reschedule?', Object.getOwnPropertyNames(this._tasks).length, this.stopped);
                    if (!this.done) {
                        this.done = true;
                        this.rs._emit('sync-done', { completed: true });
                    }
                }
                else {
                    // Use a 10ms timeout to let the JavaScript runtime catch its breath
                    // (and hopefully force an IndexedDB auto-commit?), and also to cause
                    // the threads to get staggered and get a good spread over time:
                    setTimeout(() => { this.doTasks(); }, 10);
                }
            });
        }), err => {
            (0, log_1.default)('[Sync] Error', err);
            this._finishedTasks.shift();
            delete this._timeStarted[task.path];
            delete this._running[task.path];
            this.rs._emit('sync-req-done', {
                tasksRemaining: Object.keys(this._tasks).length
            });
            if (this._finishedTasks.length > 0) {
                this.finishTask(this._finishedTasks[0], false);
                return;
            }
            if (!this.done) {
                this.done = true;
                this.rs._emit('sync-done', { completed: false });
            }
        });
    }
    doTasks() {
        let numToHave, numAdded = 0, path;
        if (this.rs.remote.connected) {
            if (this.rs.remote.online) {
                numToHave = this.numThreads;
            }
            else {
                numToHave = 1;
            }
        }
        else {
            numToHave = 0;
        }
        const numToAdd = numToHave - Object.getOwnPropertyNames(this._running).length;
        if (numToAdd <= 0) {
            return true;
        }
        for (path in this._tasks) {
            if (!this._running[path]) {
                this._timeStarted[path] = this.now();
                this._running[path] = this.doTask(path);
                this._running[path].then(this.finishTask.bind(this));
                numAdded++;
                if (numAdded >= numToAdd) {
                    return true;
                }
            }
        }
        return (numAdded >= numToAdd);
    }
    collectTasks(alsoCheckRefresh) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.hasTasks() || this.stopped) {
                return Promise.resolve();
            }
            return this.collectDiffTasks().then(numDiffs => {
                if (numDiffs || alsoCheckRefresh === false) {
                    return Promise.resolve();
                }
                else {
                    return this.collectRefreshTasks();
                }
            }, function (err) { throw err; });
        });
    }
    addTask(path, cb) {
        if (!this._tasks[path]) {
            this._tasks[path] = [];
        }
        if (typeof (cb) === 'function') {
            this._tasks[path].push(cb);
        }
    }
    /**
     * Method: sync
     **/
    sync() {
        this.done = false;
        if (!this.doTasks()) {
            return this.collectTasks().then(() => {
                try {
                    this.doTasks();
                }
                catch (e) {
                    (0, log_1.default)('[Sync] doTasks error', e);
                }
            }, function (e) {
                (0, log_1.default)('[Sync] Sync error', e);
                throw new Error('Local cache unavailable');
            });
        }
        else {
            return Promise.resolve();
        }
    }
    static _rs_init(remoteStorage) {
        syncCycleCb = function () {
            // if (!config.cache) return false
            (0, log_1.default)('[Sync] syncCycleCb calling syncCycle');
            const env = new env_1.default();
            if (env.isBrowser()) {
                handleVisibility(env, remoteStorage);
            }
            if (!remoteStorage.sync) {
                // Call this now that all other modules are also ready:
                remoteStorage.sync = new Sync(remoteStorage);
                if (remoteStorage.syncStopped) {
                    (0, log_1.default)('[Sync] Instantiating sync stopped');
                    remoteStorage.sync.stopped = true;
                    delete remoteStorage.syncStopped;
                }
            }
            (0, log_1.default)('[Sync] syncCycleCb calling syncCycle');
            remoteStorage.syncCycle();
        };
        syncOnConnect = function () {
            remoteStorage.removeEventListener('connected', syncOnConnect);
            remoteStorage.startSync();
        };
        remoteStorage.on('ready', syncCycleCb);
        remoteStorage.on('connected', syncOnConnect);
    }
    static _rs_cleanup(remoteStorage) {
        remoteStorage.stopSync();
        remoteStorage.removeEventListener('ready', syncCycleCb);
        remoteStorage.removeEventListener('connected', syncOnConnect);
        remoteStorage.sync = undefined;
        delete remoteStorage.sync;
    }
}
(0, util_1.applyMixins)(Sync, [eventhandling_1.default]);
module.exports = Sync;


/***/ }),

/***/ "./src/syncedgetputdelete.ts":
/*!***********************************!*\
  !*** ./src/syncedgetputdelete.ts ***!
  \***********************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const log_1 = __importDefault(__webpack_require__(/*! ./log */ "./src/log.ts"));
function shareFirst(path) {
    return (this.backend === 'dropbox' &&
        !!path.match(/^\/public\/.*[^\/]$/));
}
function defaultMaxAge(context) {
    if ((typeof context.remote === 'object') &&
        context.remote.connected && context.remote.online) {
        return 2 * context.getSyncInterval();
    }
    else {
        (0, log_1.default)('Not setting default maxAge, because remote is offline or not connected');
        return false;
    }
}
const SyncedGetPutDelete = {
    get: function (path, maxAge) {
        if (!this.local) {
            return this.remote.get(path);
        }
        else {
            if (typeof maxAge === 'undefined') {
                maxAge = defaultMaxAge(this);
            }
            else if (typeof maxAge !== 'number' && maxAge !== false) {
                return Promise.reject(`Argument 'maxAge' must be 'false' or a number`);
            }
            return this.local.get(path, maxAge, this.sync.queueGetRequest.bind(this.sync));
        }
    },
    put: function (path, body, contentType) {
        if (shareFirst.bind(this)(path)) {
            return SyncedGetPutDelete._wrapBusyDone.call(this, this.remote.put(path, body, contentType));
        }
        else if (this.local) {
            return this.local.put(path, body, contentType);
        }
        else {
            return SyncedGetPutDelete._wrapBusyDone.call(this, this.remote.put(path, body, contentType));
        }
    },
    'delete': function (path) {
        if (this.local) {
            return this.local.delete(path);
        }
        else {
            return SyncedGetPutDelete._wrapBusyDone.call(this, this.remote.delete(path));
        }
    },
    _wrapBusyDone: function (result) {
        return __awaiter(this, void 0, void 0, function* () {
            this._emit('wire-busy');
            return result.then((r) => {
                this._emit('wire-done', { success: true });
                return Promise.resolve(r);
            }, (err) => {
                this._emit('wire-done', { success: false });
                return Promise.reject(err);
            });
        });
    }
};
module.exports = SyncedGetPutDelete;


/***/ }),

/***/ "./src/types.ts":
/*!**********************!*\
  !*** ./src/types.ts ***!
  \**********************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseClientTypes = void 0;
/**
 * - Manages and validates types of remoteStorage objects, using JSON-LD and
 *   JSON Schema
 * - Adds schema declaration/validation methods to BaseClient instances.
 **/
class BaseClientTypes {
    constructor() {
        /**
         * <alias> -> <uri>
         */
        this.uris = {};
        /**
         * Contains schema objects of all types known to the BaseClient instance
         *
         * <uri> -> <schema>
         */
        this.schemas = {};
        /**
         * <uri> -> <alias>
         */
        this.aliases = {};
    }
    /**
     * Called via public function BaseClient.declareType()
     *
     * @private
     */
    declare(moduleName, alias, uri, schema) {
        const fullAlias = moduleName + '/' + alias;
        if (schema.extends) {
            const parts = schema.extends.split('/');
            const extendedAlias = (parts.length === 1)
                ? moduleName + '/' + parts.shift()
                : parts.join('/');
            const extendedUri = this.uris[extendedAlias];
            if (!extendedUri) {
                throw "Type '" + fullAlias + "' tries to extend unknown schema '" + extendedAlias + "'";
            }
            schema.extends = this.schemas[extendedUri];
        }
        this.uris[fullAlias] = uri;
        this.aliases[uri] = fullAlias;
        this.schemas[uri] = schema;
    }
    resolveAlias(alias) {
        return this.uris[alias];
    }
    getSchema(uri) {
        return this.schemas[uri];
    }
    inScope(moduleName) {
        const ml = moduleName.length;
        const schemas = {};
        for (const alias in this.uris) {
            if (alias.substr(0, ml + 1) === moduleName + '/') {
                const uri = this.uris[alias];
                schemas[uri] = this.schemas[uri];
            }
        }
        return schemas;
    }
}
exports.BaseClientTypes = BaseClientTypes;
const Types = new BaseClientTypes();
exports.default = Types;


/***/ }),

/***/ "./src/unauthorized-error.ts":
/*!***********************************!*\
  !*** ./src/unauthorized-error.ts ***!
  \***********************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

class UnauthorizedError extends Error {
    constructor(message, options = {}) {
        super();
        this.name = 'Unauthorized';
        if (typeof message === 'undefined') {
            this.message = 'App authorization expired or revoked.';
        }
        else {
            this.message = message;
        }
        if (typeof options.code !== 'undefined') {
            this.code = options.code;
        }
        this.stack = (new Error()).stack;
    }
}
module.exports = UnauthorizedError;


/***/ }),

/***/ "./src/util.ts":
/*!*********************!*\
  !*** ./src/util.ts ***!
  \*********************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(global, Buffer) {
// Reusable utility functions
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyMixins = exports.generateCodeVerifier = exports.toBase64 = exports.getTextFromArrayBuffer = exports.shouldBeTreatedAsBinary = exports.getJSONFromLocalStorage = exports.localStorageAvailable = exports.pathsFromRoot = exports.deepClone = exports.equal = exports.bindAll = exports.cleanPath = exports.baseName = exports.isDocument = exports.isFolder = exports.containingFolder = exports.extend = exports.getGlobalContext = exports.globalContext = exports.logError = void 0;
/**
 * Takes an object and its copy as produced by the _deepClone function
 * below, and finds and fixes any ArrayBuffers that were cast to `{}` instead
 * of being cloned to new ArrayBuffers with the same content.
 *
 * It recurses into sub-objects, but skips arrays if they occur.
 */
function _fixArrayBuffers(srcObj, dstObj) {
    if (typeof (srcObj) !== 'object' || Array.isArray(srcObj) || srcObj === null) {
        return;
    }
    for (const field in srcObj) {
        if (typeof (srcObj[field]) === 'object' && srcObj[field] !== null) {
            if (srcObj[field].toString() === '[object ArrayBuffer]') {
                dstObj[field] = new ArrayBuffer(srcObj[field].byteLength);
                const srcArr = new Int8Array(srcObj[field]);
                const dstArr = new Int8Array(dstObj[field]);
                dstArr.set(srcArr);
            }
            else {
                _fixArrayBuffers(srcObj[field], dstObj[field]);
            }
        }
    }
}
const logError = (error) => {
    if (typeof (error) === 'string') {
        console.error(error);
    }
    else {
        console.error(error.message, error.stack);
    }
};
exports.logError = logError;
exports.globalContext = (typeof (window) !== 'undefined' ? window : (typeof self === 'object' ? self : global));
const getGlobalContext = () => {
    return (typeof (window) !== 'undefined' ? window : (typeof self === 'object' ? self : global));
};
exports.getGlobalContext = getGlobalContext;
// TODO Remove in favor of modern JS:
// `const mergedObject = { ...obj1, ..obj2 }`
const extend = (...args) => {
    const target = args[0];
    const sources = Array.prototype.slice.call(args, 1);
    sources.forEach(function (source) {
        for (const key in source) {
            target[key] = source[key];
        }
    });
    return target;
};
exports.extend = extend;
const containingFolder = (path) => {
    if (path === '') {
        return '/';
    }
    if (!path) {
        throw "Path not given!";
    }
    return path.replace(/\/+/g, '/')
        .replace(/[^\/]+\/?$/, '');
};
exports.containingFolder = containingFolder;
const isFolder = (path) => {
    return path.slice(-1) === '/';
};
exports.isFolder = isFolder;
const isDocument = (path) => {
    return !(0, exports.isFolder)(path);
};
exports.isDocument = isDocument;
const baseName = (path) => {
    const parts = path.split('/');
    if ((0, exports.isFolder)(path)) {
        return parts[parts.length - 2] + '/';
    }
    else {
        return parts[parts.length - 1];
    }
};
exports.baseName = baseName;
const cleanPath = (path) => {
    return path.replace(/\/+/g, '/')
        .split('/').map(encodeURIComponent).join('/')
        .replace(/'/g, '%27');
};
exports.cleanPath = cleanPath;
const bindAll = (object) => {
    for (const key in this) {
        if (typeof (object[key]) === 'function') {
            object[key] = object[key].bind(object);
        }
    }
};
exports.bindAll = bindAll;
const equal = (a, b, seen = []) => {
    let key;
    if (typeof (a) !== typeof (b)) {
        return false;
    }
    if (typeof (a) === 'number' || typeof (a) === 'boolean' || typeof (a) === 'string') {
        return a === b;
    }
    if (typeof (a) === 'function') {
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
        for (let i = 0, c = a.length; i < c; i++) {
            if (!(0, exports.equal)(a[i], b[i], seen)) {
                return false;
            }
        }
    }
    else {
        // Check that keys from a exist in b
        for (key in a) {
            if (a.hasOwnProperty(key) && !(key in b)) {
                return false;
            }
        }
        // Check that keys from b exist in a, and compare the values
        for (key in b) {
            if (!b.hasOwnProperty(key)) {
                continue;
            }
            if (!(key in a)) {
                return false;
            }
            let seenArg;
            if (typeof (b[key]) === 'object') {
                if (seen.indexOf(b[key]) >= 0) {
                    // Circular reference, don't attempt to compare this object.
                    // If nothing else returns false, the objects match.
                    continue;
                }
                seenArg = seen.slice();
                seenArg.push(b[key]);
            }
            if (!(0, exports.equal)(a[key], b[key], seenArg)) {
                return false;
            }
        }
    }
    return true;
};
exports.equal = equal;
const deepClone = (obj) => {
    if (obj === undefined) {
        return undefined;
    }
    else {
        const clone = JSON.parse(JSON.stringify(obj));
        _fixArrayBuffers(obj, clone);
        return clone;
    }
};
exports.deepClone = deepClone;
const pathsFromRoot = (path) => {
    const paths = [path];
    const parts = path.replace(/\/$/, '').split('/');
    while (parts.length > 1) {
        parts.pop();
        paths.push(parts.join('/') + '/');
    }
    return paths;
};
exports.pathsFromRoot = pathsFromRoot;
const localStorageAvailable = () => {
    const context = (0, exports.getGlobalContext)();
    if (!('localStorage' in context)) {
        return false;
    }
    try {
        context.localStorage.setItem('rs-check', '1');
        context.localStorage.removeItem('rs-check');
        return true;
    }
    catch (error) {
        return false;
    }
};
exports.localStorageAvailable = localStorageAvailable;
/**
 * Extract and parse JSON data from localStorage.
 *
 * @param {string} key - localStorage key
 *
 * @returns {object} parsed object or undefined
 */
const getJSONFromLocalStorage = (key) => {
    const context = (0, exports.getGlobalContext)();
    try {
        return JSON.parse(context.localStorage.getItem(key));
    }
    catch (e) {
        // no JSON stored
    }
};
exports.getJSONFromLocalStorage = getJSONFromLocalStorage;
/**
 * Decide if data should be treated as binary based on the content (presence of non-printable characters
 * or replacement character) and content-type.
 *
 * @param {string} content - The data
 * @param {string} mimeType - The data's content-type
 *
 * @returns {boolean}
 */
const shouldBeTreatedAsBinary = (content, mimeType) => {
    // eslint-disable-next-line no-control-regex
    return !!((mimeType && mimeType.match(/charset=binary/)) || /[\x00-\x08\x0E-\x1F\uFFFD]/.test(content));
};
exports.shouldBeTreatedAsBinary = shouldBeTreatedAsBinary;
/**
 * Read data from an ArrayBuffer and return it as a string
 * @param {ArrayBuffer} arrayBuffer
 * @param {string} encoding
 * @returns {Promise} Resolves with a string containing the data
 */
const getTextFromArrayBuffer = (arrayBuffer, encoding) => {
    return new Promise((resolve /*, reject*/) => {
        if (typeof Blob === 'undefined') {
            const buffer = Buffer.from(arrayBuffer);
            resolve(buffer.toString(encoding));
        }
        else {
            let blob;
            const gc = exports.globalContext;
            // TODO fix as BlobBuilder is not available in all browsers
            // @see https://developer.mozilla.org/en-US/docs/Web/API/BlobBuilder
            gc.BlobBuilder = gc.BlobBuilder || gc.WebKitBlobBuilder;
            if (typeof gc.BlobBuilder !== 'undefined') {
                const bb = new gc.BlobBuilder();
                bb.append(arrayBuffer);
                blob = bb.getBlob();
            }
            else {
                blob = new Blob([arrayBuffer]);
            }
            const fileReader = new FileReader();
            if (typeof fileReader.addEventListener === 'function') {
                fileReader.addEventListener('loadend', function (evt) {
                    resolve(evt.target.result);
                });
            }
            else {
                fileReader.onloadend = function (evt) {
                    resolve(evt.target.result);
                };
            }
            fileReader.readAsText(blob, encoding);
        }
    });
};
exports.getTextFromArrayBuffer = getTextFromArrayBuffer;
/**
 * Encode string in base64
 * @param {String} str
 * @returns {String} base64-encoded string
 */
const toBase64 = (str) => {
    const context = (0, exports.getGlobalContext)();
    if ('btoa' in context) {
        return context['btoa'](str);
    }
    else {
        return Buffer.from(str).toString('base64');
    }
};
exports.toBase64 = toBase64;
/**
 * Generates values required for OAuth2 PKCE in a cryptographically secure manner.
 * @param {number} [numChar=128] - length of codeVerifier to generate; from 43 to 128
 *
 * @typedef {Object} PkceValues
 * @property {string} codeVerifier - 43 to 128 chars from the 66-char set
 * @property {string} codeChallenge - verifier hashed & base-64 URL encoded
 * @property {string} state - a separate random value. Should be used to check redirect_uri.
 * @returns PkceValues
 */
function generateCodeVerifier(numChar = 128) {
    return __awaiter(this, void 0, void 0, function* () {
        const randomBytes = new Uint8Array(numChar);
        crypto.getRandomValues(randomBytes);
        const charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        const randomChar = Array.from(randomBytes).map(byte => charSet[byte % charSet.length]);
        const codeVerifier = randomChar.join('');
        const charsAsBytes = Uint8Array.from(randomChar.map(ch => ch.charCodeAt(0)));
        const sha256hash = yield crypto.subtle.digest('SHA-256', charsAsBytes);
        const codeChallenge = base64Urlencode(sha256hash);
        crypto.getRandomValues(randomBytes);
        const stateRandomChar = Array.from(randomBytes).map(byte => charSet[byte % charSet.length]);
        const state = stateRandomChar.join('');
        return { codeVerifier, codeChallenge, state };
    });
}
exports.generateCodeVerifier = generateCodeVerifier;
function base64Urlencode(str) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(str)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}
/*
 * Apply mixins to an object
 *
 * https://www.typescriptlang.org/docs/handbook/mixins.html
 *
 * @param {object} Parent object
 * @param {Array} Mixins to apply methods from
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyMixins(derivedCtor, baseCtors) {
    baseCtors.forEach(baseCtor => {
        Object.getOwnPropertyNames(baseCtor.prototype).forEach(name => {
            Object.defineProperty(derivedCtor.prototype, name, Object.getOwnPropertyDescriptor(baseCtor.prototype, name));
        });
    });
}
exports.applyMixins = applyMixins;

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./../node_modules/webpack/buildin/global.js */ "./node_modules/webpack/buildin/global.js"), __webpack_require__(/*! ./../node_modules/buffer/index.js */ "./node_modules/buffer/index.js").Buffer))

/***/ }),

/***/ "./src/wireclient.ts":
/*!***************************!*\
  !*** ./src/wireclient.ts ***!
  \***************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const authorize_1 = __importDefault(__webpack_require__(/*! ./authorize */ "./src/authorize.ts"));
const eventhandling_1 = __importDefault(__webpack_require__(/*! ./eventhandling */ "./src/eventhandling.ts"));
const unauthorized_error_1 = __importDefault(__webpack_require__(/*! ./unauthorized-error */ "./src/unauthorized-error.ts"));
const log_1 = __importDefault(__webpack_require__(/*! ./log */ "./src/log.ts"));
const util_1 = __webpack_require__(/*! ./util */ "./src/util.ts");
const requests_1 = __webpack_require__(/*! ./requests */ "./src/requests.ts");
const remote_1 = __webpack_require__(/*! ./remote */ "./src/remote.ts");
let hasLocalStorage;
const SETTINGS_KEY = 'remotestorage:wireclient';
const API_2012 = 1;
const API_00 = 2;
const API_01 = 3;
const API_02 = 4;
const API_HEAD = 5;
const STORAGE_APIS = {
    'draft-dejong-remotestorage-00': API_00,
    'draft-dejong-remotestorage-01': API_01,
    'draft-dejong-remotestorage-02': API_02,
    'https://www.w3.org/community/rww/wiki/read-write-web-00#simple': API_2012
};
function readSettings() {
    const settings = (0, util_1.getJSONFromLocalStorage)(SETTINGS_KEY) || {};
    const { userAddress, href, storageApi, token, properties } = settings;
    return { userAddress, href, storageApi, token, properties };
}
function determineCharset(mimeType) {
    let charset = 'utf-8';
    let charsetMatch;
    if (mimeType) {
        charsetMatch = mimeType.match(/charset=(.+)$/);
        if (charsetMatch) {
            charset = charsetMatch[1];
        }
    }
    return charset;
}
function isFolderDescription(body) {
    return ((body['@context'] === 'http://remotestorage.io/spec/folder-description')
        && (typeof (body['items']) === 'object'));
}
function isSuccessStatus(status) {
    return [201, 204, 304].indexOf(status) >= 0;
}
function isErrorStatus(status) {
    return [401, 403, 404, 412].indexOf(status) >= 0;
}
class WireClient extends remote_1.RemoteBase {
    constructor(rs) {
        super(rs);
        this._revisionCache = {};
        hasLocalStorage = (0, util_1.localStorageAvailable)();
        /**
         * Event: connected
         *   Fired when the wireclient connect method realizes that it is in
         *   possession of a token and href
         **/
        this.addEvents(['connected', 'not-connected']);
        if (hasLocalStorage) {
            const settings = readSettings();
            if (settings) {
                setTimeout(() => {
                    this.configure(settings);
                }, 0);
            }
        }
        if (this.connected) {
            setTimeout(this._emit.bind(this), 0, 'connected');
        }
    }
    get storageType() {
        if (this.storageApi) {
            const spec = this.storageApi.match(/draft-dejong-(remotestorage-\d\d)/);
            return spec ? spec[1] : '2012.04';
        }
        else {
            return undefined;
        }
    }
    _request(method, uri, token, headers, body, getEtag, fakeRevision) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isForbiddenRequestMethod(method, uri)) {
                return Promise.reject(`Don't use ${method} on directories!`);
            }
            let revision;
            if (token !== authorize_1.default.IMPLIED_FAKE_TOKEN) {
                headers['Authorization'] = 'Bearer ' + token;
            }
            this.rs._emit('wire-busy', {
                method: method,
                isFolder: (0, util_1.isFolder)(uri)
            });
            return (0, requests_1.requestWithTimeout)(method, uri, {
                body: body,
                headers: headers,
                responseType: 'arraybuffer'
            }).then((response) => {
                if (!this.online) {
                    this.online = true;
                    this.rs._emit('network-online');
                }
                this.rs._emit('wire-done', {
                    method: method,
                    isFolder: (0, util_1.isFolder)(uri),
                    success: true
                });
                if (isErrorStatus(response.status)) {
                    (0, log_1.default)('[WireClient] Error response status', response.status);
                    if (getEtag) {
                        revision = this.stripQuotes(response.getResponseHeader('ETag'));
                    }
                    else {
                        revision = undefined;
                    }
                    if (response.status === 401) {
                        this.rs._emit('error', new unauthorized_error_1.default());
                    }
                    return Promise.resolve({ statusCode: response.status, revision: revision });
                }
                else if (isSuccessStatus(response.status) ||
                    (response.status === 200 && method !== 'GET')) {
                    revision = this.stripQuotes(response.getResponseHeader('ETag'));
                    (0, log_1.default)('[WireClient] Successful request', revision);
                    return Promise.resolve({ statusCode: response.status, revision: revision });
                }
                else {
                    const mimeType = response.getResponseHeader('Content-Type');
                    if (getEtag) {
                        revision = this.stripQuotes(response.getResponseHeader('ETag'));
                    }
                    else {
                        revision = (response.status === 200) ? fakeRevision : undefined;
                    }
                    const charset = determineCharset(mimeType);
                    if ((0, util_1.shouldBeTreatedAsBinary)(response.response, mimeType)) {
                        (0, log_1.default)('[WireClient] Successful request with unknown or binary mime-type', revision);
                        return Promise.resolve({
                            statusCode: response.status,
                            body: response.response,
                            contentType: mimeType,
                            revision: revision
                        });
                    }
                    else {
                        return (0, util_1.getTextFromArrayBuffer)(response.response, charset)
                            .then((textContent) => {
                            (0, log_1.default)('[WireClient] Successful request', revision);
                            return Promise.resolve({
                                statusCode: response.status,
                                body: textContent,
                                contentType: mimeType,
                                revision: revision
                            });
                        });
                    }
                }
            }, error => {
                if (this.online) {
                    this.online = false;
                    this.rs._emit('network-offline');
                }
                this.rs._emit('wire-done', {
                    method: method,
                    isFolder: (0, util_1.isFolder)(uri),
                    success: false
                });
                return Promise.reject(error);
            });
        });
    }
    /**
     * Sets the userAddress, href, storageApi, token, and properties of a
     * remote store. Also sets connected and online to true and emits the
     * 'connected' event, if both token and href are present.
     *
     * Parameters:
     *   settings - An object that may contain userAddress (string or null),
     *              href (string or null), storageApi (string or null), token (string
     *              or null), and/or properties (the JSON-parsed properties object
     *              from the user's WebFinger record, see section 10 of
     *              http://tools.ietf.org/html/draft-dejong-remotestorage-03
     *              or null).
     *              Fields that are not included (i.e. `undefined`), stay at
     *              their current value. To set a field, include that field
     *              with a `string` value. To reset a field, for instance when
     *              the user disconnected their storage, or you found that the
     *              token you have has expired, simply set that field to `null`.
     */
    configure(settings) {
        if (typeof settings !== 'object') {
            throw new Error('WireClient configure settings parameter should be an object');
        }
        if (typeof settings.userAddress !== 'undefined') {
            this.userAddress = settings.userAddress;
        }
        if (typeof settings.href !== 'undefined') {
            this.href = settings.href;
        }
        if (typeof settings.storageApi !== 'undefined') {
            this.storageApi = settings.storageApi;
        }
        if (typeof settings.token !== 'undefined') {
            this.token = settings.token;
        }
        if (typeof settings.properties !== 'undefined') {
            this.properties = settings.properties;
        }
        if (typeof this.storageApi === 'string') {
            const _storageApi = STORAGE_APIS[this.storageApi] || API_HEAD;
            this.supportsRevs = _storageApi >= API_00;
        }
        if (this.href && this.token) {
            this.connected = true;
            this.online = true;
            this._emit('connected');
        }
        else {
            this.connected = false;
        }
        if (hasLocalStorage) {
            localStorage[SETTINGS_KEY] = JSON.stringify({
                userAddress: this.userAddress,
                href: this.href,
                storageApi: this.storageApi,
                token: this.token,
                properties: this.properties
            });
        }
    }
    get(path, options = {}) {
        if (!this.connected) {
            return Promise.reject('not connected (path: ' + path + ')');
        }
        const headers = {};
        if (this.supportsRevs) {
            if (options.ifNoneMatch) {
                headers['If-None-Match'] = this.addQuotes(options.ifNoneMatch);
            }
        }
        // commenting it out as this is doing nothing and jshint is complaining -les
        // else if (options.ifNoneMatch) {
        //   let oldRev = this._revisionCache[path];
        // }
        return this._request('GET', this.href + (0, util_1.cleanPath)(path), this.token, headers, undefined, this.supportsRevs, this._revisionCache[path])
            .then((r) => {
            if (!(0, util_1.isFolder)(path)) {
                return Promise.resolve(r);
            }
            let itemsMap = {};
            if (typeof (r.body) !== 'undefined') {
                try {
                    r.body = JSON.parse(r.body);
                }
                catch (e) {
                    return Promise.reject('Folder description at ' + this.href + (0, util_1.cleanPath)(path) + ' is not JSON');
                }
            }
            if (r.statusCode === 200 && typeof (r.body) === 'object') {
                // New folder listing received
                if (Object.keys(r.body).length === 0) {
                    // Empty folder listing of any spec
                    r.statusCode = 404;
                }
                else if (isFolderDescription(r.body)) {
                    // >= 02 spec
                    for (const item in r.body.items) {
                        this._revisionCache[path + item] = r.body.items[item].ETag;
                    }
                    itemsMap = r.body.items;
                }
                else {
                    // < 02 spec
                    Object.keys(r.body).forEach((key) => {
                        this._revisionCache[path + key] = r.body[key];
                        itemsMap[key] = { 'ETag': r.body[key] };
                    });
                }
                r.body = itemsMap;
                return Promise.resolve(r);
            }
            else {
                return Promise.resolve(r);
            }
        });
    }
    put(path, body, contentType, options = {}) {
        if (!this.connected) {
            return Promise.reject('not connected (path: ' + path + ')');
        }
        if ((!contentType.match(/charset=/)) && (body instanceof ArrayBuffer || (0, requests_1.isArrayBufferView)(body))) {
            contentType += '; charset=binary';
        }
        const headers = { 'Content-Type': contentType };
        if (this.supportsRevs) {
            if (options.ifMatch) {
                headers['If-Match'] = this.addQuotes(options.ifMatch);
            }
            if (options.ifNoneMatch) {
                headers['If-None-Match'] = this.addQuotes(options.ifNoneMatch);
            }
        }
        return this._request('PUT', this.href + (0, util_1.cleanPath)(path), this.token, headers, body, this.supportsRevs);
    }
    delete(path, options = {}) {
        if (!this.connected) {
            throw new Error('not connected (path: ' + path + ')');
        }
        if (!options) {
            options = {};
        }
        const headers = {};
        if (this.supportsRevs) {
            if (options.ifMatch) {
                headers['If-Match'] = this.addQuotes(options.ifMatch);
            }
        }
        return this._request('DELETE', this.href + (0, util_1.cleanPath)(path), this.token, headers, undefined, this.supportsRevs);
    }
    static _rs_init(remoteStorage) {
        remoteStorage.remote = new WireClient(remoteStorage);
        remoteStorage.remote.online = true;
    }
    static _rs_supported() {
        return typeof fetch === 'function' || typeof XMLHttpRequest === 'function';
    }
    static _rs_cleanup() {
        if (hasLocalStorage) {
            delete localStorage[SETTINGS_KEY];
        }
    }
}
(0, util_1.applyMixins)(WireClient, [eventhandling_1.default]);
module.exports = WireClient;


/***/ }),

/***/ 0:
/*!************************************!*\
  !*** multi ./src/remotestorage.ts ***!
  \************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(/*! ./src/remotestorage.ts */"./src/remotestorage.ts");


/***/ })

/******/ });
});
//# sourceMappingURL=remotestorage.js.map