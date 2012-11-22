define(['../remoteStorage'], function(remoteStorage) {

  var moduleName = 'calendar';

  remoteStorage.defineModule(moduleName, function(client) {

    client.declareType('event', 'http://json-schema.org/calendar', {
      "description": "A representation of an event",
      "type": "object",
      "properties": {
        "id": {
          "format": "id",
          "type": "string",
          "description": "Unique identifier for this event"
        },
        "dtstart": {
          "format": "date-time",
          "type": "string",
          "description": "Event starting time",
          "required": true
        },
        "dtend": {
          "format": "date-time",
          "type": "string",
          "description": "Event ending time"
        },
        "summary": { "type": "string", "required": true },
        "location": { "type": "string" },
        "url": { "type": "string", "format": "uri" },
        "duration": {
          "format": "time",
          "type": "string",
          "description": "Event duration"
        },
        "rdate": {
          "format": "date-time",
          "type": "string",
          "description": "Recurrence date"
        },
        "rrule": {
          "type": "string",
          "description": "Recurrence rule"
        },
        "category": { "type": "string" },
        "description": { "type": "string" },
        "geo": { "$ref": "http: //json-schema.org/geo" }
      }
    });

    //client.use('');

    function getEventsForDay(day) {
      var ids = client.getListing(day+'/');
      var list = [];
      for(var i=0; i<ids.length; i++) {
        var obj = client.getObject(day+'/'+ids[i]);
        list.push({'itemId': ids[i], 'itemValue': obj.summary});
      }
      return list;
    }

    function addEvent(itemId, day, value) {
      var mdy = day.split('_');
      client.storeObject('event', day+'/'+itemId, {
        summary: value,
        dtstart: new Date(mdy[2], mdy[0], mdy[1]).toISOString()
      });
    }
    function removeEvent(itemId, day) {
      client.remove(day+'/'+itemId);
    }
    return {
      exports: {
        getEventsForDay: getEventsForDay,
        addEvent: addEvent,
        removeEvent: removeEvent
      }
    };
  });

  return remoteStorage[moduleName];

});
