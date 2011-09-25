This repository contains various things and changes over time. Right now, it contains:

* the code of all the demo domains we host at rackspace
* the code of apptorrent.nodejitsu.com


Setting up unhosted storage for your own user address
=============================
If you want to get started with Unhosted, try installing ownCloud on your domain. If your domain is me.com and your ownCloud user is called 'admin', then 'admin@me.com' will be your remote storage. Just make sure you install ownCloud in the root of the domain, so not in a subfolder (although subdomains are OK). If in doubt, drop by in our [chat](http://webchat.freenode.net/?channels=unhosted).

Converting your web app to Unhosted
=============================
With our packager, you can easily take any localStorage-based app, and make it into an unhosted app. So if you have an application, then write it so that it stores all user data in localStorage. Then follow the steps at http://apptorrent.nodejitsu.com/packager (WARNING: the packager doesn't work yet. But we're quickly ironing out more bugs). Make sure you state somewhere that your app is free software. Add for instance "This web app is published under the MIT license" to the README file of your repo. Otherwise other people can't reuse your code.
