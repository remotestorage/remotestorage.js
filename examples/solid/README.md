# Solid adapter lab

Interactive browser demo of the optional Solid backend. It uses the repository's
actual browser bundle and a local Community Solid Server 7.2.0, with the normal
local cache and synchronization enabled.

## Run

Requirements: Node.js 22 or 24 and a recent browser. From the repository root:

```sh
npm ci
npm run build:solid
npm ci --prefix examples/solid
npm start --prefix examples/solid
```

Open the browser address printed after the provider is ready. Select **Open
local account setup**, sign up, and create a pod. Keep **Use the WebID in the
Pod** and **Link to this storage from my WebID** selected. Return to the demo,
select **Connect**, and complete the provider login/consent flow.

The local provider stores data in memory. Stopping the demo discards its
accounts and pod data. No test credentials or tokens are committed. The app
writes only inside `/solid-demo/`.

## Checks

Try JSON save/read, binary SHA-256 verification, stale writes and deletes,
Turtle container listings, and deletion. The fixed sample filenames are read
before editing or deleting to establish the current cached revision. Writes
are verified against the pod after queued synchronization, rather than treating
the `startSync()` promise as proof that transfers finished.

The [recorded browser run](../../docs/images/solid-demo.mp4) exercised all seven
checks against a real local provider. Other hosted providers and the separate
connect widget have not been tested by this demo.

You can enter an HTTPS provider for a disposable remote account if it permits
this app's localhost callback and exposes the ETag/conditional-request behavior
documented in the [Solid guide](../../docs/solid.md).

`SOLID_BUNDLE_DIRECTORY` optionally selects a directory containing a separately
built `remotestorage-solid.js`, its source map, and its license file.
