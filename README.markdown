UNDER TRANSITION
==========

Please see [http://github.com/michiel-unhosted/myfavouritesandwich](http://github.com/michiel-unhosted/myfavouritesandwich) (client-side) and [http://github.com/michiel-unhosted/DemoRedlibreOrg](http://github.com/michiel-unhosted/DemoRedlibreOrg) (server-side) while we refurbish this repository to contain the latest version of App, The Data, and Everything.

INSTALL INSTRUCTIONS - OPTION 1: Only static content
- This is totally entry-level, you can probably host this absolutely any webserver on the entire web.
- Only owners of an unhosted account can use your app, but luckily there are public providers that offer unhosted accounts for free.
- Put this directory on your webserver, and rename 'config.js-appOnly-noCrypto' to 'config.js'

INSTALL INSTRUCTIONS - OPTION 2: With PHP and MySQL
- This is still pretty basic as well; you only need standard PHP and MySQL, which 99% of all linux web hosts offer nowadays.
- Very attractive option if you just want to offer your normal js->php->mysql app, but be ready for users that register/login to your app with an unhosted account. 
- put this directory on your webserver, and rename 'config.js-appOnly-mysql' to 'config.js'
- make sure to have PHP enabled on the server, create a database, and edit config.php with mysql credentials
- to save hosting costs, and help push the unhosted web, you can set the evangelism level in config.php. Choose from: silent, informational, persuasive, militant.

INSTALL INSTRUCTIONS - OPTION 3: With root access
- put this directory on your webserver, and use the default 'config.js'
- make sure to have PHP enabled on the server, enable DAV
