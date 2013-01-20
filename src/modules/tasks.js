remoteStorage.defineModule('tasks', function(privateClient) {
  function getUuid() {
    var i, random, uuid = '';
    for (i=0; i<32; i++) {
      random = Math.random()*16 | 0;
      if(i === 8 || i === 12 || i === 16 || i === 20) {
        uuid += '-';
      }
      uuid += (i === 12 ? 4 : (i === 16 ? (random & 3 | 8) : random) ).toString(16);
    }
    return uuid;
  }
  function Todo(title) {
    this.id = getUuid();
    this.title = title;
    this.completed = false;
  }

  return {
    exports: {
      getTodos: function() {
        console.log('in getTodos, calling getAll');
        return privateClient.getAll('todos/');
      },
      addTodo: function(text) {
        var todo = new Todo(text);
        privateClient.storeObject('todo-list-item', 'todos/'+todo.id, todo);
      },
      setTodo: function(id, todo) {
        console.log('setTodo', id, todo);
        privateClient.storeObject('todo-list-item', 'todos/'+id, todo);
      },
      setTodoText: function(id, text) {
        privateClient.getObject('todos/'+id).then(function(obj) {
          console.log('updating text of item '+id+' from "'+obj.text+'" to "'+text+'"');
          obj.title = text;
          privateClient.storeObject('todo-list-item', 'todos/'+id, obj);
        });
      },
      setTodoCompleted: function(id, value) {
        privateClient.getObject('todos/'+id).then(function(obj) {
          obj.completed = value;
          privateClient.storeObject('todo-list-item', 'todos/'+id, obj);
        });
      },
      setAllTodosCompleted: function(value) {
        privateClient.getAll('todos/').then(function(objs) {
          for(var i in objs) {
            if(objs[i].completed != value) {
              objs[i].completed = value;
              privateClient.storeObject('todo-list-item', 'todos/'+i, objs[i]);
            }
          }
        });
      },
      removeTodo: function(id) {
        privateClient.remove('todos/'+id);
      },
      removeAllCompletedTodos: function() {
        privateClient.getAll('todos/').then(function(objs) {
          for(var i in objs) {
            if(objs[i].completed) {
              privateClient.remove('todos/'+i);
            }
          }
        });
      },
      onChange: function( cb ) {
        privateClient.on('change', function(event) {
          console.log('change', event);
          cb(event.oldValue, event.newValue);
        });
      }
    }
  };
});
