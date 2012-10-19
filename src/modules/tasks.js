
define(['../remoteStorage'], function(remoteStorage) {

  var moduleName = "tasks";

  remoteStorage.defineModule(moduleName, function(myPrivateBaseClient, myPublicBaseClient) {

    // Namespace: remoteStorage.tasks
    //
    // tasks are things that need doing; items on your todo list
    //
    // Example:
    //   (start code)
    //
    //   remoteStorage.claimAccess('tasks', 'rw');
    //
    //   remoteStorage.displayWidget('remotestorage-connect');
    //
    //   // open a task list (you can have multiple task lists, see dataHints for naming suggestions)
    //   var todos = remoteStorage.tasks.getPrivateList('todos');
    //
    //   function printTasks() {
    //     // get all task ids...
    //     todos.getIds().forEach(function(id) {
    //       // ...then load each task and print it.
    //       var task = todos.get(id);
    //       console.log(task.completed ? '[x]' : '[ ]', task.title);
    //     });
    //   }
    //
    //   // add some tasks
    //   todos.add("Start unhosted webapp");
    //   todos.add("Obtain a freedombox");
    //   todos.add("Scientifically overcome the existence of dirty laundry");
    //
    //   // see the result
    //   printTasks();
    //
    //   // mark the first task as completed (after all, by copying this code you create a unhosted webapp)
    //   todos.markCompleted(todos.getIds()[0]);
    //
    //   // see what changed
    //   printTasks();
    //
    //   (end code)
    //
    // Method: getPrivateList
    //
    // open a task list to work with
    //
    // Parameters:
    //   listName - name of the list to open. try "todos" or "2012".
    //
    // Returns:
    //   a <TaskList> object
    //

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
      myPrivateBaseClient.use(listName+'/');
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
      // Class: TaskList
      return {
        // Method: getIds
        //
        // Get a list of task IDs, currently in this list
        //
        // Example:
        //   > remoteStorage.tasks.getIds();
        //
        getIds        : getIds,
        // Method: get
        //
        // Get a single task object, by it's ID.
        //
        // Parameters:
        //   id - the task ID
        //
        // Returns:
        //   An object containing the task's data.
        get           : get,
        // Method: set
        //
        // Set the title of a task.
        // 
        // Parameters:
        //   id - the task ID
        //   title - new title to set
        //
        set           : set,
        // Method: add
        //
        // Add a task by providing it's title.
        //
        // Newly created tasks are marked as not completed.
        //
        // Parameters:
        //   title - title to set for the new task.
        //
        add           : add,
        // Method: remove
        //
        // Remove a task
        //
        // Parameters:
        //   id - the task ID
        //
        remove        : remove,
        // Method: markCompleted
        //
        // Mark a task as completed.
        //
        // Parameters:
        //   id    - the task ID
        //   value - (optional) boolean. defaults to true.
        //
        // Examples:
        //   > remoteStorage.tasks.markCompleted(123);
        //
        //   > remoteStorage.tasks.markCompleted(234, false);
        markCompleted : markCompleted,
        // Method: getStats
        //
        // Get statistics on this <TaskList>.
        //
        // Returns:
        //   An Object with keys,
        //
        //   todoCompleted - number of completed tasks
        //   totalTodo     - total number of tasks in this list
        //   todoLeft      - number of tasks awaiting completion
        //
        getStats      : getStats,
        // Method: on
        //
        // Delegated to <BaseClient.on>
        on            : on
      };
    }
    return {
      name: moduleName,
      dataHints: {
        "module": "",
        
        "objectType task": "something that needs doing, like cleaning the windows or fixing a specific bug in a program",
        "string task#title": "describes what it is that needs doing",
        "boolean task#completed": "whether the task has already been completed or not (yet)",
        
        "directory tasks/todos/": "default private todo list",
        "directory tasks/:year/": "tasks that need doing during year :year",
        "directory public/tasks/:hash/": "tasks list shared to for instance a team"
      },
      exports: {
        getPrivateList: getPrivateList
      }
    };
  });

  return remoteStorage[moduleName];

});
