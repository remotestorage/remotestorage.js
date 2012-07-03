remoteStorage.defineModule('tasks', function(myPrivateBaseClient, myPublicBaseClient) {
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
    myPrivateBaseClient.sync(listName+'/');
    function getIds() {
      return myPrivateBaseClient.getListing(listName+'/');
    }
    function get(id) {
      return myPrivateBaseClient.getObject(listName+'/'+id);
    }
    function set(id, title) {
      var obj = myPrivateBaseClient.getObject(listName+'/'+id);
      obj.title = title;
      myPrivateBaseClient.storeObject('task', listName+'/'+id, obj);
    }
    function add(title) {
      var id = getUuid();
      myPrivateBaseClient.storeObject('task', listName+'/'+id, {
        title: title,
        completed: false
      });
      return id;
    }
    function markCompleted(id, completedVal) {
      if(typeof(completedVal) == 'undefined') {
        completedVal = true;
      }
      var obj = myPrivateBaseClient.getObject(listName+'/'+id);
      if(obj && obj.completed != completedVal) {
        obj.completed = completedVal;
        myPrivateBaseClient.storeObject('task', listName+'/'+id, obj);
      }
    }
    function isCompleted(id) {
      var obj = get(id);
      return obj && obj.completed;
    }
    function getStats() {
      var ids = getIds();
      var stat = {
        todoCompleted: 0,
        totalTodo: ids.length
      };
      for (var i=0; i<stat.totalTodo; i++) {
        if (isCompleted(ids[i])) {
          stat.todoCompleted += 1;
        }
      }
      stat.todoLeft = stat.totalTodo - stat.todoCompleted;
      return stat;
    }
    function remove(id) {
      myPrivateBaseClient.remove(listName+'/'+id);
    }
    function on(eventType, cb) {
      myPrivateBaseClient.on(eventType, cb);
      if(eventType == 'error') {
        errorHandlers.push(cb);
      }
    }
    return {
      getIds        : getIds,
      get           : get,
      set           : set,
      add           : add,
      remove        : remove,
      markCompleted : markCompleted,
      getStats      : getStats,
      on            : on
    };
  }
  return {
    name: 'tasks',
    dataVersion: '0.1',
    dataHints: {
      "module": "tasks are things that need doing; items on your todo list",
      
      "objectType task": "something that needs doing, like cleaning the windows or fixing a specific bug in a program",
      "string task#title": "describes what it is that needs doing",
      "boolean task#completed": "whether the task has already been completed or not (yet)",
      
      "directory tasks/todos/": "default private todo list",
      "directory tasks/:year/": "tasks that need doing during year :year",
      "directory public/tasks/:hash/": "tasks list shared to for instance a team"
    },
    codeVersion: '0.1.0',
    exports: {
      getPrivateList: getPrivateList
    }
  };
});
