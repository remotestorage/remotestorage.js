# Sync invariants and current limits

This page distinguishes behavior exercised by the current tests from desired
properties that the implementation does not yet provide. It describes cached
operation through `CachingLayer` and `Sync`; direct remote access has different
completion semantics. It is not a proof of correctness across all schedules,
browsers, or storage providers.

The [cache data format](./cache-data-format) explains `common`, `local`,
`remote`, and `push`. In particular, `push` is the snapshot sent to the server;
`local` can change again while that request is in flight.

## Implemented behavior

The following cases are executable in `test/unit/sync-invariants.test.mjs`.
They use the real in-memory cache and sync response handlers with controlled
inputs. The push-acknowledgement cases apply when the newer local edit is
already stored before response handling reads the node; they do not establish
atomicity against a local edit overlapping that read/write operation.

| Situation | Behavior exercised by the tests |
| --- | --- |
| PUT A is acknowledged after a newer local edit B | `common` takes the uploaded A and its revision; the differing local body, content type, or deletion B remains pending. |
| DELETE is acknowledged after a local recreation | The recreated local body remains pending and the old `push` snapshot is removed. |
| A push fails with HTTP 503 | The in-flight snapshot is removed, the local edit remains, and a later task can retry it. |
| A document has a known common revision | An update uses `ifMatch`; creation without that revision uses `ifNoneMatch: '*'`. The remote adapter/provider must enforce those conditions. |
| A push returns HTTP 412 | The remote revision is recorded; the local value remains until the remote body is fetched. The fetched conflicting body wins, with the local/common/remote values captured in a conflict event. |
| A GET returns 304 | Only the timestamp of a matching common revision is refreshed; pending local content is retained. |
| Cache strategy is FLUSH | Pending local edits are retained; a clean acknowledged document can be removed from the cache. |
| A push acknowledgement has no push snapshot | Response handling rejects and stops that sync instance instead of claiming a valid acknowledgement. |

The existing session-isolation cases in `test/unit/sync.test.mjs` also exercise
responses and delayed conflict events after session replacement: they must not
write into or emit changes through the replacement session's adapter. This does
not mean that every network request is physically cancelled or that an already
submitted storage transaction can be rolled back.

## Completion is not the same as durability

With caching enabled, a successful `storeFile()`, `storeObject()`, or `remove()`
resolves after the local adapter accepts the operation. It does not acknowledge
a remote upload. A later conflict can replace that value under the default
remote-wins policy; applications can use the conflict event to restore or merge
it explicitly.

For IndexedDB there is another boundary: `setNodes()` queues changes and starts
persistence, but does not await its database transaction. Reads consult queued
or running changes before the database. `test/unit/indexeddb-storage.test.mjs`
exercises this optimistic visibility and verifies that explicit
`getNodesFromDb()` / `setNodesInDb()` calls settle at their transaction boundaries,
including error/abort cases. Those are controlled transaction fixtures, not
browser durability or recovery tests.

Consequently, a resolved local write is not proof that a reload or process crash
will recover it. Nor do the explicit transaction-error tests establish error
propagation or rollback through the higher-level write API.

A remote change event can also be emitted during merging, before its resulting
cache write completes. The event's `newValue` describes the incoming transition;
a read started inside that listener can still see the previous cached value.
The sync-invariants suite exercises this ordering. Do not use a change event as
a disk-commit notification.

`sync-done` reports a sync cycle's result. It is not a database durability
barrier, a multi-document transaction, or proof that another client has observed
the same state.

## Expectations not yet guaranteed

| Reasonable application expectation | Current limitation and tracking |
| --- | --- |
| A fetched nested document is reachable through every ancestor listing | A cached ancestor's local listing can remain stale even though the document is readable and a change event arrived. See [#1387](https://github.com/remotestorage/remotestorage.js/issues/1387) and the proposed fix in [#1412](https://github.com/remotestorage/remotestorage.js/pull/1412). |
| Sync reconciliation and a concurrent local edit preserve both updates | Separate snapshot reads and whole-node writes can overwrite one another. See [#1413](https://github.com/remotestorage/remotestorage.js/issues/1413). #1412 includes a per-instance queue; that is not yet part of master and is not a cross-tab transaction. |
| Multiple tabs update a document and its listings atomically | No shared transactional read/modify/write contract is established across the adapters. Broadcast change events do not supply isolation. See [#1421](https://github.com/remotestorage/remotestorage.js/issues/1421). |
| Disconnect is a way to keep working offline with the same local data | Disconnect runs storage/session cleanup; it is not the same as temporarily losing network connectivity. Keeping data and warning about unsynced changes are discussed in [#1170](https://github.com/remotestorage/remotestorage.js/issues/1170) and [#1124](https://github.com/remotestorage/remotestorage.js/issues/1124). |

The first two expectations have **pending tests with desired assertions**, not
tests that endorse the incorrect state. To reproduce the failures on current
master after compilation:

```sh
RS_TEST_KNOWN_GAPS=1 npm run test:mocha -- --grep 'Known sync expectation gaps' --exit
```

This command is expected to fail until the corresponding fixes land. The normal
suite lists those cases as pending. When a fix lands, enable its test by default
and update this table; do not change the assertion to accept the bug. The
interleaving test pauses a snapshot read explicitly, rather than relying on a
probabilistic timeout.

## Refactoring criteria

[Discussion #1421](https://github.com/remotestorage/remotestorage.js/issues/1421)
proposes transactional updates and a pure merge/state-transition core under
[#1251](https://github.com/remotestorage/remotestorage.js/issues/1251).
Before strengthening the guarantees above, specify the isolation scope,
commit/error semantics, event ordering, and session cancellation behavior.
Add two-tab and transaction-abort/reopen browser tests alongside deterministic
transition tests. A high line-coverage percentage cannot establish these
properties on its own.
