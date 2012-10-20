# remoteStorage.js

### Where to get help?

* Consult this README
* Consult the [API documentation](http://remotestoragejs.com/doc/code)
* Ask in the [IRC Channel](http://webchat.freenode.net/?channels=remotestorage) (#remotestorage on freenode)
* Open an issue for discussion, either in the relevant repository or [the website repo for general discussion](https://github.com/remotestorage/remotestorage.io/issues)

### Running the local Test Server

#### To run the test server, first of all add a line

    127.0.0.1 local.dev

#### to your /etc/hosts file. then run:

    sudo node server/nodejs-example.js

### Adding remoteStorage.js v0.7 to your app:

#### add "remoteStorage-modules.js" (you can download it from http://remotestoragejs.com/build/0.7.0-head/remoteStorage-modules.js)
#### in index.html, include this script and any modules you plan to load:

    <script src="remoteStorage-modules.js"></script>

#### in the place where you want the remoteStorage element to go, add a div:

    <div id="remotestorage-connect"></div>

#### claim access to the 'tasks' module,

    remoteStorage.claimAccess('tasks', 'rw');

#### and after you have loaded all the modules you will be using, but still in your app's onload function,
#### add a call to put the 'connect your remote storage' UI into that div, 

    remoteStorage.displayWidget('remotestorage-connect');

#### open a private tasks list called 'todos':

    todos = remoteStorage.tasks.getPrivateList('todos');

#### and specify your handlers for 'error' and 'change' on the task list:

    todos.on('error', function(event) {
      // you can set up this event handler, but currently it isn't used.
      // will probably be in the future though.
    });

    todos.on('change', function(event) {

      if(event.newValue && event.oldValue) {
        console.log(event.path + " was updated")
      } else if(event.newValue) {
        console.log(event.path + " was created")
      } else if(event.oldValue) {
        console.log(event.path + " was deleted")
      }

    });

#### note that your change handler will be called with an object that has an 'origin' field, that comes with a value of 'tab', 'device', or 'cloud'

Note: maybe 'window' is a better term than 'tab' here, this sort of details is still subject to change in the final v0.7


# using the tasks list:

#### function list.getIds();

returns an array of id's, which you can use to retrieve the actual objects.

#### function list.get(id);

returns an object from the list, or undefined if there is no object in the list with that id

#### function list.set(id, obj);

sets the item with that id to that object (might trigger a 'change' event with origin 'tab').

#### function list.add(text);

creates a new todo item with that text, completed set to false, and a randomly generated id, which is returned by the function.

#### function list.remove(id);

removes that item

#### function list.markAsCompleted(id);

marks that todo item as completed (you can see we really have a higher-level API here that understands that tasks are things that have a boolean 'completed' field)

#### function list.isCompleted(id);

returns true or false. this one is maybe a bit silly, you could also just get the object and read the obj.completed field. or maybe we should make obj.isCompleted(), 
inline with OO practice. Anyway, you get the idea. I hope that with this everybody can write apps very easily based on modules like this. For now i only included 'tasks', but once this works it should be easy to make first versions of other modules like 'documents', 'contacts', 'photos', 'stuff', 'music', etcetera. Pull requests welcome! :)
