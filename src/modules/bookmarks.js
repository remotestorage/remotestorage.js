
define(['../remoteStorage'], function(remoteStorage) {

  var moduleName = 'bookmarks';

  remoteStorage.defineModule(
    moduleName,
    function(privateClient, publicClient) {

      // publicClient.sync('');

      return {
        name: moduleName,

        dataHints: {
          "module" : "Store URLs which you do not wish to forget"
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

          listUrls: function() {
            var keys = privateClient.getListing('');
            var urls = [];
            keys.forEach(function(key) {
              urls.push(privateClient.getObject(key).url);
            });
            return urls;
          },


          listBookmarks: function() {
            var keys = privateClient.getListing('');
            var bms = [];
            keys.forEach(function(key) {
              bms.push(privateClient.getObject(key));
            });
            privateClient.use('');
            return bms;
          },
          
          // remoteStorage.bookmarks.addUrl
          addUrl: function(url) {
            return privateClient.storeObject(
              // /bookmarks/http%3A%2F%2Funhosted.org%2F
              'bookmark', encodeURIComponent(url), {
                url: url,
                createdAt: new Date()
              }
            );
          },

          getPublicListing: function() {
            var listing = publicClient.getObject('publishedItems');
            return listing || { items: [] };
          },

          publish: function(url) {
            var key = encodeURIComponent(url);
            var bookmark = privateClient.getObject(key);

            publicClient.storeObject('bookmark', key, bookmark);

            var listing = publicClient.getListing('');
            delete listing.published;
            publicClient.storeObject('bookmark-list', 'published', listing);
          }

        }
      };
    }
  );

});
