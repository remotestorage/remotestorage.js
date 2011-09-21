This repository contains various things:



Setting up unhosted storage for your own user address
=============================

This repository contains everything you need to set up your own unhosted storage node.
It assumes you take a freshly formatted debian squeeze server, and set up WordPress, ownCloud and BrowserMail on there.
Just follow unhosted-storage-debian.md.
If you can't get it work, please drop by in our [chat room](http://webchat.freenode.net/?channels=unhosted).
We also have shared hosting setup instructions, but they are still quite experimental: unhosted-storage-shared-hosting.md. 

Setting up your own app server
==============================

We're working towards a sort of apptorrent app-mirroring servers. The first parts of it are here, to use them follow app-server-debian.md. If you want, you can add a default storage node into your app server. That way, people that reach your app server, but don't have an unhosted account yet, can get an account at your domain name. To do this, you can make ownCloud run on port 444. It's described in hosted-storage-debian.md
