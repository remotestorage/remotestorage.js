# Adding the remoteStorage syncer to your app

Add the *syncer* directory (you can copy this one). In *index.html*, include this script and the stylesheet:

    <script src="syncer/include.js"></script>
    <link rel="stylesheet" href="syncer/remoteStorage.css">

In the place where you want the remoteStorage element to go, add this element:

    <div id="remotestorage-connect"></div>

Then in your app's **onload** function, add a call to put the syncer interface into the element, and specify your onChange handler:

    syncer.display('remotestorage-connect', ['tasks'], 'syncer/', function(e) {
      refreshData();
    });



# Using the syncer object

**Load** the array of task items: **syncer.getCollection('tasks');**

**Get** an item by id: you could search for it in the array or just call: **syncer.getItem('tasks', id);**

**Add or update** an item with a certain id: **syncer.setItem('tasks', id, object);** (so without stringifying)

**Remove** an item from the collection: **syncer.removeItem('tasks', id);**
