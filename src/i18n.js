(function() {
  "use strict";

  var dictionary = {
    "view_info": 'This app allows you to use your own storage. <a href="http://remotestorage.io/" target="_blank">Learn more</a>',
    "view_connect": "<strong>Connect</strong> remote storage",
    "view_connecting": "Connecting <strong>%s</strong>",
    "view_offline": "Offline"
  };

  RemoteStorage.I18n = {

    translate: function() {
      var str    = arguments[0],
          params = Array.prototype.splice.call(arguments, 1);

      if (typeof dictionary[str] !== "string") {
        throw "Unknown translation string: " + str;
      } else {
        str = dictionary[str];
      }
      return (str.replace(/%s/g, function(){ return params.shift(); }));
    },

    getDictionary: function() {
      return dictionary;
    },

    setDictionary: function(newDictionary) {
      dictionary = newDictionary;
    }

  };
})();
