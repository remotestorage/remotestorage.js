First setup
-----------

    ssh root@myfavouritesandwich.org
    [type password]
        1  mkdir .ssh
        2  exit
    scp .ssh/id_rsa.pub root@myfavouritesandwich.org:.ssh/
    [type password]
        3  apt-get update
        4  apt-get upgrade


Set up node
-----------
       5  apt-get install git python g++ libssl-dev make curl
    [follow instructions on https://github.com/joyent/node/wiki/Installation step 3a]
      17  curl http://npmjs.org/install.sh | sh

Set up redis
------------
      18  wget http://redis.googlecode.com/files/redis-2.2.12.tar.gz
      19  tar -xzvf redis-2.2.12.tar.gz 
      20  cd redis-2.2.12
      21  make
      22  echo daemonize yes >> redis.conf
      23  src/redis-server redis.conf

Set up app server
-----------------
       18  npm install redis
    scp node/ssl-cert/* root@myfavouritesandwich.org:ssl-cert/
    [you can also clone git://github.com/unhosted/unhosted.git as a read-only copy. but for read/write:]
       22  ssh-keygen -t rsa -C "root@myfavouritesandwich.org"
       23  cat .ssh/id_rsa.pub 
    [paste it into ssh-keys tab of your github account settings]
       24  git clone git@github.com:unhosted/unhosted.git
       25  cd unhosted/
       26  git checkout devel
       27  cd node
       28  npm -g install forever
       29  forever start server.js

Set up apache https on port 444
-------------------------------
       30  apt-get install libapache2-mod-php5 php5-sqlite
    scp ~/ssl-cert/* root@myfavouritesandwich.org:
        8  a2enmod ssl
        9  a2dissite default
        9  a2ensite default-ssl
        9  vim /etc/apaches2/ports.conf
    [comment out:]
    #NameVirtualHost *:80
    #Listen 80
    [edit (twice):]
               Listen 444
        9  vim /etc/apache2/sites-enabled/default-ssl
    [edit:]
           <VirtualHost _default_:444>
    [edit:]
            SSLCertificateFile    /root/ssl.crt
            SSLCertificateKeyFile /root/ssl.key
    [and:]
            SSLCertificateChainFile /root/sub.class1.server.ca.pem
    [and this is needed for ownCloud:]
        AllowOverride All
       11  /etc/init.d/apache2 restart
    [confirm that https://myfavouritesandwich.org:444/ shows It Works!]
    [confirm https://myfavouritesandwich.org/ still shows the app server]

Set up ownCloud
---------------

       15  git clone git://gitorious.org/owncloud/owncloud.git
       16  mv owncloud/* /var/www
       17  apt-get install php5-mysql
       18  /etc/init.d/apache2 restart
       19  chown www-data /var/www/owncloud/
       20  chown www-data /var/www/owncloud/config/
    [browse to http://myfavouritesandwich.org/owncloud/ and follow setup wizard]
       21  git clone git@github.com:unhosted/unhosted.git
       22  ssh-keygen -t rsa -C "root@myfavouritesandwich.org"
       23  cat .ssh/id_rsa.pub 
    [paste it into ssh-keys tab of github account settings]
       24  git clone git@github.com:unhosted/unhosted.git
       25  cd unhosted/
       26  git checkout devel
       27  git branch devel
       28  git pull devel
       29  git pull
       30  git checkout devel
    [not sure which one of these worked!]
       31  cp -r ownCloudApp/core_unhosted/ /var/www/owncloud/apps/core_unhosted
    [go into ownCloud as admin and activate the 'Unhosted Web' app]


Set up WordPress
----------------

       32  cd
       33  wget http://wordpress.org/latest.tar.gz
       34  tar -xzvf latest.tar.gz 
       35  mv wordpress/* /var/www/
       36  cd /var/www
       37  mysql -p
    create database wordpress;
    exit;
    [browse to http://myfavouritesandwich.org/index.php and follow setup wizard]
       38  vim wp-config.php
    [paste config from setup wizard]
       39  mv index.html maintenance.html
    [in wordpress dashboard, add a wordpress blogpost explaining maintenance]
    [in wordpress dashboard, install and activate plugins: well-known, host-meta, webfinger]
       40  touch /var/www/.htaccess
       41  chown www-data /var/www/.htaccess
       42  /etc/init.d/apache2 restart
    [visit https://myfavouritesandwich.org/wp-admin/options-permalink.php and choose a format with no '?' in it]
    [visit https://myfavouritesandwich.org/wp-admin/options-general.php and change the site url and WordPress url to https://myfavouritesandwich.org/]
    [visit https://myfavouritesandwich.org/wp-admin/plugin-editor.php?file=webfinger/plugin.php and just above 'echo "\n</XRD>";', if 'mich' is your username, paste:]
        echo '<Link rel="http://unhosted.org/spec/dav/0.1" href="https://myfavouritesandwich.org/owncloud/apps/core_unhosted/compat.php/mich/unhosted/"/>';

Set up BrowserId
----------------
       44 cd /root/unhosted/browsermail
       45 vim server.js
     [replace hard-coded 'mich@myfavouritesandwich.org' with your own user address]
       45 node server.js
    [browse to http://myfavouritesandwich.org:8001 - you should see a message like 'raw MIME emails will appear here'.]
    [browse to http://myfavoritebeer.org and register your user address]
    [go back to your browsermail tab, copy the link from the email, and paste it, carefully removing the '3D' from '?token=3D...' bit]
