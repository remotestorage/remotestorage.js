import {localStorage} from '../helpers/memoryStorage';
import 'mocha';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import fetchMock from 'fetch-mock';
import config from "../../src/config";
import RemoteStorage from '../../src/remotestorage';
import Dropbox from "../../src/dropbox";


const SETTINGS_KEY = 'remotestorage:dropbox';
const ACCOUNT_URL = 'https://api.dropboxapi.com/2/users/get_current_account';
const FOLDER_URL = 'https://api.dropboxapi.com/2/files/list_folder';
const DOWNLOAD_URL = 'https://content.dropboxapi.com/2/files/download';
const UPLOAD_URL = 'https://content.dropboxapi.com/2/files/upload';
const DELETE_URL = 'https://api.dropboxapi.com/2/files/delete';
const METADATA_URL = 'https://api.dropboxapi.com/2/files/get_metadata';
const SHARING_URL = 'https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings';
const USER_ADDRESS = 'smith@gmail.com';
const ACCESS_TOKEN = 'sl.BPZFhZaFfYqb88';
const REFRESH_TOKEN = '4-_IbSBsp5wAAA';

chai.use(chaiAsPromised);


// This function is simple and has OK performance compared to more
// complicated ones: http://jsperf.com/json-escape-unicode/4
const charsToEncode = /[\u007f-\uffff]/g;
function httpHeaderSafeJson(obj) {
  return JSON.stringify(obj).replace(charsToEncode,
    function(c) {
      return '\\u'+('000'+c.charCodeAt(0).toString(16)).slice(-4);
    }
  );
}


describe('Dropbox backend', () => {
  const sandbox = sinon.createSandbox();
  const originalTimeout = config.requestTimeout;
  let rs, dropbox;
  const textEncoder = new TextEncoder();

  beforeEach(() => {
    localStorage.removeItem(SETTINGS_KEY);
    rs = new RemoteStorage();
    rs.setApiKeys({dropbox: 'swcj8jbc9i1jf1m'});   // an app would do this

    dropbox = rs.dropbox;
    dropbox.configure({
      userAddress: USER_ADDRESS,
      token: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
      tokenType: 'bearer',
    });
    dropbox.connected = true;
    dropbox.online = true;
    dropbox._initialFetchDone = true;
  });

  afterEach(() => {
    fetchMock.reset();
    sandbox.restore();
  });

  describe("infrastructure", () => {
    it("has a function `stopWaitingForToken`", () => {
      expect(typeof dropbox.stopWaitingForToken).to.equal('function');
    });

    it("aborts requests if they don't resolve by the configured timeout", async () => {
      config.requestTimeout = 20;

      const REVISION = '101';
      const CONTENT = "Able was I ere I saw Elba";
      const apiResult = {
        name: "grault",
        path_lower: "/remotestorage/corge/grault",
        path_display: "/remotestorage/corge/grault",
        rev: REVISION,
        size: CONTENT.length,
        content_hash: "3489e9a9d9"
      };
      fetchMock.mock({name: 'getFile', url: DOWNLOAD_URL}, {status: 200, body: CONTENT, headers: {'Dropbox-API-Result': httpHeaderSafeJson(apiResult)}}, {delay: 10_000});
      await expect(dropbox.get('/wug/blicket')).to.be.rejectedWith(/timeout/);

      config.requestTimeout = originalTimeout;
    });

    it("fetchDelta doesn't reject on timeouts", async () => {
      config.requestTimeout = 20;

      fetchMock.mock(
        {name: 'postFolder', method: 'POST', url: FOLDER_URL},
        {status: 200, body: JSON.stringify({entries: []})},
        {delay: 100}
      );
      await expect(dropbox.fetchDelta()).to.be.fulfilled;

      config.requestTimeout = originalTimeout;
    });

    it("fetchDelta fails when offline", async () => {
      fetchMock.mock(
        {name: 'postFolder', method: 'POST', url: FOLDER_URL},
        {throws: new TypeError("Failed to fetch")},
      );
      await expect(dropbox.fetchDelta()).to.be.rejected;
    });

    it("hooks itself into sync cycle when activated", async () => {
      // TODO: change the setup to be more like the real sequence of events
      fetchMock.mock(
        {name: 'postFolder', method: 'POST', url: FOLDER_URL},
        {status: 200, body: JSON.stringify({entries: []})}
      );

      const rs2 = new RemoteStorage();
      rs2.setApiKeys({dropbox: 'swcj8jbc9i1jf1m'});   // an app would do this
      rs2.backend = 'dropbox';
      rs2.sync = { sync: sinon.spy() };
      Dropbox._rs_init(rs2);

      const fetchDeltaSpy = sandbox.spy(rs2.dropbox, 'fetchDelta');

      rs2._emit('connected');

      expect(fetchDeltaSpy.callCount).to.equal(1);

      rs2.sync.sync();

      expect(fetchDeltaSpy.callCount).to.equal(2);
    });
  });

  describe("configure", () => {
    it('sets the the userAddress', async () => {
      await dropbox.configure({userAddress: 'foo@bar.com'});

      expect(dropbox.userAddress).to.equal('foo@bar.com');
    });

    it("doesn't overwrite parameters if they are given as 'undefined'", async () => {
      await dropbox.configure({userAddress: 'bob@bob.org'});
      expect(dropbox.userAddress).to.equal('bob@bob.org');

      await dropbox.configure({token: 'another-token'});
      expect(dropbox.token).to.equal('another-token');
      expect(dropbox.userAddress).to.equal('bob@bob.org');

      // await dropbox.configure({refreshToken: 'refresh-token'});
      // expect(dropbox.refreshToken).to.equal('refresh-token');
      // expect(dropbox.token).to.equal('another-token');
      // expect(dropbox.userAddress).to.equal('bob@bob.org');

      const persistent = JSON.parse(await localStorage.getItem(SETTINGS_KEY));
      expect(persistent.userAddress).to.equal('bob@bob.org');
      expect(persistent.token).to.equal('another-token');
      // expect(persistent.refreshToken).to.equal('refresh-token');

      await dropbox.configure({userAddress: null, token: null, refreshToken: null});
      // expect(dropbox.refreshToken).to.be.null;
      expect(dropbox.token).to.be.null;
      expect(dropbox.userAddress).to.be.null;

      const persistent2 = JSON.parse(await localStorage.getItem(SETTINGS_KEY));
      expect(persistent2).to.be.null;
    });

    it('fetches the user info when token but no userAddress is given', async () => {
      localStorage.removeItem(SETTINGS_KEY);
      const rs2 = new RemoteStorage();
      rs2.dropbox.connected = false;
      rs2.dropbox.online = true;

      fetchMock.mock(ACCOUNT_URL, {
        status: 200, body: {"email": "jane.doe@example.org"}
      });
      await rs2.dropbox.configure({token: 'new-access-token'});
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(rs2.dropbox.userAddress).to.equal('jane.doe@example.org');
      expect(rs2.dropbox.token).to.equal('new-access-token');
      expect(rs2.dropbox.connected).to.equal(true);
    });

    it('emits error event but resolves promise when a network error prevents fetching user info', async () => {
      localStorage.removeItem(SETTINGS_KEY);
      const rs2 = new RemoteStorage();
      const errorHandlerSpy = sinon.spy();
      rs2.on('error', errorHandlerSpy);
      rs2.dropbox.connected = false;
      rs2.dropbox.online = true;

      fetchMock.mock(ACCOUNT_URL, {throws: new TypeError('Failed to fetch')});
      await rs2.dropbox.configure({token: 'some-access-token'});
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(errorHandlerSpy.called).to.equal(true);
      expect(errorHandlerSpy.args[0]).to.match(/Could not fetch user info/);
      expect(rs2.dropbox.online).to.equal(false);
      expect(rs2.dropbox.connected).to.equal(false);
      expect(rs2.dropbox.token).to.equal('some-access-token');
      expect(rs2.dropbox.userAddress).to.be.undefined;
      expect(localStorage.getItem(SETTINGS_KEY)).to.be.a('string');
      const persistent = JSON.parse(await localStorage.getItem(SETTINGS_KEY));
      expect(persistent).to.have.property('token', 'some-access-token');
    });
  });

  describe("get", () => {
    it('rejects a promise if not connected', async () => {
      dropbox.connected = false;

      const p = dropbox.get('/frack');
      expect(p).to.be.instanceof(Promise);
      await expect(p).to.be.rejectedWith(/not connected/);
    });

    it('with network failure emits network-offline if remote.online was true, and wire-busy & wire-done', async () => {
      const mockNetworkOffline = sinon.spy();
      const mockWireBusy = sinon.spy();
      const mockWireDone = sinon.spy();
      rs.on('network-offline', mockNetworkOffline);
      rs.on('wire-busy', mockWireBusy);
      rs.on('wire-done', mockWireDone);

      fetchMock.mock(DOWNLOAD_URL, {throws: new TypeError('Failed to fetch')});
      await expect(dropbox.get('/baz', {})).to.be.rejectedWith(/Failed to fetch/);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(dropbox.online).to.equal(false);
      expect(mockNetworkOffline.called).to.equal(true);
      expect(mockWireBusy.called).to.equal(true);
      expect(mockWireDone.called).to.equal(true);
    });

    it('with network failure emits wire-busy & wire-done but not network-offline if remote.online was false', async () => {
      const mockNetworkOffline = sinon.spy();
      const mockWireBusy = sinon.spy();
      const mockWireDone = sinon.spy();
      rs.on('network-offline', mockNetworkOffline);
      rs.on('wire-busy', mockWireBusy);
      rs.on('wire-done', mockWireDone);
      dropbox.connected = true;
      dropbox.online = false;

      fetchMock.mock(DOWNLOAD_URL, {throws: new TypeError('Failed to fetch')}, {});
      await expect(dropbox.get('/qux', {})).to.be.rejectedWith(/Failed to fetch/);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mockNetworkOffline.called).to.equal(false);
      expect(mockWireBusy.called).to.equal(true);
      expect(mockWireDone.called).to.equal(true);
    });

    it('with success emits network-online and wire-busy & wire-done if remote.online was false', async () => {
      const mockNetworkOnline = sinon.spy();
      const mockWireBusy = sinon.spy();
      const mockWireDone = sinon.spy();
      rs.on('network-online', mockNetworkOnline);
      rs.on('wire-busy', mockWireBusy);
      rs.on('wire-done', mockWireDone);
      dropbox.connected = true;
      dropbox.online = false;

      fetchMock.mock(DOWNLOAD_URL, {status: 200, body: 'content', headers: {'Dropbox-API-Result': '{}'}});
      await dropbox.get('/quux', {});

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mockNetworkOnline.called).to.equal(true);
      expect(mockWireBusy.called).to.equal(true);
      expect(mockWireDone.called).to.equal(true);
    });


    it("returns a folder at the root", async () => {
      const body = {
        "entries": [{
          ".tag": "folder",
          name: "stuff",
          path_lower: "/remotestorage/stuff",
          path_display: "/remotestorage/stuff",
          id: "id:T-bOiISzOEQAAA"
        }],
        "cursor": "AAG2vbZJaaYdY3Wc_mS",
        "has_more": false
      };
      fetchMock.mock({name: 'postFolder', method: 'POST', url: FOLDER_URL}, {status: 200, body: body});
      const result = await dropbox.get('/');

      const calls = fetchMock.calls('postFolder');
      expect(calls).to.have.lengthOf(1);
      expect(calls[0][1].headers).to.have.property('Authorization', 'Bearer ' + ACCESS_TOKEN);
      expect(calls[0][1].headers).to.have.property('Content-Type').which.matches(/^application\/json\b/);
      expect(calls[0][1].body).to.equal(JSON.stringify({path: '/remotestorage'}));
      expect(result).to.have.property('statusCode', 200);
      expect(result).to.have.property('revision');
      expect(result).to.have.property('contentType').and.match(/^application\/json\b/);
      expect(result).to.have.property('body').which.is.an('object');
      expect(result.body).to.have.property('stuff/');
      expect(result.body['stuff/']).to.have.property('ETag').which.is.a('string').which.is.not.empty;
    });

    it("returns an empty listing when the root folder doesn't exist", async () => {
      fetchMock.mock({name: 'postFolder', method: 'POST', url: FOLDER_URL}, {status: 409, body: JSON.stringify({
          error_summary: 'path/not_found/..'
        })});
      const result = await dropbox.get('/');

      const calls = fetchMock.calls('postFolder');
      expect(calls).to.have.lengthOf(1);
      expect(calls[0][1].headers).to.have.property('Authorization', 'Bearer ' + ACCESS_TOKEN);
      expect(calls[0][1].headers).to.have.property('Content-Type').which.matches(/^application\/json\b/);
      expect(calls[0][1].body).to.equal(JSON.stringify({path: '/remotestorage'}));
      expect(result).to.have.property('statusCode', 200);
      expect(result).to.have.property('revision');
      expect(result).to.have.property('body').which.is.an('object').that.is.empty;
    });

    it("returns an empty listing when a nested folder doesn't exist", async () => {
      fetchMock.mock({name: 'postFolder', method: 'POST', url: FOLDER_URL}, {status: 409, body: JSON.stringify({
          error_summary: 'path/not_found/.'
        })});
      const result = await dropbox.get('/bookmarks/');

      const calls = fetchMock.calls('postFolder');
      expect(calls).to.have.lengthOf(1);
      expect(calls[0][1].headers).to.have.property('Authorization', 'Bearer ' + ACCESS_TOKEN);
      expect(calls[0][1].headers).to.have.property('Content-Type').which.matches(/^application\/json\b/);
      expect(calls[0][1].body).to.equal(JSON.stringify({path: '/remotestorage/bookmarks'}));
      expect(result).to.have.property('statusCode', 200);
      expect(result).to.have.property('revision');
      expect(result).to.have.property('body').which.is.an('object').that.is.empty;
    });

    it("makes as many requests as needed for folders with many entries", async () => {
      fetchMock.config.overwriteRoutes = false;
      fetchMock.mock(
        {name: 'postFolder', method: 'POST', url: FOLDER_URL, repeat: 1},
        {status: 200, body: JSON.stringify(payload(1, true))}
      ).mock(
        {method: 'POST', url: FOLDER_URL + '/continue', body: {cursor: 'cur1'}},
        {status: 200, body: JSON.stringify(payload(2, true))}
      ).mock(
        {url: FOLDER_URL + '/continue', body: {cursor: 'cur2'}},
        {status: 200, body: JSON.stringify(payload(3, false))}
      );
      function payload(num: number, hasMore: boolean) {
        return {
          entries: [
            {
              ".tag": "folder",
              name: "Folder" + num,
              path_lower: "/category/folder" + num,
              path_display: "/Category/Folder" + num,
              id: "id:T-bOiISzOEQA" + num
            },
            {
              ".tag": "file",
              name: "File" + num,
              path_lower: "/category/folder" + num + "/file" + num,
              path_display: "/Category/Folder" + num + "/File" + num,
              id: "id:T-bOiISzOEQAAAAAA" + num,
              client_modified: "2022-04-26T13:55:03Z",
              server_modified: "2022-04-27T13:55:03Z",
              rev: "5dd8f0a21b2fb006" + num,
              size: 280 + num,
              is_downloadable: true,
              content_hash: "6228aa93890acd" + num
            }
          ],
          has_more: hasMore,
          cursor: 'cur' + num
        };
      }
      const result = await dropbox.get('/Category/');

      const calls = fetchMock.calls();
      expect(calls).to.have.lengthOf(3);
      expect(calls[0][1].body).to.equal(JSON.stringify({path: '/remotestorage/Category'}));
      expect(calls[1][1].body).to.equal(JSON.stringify({cursor: 'cur1'}));
      expect(calls[2][1].body).to.equal(JSON.stringify({cursor: 'cur2'}));

      expect(result).to.have.property('statusCode', 200);
      expect(result).to.have.property('revision');
      expect(result).to.have.property('contentType').and.match(/^application\/json\b/);
      expect(result).to.have.property('body').which.is.an('object');
      expect(result.body).to.have.property('folder1/');
      expect(result.body['folder1/']).to.have.property('ETag').which.is.a('string').which.is.not.empty;
      expect(result.body).to.have.property('file1');
      expect(result.body['file1']).to.have.property('ETag', '5dd8f0a21b2fb0061');
      expect(result.body['file1']).to.have.property('Content-Length', 281);
      expect(result.body['file1']).to.have.property('Last-Modified').which.matches(/^\w\w\w, \d\d \w\w\w \d\d\d\d \d\d:\d\d:\d\d GMT$/);
      // expect(result.body['file1']).to.have.property('Content-Type').which.is.a('number');
      expect(result.body).to.have.property('folder2/');
      expect(result.body['folder2/']).to.have.property('ETag').which.is.a('string').which.is.not.empty;
      expect(result.body).to.have.property('file2');
      expect(result.body['file2']).to.have.property('ETag', '5dd8f0a21b2fb0062');
      expect(result.body).to.have.property('folder3/');
      expect(result.body['folder3/']).to.have.property('ETag').which.is.a('string').which.is.not.empty;
      expect(result.body).to.have.property('file3');
      expect(result.body['file3']).to.have.property('ETag', '5dd8f0a21b2fb0063');
      expect(result.body['file3']).to.have.property('Content-Length', 283);
      expect(result.body['file3']).to.have.property('Last-Modified').which.matches(/^\w\w\w, \d\d \w\w\w \d\d\d\d \d\d:\d\d:\d\d GMT$/);
      // expect(result.body['file3']).to.have.property('Content-Type').which.is.a('number');
    });

    /* happy path */
    it('text file with success emits wire-busy & wire-done but not network-online if remote.online was true', async () => {
      const mockNetworkOnline = sinon.spy();
      const mockWireBusy = sinon.spy();
      const mockWireDone = sinon.spy();
      rs.on('network-online', mockNetworkOnline);
      rs.on('wire-busy', mockWireBusy);
      rs.on('wire-done', mockWireDone);
      dropbox.connected = true;
      dropbox.online = true;

      const CONTENT = "Once and never again.";
      const REVISION = "5e8d6825";
      const apiResult = {
        name: "grault",
        path_lower: "/remotestorage/corge/grault",
        path_display: "/remotestorage/corge/grault",
        id: "id:T-bOiI",
        client_modified: "2022-09-17T02:48:10Z",
        server_modified: "2022-09-18T12:00:00Z",
        rev: REVISION,
        size: CONTENT.length,
        is_downloadable: true,
        content_hash: "f7e2cc8d4c6"
      };
      fetchMock.mock({name: 'getFile', url: DOWNLOAD_URL}, {status: 200, body: CONTENT, headers: {'Dropbox-API-Result': httpHeaderSafeJson(apiResult), 'Content-Type': 'application/octet-stream'}});
      const result = await dropbox.get('/corge/grault', {});

      const calls = fetchMock.calls('getFile');
      expect(calls).to.have.lengthOf(1);
      expect(calls[0][1]).to.have.property('headers');
      expect(calls[0][1].headers).to.have.property('Authorization', 'Bearer ' + ACCESS_TOKEN);
      expect(calls[0][1].headers).to.have.property('Dropbox-API-Arg', JSON.stringify({path: '/remotestorage/corge/grault'}));
      expect(result).to.have.property('statusCode', 200);
      expect(result).to.have.property('body', CONTENT);
      // expect(result).to.have.property('contentType').and.match(/^text\/plain\b/);
      expect(result).to.have.property('revision', REVISION);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mockNetworkOnline.called).to.equal(false);
      expect(mockWireBusy.called).to.equal(true);
      expect(mockWireDone.called).to.equal(true);
    });

    const textTypes = ['text/plain', 'text/markdown', 'text/csv', 'text/html', 'application/mathml+xml','application/xhtml+xml','image/svg+xml','application/x-yaml','application/javascript', 'application/ecmascript','message/rfc822'];
    textTypes.forEach(type => {
      it(`downloads a ${type} file intact`, async () => {
        const content = `Some text nominally of type ${type}`;
        const data = textEncoder.encode(content);
        const REVISION = "1001";
        const apiResult = {
          name: type.split('/')[1],
          path_lower: "/remotestorage/" + type,
          path_display: "/remotestorage/" + type,
          id: "id:B-lkdfjd" + type,
          client_modified: "2022-09-17T02:48:10Z",
          server_modified: "2022-09-18T12:00:00Z",
          rev: REVISION,
          size: content.length,
          is_downloadable: true,
          content_hash: "cde930a"
        };
        fetchMock.mock({name: 'getFile', url: DOWNLOAD_URL}, {status: 200, body: data, headers: {'Content-Type': 'application/octet-stream', 'Dropbox-API-Result': httpHeaderSafeJson(apiResult)}}, {sendAsJson: false});
        const result = await dropbox.get('/' + type);

        const calls = fetchMock.calls('getFile');
        expect(calls).to.have.lengthOf(1);
        expect(calls[0][1]).to.have.property('headers');
        expect(calls[0][1].headers).to.have.property('Dropbox-API-Arg', JSON.stringify({path: '/remotestorage/' + type}));
        expect(result).to.have.property('statusCode', 200);
        expect(result).to.have.property('body').which.equals(content);
        // expect(result).to.have.property('contentType', type);
        expect(result).to.have.property('revision', REVISION);
      });
    });

    /* also happy path */
    it('JSON file returns parsed JSON', async () => {
      const OBJECT = {
        openapi: "3.1.0",
        servers: [
          { url: "https://example.edu/" }
        ],
      };
      const CONTENT = JSON.stringify(OBJECT);
      const REVISION = "9a8d193fb";
      const apiResult = {
        name: "waldo",
        path_lower: "/remotestorage/garply/waldo",
        path_display: "/remotestorage/garply/waldo",
        id: "id:T-lkjdlf",
        client_modified: "2022-09-17T02:48:10Z",
        server_modified: "2022-09-18T12:00:00Z",
        rev: REVISION,
        size: CONTENT.length,
        is_downloadable: true,
        content_hash: "f7e2cc8d4c6"
      };
      fetchMock.mock({name: 'getFile', url: DOWNLOAD_URL}, {status: 200, body: CONTENT, headers: {'Content-Type': 'application/octet-stream', 'Dropbox-API-Result': httpHeaderSafeJson(apiResult)}});
      const result = await dropbox.get('/garply/waldo');

      const calls = fetchMock.calls('getFile');
      expect(calls).to.have.lengthOf(1);
      expect(calls[0][1]).to.have.property('headers');
      expect(calls[0][1].headers).to.have.property('Authorization', 'Bearer ' + ACCESS_TOKEN);
      expect(calls[0][1].headers).to.have.property('Dropbox-API-Arg', JSON.stringify({path: '/remotestorage/garply/waldo'}));
      expect(result).to.have.property('statusCode', 200);
      expect(result).to.have.property('body').which.deep.equals(OBJECT);
      expect(result).to.have.property('contentType').and.match(/^application\/json\b/);
      expect(result).to.have.property('revision', REVISION);
    });

    const binaryTypes = ['application/octet-stream', 'image/jpeg', 'audio/ogg', 'video/mp4', 'font/woff2', 'application/mathematica', 'text/rtf', 'model/gltf-binary'];
    binaryTypes.forEach(type => {
      it(`returns ${type} file as an ArrayBuffer`, async () => {
        const data = new Int32Array([21, 2_147_483_647, -42, 0, 69, -2_147_483_648]);
        const revision = "1001";
        const apiResult = {
          name: type.split('/')[1],
          path_lower: "/remotestorage/" + type,
          path_display: "/remotestorage/" + type,
          id: "id:B-lkdfjd" + type,
          client_modified: "2022-09-17T02:48:10Z",
          server_modified: "2022-09-18T12:00:00Z",
          rev: revision,
          size: data.length,
          is_downloadable: true,
          content_hash: "cde930a"
        };
        fetchMock.mock({name: 'getFile', url: DOWNLOAD_URL}, {status: 200, body: data, headers: {'Content-Type': 'application/octet-stream', 'Dropbox-API-Result': httpHeaderSafeJson(apiResult)}}, {sendAsJson: false});
        const result = await dropbox.get('/' + type);

        const calls = fetchMock.calls('getFile');
        expect(calls).to.have.lengthOf(1);
        expect(calls[0][1]).to.have.property('headers');
        expect(calls[0][1].headers).to.have.property('Dropbox-API-Arg', JSON.stringify({path: '/remotestorage/' + type}));
        expect(result).to.have.property('statusCode', 200);
        // expect(result).to.have.property('contentType', type);
        expect(result).to.have.property('revision', revision);
        expect(result).to.have.property('body').which.is.instanceof(ArrayBuffer);
        expect(ArrayBuffer.isView(result.body)).to.equal(false);
        expect(new Int32Array(result.body)).to.deep.equal(data);
      });
    });

    it("JSON encodes a Dropbox-API-Arg header", async () => {
      const data = new Uint16Array([21, 31, 65536, 42, 0, 69]);
      const revision = '2001';
      const apiResult = {
        name: "café.txt",
        path_lower: "/remotestorage/straße/café.txt",
        path_display: "/remotestorage/straße/café.txt",
        id: "id:T-oisjl",
        client_modified: "2022-09-17T02:48:10Z",
        server_modified: "2022-09-18T12:00:00Z",
        rev: revision,
        size: data.length * data.BYTES_PER_ELEMENT,
        is_downloadable: true,
        content_hash: "f7e2cc8d4c6"
      };

      fetchMock.mock({name: 'getFile', url: DOWNLOAD_URL}, {status: 200, body: data, headers: {'Dropbox-API-Result': httpHeaderSafeJson(apiResult)}}, {sendAsJson: false});
      const result = await dropbox.get('/straße/café.txt');

      const calls = fetchMock.calls('getFile');
      expect(calls).to.have.lengthOf(1);
      expect(calls[0][1]).to.have.property('headers');
      expect(calls[0][1].headers).to.have.property('Dropbox-API-Arg', '{"path":"/remotestorage/stra\\u00dfe/cafe\\u0301.txt"}');
      expect(result).to.have.property('statusCode', 200);
      expect(result).to.have.property('contentType', null);
      expect(result).to.have.property('revision', revision);
      expect(result).to.have.property('body').which.is.instanceof(ArrayBuffer);
      expect(ArrayBuffer.isView(result.body)).to.equal(false);
      expect(new Uint16Array(result.body)).to.deep.equal(data);
    });

    it("responds with status 304 Not Modified if revision matches the server", async () => {
      fetchMock.mock({name: 'getFile', url: DOWNLOAD_URL}, {status: 304});
      const result = await dropbox.get('/fred/plugh', { ifNoneMatch: 'corned-beef-hash' });

      const calls = fetchMock.calls('getFile');
      expect(calls).to.have.lengthOf(1);
      expect(calls[0][1]).to.have.property('headers');
      expect(calls[0][1].headers).to.have.property('Authorization', 'Bearer ' + ACCESS_TOKEN);
      expect(calls[0][1].headers).to.have.property('Dropbox-API-Arg', JSON.stringify({path: '/remotestorage/fred/plugh'}));
      expect(calls[0][1].headers).to.have.property('If-None-Match', 'corned-beef-hash');
      expect(result).to.have.property('statusCode', 304);
    });

    it("returns 200 and content if revision doesn't match the server", async () => {
      const CONTENT = "The rain in Spain stays mainly in the plain.";
      const REVISION = "1002";
      const apiResult = {
        name: "gimbal",
        path_lower: "/remotestorage/orlap/gimbal",
        path_display: "/remotestorage/orlap/gimbal",
        id: "id:A-l329v",
        client_modified: "2022-09-17T02:48:10Z",
        server_modified: "2022-09-18T12:00:00Z",
        rev: REVISION,
        size: CONTENT.length,
        is_downloadable: true,
        content_hash: "939d9a9e9"
      };
      fetchMock.mock({name: 'getFile', url: DOWNLOAD_URL}, {status: 200, body: CONTENT, headers: {'Dropbox-API-Result': httpHeaderSafeJson(apiResult)}});
      const result = await dropbox.get('/orlap/gimbal', { ifNoneMatch: '1001' });

      const calls = fetchMock.calls('getFile');
      expect(calls).to.have.lengthOf(1);
      expect(calls[0][1]).to.have.property('headers');
      expect(calls[0][1].headers).to.have.property('Dropbox-API-Arg', JSON.stringify({path: '/remotestorage/orlap/gimbal'}));
      expect(calls[0][1].headers).to.have.property('If-None-Match', '1001');
      expect(result).to.have.property('statusCode', 200);
      expect(result).to.have.property('body', CONTENT);
    });

    it("passes on status 401 Unauthorized from the server", async () => {
      fetchMock.mock(
        {name: 'getFile', url: DOWNLOAD_URL},
        {status: 401, body: JSON.stringify({error_summary: "expired_access_token/", error: {".tag": "expired_access_token"}})}
      );
      const result = await dropbox.get('/xyzzy');

      const calls = fetchMock.calls('getFile');
      expect(calls).to.have.lengthOf(1);
      expect(calls[0][1]).to.have.property('headers');
      expect(calls[0][1].headers).to.have.property('Authorization', 'Bearer ' + ACCESS_TOKEN);
      expect(calls[0][1].headers).to.have.property('Dropbox-API-Arg', JSON.stringify({path: '/remotestorage/xyzzy'}));
      expect(calls[0][1].headers).not.to.have.property('If-None-Match');
      expect(result).to.have.property('statusCode', 401);
    });

    it("returns status 404 when file does not exist", async () => {
      fetchMock.mock(
        {name: 'getFile', url: DOWNLOAD_URL},
        {status: 409, body: JSON.stringify({error_summary: 'path/not_found/...'})}
      );
      const result = await dropbox.get('/hoge');

      const calls = fetchMock.calls('getFile');
      expect(calls).to.have.lengthOf(1);
      expect(calls[0][1]).to.have.property('headers');
      expect(calls[0][1].headers).to.have.property('Authorization', 'Bearer ' + ACCESS_TOKEN);
      expect(calls[0][1].headers).to.have.property('Dropbox-API-Arg', JSON.stringify({path: '/remotestorage/hoge'}));
      expect(calls[0][1].headers).not.to.have.property('If-None-Match');
      expect(result).to.have.property('statusCode', 404);
      expect(result.body).to.be.undefined;
    });

    it("rejects promise on status 409 [most errors] from the server", async () => {
      fetchMock.mock(
        {name: 'getFile', url: DOWNLOAD_URL},
        {status: 409, body: JSON.stringify({
            "error_summary": "to/no_write_permission/..",
            "error": {".tag": "to", "to": {".tag": "no_write_permission"}}
          })}
      );
      await expect(dropbox.get('/thud')).to.be.rejectedWith(/no_write_permission/);

      const calls = fetchMock.calls('getFile');
      expect(calls).to.have.lengthOf(1);
      expect(calls[0][1]).to.have.property('headers');
      expect(calls[0][1].headers).to.have.property('Authorization', 'Bearer ' + ACCESS_TOKEN);
      expect(calls[0][1].headers).to.have.property('Dropbox-API-Arg', JSON.stringify({path: '/remotestorage/thud'}));
      expect(calls[0][1].headers).not.to.have.property('If-None-Match');
    });

    // TODO: can the user_message field of errors be passed to the user?

    it("reports changes in subfolders after sync", async () => {
      const initialEntries = [
        {'.tag': 'file', path_lower: '/remotestorage/file', rev: '1'},
        {'.tag': 'folder', path_lower: '/remotestorage/foo'}
      ];
      fetchMock.config.overwriteRoutes = false;
      fetchMock.mock(
        {name: 'postFolder', method: 'POST', url: FOLDER_URL, repeat: 1},
        {status: 200, body: JSON.stringify({entries: initialEntries})},
        {repeat: 2}
      );
      const result1 = await dropbox.get('/');

      expect(fetchMock.calls()).to.have.lengthOf(1);
      expect(result1).to.have.property('statusCode', 200);
      expect(result1).to.have.property('revision').which.is.a('string');
      expect(result1).to.have.property('body').which.is.an('object');
      expect(result1.body).to.have.property('foo/').which.is.an('object');
      expect(result1.body['foo/']).to.have.property('ETag').which.is.a('string');
      const initialFooRev = result1.body['foo/'].ETag;

      await expect(dropbox.fetchDelta()).to.be.fulfilled;
      expect(fetchMock.calls()).to.have.lengthOf(2);

      const result2 = await dropbox.get('/', { ifNoneMatch: result1.revision });

      expect(fetchMock.calls()).to.have.lengthOf(2);
      expect(result2).to.have.property('statusCode', 304);
      expect(dropbox._revCache.get('/foo/')).equals(initialFooRev);

      fetchMock.reset();
      fetchMock.mock(
        {name: 'postFolder', method: 'POST', url: FOLDER_URL, repeat: 1},
        {status: 200, body: JSON.stringify({
            entries: [...initialEntries,
              {'.tag': 'file', path_lower: '/remotestorage/foo/bar', rev: '1'},
            ]
          })},
        {repeat: 2}
      );
      await expect(dropbox.fetchDelta()).to.be.fulfilled;
      expect(fetchMock.calls()).to.have.lengthOf(1);

      const result3 = await dropbox.get('/', { ifNoneMatch: result1.revision });

      expect(fetchMock.calls()).to.have.lengthOf(2);
      expect(result3).to.have.property('statusCode', 200);   // not 304 Not Modified
      expect(result3).to.have.property('revision').which.is.a('string');
      expect(result3.revision).not.to.equal(result1.revision);
      expect(result3).to.have.property('body').which.is.an('object');
      expect(result3.body).to.have.property('foo/').which.is.an('object');
      expect(result3.body['foo/']).to.have.property('ETag').which.is.a('string');
      expect(result3.body['foo/'].ETag).not.to.equal(initialFooRev);
    });

    it("calls share() after getting a public path (and the value returned by get is unchanged)", async () => {
      sandbox.spy(dropbox, 'share');

      const CONTENT = "Good news!";
      const REVISION = "101";
      const apiResult = {
        name: "announcement",
        path_lower: "/remotestorage/public/announcement",
        path_display: "/remotestorage/public/announcement",
        id: "id:Z-ljsfa9",
        client_modified: "2022-09-17T02:48:10Z",
        server_modified: "2022-09-18T12:00:00Z",
        rev: REVISION,
        size: CONTENT.length,
        is_downloadable: true,
        content_hash: "f7e2cc8d4c6"
      };
      fetchMock.mock({name: 'getFile', url: DOWNLOAD_URL},
        {status: 200, body: CONTENT, headers: {'Dropbox-API-Result': httpHeaderSafeJson(apiResult)}});
      fetchMock.mock({name: 'postSharing', method: 'POST', url: SHARING_URL},
        {status: 200, body: JSON.stringify({
            name: 'announcement',
            path_lower: '/remotestorage/public/announcement',
            url: 'https://dropbox.sharing/url'
        })});
      const result = await dropbox.get('/public/announcement');

      let calls = fetchMock.calls();
      expect(calls.length).to.be.greaterThanOrEqual(1);
      expect(calls[0][1]).to.have.property('headers');
      expect(calls[0][1].headers).to.have.property('Dropbox-API-Arg', JSON.stringify({path: '/remotestorage/public/announcement'}));
      expect(result).to.have.property('statusCode', 200);
      expect(result.body).to.equal(CONTENT);

      await new Promise(resolve => setInterval(() => {
        if (fetchMock.calls().length >= 2) { resolve(null); }
      }, 5));
      calls = fetchMock.calls();
      expect(calls[1][0]).to.equal(SHARING_URL);
      expect(calls[1][1].headers).to.have.property('Content-Type').which.matches(/^application\/json\b/);
      const shareBody = JSON.parse(calls[1][1].body as string);
      expect(shareBody).to.have.property('path', '/remotestorage/public/announcement');
      expect(calls).to.have.lengthOf(2);

      expect(dropbox.share.callCount).to.equal(1);
      expect(dropbox.share.getCall(0).args[0]).to.equal('/public/announcement');
      expect(dropbox._itemRefs['/public/announcement']).to.equal('https://dropbox.sharing/url');
    });
  });

  describe("put", () => {
    it('rejects a promise if not connected', async () => {
      dropbox.connected = false;

      const p = dropbox.put('/bar', 'spam', 'text/plain', {});
      expect(p).to.be.instanceof(Promise);
      await expect(p).to.be.rejectedWith(/not connected/);
    });

    it("responds with status 200 on successful unconditional put", async () => {
      fetchMock.mock(
        {name: 'postUpload', method: 'POST', url: UPLOAD_URL},
        {status: 200, body: JSON.stringify({path: '/remotestorage/straße/Það.txt', rev: '101'})}
      );
      const result = await dropbox.put('/straße/Það.txt', 'some data', 'text/plain');

      const calls = fetchMock.calls();
      expect(calls).to.have.lengthOf(1);
      expect(calls[0][0]).to.equal(UPLOAD_URL);
      expect(calls[0][1].headers).to.have.property('Authorization', 'Bearer ' + ACCESS_TOKEN);
      expect(calls[0][1].headers).to.have.property('Dropbox-API-Arg', '{"path":"/remotestorage/stra\\u00dfe/\\u00dea\\u00f0.txt","mode":{".tag":"overwrite"},"mute":true}');
      expect(calls[0][1].body).to.equal('some data');
      expect(result).to.have.property('statusCode', 200);
      expect(result).to.have.property('revision', '101');
      expect(dropbox._revCache.get('/straße/Það.txt')).to.equal('101');
    });

    it("causes the revision to propagate down in revCache", async () => {
      dropbox._revCache.set('/', '101');
      dropbox._revCache.set('/zwelp/', '101');
      dropbox._revCache.set('/zwelp/onk', '101');

      fetchMock.mock(
        {name: 'postUpload', method: 'POST', url: UPLOAD_URL},
        {status: 200, body: JSON.stringify({path: '/remotestorage/zwelp/onk', rev: '102'})}
      );
      const result = await dropbox.put('/zwelp/onk', 'data', 'text/plain');

      const calls = fetchMock.calls();
      expect(calls).to.have.lengthOf(1);
      expect(calls[0][0]).to.equal(UPLOAD_URL);
      expect(calls[0][1].headers).to.have.property('Dropbox-API-Arg', JSON.stringify({"path":"/remotestorage/zwelp/onk","mode":{".tag":"overwrite"},"mute":true}));
      expect(calls[0][1].body).to.equal('data');
      expect(result).to.have.property('statusCode', 200);
      expect(result).to.have.property('revision', '102');
      expect(dropbox._revCache.get('/zwelp/onk')).to.equal('102');
      expect(dropbox._revCache.get('/zwelp/')).to.not.equal('101');
      expect(dropbox._revCache.get('/')).to.not.equal('101');
    });

    it("responds with status 412 if ifMatch condition doesn't match from cache", async () => {
      dropbox._revCache.set('/rep/lok', '102');

      const result = await dropbox.put('/rep/lok', 'data', 'text/plain', { ifMatch: '101' });
      expect(fetchMock.calls()).to.have.lengthOf(0);
      expect(result).to.have.property('statusCode', 412);
      expect(result).to.have.property('revision', '102');
    });

    it("responds with status 412 if ifMatch condition doesn't match from server", async () => {
      dropbox._revCache.set('/zom/baz', '101');

      fetchMock.mock(
        {name: 'postMetadata', method: 'POST', url: METADATA_URL},
        {status: 200, body: JSON.stringify({
            ".tag": "file",
            path_display: '/remotestorage/zom/baz', path_lower: '/remotestorage/zom/baz',
            rev: '102'})}
      );
      const result = await dropbox.put('/zom/baz', 'data', 'text/plain', { ifMatch: '101' });

      expect(fetchMock.calls()).to.have.lengthOf(1);
      expect(result).to.have.property('statusCode', 412);
      expect(result).to.have.property('revision', '102');
    });

    it("succeeds if ifMatch condition matches", async () => {
      dropbox._revCache.set('/mif/maf', '101');

      fetchMock.mock(
        {name: 'postMetadata', method: 'POST', url: METADATA_URL},
        {status: 200, body: JSON.stringify({
            ".tag": "file",
            path_display: '/remotestorage/mif/maf', path_lower: '/remotestorage/mif/maf',
            rev: '101'})}
      );
      fetchMock.mock(
        {name: 'postUpload', method: 'POST', url: UPLOAD_URL},
        {status: 200, body: JSON.stringify({path: '/remotestorage/mif/maf', rev: '102'})}
      );
      const result = await dropbox.put('/mif/maf', 'data', 'text/plain',  { ifMatch: '101' });

      const calls = fetchMock.calls();
      expect(calls).to.have.lengthOf(2);
      expect(calls[0][0]).to.equal(METADATA_URL);
      expect(calls[0][1].body).to.equal(JSON.stringify({"path":"/remotestorage/mif/maf"}));
      expect(calls[1][0]).to.equal(UPLOAD_URL);
      expect(calls[1][1].body).to.equal("data");
      expect(result).to.have.property('statusCode', 200);
      expect(result).to.have.property('revision', '102');
    });

    it("responds with status 412 if ifNoneMatch * condition fails from cache", async () => {
      dropbox._revCache.set('/zor/fim', '101');

      const result = await dropbox.put('/zor/fim', 'data', 'text/plain',  { ifNoneMatch: '*' });

      const calls = fetchMock.calls();
      expect(calls).to.have.lengthOf(0);
      expect(result).to.have.property('statusCode', 412);
      expect(result).to.have.property('revision', '101');
    });

    it("responds with status 412 if ifNoneMatch * condition fails from server", async () => {
      fetchMock.mock(
        {name: 'postMetadata', method: 'POST', url: METADATA_URL},
        {status: 200, body: JSON.stringify({hash: 'hash123', rev: '101'})}
      );
      const result = await dropbox.put('/zor/fud', 'data', 'text/plain',  { ifNoneMatch: '*' });

      const calls = fetchMock.calls();
      expect(calls).to.have.lengthOf(1);
      expect(calls[0][0]).to.equal(METADATA_URL);
      expect(calls[0][1].body).to.equal(JSON.stringify({"path":"/remotestorage/zor/fud"}));
      expect(result).to.have.property('statusCode', 412);
      expect(result).to.have.property('revision', '101');
    });

    it("succeeds if ifNoneMatch * condition succeeds", async () => {
      fetchMock.mock(
        {name: 'postMetadata', method: 'POST', url: METADATA_URL},
        {status: 409, body: JSON.stringify({
            error_summary: "path/not_found/",
            error: {".tag": "path", path: {".tag": "not_found"}}
          })}
      );
      fetchMock.mock(
        {name: 'postUpload', method: 'POST', url: UPLOAD_URL},
        {status: 200, body: JSON.stringify({path: '/remotestorage/zor/mop', rev: '101'})}
      );
      const result = await dropbox.put('/zor/mop', 'data', 'text/plain',  { ifNoneMatch: '*' });

      const calls = fetchMock.calls();
      expect(calls).to.have.lengthOf(2);
      expect(calls[0][0]).to.equal(METADATA_URL);
      expect(calls[0][1].body).to.equal(JSON.stringify({"path":"/remotestorage/zor/mop"}));
      expect(calls[1][0]).to.equal(UPLOAD_URL);
      expect(calls[1][1].body).to.equal("data");
      expect(result).to.have.property('statusCode', 200);
      expect(result).to.have.property('revision', '101');
    });

    it("returns status 412 if ifMatch condition fails from cache", async () => {
      dropbox._revCache.set('/tutu/tyty', '102');

      const result = await dropbox.put('/tutu/tyty', 'data', 'text/plain',  { ifMatch: '101' });

      const calls = fetchMock.calls();
      expect(calls).to.have.lengthOf(0);
      expect(result).to.have.property('statusCode', 412);
      expect(result).to.have.property('revision', '102');
    });

    it("returns the error status it received from DropBox", async () => {
      fetchMock.mock(
        {name: 'postUpload', method: 'POST', url: UPLOAD_URL},
        {status: 401}
      );
      const result = await dropbox.put('/titi/toto', 'more data', 'text/plain');

      const calls = fetchMock.calls();
      expect(calls).to.have.lengthOf(1);
      expect(calls[0][0]).to.equal(UPLOAD_URL);
      expect(calls[0][1].headers).to.have.property('Dropbox-API-Arg', JSON.stringify({"path":"/remotestorage/titi/toto","mode":{".tag":"overwrite"},"mute":true}));
      expect(calls[0][1].body).to.equal('more data');
      expect(result).to.have.property('statusCode', 401);
      expect(result).not.to.have.property('revision');
      expect(dropbox._revCache.get('/titi/toto')).to.be.a('string');
    });
  });

  describe("delete", () => {
    it('rejects a promise if not connected', async () => {
      dropbox.connected = false;

      const p = dropbox.delete('/spam', {});
      expect(p).to.be.instanceof(Promise);
      await expect(p).to.be.rejectedWith(/not connected/);
    });

    it("deletes file and removes it from revCache, without condition", async () => {
      dropbox._revCache.set('/spam/ham', '1001');

      fetchMock.mock(
        {name: 'postDelete', method: 'POST', url: DELETE_URL},
        {status: 200, body: JSON.stringify({
            '.tag': 'file', rev: '1001', name: 'ham',
            path_display: "/remotestorage/spam/ham", path_lower: "/remotestorage/spam/ham"})}
      );
      const result = await dropbox.delete('/spam/ham');

      const calls = fetchMock.calls();
      expect(calls).to.have.lengthOf(1);
      expect(calls[0][0]).to.equal(DELETE_URL);
      expect(calls[0][1]).to.have.property('method', 'POST');
      expect(calls[0][1].headers).to.have.property('Authorization', 'Bearer ' + ACCESS_TOKEN);
      expect(calls[0][1].headers).to.have.property('Content-Type').which.matches(/^application\/json\b/);
      expect(calls[0][1]).to.have.property('body', JSON.stringify({path: "/remotestorage/spam/ham"}));
      expect(result).to.have.property('statusCode', 200);
      expect(dropbox._revCache.get('/spam/ham')).to.be.null;
    });

    it("returns status 412, when ifMatch condition fails", async () => {
      dropbox._revCache.set('/eggs/toast', '1002');

      const result = await dropbox.delete('/eggs/toast', { ifMatch: '1001'});
      expect(fetchMock.calls()).to.have.lengthOf(0);
      expect(result).to.have.property('statusCode', 412);
      expect(dropbox._revCache.get('/eggs/toast')).to.equal('1002');
    });

    it("deletes file and removes it from revCache, when ifMatch condition succeeds", async () => {
      const metadata = {
        '.tag': 'file', rev: '1001', name: 'xyzzy',
        path_display: "/remotestorage/fnord/xyzzy", path_lower: "/remotestorage/fnord/xyzzy"
      };
      dropbox._revCache.set('/fnord/xyzzy', '1001');

      fetchMock.mock(
        {name: 'postMetadata', method: 'POST', url: METADATA_URL},
        {status: 200, body: JSON.stringify(metadata)}
      );
      fetchMock.mock(
        {name: 'postDelete', method: 'POST', url: DELETE_URL},
        {status: 200, body: JSON.stringify(metadata)}
      );
      const result = await dropbox.delete('/fnord/xyzzy', {ifMatch: metadata.rev});

      const calls = fetchMock.calls();
      expect(calls).to.have.lengthOf(2);
      expect(calls[1][0]).to.equal(DELETE_URL);
      expect(calls[1][1]).to.have.property('method', 'POST');
      expect(calls[1][1].headers).to.have.property('Content-Type').which.matches(/^application\/json\b/);
      expect(calls[1][1]).to.have.property('body', JSON.stringify({path: "/remotestorage/fnord/xyzzy"}));
      expect(result).to.have.property('statusCode', 200);
      expect(dropbox._revCache.get('/fnord/xyzzy')).to.be.null;
    });

    it("returns the erroneous status it received from DropBox", async () => {
      fetchMock.mock(
        {name: 'postDelete', method: 'POST', url: DELETE_URL},
        {status: 401}
      );
      const result = await dropbox.delete('/widget/gadget');

      const calls = fetchMock.calls();
      expect(calls).to.have.lengthOf(1);
      expect(calls[0][0]).to.equal(DELETE_URL);
      expect(calls[0][1]).to.have.property('method', 'POST');
      expect(calls[0][1].headers).to.have.property('Content-Type').which.matches(/^application\/json\b/);
      expect(calls[0][1]).to.have.property('body', JSON.stringify({path: "/remotestorage/widget/gadget"}));
      expect(result).to.have.property('statusCode', 401);
    });
  });
});
