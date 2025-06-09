import 'mocha';
import { expect } from 'chai';
import fetchMock from 'fetch-mock';

import { RemoteStorage } from '../../build/remotestorage.js';
import { Caching } from "../../build/caching.js";
import { Sync } from '../../build/sync.js';
import FakeAccess from '../helpers/fake-access.mjs';

describe("CachingLayer", function() {
  beforeEach(function(done) {
    this.original = {};
    this.rs = new RemoteStorage();

    this.rs.on('features-loaded', () => {
      this.rs._handlers['connected'] = [];
      this.rs.access = new FakeAccess();
      Caching._rs_init(this.rs); // needs FakeAccess, too
      this.rs.syncStopped = true;
      this.rs.sync = new Sync(this.rs);
      done();
    });
  });

  afterEach(function() {
    if (this.rs.sync) { Sync._rs_cleanup(this.rs); }
    this.rs = undefined;
  });

  describe("#get", function() {
    beforeEach(async function() {
      this.rs.remote.connected = true;
      this.rs.remote.online = true;
      this.rs.caching.enable("/foo/");

      fetchMock.mock(
        { url: "end:/foo/"},
        { status: 200, body: {}, headers: { 'Content-Type': 'application/ld+json', 'ETag': '"new-and-fresh"' } }
      );
      fetchMock.mock(
        { url: "end:/foo/one"},
        { status: 200, body: 'body', headers: { 'Content-Type': 'text/plain', 'ETag': '"brandnew-and-fresh"' } }
      );
      fetchMock.mock(
        { url: "end:/foo/two"},
        { status: 200, body: 'ohai', headers: { 'Content-Type': 'text/plain', 'ETag': '"brandnew-and-even-fresher"' } }
      );

      await this.rs.local.setNodes({
        '/foo/': {
          path: '/foo/',
          common: {
            itemsMap: {},
            contentType: 'application/ld+json',
            timestamp: new Date().getTime() - 60000,
            revision: 'oldie-but-goodie'
          }
        },
        '/foo/one': {
          path: '/foo/one',
          common: {
            body: 'old data',
            contentType: 'text/plain',
            timestamp: new Date().getTime() - 60000,
            revision: 'oldie-but-goodie'
          }
        }
      });
    });

    afterEach(() => {
      fetchMock.reset();
    });

    it("resolves with the local data when younger than maxAge", async function() {
      const res = await this.rs.local.get('/foo/one', 120000, this.rs.sync.queueGetRequest.bind(this.rs.sync));
      expect(res).to.deep.equal({
        statusCode: 200, body: 'old data', contentType: 'text/plain'
      });
    });

    it("resolves with updated data when cache older than maxAge", async function() {
      const res = await this.rs.local.get('/foo/one', 5, this.rs.sync.queueGetRequest.bind(this.rs.sync));
      expect(res).to.deep.equal({
        statusCode: 200, body: 'body', contentType: 'text/plain'
      });
    });

    it("resolves with data from remote when no local data cached", async function() {
      const res = await this.rs.local.get('/foo/two', 5, this.rs.sync.queueGetRequest.bind(this.rs.sync));
      expect(res).to.deep.equal({
        statusCode: 200, body: 'ohai', contentType: 'text/plain'
      });
    });
  });
});
