# Why use this?

## Offline-first design

rs.js stores data locally first and syncs data with a remote storage
account second. This makes it a robust sync solution for mobile
applications, where slow and spotty network connections are a normal
situation.

Apps and use cases that don\'t require caching can keep selective data
locally while not caching the rest.

When a backend goes down, users can just keep using the app and have
their data automatically synced as soon as the server is back online.

## Zero backend

rs.js is built for creating [unhosted](/unhosted) apps. Users can connect their
own storage account to apps on their devices, without needing to trust app
developers with private data. Developers can rapidly build apps without
investing in integrating, managing, maintaining, or securing data.

A nice side effect of this design is that your app can scale to millions
of users with literally *zero* cost for storage.

Also, if an app goes offline or is abandoned, people can continue to use
it across devices until they switch to a new one at their own pace. If
an abandoned app comes back at some point, many active users may still
be there.

## Data sharing

Different apps can access the same data, so you can build an app that
uses and manipulates existing data, without building import/export
features or having users start over from scratch.

Even better, you can get advanced capabilities for free by using shared,
open-source [data modules](./data-modules/), which you can cooperate on with
other developers.

For example: enable the sharing of files by simply integrating the [shares
module](https://github.com/skddc/remotestorage-module-shares), giving you
client-side thumbnail generation for images as well as other features for free.

## Reliability

The first prototype of rs.js was written in November 2010. Since then,
it has been used, tested, stabilized, and improved in over 4000 commits.
The library has been used in commercial apps by hundreds of thousands of
users, and in countries across the globe. Bugs and issues have been
noted and fixed for virtually every device, browser, privacy setting and
network connection there is.

In short: you can rely on rs.js to do its job. And if you do find a
critical bug, there\'s a team of people who will help with fixing it.

## One JS API for multiple storage options

rs.js optionally supports Dropbox and Google Drive as storage backends which
users can connect. Conveniently, as an app developer you don\'t have to
implement anything special in order for these backends to work with your code.
Just [configure OAuth app keys](./dropbox-and-google-drive), and
your users can choose between 3 different backends to connect. If you're not
using the [connect widget](./getting-started/connect-widget), you may need to
create additional UI for these alternate backends.
