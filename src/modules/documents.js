remoteStorage.defineModule('documents', function(myBaseClient) {
  var errorHandlers=[];
  function fire(eventType, eventObj) {
    if(eventType == 'error') {
      for(var i=0; i<errorHandlers.length; i++) {
        errorHandlers[i](eventObj);
      }
    }
  }
  function getUuid() {
    var uuid = '',
    i,
    random;

    for ( i = 0; i < 32; i++ ) {
      random = Math.random() * 16 | 0;
      if ( i === 8 || i === 12 || i === 16 || i === 20 ) {
        uuid += '-';
      }
      uuid += ( i === 12 ? 4 : (i === 16 ? (random & 3 | 8) : random) ).toString( 16 );
    }
    return uuid;
  }
  function getPrivateList(listName) {
    myBaseClient.use(listName+'/');
    function getIds() {
      return myBaseClient.getListing(listName+'/');
    }
    function getAll() {
      return myBaseClient.getAll(listName + '/');
    }
    function getContent(id) {
      return myBaseClient.getObject(listName+'/'+id).
	  then(function(obj) {
          return obj ? obj.content : '';
        });
    }
    function getTitle(id) {
      return getContent(id).then(function(content) {
        return content.slice(0, 50);
      });
    }
    function setContent(id, content) {
      if(content === '') {
        return myBaseClient.remove(listName+'/'+id);
      } else {
        return myBaseClient.storeObject('text', listName+'/'+id, {
          content: content
        });
      }
    }
    function add(content) {
      var id = getUuid();
      return myBaseClient.storeObject('text', listName+'/'+id, {
        content: content
      }).then(function() {
        return id;
      });
    }
    function on(eventType, cb) {
      myBaseClient.on(eventType, cb);
      if(eventType == 'error') {
        errorHandlers.push(cb);
      }
    }
    function set(id, obj) {
      return myBaseClient.storeObject('text', listName+'/'+id, obj);
    }
    function get(id) {
      return myBaseClient.getObject(listName+'/'+id).
        then(function(obj) {
          return obj || {};
        });
    }
    return {
      getIds        : getIds,
	getAll        : getAll,
      getContent    : getContent,
      getTitle      : getTitle,
      setContent   : setContent,
      set           : set,
      get           : get,
      add           : add,
      on            : on
    };
  }


  return {
    name: moduleName,
    dataHints: {
      "module": "documents can be text documents, or etherpad-lite documents or pdfs or whatever people consider a (text) document. But spreadsheets and diagrams probably not",
      "objectType text": "a human-readable plain-text document in utf-8. No html or markdown etc, they should have their own object types",
      "string text#content": "the content of the text document",

      "directory documents/notes/": "used by litewrite for quick notes",
      "item documents/notes/calendar": "used by docrastinate for the 'calendar' pane",
      "item documents/notes/projects": "used by docrastinate for the 'projects' pane",
      "item documents/notes/personal": "used by docrastinate for the 'personal' pane"
    },
    exports: {
      getPrivateList: getPrivateList,
      onChange: function(listName, callback) {
        myBaseClient.on('change', function(event) {
          var md = event.relativePath.match(new RegExp('^' + listName + '/(.+)$'));
          if(md) {
            event.id = md[1];
            callback(event);
          }
        });
      }
    }
  };
});
