remoteStorage.defineModule('videos', function(privateClient, publicClient) {
  var curry = remoteStorage.util.curry;
  var asyncEach = remoteStorage.util.asyncEach;

  var moduleName = 'videos';
  privateClient.use('');
  publicClient.use('');

  privateClient.declareType('video', {
    "description" : "a reference to a place you'd like to return to at some point.",
    "type" : "object",
    "properties": {
      "title": {
        "type": "string",
        "description": "the title of the place the video points to",
        "required": true
      },
      "embed_url": {
        "type": "string",
        "description": "location video points to for embedding purposes",
        "format": "uri"
      },
      "visit_url": {
        "type": "string",
        "description": "location video points to for browsing to",
        "format" : "uri"
      },
      "description": {
        "type": "string",
        "description": "description of the video"
      },
      "thumbnail": {
        "type": "string",
        "description": "thumbnail image of the video",
        "format": "uri"
      },
      "duration": {
        "type": "number",
        "description": "duration of the video in seconds"
        },
      "source": {
        "type": "string",
        "description": "source of the video (ie. youtube, vimeo, local)"
      },
      "content_type": {
        "type": "string",
        "description": "the mimetype ie. application/x-shockwave-flash"
      },
      "video_data": {
        "type": "binary",
        "description": "actual binary video data",
        "required": false
      }
    }
  });

  return {
    name: moduleName,

    dataHints: {
      "module" : "Store video data metadata",

      "objectType video": "a reference to a place you'd like to return to at some point.",
      "string video#title": "the title of the place the video points to",
      "string video#embed_url": "location video points to for embedding purposes",
      "string video#visit_url": "location video points to for browsing to",
      "text video#description": "description of the video",
      "string video#thumbnail": "thumbnail image of the video",
      "int video#duration": "duration of the video in seconds",
      "string video#source": "source of video (ie. youtube, vimeo, local)",
      "string video#content_type": "the mimetype ie. application/x-shockwave-flash",
      "binary video#data": "actual binary video data"
    },

    exports: {

      // remoteStorage.bookmarks.on('change', function(changeEvent) {
      //   if(changeEvent.newValue && changeEvent.oldValue) {
      //    changeEvent.origin:
      //      * window - event come from current window
      //            -> ignore it
      //      * device - same device, other tab (/window/...)
      //      * remote - not related to this app's instance, some other app updated something on remoteStorage
      //   }
      // });
      on: privateClient.on,

      getIds: function() {
        return privateClient.getListing('');
      },

      get: function(id) {
        return privateClient.getObject(id);
      },

      add: function(details, id) {
        if (!id) {
          id = privateClient.getUuid();
        }
        return privateClient.storeObject('video', id, details).
          then(function() { return id; });
      },

      remove: function(id) {
        privateClient.remove(id);
      }

    }
  };
});
