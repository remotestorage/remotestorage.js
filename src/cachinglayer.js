(function() {
  /**
   * Class: cachinglayer
   */
  var methods = {

    _createConflictEvent: function(path, attributes) {
      var event = { path: path };
      for(var key in attributes) {
        event[key] = attributes[key];
      }

      event.resolve = function(resolution) {
        if (resolution === 'remote' || resolution === 'local') {
          attributes.resolution = resolution;
          this._recordChange(path, { conflict: attributes });
        } else {
          throw new Error("Invalid resolution: " + resolution);
        }
      }.bind(this);

      return event;
    }

  };

  /**
   * Function: cachingLayer
   *
   * Mixes common caching layer functionality into an object.
   *
   * The first parameter is always the object to be extended.
   *
   * Example:
   *   (start code)
   *   var MyConstructor = function() {
   *     cachingLayer(this);
   *   };
   *   (end code)
   */
  RemoteStorage.cachingLayer = function(object) {
    for(var key in methods) {
      object[key] = methods[key];
    }
  };
})();
