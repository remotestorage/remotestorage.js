# Storing up to 4 revisions of each node

Each cache node will represent the versioning state of either one
document or one folder. The versioning state is represented by one or
more of the `common`, `local`, `remote`, and `push` revisions. Local
changes are stored in `local`, and in `push` while an outgoing request
is active. Remote changes that have either not been fetched yet (see
[caching.md](caching.md)), or have
not been merged with local changes yet, are stored in `remote`.

# autoMerge

The `sync.autoMerge` function will try to merge local and remote changes
into the common revision of a node. It may emit change events with a
'conflict' origin to indicate that an unpushed local change was
overruled by a remote change.

When consulting the base client about the current value of a node, you
will get either its 'local' revision if it exists, or its 'common'
revision otherwise. The following are versioning tree diagrams of how
local and remote revisions of a node can interact:

    //in sync:
    1)  . . . . [common]

    //dirty:
    2)  . . . . [common]
                    \
                     \ . . . . [remote]

    //local change:
    3)  . . . . [common] . . . . [local]

    //conflict (should autoMerge):
    4) . . . . [common] . . . . [local]
                   \
                    \ . . . . [remote]

    //pushing:
    5)  . . . . [common] . . . . [push] . . . . [local]

    //pushing, and known dirty (should abort the push, or just wait for the conflict to occur):
    6)  . . . . [common] . . . . [push] . . . . [local]
                    \
                     \ . . . . [remote]


Each of local, push, remote, and common can have,

  * for documents:
    * body
    * contentType
    * contentLength
    * revision
    * timestamp

  * for folders:
    * itemsMap (itemName -> true, or itemName -> false to indicate an
        unmerged deletion)
    * revision
    * timestamp

NB: The meaning of the timestamp was changed in
https://github.com/remotestorage/remotestorage.js/pull/757#issuecomment-55276241

# Caching strategies

For each subtree, you can set the caching strategy to 'ALL',
'SEEN' (default), and 'FLUSH'.

* 'ALL' means that once all outgoing changes have been pushed, sync
      will start retrieving nodes to cache pro-actively. If a local
      copy exists of everything, it will check on each sync whether
      the ETag of the root folder changed, and retrieve remote changes
      if they exist.
* 'SEEN' does this only for documents and folders that have been either
      read from or written to at least once since connecting to the current
      remote backend, plus their parent/ancestor folders up to the root
      (to make tree-based sync possible).
* 'FLUSH' will only cache outgoing changes, and forget them as soon as
      they have been saved to remote successfully.

# "keep/revert" conflict resolution

Remotestorage implements a hub-and-spokes versioning system, with one
central remoteStorage server (the hub) and any number of clients (the
spokes). The clients will typically be unhosted web apps based on this
JS lib (remotestorage.js), but they don't have to be; they can also be
based on other client implementations, they can be hosted web apps,
desktop apps, native smartphone apps, etcetera. New versions of subtrees
always start at one of these clients. They are then sent to the server,
and from there to all the other clients. The server assigns the revision
numbers and sends them to the initiating client using HTTP ETag response
headers in response to PUT requests. Remotestorage.js is a library that
attempts to make it easy to build remoteStorage clients, by hiding both
the push/pull synchronization and the version merging from the client
developer. Versioning conflicts between the local client and the remote
server are initially resolved as a 'remote wins', to which the client
code may respond with an explicit revert (putting the old, local version
back), any type of custom merge (putting the result of the merge in
place), or by doing nothing ("keep"), and leaving the remote result in
place. This system is called "keep/revert", since the library takes a
pro-active action ('remote wins'), which the app can then either keep,
or revert.

Sync is tree-based: syncing a node is equivalent to syncing all its
children. There are two parts at play, that interact: transporting the
diffs to and from the remote server, and merging the local and remote
versions into one common version. Each document starts out as
non-existing in both its local and remote versions. From there on, it
can be created, updated, and deleted any number of times throughout its
history, both locally and remotely. If at some point in time it either
does not exist neither locally nor remotely, or its body and
content-type are the same byte-for-byte on both sides, then the two
stores are in agreement. If the document exists in only one of the
stores, or the document's body or its content-type differs between the
two stores, then the document is in conflict.

The library is always aware of the latest local version, but it may or
may not be aware of the latest remote version, and therefore of whether
a conflict or agreement exists for the document. Likewise, the server is
not necessarily aware of the latest local version, if there are changes
that haven't been pushed out yet; nor does it care, though, since the
server does not get involved in conflict resolution. It only serializes
conditional updates from all clients into one canonical versioning
history.

The lack of sync between client and server can be fixed by doing a GET,
PUT, or DELETE. A GET will return the current remote version; a
conditional PUT or DELETE will push out the change, while at the same
time checking if any unfetched remote changes exist. If they do, then
the push will fail, and the library will fetch instead. After this, the
library has a latest known common revision of the document, possibly a
local version if it was changed since then, and possibly a remote
version if it was changed since then, but the newer version has yet to
be retrieved.

Before resolving a conflict, both revision histories are squashed. This
means that creating+deleting a document becomes a noop, and
deleting+creating, or updating it multiple times, becomes one single
update. Then, if the document was changed in different ways locally and
remotely, it goes into conflict state; if it was changed only locally or
only remotely, then the change is automatically accepted by the other
store (whether client to server or server to client). Note that in the
case of a successful conditional push request, this will already have
happened.

Conflicts that are discovered by a document fetch, fire their
'keep/revert' event immediately. Conflicts that are discovered through a
parent folder fetch, or through a conditional push, fire their
'keep/revert' event after the new remote version is fetched.

The library's conflict resolution strategy is 'remote wins'. This means
that the module will receive them in the form of change events with
origin 'conflict'. When receiving such a change event, the module can
still decide to revert it explicitly.

As noted before, merging a subtree is done by merging each document that
exists within that subtree, in either or both stores. When the library
fetches a folder listing, it can detect a remote child change, which
then may or may not result in a conflict. When a folder listing comes
in, which has changed since the last time it was retrieved, four types
of information may be discovered:

* which of the documents directly within the folder changed their remote
  revision since the last check (new ETag on a document item)
* in which previously empty subtrees at least one document was created
  (new folder item)
* in which subtrees all previously existing documents were deleted
  (folder item disappeared)
* in which subtrees at least one document was either created, updated,
  or deleted (new ETag on a folder item)

All of these can occur in a folder that was at the same time either
unchanged, updated, or deleted locally. When updated, it might be that
different items were changed locally and remotely, or that the same item
was changed on both sides, either in the same way, or in different ways.

The library handles all these cases so the module developer does not
need to worry about them.

# Implications for module design

There are a number of important implications for module design:

* First of all, this sync process follows the 'asynchronous
  synchronization' design principle
  (https://github.com/offlinefirst/research/issues/9). Don't wait for it
  to finish. The module should work with the local copy of the data, and
  handle incoming updates through evented programming. The only
  exception to this is where a body of data is too big to cache locally,
  and the module needs to expose on-demand access of remote data to the
  app. In all other cases, the module should expose the local version as
  'the truth'.

* Even then, IndexedDB is not fast enough to access from a button click.
  Make sure to put an in-memory caching layer in the module, and return
  control to the app immediately. An example of this approach is the
  SyncedMap data structure used in
  https://github.com/michielbdejong/meute.

* Use folders and subfolders. This allows the tree-based sync algorithm
  to shine and efficiently detect changes in any of potentially
  thousands of documents by checking the ETag from one single HTTP
  request to the root folder of the tree.

* Use meaningful collections. Multiple clients can each edit a different
  document without ever entering in conflict with each other. But
  editing the same document is interpreted as a conflict. For instance,
  when two calendar apps both schedule an event on a certain date, this
  would be a conflict if the module stores one document per day.
  However, if the module stores one document per event, and instead uses
  one /folder/ for each day, then the two events can co-exist on the
  same day without generating a conflict. Documents are a unit of
  conflict, but folders are not. Another example is storing todo-list
  items with long UUID hashes instead of their list index numbers as
  document names. Editing item "5" would conflict with inserting a new
  item "5". But if both items have a long unique name, then they don't
  clash with each other. So make sure to choose unique item names for
  items that should not conflict.
