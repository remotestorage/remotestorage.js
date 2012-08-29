
remoteStorage.defineModule('messages', function(base) {

  var messages = {

    Message: Message,

    on: base.on,

  };

  return {
    exports: messages;
  };

});