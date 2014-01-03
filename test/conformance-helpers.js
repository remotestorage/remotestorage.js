var url = require('url');
var _http = require('http');
var _https = require('https');
var http;
var util = require('util');

var tests = [];

var config; // config is passed to 'run'

function run(_config) {
  config = _config;

  http = config.baseUrl.match(/^https/) ? _https : _http;

  function runOne() {
    var test = tests.shift();
    if (test) {
      test(function() {
        console.log("-> PASSED\n");
        runOne();
      });
    } else {
      console.log("All tests passed.");
    }
  }

  runOne();
}

function logNested(depth, args) {
  var prefix = '';
  for(var i=0; i < depth; i++) {
    prefix += ' ';
  }
  console.log.apply(console, args.map(function(arg, i) {
    if (typeof(arg) !== 'string') {
      arg = util.inspect(arg);
    }
    var lines = arg.split("\n");
    if (lines.length === 1) {
      return (i === 0 ? prefix : '') + arg;
    } else {
      return lines.map(function(line, j) {
        return (j === 0 ? (i === 0 ? prefix : '') : prefix) + line;
      }).join("\n");
    }
  }));
}

function br() {
  console.log('');
}

function request(verb, path, options, cb, finalCb) {
  var key;
  for(key in options.headers) {
    if (typeof(options.headers[key]) === 'function') {
      options.headers[key] = options.headers[key]();
    }
  }
  logNested(2, ['Request:', verb, path]);
  logNested(4, ['Headers: ', options.headers || {}]);
  if (options.body) {
    logNested(4, ['Body: ', util.inspect(options.body)]);
  }
  br();
  var opts = url.parse(config.baseUrl + path);
  opts.method = verb;
  opts.headers = {
    'Authorization': 'Bearer ' + config.token
  };
  if (options.headers) {
    for(key in options.headers) {
      opts.headers[key] = options.headers[key];
    }
  }
  var req = http.request(opts, function(response) {
    var body = '';
    response.on('data', function(d) { body += d; });
    response.on('end', function() {
      logNested(2, ['Response:', response.statusCode]);
      logNested(4, ['Headers:', response.headers]);
      if (body) {
        logNested(4, ['Body:', util.inspect(body)]);
      }
      br();
      cb({
        body: body,
        status: response.statusCode,
        headers: response.headers
      });
      finalCb();
    });
  });
  if (options.body) {
    req.write(options.body);
  }
  req.end();
}

function testRequest(desc, verb, path, a, b) {
  var options, callback;
  if (typeof(a) === 'object') {
    options = a;
    callback = b;
  } else {
    options = {};
    callback = a;
  }
  tests.push(function(next) {
    console.log(desc);
    br();
    request(verb, path, options, callback, next);
  });
}

function extendAssert(assert) {
  assert.status = function(response, status, message) {
    if (typeof(status) === 'object' && status instanceof Array) {
      assert.ok(status.indexOf(response.status) > -1, message || ("Expected response status to equal one of " + util.inspect(status) + ", got " + response.status));
    } else {
      assert.equal(response.status, status, message || ("Expected response status to equal " + status + ", got " + response.status));
    }
  };

  assert.contentType = function(response, expected) {
    var re = new RegExp('^' + expected);
    assert.ok(response.headers['content-type'].match(re),
              "Expected Content-Type '" + expected + "' but instead got '" +
              response.headers['content-type'] + "'");
  };

  assert.folderEqual = function(response, expectedListing, message) {
    var body;
    assert.status(response, 200);
    assert.contentType(response, 'application/json');
    assert.doesNotThrow(function() {
      body = JSON.parse(response.body);
    }, undefined, "Expected folder response body to be valid JSON");
    assert.ok(response.headers.etag);
    assert.deepEqual(body, expectedListing, message || ("Expected folder listing\n" + JSON.stringify(expectedListing) + "\nbut instead got\n" + JSON.stringify(body)));
  };
}

exports.extendAssert = extendAssert;
exports.testRequest = testRequest;
exports.run = run;
