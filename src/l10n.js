(function(global) {

  var dict = {
    "view_info": 'This app allows you to use your own storage! Find more info on <a href="http://remotestorage.io/" target="_blank">remotestorage.io</a>',
    "view_connect": "<strong>Connect</strong> remote storage",
    "view_connecting": "Connecting <strong>%s</strong>",
    "view_offline": "Offline"
  };

  RemoteStorage.L10n = function() {
    "use strict";
    var str    = arguments[0],
        params = Array.prototype.splice.call(arguments, 1);
    if( typeof dict[str] !== "string") {
      console.log("Unknown string " + str);
    } else {
      str = dict[str];
    }
    return (str.replace(/%s/g, function () {return params.shift(); }));
  };

  RemoteStorage.L10n.getDict = function () {
    return dict;
  };

  RemoteStorage.L10n.setDict = function (newDict) {
    dict = newDict;
  };

})(typeof(window) !== 'undefined' ? window : global);
