import 'mocha';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import fetchMock from 'fetch-mock';

import config from '../../build/config.js';
import { RemoteStorage } from '../../build/remotestorage.js';
import WireClient from '../../build/wireclient.js';
import SyncError from '../../build/sync-error.js';

chai.use(chaiAsPromised);

const BASE_URI = 'https://example.com/storage/test';
const TOKEN = 'foobarbaz';

describe('WireClient', () => {
  let rs;
  let client;
  let connectedClient;

  beforeEach(() => {
    rs = new RemoteStorage();
    client = new WireClient(rs);
    connectedClient = new WireClient(rs);
    connectedClient.configure({ href: BASE_URI, token: TOKEN });
  });

  afterEach(() => {
    fetchMock.reset();
    rs = undefined;
    client = undefined;
    connectedClient = undefined;
  });

  describe('Detect support', () => {
    it('reports not supported when neither fetch nor XMLHttpRequest exist', () => {
      const origFetch = globalThis.fetch;
      const origXHR = globalThis.XMLHttpRequest;
      try {
        // Temporarily remove globals
        // eslint-disable-next-line no-global-assign
        globalThis.fetch = undefined;
        // eslint-disable-next-line no-global-assign
        globalThis.XMLHttpRequest = undefined;

        expect(WireClient._rs_supported()).to.equal(false);
      } finally {
        // Restore globals
        // eslint-disable-next-line no-global-assign
        globalThis.fetch = origFetch;
        // eslint-disable-next-line no-global-assign
        globalThis.XMLHttpRequest = origXHR;
      }
    });

    it('reports supported when fetch or XMLHttpRequest exist', () => {
      expect(WireClient._rs_supported()).to.equal(true);
    });
  });

  describe(".rs_init", function() {
    it('sets remote correctly', () => {
      expect(rs.remote).to.be.an.instanceof(WireClient);
      expect(rs.remote.online).to.be.true;
    });
  });

  describe('#configure', () => {
    it('sets the given parameters', () => {
      client.configure({
        userAddress: 'test@example.com',
        storageApi: 'draft-dejong-remotestorage-26'
      });
      expect(client.userAddress).to.equal('test@example.com');
      expect(client.storageApi).to.equal('draft-dejong-remotestorage-26');
    });

    it('does not overwrite parameters when not given', () => {
      client.configure({ userAddress: 'test@example.com' });
      expect(client.userAddress).to.equal('test@example.com');
      client.configure({ href: 'http://foo/bar' });
      expect(client.userAddress).to.equal('test@example.com');
      expect(client.href).to.equal('http://foo/bar');
    });

    it('determines if revisions are supported, based on the storageApi', () => {
      client.configure({ storageApi: 'draft-dejong-remotestorage-00' });
      expect(client.supportsRevs).to.be.true;
      client.configure({ storageApi: 'draft-dejong-remotestorage-01' });
      expect(client.supportsRevs).to.be.true;
      client.configure({ storageApi: 'https://www.w3.org/community/rww/wiki/read-write-web-00#simple' });
      expect(client.supportsRevs).to.be.false;
      client.configure({ storageApi: 'draft-dejong-remotestorage-26' });
      expect(client.supportsRevs).to.be.true;
    });

    it('sets "connected" to true, once href and token are given', () => {
      expect(client.connected).to.be.false;
      expect(connectedClient.connected).to.be.true;
    });
  });

  describe('Events', () => {
    let busy, done, online, offline;

    beforeEach(() => {
      busy = done = online = offline = 0;
      rs.on('wire-busy', () => { busy++; });
      rs.on('wire-done', () => { done++; });
      rs.on('network-offline', () => { offline++; });
      rs.on('network-online', () => { online++; });

      fetchMock.mock(
        { name: 'getFile', url: `${BASE_URI}/foo/ok` },
        { status: 200, headers: { 'Content-Type': 'text/plain; charset=UTF-8', 'ETag': '"new"' }, body: 'Hello' }
      );
      fetchMock.mock(
        { name: 'getFileFail', url: `${BASE_URI}/foo/fail` },
        { throws: 'something went wrong at the HTTP request level' }
      );
      fetchMock.mock(
        { name: 'getFolder', url: `${BASE_URI}/foo/ok/` },
        { status: 200, headers: { 'Content-Type': 'text/plain; charset=UTF-8' },
          body: JSON.stringify({'@context':'http://remotestorage.io/spec/folder-description', items: {}}) }
      );
      fetchMock.mock(
        { name: 'getFolderFail', url: `${BASE_URI}/foo/fail/` },
        { throws: 'something went wrong at the HTTP request level' }
      );
      fetchMock.mock(
        { name: 'putFile', url: `${BASE_URI}/foo/ok`, method: 'PUT' },
        { status: 200 }
      );
      fetchMock.mock(
        { name: 'putFileFail', url: `${BASE_URI}/foo/fail`, method: 'PUT' },
        { throws: 'something went wrong at the HTTP request level' }
      );
      fetchMock.mock(
        { name: 'deleteFile', url: `${BASE_URI}/foo/ok`, method: 'DELETE' },
        { status: 200 }
      );
      fetchMock.mock(
        { name: 'deleteFileFail', url: `${BASE_URI}/foo/fail`, method: 'DELETE' },
        { throws: 'something went wrong at the HTTP request level' }
      );
    });

    it('#get emits "wire-busy" and "wire-done" on successful request', async () => {
      await connectedClient.get('/foo/ok');
      expect(busy).to.equal(1);
      expect(done).to.equal(1);
    });

    it('#get emits "wire-busy" and "wire-done" on failed request', async () => {
      await expect(connectedClient.get('/foo/fail')).to.be.rejected;
      expect(busy).to.equal(1);
      expect(done).to.equal(1);
    });

    it('#get emits "wire-busy" and "wire-done" on successful folder request', async () => {
      await connectedClient.get('/foo/ok/');
      expect(busy).to.equal(1);
      expect(done).to.equal(1);
    });

    it('#get emits "wire-busy" and "wire-done" on failed folder request', async () => {
      await expect(connectedClient.get('/foo/fail/')).to.be.rejected;
      expect(busy).to.equal(1);
      expect(done).to.equal(1);
    });

    it('#get emits "network-offline" on request failure when previously online', async () => {
      connectedClient.online = true;
      await expect(connectedClient.get('/foo/fail')).to.be.rejected;
      expect(offline).to.equal(1);
    });

    it('#get does not emit "network-offline" on request failure when previously offline', async () => {
      connectedClient.online = false;
      await expect(connectedClient.get('/foo/fail')).to.be.rejected;
      expect(offline).to.equal(0);
    });

    it('#get emits "network-online" on request success when previously offline', async () => {
      connectedClient.online = false;
      await connectedClient.get('/foo/ok');
      expect(online).to.equal(1);
    });

    it('#get does not emit "network-online" on request success when previously online', async () => {
      connectedClient.online = true;
      await connectedClient.get('/foo/ok');
      expect(online).to.equal(0);
    });

    it('#get emits "network-online" on folder request when previously offline', async () => {
      connectedClient.online = false;
      await connectedClient.get('/foo/ok/');
      expect(online).to.equal(1);
    });

    it('#put emits "wire-busy" and "wire-done" on successful request', async () => {
      await connectedClient.put('/foo/ok', 'body', 'content-type', {});
      expect(busy).to.equal(1);
      expect(done).to.equal(1);
    });

    it('#put emits "wire-busy" and "wire-done" on failed request', async () => {
      await expect(connectedClient.put('/foo/fail', 'body', 'content-type', {})).to.be.rejected;
      expect(busy).to.equal(1);
      expect(done).to.equal(1);
    });

    it('#delete emits "wire-busy" and "wire-done" on successful request', async () => {
      await connectedClient.delete('/foo/ok');
      expect(busy).to.equal(1);
      expect(done).to.equal(1);
    });

    it('#put emits "wire-busy" and "wire-done" on failed request', async () => {
      await expect(connectedClient.delete('/foo/fail')).to.be.rejected;
      expect(busy).to.equal(1);
      expect(done).to.equal(1);
    });
  });

  describe('#get', () => {
    beforeEach(() => {
      fetchMock.mock(
        { name: 'getOK', url: `${BASE_URI}/foo/bar` },
        { status: 200, headers: { 'Content-Type': 'text/plain; charset=UTF-8' },
          body: 'OK' }
      );
      fetchMock.mock(
        { name: 'getUnauthorized', url: `${BASE_URI}/foo/unauthorized` },
        { status: 401 }
      );
    });

    it('rejects when not connected', async () => {
      await expect(client.get('/foo')).to.be.rejected;
    });

    it('returns a promise', async () => {
      const res = connectedClient.get('/foo//bar');
      expect(res).to.be.a('promise');
    });

    it('sets "Authorization" header', async () => {
      await connectedClient.get('/foo/bar');
      const call = fetchMock.calls('getOK')[0];
      expect(call[1].headers).to.have.property('Authorization').which.equals('Bearer ' + TOKEN);
    });

    it('sets "If-None-Match" header when revisions supported', async () => {
      connectedClient.configure({ storageApi: 'draft-dejong-remotestorage-01' });
      await connectedClient.get('/foo/bar', { ifNoneMatch: 'something' });
      const call = fetchMock.calls('getOK')[0];
      expect(call[1].headers).to.have.property('If-None-Match').which.equals('"something"');
    });

    it('does not set "If-None-Match" when revisions supported but no rev is given', async () => {
      connectedClient.configure({ storageApi: 'draft-dejong-remotestorage-01' });
      await connectedClient.get('/foo/bar');
      const call = fetchMock.calls('getOK')[0];
      expect(call[1].headers).not.to.have.property('If-None-Match');
    });

    it('does not set "If-None-Match" when revisions are not supported', async () => {
      connectedClient.configure({ storageApi: 'https://www.w3.org/community/rww/wiki/read-write-web-00#simple' });
      await connectedClient.get('/foo/bar', { ifNoneMatch: 'something' });
      const call = fetchMock.calls('getOK')[0];
      expect(call[1].headers).not.to.have.property('If-None-Match');
    });

    it('emits an Unauthorized error on 401 responses', function(done) {
      rs.on('error', (error) => {
        expect(error.name).to.equal('Unauthorized');
        done();
      });
      connectedClient.get('/foo/unauthorized');
    });

    it('strips duplicate slahes from the path', async () => {
      const res = await connectedClient.get('/foo//bar');
      expect(res.body).to.equal('OK');
    });

    it('returns content type, HTTP status, and response body', async () => {
      const res = await connectedClient.get('/foo/bar');
      expect(res.statusCode).to.equal(200);
      expect(res.contentType).to.equal('text/plain; charset=UTF-8');
      expect(res.body).to.equal('OK');
    });

    it('returns raw response body when charset set to "binary"', async () => {
      fetchMock.mock(`${BASE_URI}/foo/binary`, {
        status: 200, body: 'something',
        headers: { 'Content-Type': 'application/octet-stream; charset=binary' }
      });
      const res = await connectedClient.get('/foo/binary');
      expect(res.statusCode).to.equal(200);
      expect(res.contentType).to.equal('application/octet-stream; charset=binary');
      expect(res.body).to.be.a('ArrayBuffer');
      const text = new TextDecoder('utf-8').decode(new Uint8Array(res.body));
      expect(text).to.equal('something');
    });

    it('returns text when content type missing and body only contains printable characters', async () => {
      const body = new TextEncoder().encode('something else').buffer;
      fetchMock.mock(`${BASE_URI}/foo/no-type`, {
        status: 200, body, headers: { 'Content-Type': '' }
      }, { sendAsJson: false });
      const res = await connectedClient.get('/foo/no-type');
      expect(res.statusCode).to.equal(200);
      expect(res.contentType).to.be.null;
      expect(res.body).to.be.a('string');
      expect(res.body).to.equal('something else');
    });

    it('returns text when content type missing and body is text', async () => {
      fetchMock.mock(`${BASE_URI}/foo/no-type`, {
        status: 200, body: 'stringy', headers: { 'Content-Type': '' }
      }, { sendAsJson: false });
      const res = await connectedClient.get('/foo/no-type');
      expect(res.statusCode).to.equal(200);
      expect(res.contentType).to.be.null;
      expect(res.body).to.be.a('string');
      expect(res.body).to.equal('stringy');
    });

    it('discards the body for document 404s', async () => {
      fetchMock.mock(`${BASE_URI}/foo/nothing-here`, {
        status: 404, body: 'not found',
        headers: { 'Content-Type': 'text/html' }
      });
      const res = await connectedClient.get('/foo/nothing-here');
      expect(res.statusCode).to.equal(404);
      expect(res.body).to.be.undefined;
    });

    it('discards the body for folder 404s', async () => {
      fetchMock.mock(`${BASE_URI}/foo/nothing-here/`, {
        status: 404, body: '{}',
        headers: { 'Content-Type': 'application/ld+json' }
      });
      const res = await connectedClient.get('/foo/nothing-here/');
      expect(res.statusCode).to.equal(404);
      expect(res.body).to.be.undefined;
    });

    it('discards the body for document 412s', async () => {
      fetchMock.mock(`${BASE_URI}/foo/conflict`, {
        status: 412, body: 'conflict',
        headers: { 'Content-Type': 'text/html' }
      });
      const res = await connectedClient.get('/foo/conflict');
      expect(res.statusCode).to.equal(412);
      expect(res.body).to.be.undefined;
    });

    it('discards the body, returns revision for document 304s', async () => {
      fetchMock.mock(`${BASE_URI}/foo/bars`, {
        status: 304, body: undefined,
        headers: { 'Content-Type': 'text/plain', 'ETag': '"foo"' }
      }, { sendAsJson: false });
      const res = await connectedClient.get('/foo/bars', { ifNoneMatch: 'foo' });
      expect(res.statusCode).to.equal(304);
      expect(res.body).to.be.undefined;
      expect(res.revision).to.equal('foo');
    });

    it('unpacks pre-02 folder listing as items map', async () => {
      fetchMock.mock(`${BASE_URI}/foo/01/`, {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: '{"one":"etag1","two/":"etag2"}' }
      );
      const res = await connectedClient.get('/foo/01/');
      expect(res.statusCode).to.equal(200);
      expect(res.contentType).to.equal("application/json; charset=UTF-8");
      expect(res.body['one']['ETag']).to.equal('etag1');
      expect(res.body['two/']['ETag']).to.equal('etag2');
    });

    it('unpacks -02 folder listings', async () => {
      fetchMock.mock(`${BASE_URI}/foo/02/`, {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({
          "@context": "http://remotestorage.io/spec/folder-description",
          items: {
            a: {
              "ETag": "qwer",
              "Content-Length": 5,
              "Content-Type": "text/html"
            },
            "b/": {
              "ETag": "asdf",
              "Content-Type":"application/json",
              "Content-Length": 137
            }
          }
        })
      });
      const res = await connectedClient.get('/foo/02/');
      expect(res.statusCode).to.equal(200);
      expect(res.contentType).to.equal("application/json; charset=UTF-8");
      expect(res.body).to.deep.equal({
        a: { "ETag": "qwer", "Content-Length": 5, "Content-Type": "text/html" },
        "b/": { "ETag": "asdf", "Content-Type":"application/json", "Content-Length": 137 }
      });
    });

    it('aborts requests when response is too slow', async () => {
      const originalTimeout = config.requestTimeout;
      config.requestTimeout = 300;

      fetchMock.mock(`${BASE_URI}/foo/slow`, {
        status: 200, body: 'OK',
        headers: { 'Content-Type': 'text/plain; charset=UTF-8' }
      }, { delay: 500 });

      await expect(connectedClient.get('/foo/slow')).to.be.rejectedWith('timeout');
      config.requestTimeout = originalTimeout;
    });
  });

  describe('#put', () => {
    beforeEach(() => {
      fetchMock.mock(
        { name: 'putFileOK', url: `${BASE_URI}/foo/bar`, method: 'PUT' },
        { status: 200, headers: { 'ETag': '"rev123"' } }
      );
      fetchMock.mock(
        { name: 'putBinary', url: `${BASE_URI}/foo/binary`, method: 'PUT' },
        { status: 200 }
      );
    });

    it('rejects when not connected', async () => {
      await expect(client.put('/foo', 'bla', 'text/plain')).to.be.rejected;
    });

    it('uses the PUT method and sends the request body', async () => {
      await connectedClient.put('/foo/bar', 'something', 'text/plain');
      const call = fetchMock.calls('putFileOK')[0];
      expect(call[0]).to.equal(`${BASE_URI}/foo/bar`);
      expect(call[1].method).to.equal('PUT');
      expect(call[1].body).to.equal('something');
    });

    it('sends the correct headers', async () => {
      await connectedClient.put('/foo/bar', 'something else', 'text/foo');
      const call = fetchMock.calls('putFileOK')[0];
      expect(call[1].headers['Content-Type']).to.equal('text/foo');
      expect(call[1].headers['Authorization']).to.equal('Bearer foobarbaz');
      expect(call[1].headers).not.to.have.property('If-None-Match');
      expect(call[1].headers).not.to.have.property('If-Match');
    });

    it('sends If-None-Match header when revisions are supported and rev is given', async () => {
      connectedClient.configure({ storageApi: 'draft-dejong-remotestorage-02' });
      await connectedClient.put('/foo/bar', '1', 'text/plain', { ifNoneMatch: 'etag1' });
      const call = fetchMock.calls('putFileOK')[0];
      expect(call[1].headers['If-None-Match']).to.equal('"etag1"');
      expect(call[1].headers).not.to.have.property('If-Match');
    });

    it('sends If-Match header when revisions are supported and rev is given', async () => {
      connectedClient.configure({ storageApi: 'draft-dejong-remotestorage-02' });
      await connectedClient.put('/foo/bar', '1', 'text/plain', { ifMatch: 'etag2' });
      const call = fetchMock.calls('putFileOK')[0];
      expect(call[1].headers['If-Match']).to.equal('"etag2"');
      expect(call[1].headers).not.to.have.property('If-None-Match');
    });

    it('encodes special characters in the path', async () => {
      const url = `${BASE_URI}/foo/A%252FB/bar`;
      fetchMock.mock(
        { name: 'putEncoded', url, method: 'PUT' },
        { status: 200 }
      );

      await connectedClient.put('/foo/A%2FB/bar', 'baz', 'text/plain');
      const calls = fetchMock.calls('putEncoded');
      expect(calls).to.have.lengthOf(1);
      expect(calls[0][0]).to.equal(url);
    });

    it('encodes spaces in the path', async () => {
      const url = `${BASE_URI}/foo/A%20B/bar`;
      fetchMock.mock(
        { name: 'putWithSpace', url, method: 'PUT' },
        { status: 200 }
      );

      await connectedClient.put('/foo/A B/bar', 'baz', 'text/plain');
      const calls = fetchMock.calls('putWithSpace');
      expect(calls).to.have.lengthOf(1);
      expect(calls[0][0]).to.equal(url);
    });

    it('leaves slash characters in the path', async () => {
      const url = `${BASE_URI}/test/foo/A/B/C/D/E`;
      fetchMock.mock(
        { name: 'putWithSlashes', url, method: 'PUT' },
        { status: 200 }
      );

      await connectedClient.put('/test/foo/A/B/C/D/E', 'slash it!', 'text/plain');
      const calls = fetchMock.calls('putWithSlashes');
      expect(calls).to.have.lengthOf(1);
      expect(calls[0][0]).to.equal(url);
    });

    it('removes redundant slash characters in the path', async () => {
      const url = `${BASE_URI}/test/foo/A/B/C/D/E`;
      fetchMock.mock(
        { name: 'putWithSlashes', url, method: 'PUT' },
        { status: 200 }
      );

      await connectedClient.put('/test/foo/A/B/C///D/E', 'slash it!', 'text/plain');
      const calls = fetchMock.calls('putWithSlashes');
      expect(calls).to.have.lengthOf(1);
      expect(calls[0][0]).to.equal(url);
    });

    it('adds no charset for strings', async () => {
      await connectedClient.put('/foo/bar', 'something', 'text/html');
      const call = fetchMock.calls('putFileOK')[0];
      expect(call[1].headers).to.have.property('Content-Type').which.equals('text/html');
    });

    it('preserves charset for strings', async () => {
      await connectedClient.put('/foo/bar', 'something', 'text/html; charset=UTF-8');
      let call = fetchMock.calls('putFileOK')[0];
      expect(call[1].headers).to.have.property('Content-Type').which.equals('text/html; charset=UTF-8');
    });

    it('adds binary charset for ArrayBuffer PUT', async () => {
      await connectedClient.put('/foo/binary', new ArrayBuffer(3), 'image/jpeg');
      const call = fetchMock.calls('putBinary')[0];
      expect(call[1].headers).to.have.property('Content-Type').which.equals('image/jpeg; charset=binary');
    });

    it('does not add second binary charset for ArrayBuffer PUT', async () => {
      await connectedClient.put('/foo/binary', new ArrayBuffer(3), 'image/jpeg; charset=custom');
      const call = fetchMock.calls('putBinary')[0];
      expect(call[1].headers).to.have.property('Content-Type').which.equals('image/jpeg; charset=custom');
    });

    it('discards body and content type, returns revision for document 200s', async () => {
      const res = await connectedClient.put(
        '/foo/bar', 'something', 'text/html; charset=UTF-8',
        { ifMatch: 'rev123' }
      );
      expect(res.body).to.be.undefined;
      expect(res.contentType).to.be.undefined;
      expect(res.revision).to.equal('rev123');
    });
  });

  describe('#delete', () => {
    beforeEach(() => {
      connectedClient.configure({ storageApi: 'draft-dejong-remotestorage-26' });
      fetchMock.mock(
        { name: 'deleteOK', url: `${BASE_URI}/foo/bar`, method: 'DELETE' },
        { status: 204, body: undefined }, { sendAsJson: false }
      );
    });

    it('throws error when not connected', () => {
      expect(() => client.delete('/foo')).to.throw(/not connected/);
    });

    it('uses the DELETE method and sets the correct headers', async () => {
      await connectedClient.delete('/foo/bar');
      const call = fetchMock.calls('deleteOK')[0];
      expect(call[0]).to.equal(`${BASE_URI}/foo/bar`);
      expect(call[1].method).to.equal('DELETE');
      expect(call[1].headers['Authorization']).to.equal('Bearer foobarbaz');
      expect(call[1].headers).not.to.have.property('If-None-Match');
      expect(call[1].headers).not.to.have.property('If-Match');
    });

    it('sends If-Match header when revisions are supported and rev is given', async () => {
      await connectedClient.delete('/foo/bar', { ifMatch: 'etag1' });
      const call = fetchMock.calls('deleteOK')[0];
      expect(call[1].headers['If-Match']).to.equal('"etag1"');
      expect(call[1].headers).not.to.have.property('If-None-Match');
    });

    it('discards body and content type, returns revision for document 200s', async () => {
      fetchMock.mock({
        url: `${BASE_URI}/foo/begone`, method: 'DELETE'
      }, {
        status: 200, body: undefined,
        headers: {'Content-Type': 'text/plain', 'ETag': '"ohai"' }
      }, { sendAsJson: false });
      const res = await connectedClient.delete('/foo/begone', { ifMatch: 'ohai' });
      expect(res.statusCode).to.equal(200);
      expect(res.body).to.be.undefined;
      expect(res.contentType).to.be.undefined;
      expect(res.revision).to.equal('ohai');
    });

    it('discards revision for document 200s when no ETag is returned', async () => {
      fetchMock.mock(
        { url: `${BASE_URI}/foo/begone`, method: 'DELETE' },
        { status: 200, body: undefined },
        { sendAsJson: false }
      );
      const res = await connectedClient.delete('/foo/begone');
      expect(res.statusCode).to.equal(200);
      expect(res.body).to.be.undefined;
      expect(res.contentType).to.be.undefined;
      expect(res.revision).to.be.null;
    });

    it('discards body and content type, returns revision for document 204s', async () => {
      fetchMock.mock({
        url: `${BASE_URI}/foo/begone`, method: 'DELETE'
      }, {
        status: 204, body: undefined,
        headers: {'Content-Type': 'text/plain', 'ETag': '"ohai"' }
      }, { sendAsJson: false });
      const res = await connectedClient.delete('/foo/begone', { ifMatch: 'ohai' });
      expect(res.statusCode).to.equal(204);
      expect(res.body).to.be.undefined;
      expect(res.contentType).to.be.undefined;
      expect(res.revision).to.equal('ohai');
    });
  });

  describe('Sync error', function() {
    it('does not mark WireClient as offline', function(done) {
      connectedClient.online = true;
      rs._emit('error', new SyncError('Houston, we have a problem.'));
      setTimeout(function() {
        expect(connectedClient.online).to.be.true;
        done();
      }, 100);
    });
  });

  describe('XMLHttpRequest (legacy)', function() {
    it('#get sends the request', function(done) {
      const origFetch = globalThis.fetch;
      const origXHR = globalThis.XMLHttpRequest;
      const instances = [];
      class MockXHR {
        constructor() { this._headers = {}; instances.push(this); }
        open(...args) { this._open = args; }
        send(...args) { this._send = args; setTimeout(() => { if (this._onload) { this._onload(); } }, 0); }
        setRequestHeader(k, v) { this._headers[k] = v; }
        getResponseHeader() { return null; }
        set onload(f) { this._onload = f; }
        set onerror(f) { this._onerror = f; }
      }
      // force XHR path
      // eslint-disable-next-line no-global-assign
      globalThis.fetch = undefined;
      // eslint-disable-next-line no-global-assign
      globalThis.XMLHttpRequest = MockXHR;

      connectedClient.get('/foo/bar');
      setTimeout(() => {
        const req = instances.shift();
        try {
          expect(req._send).to.be.an('array');
        } finally {
          // restore globals
          // eslint-disable-next-line no-global-assign
          globalThis.fetch = origFetch;
          // eslint-disable-next-line no-global-assign
          globalThis.XMLHttpRequest = origXHR;
          done();
        }
      }, 0);
    });

    it('#get installs onload and onerror handlers', function(done) {
      const origFetch = globalThis.fetch;
      const origXHR = globalThis.XMLHttpRequest;
      const instances = [];
      class MockXHR {
        constructor() { this._headers = {}; instances.push(this); }
        open(...args) { this._open = args; }
        send(...args) { this._send = args; setTimeout(() => { if (this._onload) { this._onload(); } }, 0); }
        setRequestHeader(k, v) { this._headers[k] = v; }
        getResponseHeader() { return null; }
        set onload(f) { this._onload = f; }
        set onerror(f) { this._onerror = f; }
      }
      // force XHR path
      // eslint-disable-next-line no-global-assign
      globalThis.fetch = undefined;
      // eslint-disable-next-line no-global-assign
      globalThis.XMLHttpRequest = MockXHR;

      connectedClient.get('/foo/bar/');
      setTimeout(() => {
        const req = instances.shift();
        try {
          expect(req._onload).to.be.a('function');
          expect(req._onerror).to.be.a('function');
        } finally {
          // restore globals
          // eslint-disable-next-line no-global-assign
          globalThis.fetch = origFetch;
          // eslint-disable-next-line no-global-assign
          globalThis.XMLHttpRequest = origXHR;
          done();
        }
      }, 0);
    });
  });
});
