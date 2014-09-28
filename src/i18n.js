(function () {
  /**
   * Class: RemoteStorage.I18n
   *
   * TODO add documentation
   **/

  "use strict";

  var dictionary = {
    "view_info": 'This app allows you to use your own storage. <a href="http://remotestorage.io/" target="_blank">Learn more!</a>',
    "view_connect": "<strong>Connect</strong> remote storage",
    "view_connecting": "Connecting <strong>%s</strong>",
    "view_offline": "Offline",
    "view_error_occured": "Sorry! An error occured.",
    "view_invalid_key": "Wrong key!",
    "view_confirm_reset": "Are you sure you want to reset everything? This will clear your local data and reload the page.",
    "view_get_me_out": "Get me out of here!",
    "view_error_plz_report": 'If this problem persists, please <a href="http://remotestorage.io/community/" target="_blank">let us know</a>!',
    "view_unauthorized": "Unauthorized! Click here to reconnect."
  };

  RemoteStorage.I18n = {

    translate: function () {
      var str    = arguments[0],
          params = Array.prototype.splice.call(arguments, 1);

      if (typeof dictionary[str] !== "string") {
        throw "Unknown translation string: " + str;
      } else {
        str = dictionary[str];
      }
      return (str.replace(/%s/g, function (){ return params.shift(); }));
    },

    getDictionary: function () {
      return dictionary;
    },

    setDictionary: function (newDictionary) {
      dictionary = newDictionary;
    }

  };
})();
