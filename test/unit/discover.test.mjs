import 'mocha';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import fetchMock from 'fetch-mock';

import { localStorage } from '../helpers/memoryStorage.mjs';

import Discover from '../../build/discover.js';

chai.use(chaiAsPromised);

Discover._rs_init();

const jrdJimmy = {
  "subject": "acct:jimmy@kosmos.org",
  "aliases": [
    "https://kosmos.social/@jimmy",
    "https://kosmos.social/users/jimmy"
  ],
  "links": [
    {
      "rel": "http://webfinger.net/rel/profile-page",
      "type": "text/html",
      "href": "https://kosmos.social/@jimmy"
    },
    {
      "rel": "self",
      "type": "application/activity+json",
      "href": "https://kosmos.social/users/jimmy"
    },
    {
      "rel": "http://ostatus.org/schema/1.0/subscribe",
      "template": "https://kosmos.social/authorize_interaction?uri={uri}"
    },
    {
      "rel": "http://tools.ietf.org/id/draft-dejong-remotestorage",
      "href": "https://storage.kosmos.org/jimmy",
      "properties": {
        "http://remotestorage.io/spec/version": "draft-dejong-remotestorage-13",
        "http://tools.ietf.org/html/rfc6749#section-4.2": "https://accounts.kosmos.org/rs/oauth/jimmy",
        "http://tools.ietf.org/html/rfc6750#section-2.3": null,
        "http://tools.ietf.org/html/rfc7233": "GET",
        "http://remotestorage.io/spec/web-authoring": null
      }
    }
  ]
};

const jrdJimbo = {
  "subject": "acct:jimmy@kosmos.social",
  "aliases": [
    "https://kosmos.social/@jimmy",
    "https://kosmos.social/users/jimmy"
  ],
  "links": [
    {
      "rel": "http://webfinger.net/rel/profile-page",
      "type": "text/html",
      "href": "https://kosmos.social/@jimmy"
    },
    {
      "rel": "self",
      "type": "application/activity+json",
      "href": "https://kosmos.social/users/jimmy"
    },
    {
      "rel": "http://ostatus.org/schema/1.0/subscribe",
      "template": "https://kosmos.social/authorize_interaction?uri={uri}"
    },
    {
      "rel": "http://webfinger.net/rel/avatar",
      "type": "image/jpeg",
      "href": "https://s3.kosmos.social/accounts/avatars/112/177/171/125/734/387/original/80b37acacf5c34d0.jpg"
    }
  ]
};

describe('Webfinger discovery', () => {

  describe('successful lookup', () => {
    before(() => {
      fetchMock.mock(
        'https://kosmos.org/.well-known/webfinger?resource=acct:jimmy@kosmos.org',
        { status: 200, body: jrdJimmy, headers: {
          'Content-Type': 'application/jrd+json; charset=utf-8'
        }},
      );
    });

    it("returns formatted storage info", async () => {
      await Discover('jimmy@kosmos.org').then(info => {
        expect(info.href).to.equal('https://storage.kosmos.org/jimmy');
        expect(info.storageApi).to.equal('draft-dejong-remotestorage-13');
        expect(info.authURL).to.equal('https://accounts.kosmos.org/rs/oauth/jimmy');
        expect(Object.keys(info.properties).length).to.equal(5);
      });
    });

    it("caches the info in localStorage", async () => {
      await Discover('jimmy@kosmos.org').then(() => {
        const cachedInfo = JSON.parse(localStorage.getItem('remotestorage:discover')).cache;
        expect(cachedInfo['jimmy@kosmos.org'].href).to.equal('https://storage.kosmos.org/jimmy');
      });
    });

    after(() => {
      localStorage.removeItem('remotestorage:discover');
      fetchMock.reset();
    });
  });

  describe('record missing', () => {
    before(() => {
      fetchMock.mock(
        /https?\:\/\/kosmos\.org\/\.well-known/,
        { status: 404, body: '' }
      );
    });

    it("rejects the request", async () => {
      await expect(Discover('jimbo@kosmos.org')).to.be.rejectedWith(/resource not found/);
    });

    after(() => fetchMock.reset());
  });

  describe('record does not contain RS properties', () => {
    before(() => {
      fetchMock.mock(
        'https://kosmos.org/.well-known/webfinger?resource=acct:jimbo@kosmos.org',
        { status: 200, body: jrdJimbo, headers: {
          'Content-Type': 'application/jrd+json; charset=utf-8'
        }},
      );
    });

    it("rejects the request", async () => {
      await expect(Discover('jimbo@kosmos.org')).to.be.rejectedWith(/WebFinger record for jimbo@kosmos.org does not have remotestorage defined/);
    });

    after(() => fetchMock.reset());
  });
});
