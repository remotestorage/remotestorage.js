import "mocha";
import { expect } from "chai";

import InMemoryStorage from "../../build/inmemorystorage.js";
import { RemoteStorage } from "../../build/remotestorage.js";
import { Sync } from "../../build/sync.js";
import FakeAccess from "../helpers/fake-access.mjs";

const now = () => new Date().getTime();

describe("Cached folder listings", function() {
  beforeEach(function(done) {
    this.rs = new RemoteStorage();
    Object.defineProperty(this.rs, "access", {
      value: new FakeAccess(),
      writable: true,
      configurable: true
    });

    this.rs.on("features-loaded", () => {
      this.rs._handlers["connected"] = [];
      this.rs.local = new InMemoryStorage();
      this.rs.syncStopped = true;
      this.rs.sync = new Sync(this.rs);
      done();
    });
  });

  afterEach(function() {
    if (this.rs.sync) { Sync._rs_cleanup(this.rs); }
    this.rs = undefined;
  });

  describe("CachingLayer#get", function() {
    beforeEach(async function() {
      this.rs.remote.connected = true;
      this.rs.remote.online = true;
      await this.rs.local.setNodes({
        "/foo/": {
          path: "/foo/",
          common: {
            itemsMap: { "one": true, "two": true, "gone": false, "sub/": true },
            itemsMeta: {
              "one": { ETag: "etag-one", "Content-Type": "text/plain", "Content-Length": 5 },
              "two": { ETag: "etag-two" },
              "gone": { ETag: "etag-gone" },
              "sub/": { ETag: "etag-sub" }
            },
            revision: "folder-revision",
            timestamp: now()
          }
        }
      });
    });

    it("includes metadata for children (maxAge branch)", async function() {
      const res = await this.rs.local.get("/foo/", 60000, this.rs.sync.queueGetRequest.bind(this.rs.sync));
      expect(res.statusCode).to.equal(200);
      expect(res.body).to.deep.equal({
        "one": { ETag: "etag-one", "Content-Type": "text/plain", "Content-Length": 5 },
        "two": { ETag: "etag-two" },
        "sub/": { ETag: "etag-sub" }
      });
    });

    it("includes metadata for children (maxAge=false branch)", async function() {
      const res = await this.rs.local.get("/foo/", false, this.rs.sync.queueGetRequest.bind(this.rs.sync));
      expect(res.statusCode).to.equal(200);
      expect(res.body).to.deep.equal({
        "one": { ETag: "etag-one", "Content-Type": "text/plain", "Content-Length": 5 },
        "two": { ETag: "etag-two" },
        "sub/": { ETag: "etag-sub" }
      });
    });

    it("omits soft-deleted children in the maxAge branch", async function() {
      const res = await this.rs.local.get("/foo/", 60000, this.rs.sync.queueGetRequest.bind(this.rs.sync));
      expect(res.body).to.not.have.property("gone");
    });

    it("omits soft-deleted children in the maxAge=false branch", async function() {
      const res = await this.rs.local.get("/foo/", false, this.rs.sync.queueGetRequest.bind(this.rs.sync));
      expect(res.body).to.not.have.property("gone");
    });

    it("lists locally created items as true", async function() {
      await this.rs.local.setNodes({
        "/foo/": {
          path: "/foo/",
          common: {
            itemsMap: { "one": true },
            itemsMeta: { "one": { ETag: "etag-one" } },
            revision: "folder-revision",
            timestamp: now()
          },
          local: {
            itemsMap: { "one": true, "new": true },
            revision: "local-revision",
            timestamp: now()
          }
        }
      });

      const res = await this.rs.local.get("/foo/", false, this.rs.sync.queueGetRequest.bind(this.rs.sync));
      expect(res.body).to.deep.equal({
        "one": { ETag: "etag-one" },
        "new": true
      });
    });

    it("reads metadata from common, not from a stale local copy", async function() {
      await this.rs.local.setNodes({
        "/foo/": {
          path: "/foo/",
          common: {
            itemsMap: { "one": true },
            itemsMeta: { "one": { ETag: "fresh" } },
            revision: "folder-revision",
            timestamp: now()
          },
          local: {
            itemsMap: { "one": true, "new": true },
            itemsMeta: { "one": { ETag: "stale" } },
            revision: "local-revision",
            timestamp: now()
          }
        }
      });

      const res = await this.rs.local.get("/foo/", false, this.rs.sync.queueGetRequest.bind(this.rs.sync));
      expect(res.body).to.deep.equal({
        "one": { ETag: "fresh" },
        "new": true
      });
    });

    it("degrades gracefully for caches written before itemsMeta existed", async function() {
      await this.rs.local.setNodes({
        "/foo/": {
          path: "/foo/",
          common: {
            itemsMap: { "one": true },
            revision: "folder-revision",
            timestamp: now()
          }
        }
      });

      const res = await this.rs.local.get("/foo/", false, this.rs.sync.queueGetRequest.bind(this.rs.sync));
      expect(res.body).to.deep.equal({ "one": true });
    });
  });

  describe("CachingLayer#delete", function() {
    it("removes the deleted item from the parent's metadata", async function() {
      this.rs.remote.connected = true;
      await this.rs.local.setNodes({
        "/foo/": {
          path: "/foo/",
          common: {
            itemsMap: { "one": true, "two": true },
            itemsMeta: { "one": { ETag: "etag-one" }, "two": { ETag: "etag-two" } },
            revision: "folder-revision",
            timestamp: now()
          }
        },
        "/foo/one": {
          path: "/foo/one",
          common: { body: "data", contentType: "text/plain", revision: "rev-one", timestamp: now() }
        }
      });

      await this.rs.local.delete("/foo/one", true);

      const res = await this.rs.local.get("/foo/", false, this.rs.sync.queueGetRequest.bind(this.rs.sync));
      expect(res.body).to.deep.equal({ "two": { ETag: "etag-two" } });
    });
  });

  describe("Sync#handleResponse", function() {
    it("stores child metadata when fetching a folder", async function() {
      this.rs.remote.connected = true;
      this.rs.remote.online = true;
      await this.rs.sync.handleResponse("/foo/", "get", {
        statusCode: 200,
        body: {
          "one": { ETag: "etag-one", "Content-Type": "text/plain", "Content-Length": 5 },
          "sub/": { ETag: "etag-sub" }
        },
        contentType: "application/ld+json",
        revision: "folder-revision"
      });

      const nodes = await this.rs.local.getNodes(["/foo/"]);
      expect(nodes["/foo/"].common.itemsMeta).to.deep.equal({
        "one": { ETag: "etag-one", "Content-Type": "text/plain", "Content-Length": 5 },
        "sub/": { ETag: "etag-sub" }
      });

      const res = await this.rs.local.get("/foo/", false, this.rs.sync.queueGetRequest.bind(this.rs.sync));
      expect(res.body).to.deep.equal({
        "one": { ETag: "etag-one", "Content-Type": "text/plain", "Content-Length": 5 },
        "sub/": { ETag: "etag-sub" }
      });

      // Round-trip through the public API, which reads via the storage layer.
      const listing = await this.rs.scope("/foo/").getListing("");
      expect(listing).to.deep.equal({
        "one": { ETag: "etag-one", "Content-Type": "text/plain", "Content-Length": 5 },
        "sub/": { ETag: "etag-sub" }
      });
    });

    it("returns an empty listing for a 404 folder", async function() {
      await this.rs.sync.handleResponse("/foo/", "get", { statusCode: 404 });

      const res = await this.rs.local.get("/foo/", false, this.rs.sync.queueGetRequest.bind(this.rs.sync));
      expect(res.body).to.deep.equal({});
    });
  });

  describe("Sync#doTask refresh strategy", function() {
    beforeEach(function() {
      this.rs.remote.connected = true;
      this.rs.remote.online = true;
    });

    it("fetches a legacy folder without a revision condition", async function() {
      // A folder cached before `itemsMeta` existed: revision and itemsMap, but
      // no metadata. A conditional GET would return 304 and never populate it.
      await this.rs.local.setNodes({
        "/foo/": {
          path: "/foo/",
          common: {
            itemsMap: { "one": true },
            revision: "legacy-revision",
            timestamp: now()
          }
        }
      });

      let getArgs;
      this.rs.remote.get = function (...args) {
        getArgs = args;
        return Promise.resolve({ statusCode: 304, revision: "legacy-revision" });
      };

      await this.rs.sync.doTask("/foo/");

      expect(getArgs).to.deep.equal(["/foo/"]);
    });

    it("fetches a folder with metadata conditionally", async function() {
      await this.rs.local.setNodes({
        "/foo/": {
          path: "/foo/",
          common: {
            itemsMap: { "one": true },
            itemsMeta: { "one": { ETag: "etag-one" } },
            revision: "folder-revision",
            timestamp: now()
          }
        }
      });

      let getArgs;
      this.rs.remote.get = function (...args) {
        getArgs = args;
        return Promise.resolve({ statusCode: 304, revision: "folder-revision" });
      };

      await this.rs.sync.doTask("/foo/");

      expect(getArgs).to.deep.equal(["/foo/", { ifNoneMatch: "folder-revision" }]);
    });

    it("still fetches documents conditionally", async function() {
      await this.rs.local.setNodes({
        "/foo/one": {
          path: "/foo/one",
          common: {
            body: "data",
            contentType: "text/plain",
            revision: "doc-revision",
            timestamp: now()
          }
        }
      });

      let getArgs;
      this.rs.remote.get = function (...args) {
        getArgs = args;
        return Promise.resolve({ statusCode: 304, revision: "doc-revision" });
      };

      await this.rs.sync.doTask("/foo/one");

      expect(getArgs).to.deep.equal(["/foo/one", { ifNoneMatch: "doc-revision" }]);
    });
  });

  describe("BaseClient#getListing", function() {
    it("returns cached metadata", async function() {
      this.rs.remote.connected = true;
      this.rs.remote.online = true;
      await this.rs.local.setNodes({
        "/foo/": {
          path: "/foo/",
          common: {
            itemsMap: { "one": true, "sub/": true },
            itemsMeta: {
              "one": { ETag: "etag-one", "Content-Type": "text/plain" },
              "sub/": { ETag: "etag-sub" }
            },
            revision: "folder-revision",
            timestamp: now()
          }
        }
      });

      const client = this.rs.scope("/foo/");
      const listing = await client.getListing("");

      expect(listing).to.deep.equal({
        "one": { ETag: "etag-one", "Content-Type": "text/plain" },
        "sub/": { ETag: "etag-sub" }
      });
    });
  });

  describe("corruption validation", function() {
    it("accepts a folder node with valid itemsMeta", function() {
      const node = {
        path: "/foo/",
        common: {
          itemsMap: { "one": true },
          itemsMeta: { "one": { ETag: "etag-one" } },
          timestamp: now()
        }
      };

      expect(this.rs.sync.isCorrupt(node)).to.not.be.ok;
    });

    it("rejects itemsMeta whose value is not an object", function() {
      const node = {
        path: "/foo/",
        common: { itemsMap: { "one": true }, itemsMeta: { "one": "not-an-object" } }
      };

      expect(this.rs.sync.isCorrupt(node)).to.be.true;
    });

    it("rejects itemsMeta whose value has no ETag", function() {
      const node = {
        path: "/foo/",
        common: { itemsMap: { "one": true }, itemsMeta: { "one": { "Content-Type": "text/plain" } } }
      };

      expect(this.rs.sync.isCorrupt(node)).to.be.true;
    });

    it("rejects a non-object itemsMeta", function() {
      const node = {
        path: "/foo/",
        common: { itemsMap: {}, itemsMeta: "nope" }
      };

      expect(this.rs.sync.isCorrupt(node)).to.be.true;
    });
  });
});
