remoteStorage.defineModule('calendar', function(privateBaseClient) {
  // callback expects a list of objects with the itemId and itemValue properties set
  privateBaseClient.sync('/');
  function getEventsForDay(day) {
    var ids = privateBaseClient.getListing(day+'/');
    var list = [];
    for(var i=0; i<ids.length; i++) {
      var obj = privateBaseClient.getObject(day+'/'+ids[i]);
      list.push({'itemId': ids[i], 'itemValue': obj.text});
    }
    return list;
  }
  function addEvent(itemId, day, value) {
    privateBaseClient.storeObject('event', day+'/'+itemId, {
      text: value
    });
  }
  function removeEvent(itemId, day) {
    privateBaseClient.remove(day+'/'+itemId);
  }
  return {
    exports: {
      getEventsForDay: getEventsForDay,
      addEvent: addEvent,
      removeEvent: removeEvent
    }
  };
});
