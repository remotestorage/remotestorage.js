This is the remoteStorage CommonJS package that can be used with any asynchronous module loader like RequireJS.

If you have questions, go to http://webchat.freenode.net/?channels=unhosted and ask. If you don't get
an immediate reply, email support @unhosted.org.

The following options can be passed either as a js object inside the script tag, or in a call to remoteStorage.configure() during runtime. Syntax for this:

    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>example</title>
        <script src="http://unhosted.org/remoteStorage.js">{
          someKey: 'someValue'
        }</script>
        <script>
          function changeFoo() {
            remoteStorage.configure({
              someKey: 'someNewValue'
            });
          }
        </script>
      </head>
      <body>
        <input type="submit" onclick="changeFoo();">
      </body>
    </html>

Options:

* category: the category to sync localStorage to [will probably be deprecated if we switch to BrowserAuth]
* onChange: a callback, function(key, oldValue, newValue) that will be called when connecting results in incoming changes
* onStatus: a callback, function(oldStatus, newStatus) that will be called when remoteStorage changes status. For now, there's only {name: 'disconnected'} and {name: 'online'}, but more intermediate statuses should be added soon.
* suppressDialog: if false, a dialog is displayed. if true, you should call configure() with userAddress yourself to initiate connection.
* userAddress: when you do your own login interface, use this with configure() to initiate connection.
* suppressAutoSave: if false, localStorage is diffed and synced every 5 seconds. if true, you should call remoteStorage.syncNow() each time you want changes to be pushed
* requestBrowseridAccess: experimental; see http://groups.google.com/group/unhosted/browse\_thread/thread/8665a5913ccbd965

Methods:

* remoteStorage.configure(optionsObj) - change some option(s) during runtime (for setting options during page load, use the options object that goes inside the script tag)
* syncNow() - sync now
* getStatus() - returns a status object, currently either {name: 'disconnected'} or {name: 'online'}
* share(key, cb) - push said key to public and call cb with the hash created
* receive(senderAddress, hash, cb) - fetch said hash from senderAddress's remoteStorage and call cb with the content fetched
