var todos,
  ENTER_KEY = 13;

window.addEventListener( "load", windowLoadHandler, false );

function windowLoadHandler() {
  remoteStorage.displayWidget('remotestorage-connect');
  remoteStorage.loadModule('tasks', '0.1', 'rw');
  todos = remoteStorage.tasks.getPrivateList('todos');
  todos.on('error', function(err) {
  });
  todos.on('change', function(id, obj) {
  refreshData();
  });
  refreshData();
  document.getElementById( 'new-todo' ).addEventListener( "keypress", newTodoKeyPressHandler, false );
  document.getElementById( 'toggle-all' ).addEventListener( "change", toggleAllChangeHandler, false );
}
function inputEditTodoKeyPressHandler( event ) {
  var inputEditTodo,
  trimmedText,
  todoId;

  inputEditTodo = event.target;
  trimmedText = inputEditTodo.value.trim();
  todoId = event.target.id.slice( 6 );

  if ( trimmedText ) {
    if ( event.keyCode === ENTER_KEY ) {
      todos.set( todoId, trimmedText );
    }
  } else {
    todos.remove( todoId );
  }
}

function inputEditTodoBlurHandler( event ) {
  var inputEditTodo,
    todoId;

  inputEditTodo = event.target;
  todoId = event.target.id.slice( 6 );
  todos.set( todoId, inputEditTodo.value.trim() );
}

function newTodoKeyPressHandler( event ) {
  if ( event.keyCode === ENTER_KEY ) {
    var trimmedText = document.getElementById( 'new-todo' ).value;
    if ( trimmedText ) {
      todos.add( trimmedText );
    }
  }
}

function toggleAllChangeHandler( event ) {
  for ( var i in todos.getIds() ) {
    todos.markAsCompleted( i, event.target.checked);
  }
}

function spanDeleteClickHandler( event ) {
  todos.remove( event.target.getAttribute( 'data-todo-id' ) );
}

function hrefClearClickHandler() {
  var ids = todos.getIds();
  for(var i=0; i<ids.length; i++) {
    if ( todos.get(ids[i]).completed ) {
      todos.remove(ids[i]);
    }
   }
}

function todoContentHandler( event ) {
  var todoId,
    div,
    inputEditTodo;

  todoId = event.target.getAttribute( 'data-todo-id' );
  div = document.getElementById( 'li_'+todoId );
  if(div) {//it is possible to double-click the delete X, in which case the div will not exist at this point
    div.className = 'editing';

    inputEditTodo = document.getElementById( 'input_' + todoId );
    inputEditTodo.focus();
  }
}

function checkboxChangeHandler( event ) {
  var checkbox;
  checkbox = event.target;
  todos.markCompleted( checkbox.getAttribute( 'data-todo-id' ), checkbox.checked);
}

function refreshData() {
  var stats = todos.getStats();
  redrawTodosUI(stats);
  redrawStatsUI(stats);
  changeToggleAllCheckboxState(stats);
}

function redrawTodosUI() {
  var ul,
    todo,
    checkbox,
    label,
    deleteLink,
    divDisplay,
    inputEditTodo,
    li,
    i;

  ul = document.getElementById( 'todo-list' );
  var ids = todos.getIds();
  document.getElementById( 'main' ).style.display = ids.length ? 'block' : 'none';

  ul.innerHTML = "";
  document.getElementById( 'new-todo' ).value = '';

  for ( i= 0; i < ids.length; i++ ) {
    todo = todos.get(ids[i]);

    // create checkbox
    checkbox = document.createElement( 'input' );
    checkbox.className = 'toggle';
    checkbox.setAttribute( 'data-todo-id', ids[i] );
    checkbox.type = 'checkbox';
    checkbox.addEventListener( 'change', checkboxChangeHandler );

    // create div text
    label = document.createElement( 'label' );
    label.setAttribute( 'data-todo-id', ids[i] );
    label.appendChild( document.createTextNode( todo.title ) );

    // create delete button
    deleteLink = document.createElement( 'button' );
    deleteLink.className = 'destroy';
    deleteLink.setAttribute( 'data-todo-id', ids[i] );
    deleteLink.addEventListener( 'click', spanDeleteClickHandler );

    // create divDisplay
    divDisplay = document.createElement( 'div' );
    divDisplay.className = 'view';
    divDisplay.setAttribute( 'data-todo-id', ids[i] );
    divDisplay.appendChild( checkbox );
    divDisplay.appendChild( label );
    divDisplay.appendChild( deleteLink );
    divDisplay.addEventListener( 'dblclick', todoContentHandler );

    // create todo input
    inputEditTodo = document.createElement( 'input' );
    inputEditTodo.id = 'input_' + ids[i];
    inputEditTodo.className = 'edit';
    inputEditTodo.value = todo.title;
    inputEditTodo.addEventListener( 'keypress', inputEditTodoKeyPressHandler );
    inputEditTodo.addEventListener( 'blur', inputEditTodoBlurHandler );

    // create li
    li = document.createElement( 'li' );
    li.id = 'li_' + ids[i];
    li.appendChild( divDisplay );
    li.appendChild( inputEditTodo );

    if ( todo.completed )
    {
      li.className += 'complete';
      checkbox.checked = true;
    }

    ul.appendChild( li );
  }
}

function changeToggleAllCheckboxState(stat) {
  var toggleAll = document.getElementById( 'toggle-all' );
  if ( stat.todoCompleted === stat.totalTodo ) {
    toggleAll.checked = true;
  } else {
    toggleAll.checked = false;
  }
}

function redrawStatsUI(stat) {
  removeChildren( document.getElementsByTagName( 'footer' )[ 0 ] );
  document.getElementById( 'footer' ).style.display = stat.totalTodo ? 'block' : 'none';

  if ( stat.todoCompleted > 0 ) {
    drawTodoClear(stat);
  }

  if ( stat.totalTodo > 0 ) {
    drawTodoCount(stat);
  }
}

function drawTodoCount(stat) {
  var number,
    theText,
    remaining;
  // create remaining count
  number = document.createElement( 'strong' );
  number.innerHTML = stat.todoLeft;
  theText = ' item';
  if ( stat.todoLeft !== 1 ) {
    theText += 's';
  }
  theText += ' left';

  remaining = document.createElement( 'span' );
  remaining.id = 'todo-count';
  remaining.appendChild( number );
  remaining.appendChild( document.createTextNode( theText ) );

  document.getElementsByTagName( 'footer' )[ 0 ].appendChild( remaining );
}

function drawTodoClear(stat) {
  var buttonClear = document.createElement( 'button' );
  buttonClear.id = 'clear-completed';
  buttonClear.addEventListener( 'click', hrefClearClickHandler );
  buttonClear.innerHTML = 'Clear completed (' + stat.todoCompleted + ')';

  document.getElementsByTagName( 'footer' )[ 0 ].appendChild( buttonClear );
}


function removeChildren( node ) {
  node.innerHTML = '';
}
