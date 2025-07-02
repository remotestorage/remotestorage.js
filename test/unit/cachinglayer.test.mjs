import 'mocha';
import { expect } from 'chai';
import fetchMock from 'fetch-mock';

import { RemoteStorage } from '../../build/remotestorage.js';
import { Sync } from '../../build/sync.js';
import FakeAccess from '../helpers/fake-access.mjs';

describe("CachingLayer", function() {
  beforeEach(function(done) {
    this.original = {};
    this.rs = new RemoteStorage();
    Object.defineProperty(this.rs, 'access', {
      value: new FakeAccess(),
      writable: true,
      configurable: true
    });

    this.rs.on('features-loaded', () => {
      this.rs._handlers['connected'] = [];
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

  describe("#delete", function() {
    describe("when connected", function() {
      beforeEach(async function() {
        this.rs.remote.connected = true;
        this.rs.remote.online = true;
        this.rs.caching.enable("/foo/");

        await this.rs.local.setNodes({
          "/foo/": {
            path: "/foo/",
            common: {
              itemsMap: {
                "one": true,
                "two": true
              },
              contentType: "application/ld+json",
              timestamp: new Date().getTime(),
              revision: "oldie-but-goodie"
            }
          },
          "/foo/one": {
            path: "/foo/one",
            common: {
              body: "some data",
              contentType: "text/plain",
              timestamp: new Date().getTime(),
              revision: "123456"
            }
          },
          "/foo/two": {
            path: "/foo/two",
            common: {
              body: "some other data",
              contentType: "text/plain",
              timestamp: new Date().getTime(),
              revision: "abcdef"
            }
          }
        });

        await this.rs.local.delete('/foo/one', this.rs.remote.connected);
      });

      it("marks the node for deletion", async function() {
        const nodes = await this.rs.local.getNodes(["/foo/", "/foo/one"]);
        const folder = nodes["/foo/"];
        const node = nodes["/foo/one"];

        expect(Object.keys(folder.common.itemsMap)).to.deep.equal(["one", "two"]);
        expect(Object.keys(folder.local.itemsMap)).to.deep.equal(["two"]);
        expect(node.local.body).to.be.false;
        expect(node.push.body).to.be.false;
      });
    });

    describe("when disconnected", function() {
      beforeEach(async function() {
        this.rs.remote.connected = false;
        this.rs.remote.online = false;
        this.rs.caching.enable("/foo/");

        await this.rs.local.setNodes({
          "/foo/": {
            path: "/foo/",
            local: {
              itemsMap: {
                "one": true,
                "two": true
              },
              contentType: "application/ld+json",
              timestamp: new Date().getTime(),
              revision: "oldie-but-goodie"
            }
          },
          "/foo/one": {
            path: "/foo/one",
            local: {
              body: "some data",
              contentType: "text/plain",
              timestamp: new Date().getTime(),
              revision: "123456"
            }
          },
          "/foo/two": {
            path: "/foo/two",
            local: {
              body: "some other data",
              contentType: "text/plain",
              timestamp: new Date().getTime(),
              revision: "abcdef"
            }
          }
        });

        await this.rs.local.delete('/foo/one', this.rs.remote.connected);
      });

      it("deletes the node immediately", async function() {
        const nodes = await this.rs.local.getNodes(["/foo/", "/foo/one", "/foo/two"]);
        const folder = nodes["/foo/"];

        expect(folder.common).to.be.undefined;
        expect(Object.keys(folder.local.itemsMap)).to.deep.equal(["two"]);
        expect(nodes["/foo/one"]).to.be.undefined;
        expect(nodes["/foo/two"].local.revision).to.equal("abcdef");
      });
    });
  });

  describe("#_emitChangeEvents", function() {
    it("broadcasts the change to other browser tabs", function(done) {
      this.rs.local.broadcastChannel = {
        postMessage: (change) => {
          expect(change.newValue).to.equal("bar");
          done();
        }
      };

      this.rs.local._emitChangeEvents([
        {
          path: "/foo/bar",
          origin: 'window',
          oldValue: "foo",
          newValue: "bar",
          oldContentType: "text/plain",
          newContentType: "text/plain"
        }
      ]);
    });
  });
});
