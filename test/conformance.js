var assert = require('assert');
var util = require('util');
var helpers = require('./conformance-helpers');

helpers.extendAssert(assert);

var testRequest = helpers.testRequest;

var baseUrl = process.argv[2];
var token = process.argv[3];
if (! (baseUrl && token)) {
  console.log("Usage: " + process.argv[1] + " <base-url> <token>");
  process.exit(127);
}

process.nextTick(function() {

  helpers.run({
    baseUrl: baseUrl,
    token: token
  });

});

function val(name) {
  return function() {
    return eval(name);
  };
}

var rememberedRootETag;

// 1) GET empty root folder
//   GET <root>/
//     check: status = 200 (section 5)
//     check: content-type = 'application/json' (section 4)
//     check: body parseable as JSON (section 4)
//     check: body contains an empty object (section 4)
//     check: ETag header is set (section 6)
testRequest(
  "1) GET empty root folder", 'GET', '/', function(response) {
    assert.status(response, 200);
    assert.folderEqual(response, {}, "Expected storage to be initially empty, but there seems to be data in it. root listing is: " + response.body);
    rememberedRootETag = response.headers.etag;
  }
);

// 2) attempt PUT on folder
//   PUT <root>/
//     check: status = 400 (section 5)
testRequest(
  "2) attempt PUT on folder", 'PUT', '/', function(response) {
    assert.status(response, 400);
  }
);

// 3) attempt DELETE on folder
//   DELETE <root>/
//     check: status = 400 (section 5)
testRequest(
  "3) attempt DELETE on folder", 'DELETE', '/', function(response) {
    assert.status(response, 400);
  }
);

// 4) GET file that doesn't exist
//   GET <root>/test-file
//     check: status = 404 (section 5)
testRequest(
  "4) GET file that doesn't exist", 'GET', '/test-file', function(response) {
    assert.status(response, 404);
  }
);

var rememberedETag;

// 5) PUT a file
//   PUT <root>/test-file, with content-type = 'text/plain', body = 'hello'
//     check: status = 200 (section 5)
//     check: ETag header is returned (section 4)
//     remember: ETag
testRequest(
  "5) PUT a file", 'PUT', '/test-file', {
    headers: {
      "Content-Type": "text/plain"
    },
    body: "hello"
  }, function(response) {
    assert.status(response, [200, 201]);
    assert.ok(response.headers.etag);
    rememberedETag = response.headers.etag;
  }
);

// 6) GET the root listing now containing the file
//   GET <root>/
//     check: status = 200 (section 5)
//     check: content-type = 'application/json' (section 4)
//     check: body parseable as JSON (section 4)
//     check: body contains an object (section 4)
//     check: body object contains one key, "test-file" (section 4)
//     check: the corresponding value is equal to the ETag remembered in (5)
testRequest(
  "6) GET the root listing now containing the file", 'GET', '/', function(response) {
    assert.folderEqual(response, {
      'test-file': rememberedETag
    });
    assert.notEqual(response.headers.etag, rememberedRootETag);
    rememberedRootETag = response.headers.etag;
  }
);

// 7) GET the file itself
//   GET <root>/test-file
//     check: status = 200 (section 5)
//     check: content-type = 'text/plain'
//     check: body = 'hello'
//     check: ETag set as remembered in (5)
testRequest(
  "7) GET the file itself", 'GET', '/test-file', function(response) {
    assert.status(response, 200);
    assert.contentType(response, 'text/plain');
    assert.equal(response.body, 'hello');
    assert.equal(response.headers.etag, rememberedETag);
  }
);

// 8) DELETE the file
//   DELETE <root>/test-file
//     check: status = 200 (section 5)
//     check: ETag set as remembered in (5)
testRequest(
  "8) DELETE the file", 'DELETE', '/test-file', function(response) {
    assert.status(response, 200);
    assert.equal(response.headers.etag, rememberedETag);
  }
);

// 9) attempt to DELETE the same file again
//   DELETE <root>/test-file
//     check: status = 404 (section 5)
testRequest(
  "9) attempt to DELETE the same file again", 'DELETE', '/test-file', function(response) {
    assert.status(response, 404);
  }
);

// 10) check (empty) root listing again
//   -> same as (1)
testRequest(
  "10) check (empty) root listing again", 'GET', '/', function(response) {
    assert.status(response, 200);
    assert.contentType(response, 'application/json');
    var body;
    assert.doesNotThrow(function() {
      body = JSON.parse(response.body);
    }, undefined, "Expected response body to be valid JSON");
    assert.deepEqual(body, {}, "Expected storage to be initially empty, but there seems to be data in it. root listing is: " + util.inspect(body));
    assert.ok(response.headers['etag']);
    assert.notEqual(response.headers.etag, rememberedRootETag);
    rememberedRootETag = response.headers.etag;
  }
);

// 11) get folder that doesn't exist
//   GET /test-folder/
//     check: status = 404
testRequest(
  "11) get folder that doesn't exist", 'GET', '/test-folder/', function(response) {
    assert.status(response, 404);
  }
);

var rememberedNestedETag;

// 12) create nested file
//   PUT /test-folder/nested-file
//     check: status = 200
//     check: ETag is set
testRequest(
  "12) create nested file", 'PUT', '/test-folder/nested-file', {
    headers: {
      "Content-Type": "text/plain"
    },
    body: "nested file content"
  }, function(response) {
    assert.status(response, [200, 201]);
    rememberedNestedETag = response.headers.etag;
    assert.ok(rememberedNestedETag);
  }
);

// 13) check that file can be retrieved correctly
//   GET /test-folder/nested-file
testRequest(
  "13) check that file can be retrieved correctly", 'GET', '/test-folder/nested-file',
  function(response) {
    assert.status(response, 200);
    assert.equal(response.headers.etag, rememberedNestedETag);
    assert.contentType(response, 'text/plain');
    assert.equal(response.body, 'nested file content');
  }
);

var rememberedFolderETag;

// 14) check that folder was created
//   GET /test-folder/
//     -> checks similar to (6)
testRequest(
  "14) check that folder was created", 'GET', '/test-folder/', function(response) {
    assert.folderEqual(response, {
      'nested-file': rememberedNestedETag
    });
    rememberedFolderETag = response.headers.etag;
  }
);

// 15) check that root folder was updated
//   GET /
//     -> checks similar to (6)
testRequest(
  "15) check that root folder was updated", 'GET', '/', function(response) {
    assert.folderEqual(response, {
      'test-folder/': rememberedFolderETag
    });
    assert.notEqual(response.headers.etag, rememberedRootETag);
    rememberedRootETag = response.headers.etag;
  }
);

var rememberedOtherNestedETag;

// 16) put another file in the same folder
testRequest(
  "16) put another file in the same folder", 'PUT', '/test-folder/other-file', {
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ foo: 'bar' })
  }, function(response) {
    assert.status(response, [200, 201]);
    rememberedOtherNestedETag = response.headers.etag;
    assert.ok(rememberedOtherNestedETag);
  }
);

// 17) check that folder was updated again
testRequest(
  "17) check that folder was updated again", 'GET', '/test-folder/',
  function(response) {
    assert.folderEqual(response, {
      'nested-file': rememberedNestedETag,
      'other-file': rememberedOtherNestedETag
    });
    assert.notEqual(response.headers.etag, rememberedFolderETag);
    assert.ok(response.headers.etag);
    rememberedFolderETag = response.headers.etag;
  }
);

// 18) check that folder etag changed accordingly in root listing
testRequest(
  "18) check that folder etag changed accordingly in root listing", 'GET', '/',
  function(response) {
    assert.folderEqual(response, {
      'test-folder/': rememberedFolderETag
    });
    assert.notEqual(response.headers.etag, rememberedRootETag);
    rememberedRootETag = response.headers.etag;
  }
);

// 19) DELETE the nested file stored first
testRequest(
  "19) DELETE the nested file stored first", 'DELETE', '/test-folder/nested-file',
  function(response) {
    assert.status(response, 200);
    assert.equal(response.headers.etag, rememberedNestedETag);
  }
);

// 20) check that it cannot be retrieved anymore
testRequest(
  "20) check that it cannot be retrieved anymore", 'GET', '/test-folder/nested-file',
  function(response) {
    assert.status(response, 404);
  }
);

// 21) check that the folder was updated accordingly
testRequest(
  "21) check that the folder was updated accordingly", 'GET', '/test-folder/',
  function(response) {
    assert.folderEqual(response, {
      'other-file': rememberedOtherNestedETag
    });
  }
);

// 22) remove the other nested file
testRequest(
  "22) remove the other nested file", 'DELETE', '/test-folder/other-file',
  function(response) {
    assert.status(response, 200);
  }
);

// 23) check that the folder was implictly deleted
testRequest(
  "23) check that the folder was implictly deleted", 'GET', '/test-folder/',
  function(response) {
    assert.status(response, 404);
  }
);

// 24) check that root listing is empty again
testRequest(
  "24) check that root listing is empty again", 'GET', '/', function(response) {
    assert.folderEqual(response, {});
    assert.notEqual(response.headers.etag, rememberedRootETag);
    rememberedRootETag = response.headers.etag;
  }
);

// 25) Create a new file, to test conditional requests
testRequest(
  "25) Create a new file, to test conditional requests", 'PUT', '/test-file', {
    headers: { 'Content-Type': 'text/plain' },
    body: 'hello world'
  }, function(response) {
    assert.status(response, [200, 201]);
    rememberedETag = response.headers.etag;
    assert.ok(rememberedETag);
  }
);

// 26) PUT to that file with If-None-Match: *, check that it fails.
testRequest(
  "26) PUT to that file with If-None-Match: *", 'PUT', '/test-file', {
    headers: {
      'Content-Type': 'text/plain',
      'If-None-Match': '*'
    },
    body: 'Hello World'
  }, function(response) {
    assert.status(response, 412);
  }
);

// 27) GET that file again to verify it hasn't changed
testRequest(
  "27) GET that file again to verify it hasn't changed", 'GET', '/test-file',
  function(response) {
    assert.status(response, 200);
    assert.equal(rememberedETag, response.headers.etag);
    assert.equal(response.body, "hello world");
  }
);

var rememberedOtherETag;

// 28) PUT on a different path with If-None-Match: *, check that it works
testRequest(
  "28) PUT on a different path with If-None-Match: *, check that it works",
  'PUT', '/other-file', {
    headers: {
      'Content-Type': 'text/plain',
      'If-None-Match': '*'
    },
    body: 'foo'
  }, function(response) {
    assert.status(response, [200, 201]);
    rememberedOtherETag = response.headers.etag;
    assert.ok(rememberedOtherETag);
  }
);

// 29) Conditionally DELETE the other file with an invalid ETag
testRequest(
  "29) Conditionally DELETE the other file with an invalid ETag",
  'DELETE', '/other-file', {
    headers: {
      'If-Match': 'etag-that-is-most-likely-not-valid'
    }
  }, function(response) {
    assert.status(response, 412);
  }
);

// 30) check that other file wasn't deleted
testRequest(
  "30) check that other file wasn't deleted", 'GET', '/other-file',
  function(response) {
    assert.status(response, 200);
    assert.equal(response.headers.etag, rememberedOtherETag);
  }
);

// 31) DELETE other-file with valid If-Match header
testRequest(
  "31) DELETE other-file with valid If-Match header", 'DELETE', '/other-file',
  { headers: { 'If-Match': val('rememberedOtherETag') } }, function(response) {
    assert.status(response, 200);
    assert.equal(response.headers.etag, rememberedOtherETag);
  }
);

// 32) check that other file was actually deleted
testRequest(
  "32) check that other file was actually deleted", 'GET', '/other-file',
  function(response) {
    assert.status(response, 404);
  }
);

// 33) update first file with an invalid If-Match header
testRequest(
  "33) update first file with an invalid If-Match header", 'PUT', '/test-file',
  {
    headers: {
      'Content-Type': 'text/plain',
      'If-Match': 'etag-that-is-most-likely-not-valid'
    },
    body: 'Hello World !'
  }, function(response) {
    assert.status(response, 412);
  }
);

// 34) check that the file hasn't changed
testRequest(
  "34) check that the file hasn't changed", 'GET', '/test-file',
  function(response) {
    assert.status(response, 200);
    assert.equal(response.body, 'hello world');
    assert.equal(response.headers.etag, rememberedETag);
  }
);

// 35) now update the file with a valid If-Match header
testRequest(
  "35) now update the file with a valid If-Match header", 'PUT', '/test-file', {
    headers: {
      'Content-Type': 'text/html',
      'If-Match': val('rememberedETag')
    },
    body: '<h1>Hello World !</h1>'
  }, function(response) {
    assert.status(response, 200);
    assert.notEqual(response.headers.etag, rememberedETag);
    rememberedETag = response.headers.etag;
    assert.ok(rememberedETag);
  }
);

// 36) check that the file was updated correctly
testRequest(
  "36) check that the file was updated correctly", 'GET', '/test-file',
  function(response) {
    assert.status(response, 200);
    console.log('resp', response);
    assert.contentType(response, 'text/html');
    assert.equal(response.headers.etag, rememberedETag);
    assert.equal(response.body, '<h1>Hello World !</h1>');
  }
);

// 37) test conditional GET request with correct ETag
testRequest(
  "37) test conditional GET request with correct ETag", 'GET', '/test-file', {
    headers: {
      'If-None-Match': val('rememberedETag')
    }
  }, function(response) {
    if (response.status === 412) {
      throw "Response status is 412. Conditional GET requests should return 403 instead. See this issue for an explaination: https://github.com/remotestorage/spec/issues/23";
    }
    assert.status(response, 304);
  }
);

// 38) test conditional GET request with incorrect ETag
testRequest(
  "38) test conditional GET request with incorrect ETag", 'GET', '/test-file', {
    headers: {
      'If-None-Match': 'etag-that-is-most-likely-not-valid'
    }
  }, function(response) {
    assert.status(response, 200);
  }
);

// 39) finally DELETE test-file again
testRequest(
  "39) finally DELETE test-file again", 'DELETE', '/test-file', {
    headers: {
      'If-Match': val('rememberedETag')
    }
  }, function(response) {
    assert.status(response, 200);
  }
);


/**
   TODO:
   - edge case: test that the ETag of a folder doesn't revert back to a previous state when creating a document and subsequently deleting it without touching anything else in the folder
   - PUT binary file
   - OPTIONS requests
   - try invalid tokens
   - try accessing different scopes
   - try folder traversal attack
   - try PUT/DELETE with read-only token
   - test /public/

   DONE:
   - test implicit folder creation
   - test implicit folder deletion
   - second PUT (changing ETag in all places)
   - test ETags changing throughout the entire parent tree after a PUT and DELETE
   - GET with if-none-match (both cases)
   - PUT with if-match (both cases)
   - PUT with if-none-match = '*' (on a document that exists and one that doesn't)
   - DELETE with if-match (both cases)
 **/
