import "mocha";
import { expect } from "chai";

import { RemoteStorage } from "../../build/remotestorage.js";

describe("Caching", () => {
  let rs;

  beforeEach(() => {
    rs = new RemoteStorage();
  });

  describe("#set", () => {
    beforeEach(() => {
      rs.access.claim("example", "r");
    });

    describe("with no path given", () => {
      it("throws an error", async () => {
        expect(() => rs.caching.set(), "ALL").to.throw(/should be a string/);
      });
    });

    describe("with empty string", () => {
      it("throws an error", async () => {
        expect(() => rs.caching.set("", "ALL")).to.throw(/should be a folder/);
      });
    });

    describe("with invalid path (missing trailing slash)", () => {
      it("throws an error", async () => {
        expect(() => rs.caching.set("", "ALL")).to.throw(/should be a folder/);
      });
    });

    describe("with undefined strategy", () => {
      it("throws an error", async () => {
        expect(() => rs.caching.set("/example/")).to.throw(/should be 'F/);
      });
    });

    describe("with invalid strategy", () => {
      it("throws an error", async () => {
        expect(() => rs.caching.set("/example/", "YOLO")).to.throw(/should be 'F/);
      });
    });

    describe("without access to path", () => {
      it("throws an error", async () => {
        expect(() => rs.caching.set("/bookmarks/", "ALL")).to.throw(/No access/);
      });
    });

    describe("with valid arguments", () => {
      it("succeeds", async () => {
        expect(() => rs.caching.set("/example/", "ALL")).to.not.throw();
      });
    });
  });

  describe("#checkPath", () => {
    beforeEach(() => {
      rs.access.claim("foo", "r");
      rs.access.claim("bar", "r");
      rs.access.claim("baz", "r");
    });

    it("returns SEEN for paths that haven't been configured", async () => {
      expect(rs.caching.checkPath("/foo/")).to.equal("SEEN");
    });

    describe("subfolders", () => {
      it("returns caching settings for the given path and its subtree", async () => {
        rs.caching.set('/foo/', 'FLUSH');

        let config = {
          '/': 'SEEN',
          '/bar': 'SEEN',
          '/bar/': 'SEEN',
          '/bar/foo': 'SEEN',
          '/foo/': 'FLUSH',
          '/foo/bar': 'FLUSH',
          '/foo/bar/': 'FLUSH',
          '/foo/bar/baz': 'FLUSH',
          '/foo/bar/baz/': 'FLUSH'
        };

        for (const path in config) {
          expect(rs.caching.checkPath(path)).to.equal(config[path]);
        }
      });

      it("returns value of tightest fitting rootPath", async () => {
        rs.caching.set('/foo/', 'ALL');
        rs.caching.set('/foo/bar/baz/', 'FLUSH');
        rs.caching.set('/foo/baf/', 'SEEN');
        rs.caching.set('/bar/', 'FLUSH');

        let config = {
          '/foo/': 'ALL',
          '/foo/1': 'ALL',
          '/foo/2/': 'ALL',
          '/foo/2/3': 'ALL',
          '/foo/bar/': 'ALL',
          '/foo/bar/baz/': 'FLUSH',
          '/foo/baf/': 'SEEN',
          '/foo/baf/1': 'SEEN',
          '/foo/baf/2/': 'SEEN',
          '/foo/baf/2/1/': 'SEEN',
          '/bar/': 'FLUSH',
          '/bar/1': 'FLUSH',
          '/bar/2/': 'FLUSH',
          '/bar/2/3/': 'FLUSH',
          '/baz/': 'SEEN',
          '/baz/3/': 'SEEN',
        };

        for (const path in config) {
          expect(rs.caching.checkPath(path)).to.equal(config[path]);
        }
      });
    });
  });

  describe("#reset", () => {
    beforeEach(() => {
      rs.access.claim("foo", "r");
      rs.access.claim("bar", "r");
      rs.caching.set('/foo/', 'ALL');
      rs.caching.set('/foo/bar/baz/', 'ALL');
      rs.caching.set('/bar/foo/baz/', 'FLUSH');
    });

    it("resets the state", async () => {
      rs.caching.reset();

      expect(rs.caching.checkPath('/foo/'), 'SEEN');
      expect(rs.caching.checkPath('/bar/'), 'SEEN');
      expect(rs.caching._rootPaths, {});
    });
  });
});
