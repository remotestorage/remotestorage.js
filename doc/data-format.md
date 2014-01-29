# Storing up to 4 revisions of each node
Each cache node will represent the versioning state of either one document or one folder. the versioning state is represented by one or more of the `common`, `local`, `remote`, and `push` revisions. Local changes are stored in `local`, and in `push` while an outgoing request is active. Remote changes that have either not been fetched yet, or have not been merged with local changes yet, are stored in `remote`.

# autoMerge
The sync.autoMerge function will try to merge local and remote changes into the common revision of a node. It may call the conflict handler callback provided by the app/module, if there is one. If so, then it will pass this handler a path, and expect either 'local', 'remote', 'fetch', or 'wait' as a reply. Here, 'fetch' is only a valid response in dirty state (state 2) below), and means: fetch the body or itemsMap, and ask me again. 'wait' means leave in conflict state (presumably so the app can consult the user, or merge the two versions and write the result to local), and the app can then call sync.resolve later, with either 'local' or 'remote' as the resolution.

If a conflict is resolved as 'local', this means the 'remote' revision is made common, and the 'local' revision is kept on top of it (state 3) below). If it is resolved as 'remote', then the 'remote' revision is *also* made common, but the difference is then that the 'local' revision is deleted, and a change event is emitted to report this to the app.

When consulting the base client about the current value of a node, you will get either its 'local' revision if it exists, or its 'common' revision otherwise.

    //in sync: 
    1)  . . . . [common]

    //dirty:
    2)  . . . . [common]
                    \
                     \ . . . . [remote]

    //local change:
    3)  . . . . [common] . . . . [local]

    //conflict:
    4) . . . . [common] . . . . [local]
                   \
                    \ . . . . [remote]

    //pushing:
    5)  . . . . [common] . . . . [push] . . . . [local]

    //pushing, and known dirty (should abort the push, or just wait for the conflict to occur):
    6)  . . . . [common] . . . . [push] . . . . [local]
                    \
                     \ . . . . [remote]


each of local, push, remote, and common can have,
- for documents:
  * body
  * contentType
  * contentLength
  * revision
  * timestamp
- for folders:
  * itemsMap (itemName -> true)
  * revision
  * timestamp

timestamp means when this data was written (local), push was initiated (push), fetch/push was completed (remote), agreement was reached (common)

# caching strategies

Up to now, our caching strategy was only 'yes', 'no', or 'folders only'. Also, setting a strategy for a subtree of a tree with a different strategy, was ignored. This pull request fixes that by always caching nodes that were seen (even though their caching strategy is 'no'), and introducing a flush() method that flushes the cache for a subtree (which will emit change events that revert any pending outgoing changes there).

# "keep/revert" conflict resolution

Remotestorage implements a hub-and-spokes versioning system, with one central server (the hub) any any number of clients (the spokes). New versions of subtrees always start at one of the clients. They are then sent to the server, and from there to all the other clients. The server assigns the revision numbers and sends them to the initiating client using http ETag responses. Remotestorage.js is a library that attempts to make it easy to build remoteStorage clients, by hiding both the push/pull synchronization and the version merging from the client developer. Versioning conflicts between the local client and the remote server are initially resolved as a 'remote wins', to which the client code may respond with an explicit revert (putting the old, local version back), a merge (putting the result of the merge in place), or by doing nothing ("keep"), and leaving the remote result in place.

Sync is tree-based: syncing a node is equivalent to syncing all its children. There are two parts at play, that interact: transporting the diffs to and from the remote server, and merging the local and remote versions into one common version. Each document starts out at non-existing in both its local and remote versions. From there on, it can be created, updated, and deleted any number of times throughout its history, both locally and remotely. If at some point in time it either does not exist neither locally nor remotely, or its body and content-type are the same byte-for-byte on both sides, then the two stores are in agreement. If the document exists in only one of the stores, or the document's body or its content-type differs between the two stores, then the document is in conflict.

The library is always aware of the latest local version, but it may or may not be aware of the latest remote version, and therefore of whether a conflict or agreement exists for the document. The server is likewise not necessarily aware of the latest local version, if there are changes that haven't been pushed out yet. This can be fixed by doing a GET, PUT, or DELETE. A GET will return the current remote version; a conditional PUT or DELETE will push out the change, while at the same time checking if any unfetched remote changes exist. If they do, then the push will fail, and the library will fetch instead. After this, the library has a latest known common revision of the document, possibly a local version if it was changed since then, and possibly a remote version if it was changed since then.

Before resolving a conflict, both revision histories are squashed. This means that creating+deleting a document becomes a noop, and deleting+creating, or updating it multiple times, becomes one single update. Then, if the document was changed in different ways locally and remotely, a conflict is fired; if it was changed only locally or only remotely, then the change is automatically accepted by the other store. Note that in the case of a successful conditional push request, this will already have happened.

Conflicts that are discovered by a document fetch fire only once. Conflicts that are discovered through a parent folder fetch, or through a conditional push, fire twice: once as a pre-conflict (where only the revision, not the content, of the remote version is filled in), and once as a full-conflict, where 'common', 'local', and 'remote' are all fully filled in.

There are 3 basic ways to resolve a pre-conflict: 'local', 'remote', 'wait'. If you wait on a pre-conflict, the remote version will automatically be fetched, so that the full-conflict can be triggered, and you get a second chance to decide. This can then again be resolved in the same three ways.

After calling 'wait' on a conflict, you can always resolve it later by calling BaseClient#resolveConflict(path, resolution). You can also request each existing conflict under the BaseClient's scope to be triggered again, with BaseClient#fireConflicts().

The library's conflict resolution strategy is 'wait' for pre-conflicts, and 'remote' for full-conflicts. This means that the module will receive them in the form of change events with origin 'conflict'. When receiving such a change event, the module can still decide to revert it explicitly.

As noted before, merging a subtree is done by merging each document that exists within that subtree, in either or both stores. When the library fetches a folder listings, it can detect a remote child change, which then may or may not result in a conflict. When a folder listing comes in, which has changed since the last time it was retrieved, four types of information may be discovered:

* which of the documents directly within the folder changed their remote revision since the last check (new ETag on a document item)
* in which previously empty subtrees at least one document was created (new folder item)
* in which subtrees all previously existing documents were deleted (folder item disappeared)
* in which subtrees at least one document was either created, updated, or deleted (new ETag on a folder item)

