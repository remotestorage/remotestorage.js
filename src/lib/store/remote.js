define(['../util'], function(util) {

  /**
   * Class: RemoteStore
   *
   * Talks to a <remotestorage at https://tools.ietf.org/html/draft-dejong-remotestorage-00.html>
   * API endpoint through an HTTP implementation. Provides a <Store> interface.
   *
   * Parameters:
   *   http    - An HTTP Implementation, such as <BrowserHTTP> or <NodeHTTP>.
   *   options - (optional) object of initial configuration values (such as 'storageInfo' or 'bearerToken')
   */
  var RemoteStore = function(http, options) {
    this.http = http;

    util.extend(this, util.getEventEmitter('state-change'));

    this._headers = {};

    /**
     * Property: state
     *
     * Current state of this RemoteStore, as determined by configuration.
     *
     * One of:
     *   - anonymous
     *   - connecting
     *   - connected
     */
    this.state = undefined;

    this.configure(options);
  };

  // prototype

  RemoteStore.prototype = {

    /**
     * Method: get
     * See <Store.get>
     */
    get: function(path) {
      if(this.state !== 'connected') {
        throw new RemoteStore.NotConnected();
      }
      return this.http('GET', this._urlFor(path), this._headers).
        then(util.bind(this._loadNode, this));
    },

    /**
     * Method: set
     * See <Store.set>
     */
    set: function(path, node) {
      if(this.state !== 'connected') {
        throw new RemoteStore.NotConnected();
      }
      if(typeof(path) !== 'string') {
        throw new Error("Expected 'path' to be a string");
      }
      if(typeof(node) !== 'object') {
        throw new Error("Expected 'node' to be an object");
      }
      var data = (node.mimeType === 'application/json' ?
                  JSON.stringify(node.data) : node.data);
      var contentType = node.mimeType + '; charset=' + (
        node.binary ? 'binary' : 'utf-8'
      );
      var headers = util.extend({
        'Content-Type': contentType
      }, this._headers);
      if(node.version) {
        headers.ETag = node.version;
      }
      return this.http('PUT', this._urlFor(path), headers, data);
    },

    /**
     * Method: remove
     * See <Store.remove>
     */
    remove: function(path) {
      if(this.state !== 'connected') {
        throw new RemoteStore.NotConnected();
      }
      if(typeof(path) !== 'string') {
        throw new Error("Expected 'path' to be a string");
      }
      return this.http('DELETE', this._urlFor(path), this._headers);
    },

    /**
     * Method: configure
     * Sets configuration options for this remote store. Valid configuration options
     * are the <storageInfo> and <bearerToken> properties. Adding configuration options
     * can cause the <state> to change and thus fire a <state-change> Event.
     */
    configure: function(options) {
      var state = 'anonymous';
      if(typeof(options) === 'object') {
        // storageInfo? -> connecting!
        if(options.storageInfo) {
          this.storageInfo = options.storageInfo;
          state = 'connecting';
          // bearerToken? -> connected!
          if(options.bearerToken) {
            this.bearerToken = options.bearerToken;
            this._headers['Authorization'] = 'Bearer ' + encodeURIComponent(this.bearerToken);
            state = 'connected';
          }
        }
      }
      if(state !== this.state) {
        /**
         * Event: state-change
         * Fired whenever the <state> changes.
         *
         * Arguments:
         *   newState - the new state transitioned into
         *   oldState - the previous state
         */
        this.emit('state-change', state, this.state);
        this.state = state;
      }
    },

    /**
     * Method: reset
     * Resets all configuration and returns to initial state.
     */
    reset: function() {
      delete this.storageInfo;
      delete this.bearerToken;
      this._headers = {};
      this.configure();
    },

    _urlFor: function(path) {
      return this.storageInfo.href + path;
    },

    _loadNode: function(response) {
      var node = util.extend({}, RemoteStore.EMPTY_NODE);
      if(RemoteStore.NOT_FOUND_STATES[response.status]) { // NOT FOUND
        // nothing to do.

      } else if(RemoteStore.SUCCESS_STATES[response.status]) { // SUCCESS
        var contentType = response.headers['content-type'];
        node.mimeType = contentType.split(';')[0];
        node.data = response.body;
        if(contentType.match(/charset=binary/)) {
          node.data = util.rawToBuffer(node.data);
        }
        if(node.mimeType === 'application/json') {
          try {
            node.data = JSON.parse(node.data);
          } catch(exc) {
            throw new RemoteStore.InvalidJSON(response);
          }
        }
        node.version = response.headers['etag'];

      } else if(RemoteStore.UNAUTHORIZED_STATES[response.status]) { // UNAUTHORIZED
        throw new RemoteStore.Unauthorized(response);

      } else { // UNEXPECTED
        throw new RemoteStore.UnexpectedResponse(response);

      }
      return node;
    }

  };


  // constants

  /**
   * Constant: RemoteStore.EMPTY_NODE
   * An empty node object.
   */
  RemoteStore.EMPTY_NODE = {
    data: undefined,
    mimeType: undefined,
    version: null
  };

  /**
   * Constant: RemoteStore.SUCCESS_STATES
   * List of status codes interpreted as success (200, 201, 204, 207).
   */
  RemoteStore.SUCCESS_STATES = { 200:true, 201:true, 204:true, 207:true };
  /**
   * Constant: RemoteStore.NOT_FOUND_STATES
   * List of status codes interpreted as not found (404).
   * (these codes cause a request to succeed with the <RemoteStore.EMPTY_NODE>)
   */
  RemoteStore.NOT_FOUND_STATES = { 404:true };
  /**
   * Constant: RemoteStore.UNAUTHORIZED_STATES
   * List of status codes interpreted as unauthorized (401, 403).
   * (these codes cause <RemoteStore.Unauthorized> to be thrown)
   */
  RemoteStore.UNAUTHORIZED_STATES = { 401:true, 403:true };

  // errors

  /**
   * Class: RemoteStore.Error
   * Abstract Error.
   */
  util.declareError(RemoteStore, 'Error');

  /**
   * Class: RemoteStore.Unauthorized
   * <RemoteStore.Error> thrown when one of <RemoteStore.UNAUTHORIZED_STATES> is seen.
   */
  util.declareError(RemoteStore, 'Unauthorized', function(response) {
    this.response = response;
    return 'the server denied our request! (status: ' + response.status + ', response text: ' + response.body + ')';
  }, RemoteStore.Error);

  /**
   * Class: RemoteStore.NotConnected
   * <RemoteStore.Error> thrown when the <RemoteStore.state> is not "connected".
   */
  util.declareError(RemoteStore, 'NotConnected', function() {
    return 'not connected';
  }, RemoteStore.Error);

  /**
   * Class: RemoteStore.UnexpectedResponse
   * <RemoteStore.Error> thown when we can't make sense of the response.
   */
  util.declareError(RemoteStore, 'UnexpectedResponse', function(response) {
    this.response = response;
    return 'unexpected response (status: ' + response.status + ')';
  }, RemoteStore.Error);

  /**
   * Error: RemoteStore.InvalidJSON
   */
  util.declareError(RemoteStore, 'InvalidJSON', function(response) {
    this.response = response;
    return 'received invalid JSON: ' + response.body;
  }, RemoteStore.Error);

  return RemoteStore;

});
