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
        5  vim /var/www/index.html 
    [set an 'in maintenance' message]

Set up https
------------

        6 mkdir /var/www/no-ssl
        7 vim /var/www/no-ssl/index.html
    [edit:]
    <html>
    <script>
    document.location="https://myfavouritesandwich.org"
    </script>
    </html>
    scp ~/ssl-cert/* root@myfavouritesandwich.org:
        8  a2ensite default-ssl
        9  vim /etc/apache2/sites-enabled/default-ssl
    [edit:]
            SSLCertificateFile    /root/ssl.crt
            SSLCertificateKeyFile /root/ssl.key
    [and:]
            SSLCertificateChainFile /root/sub.class1.server.ca.pem
    [and while you have the file open, this is needed for both ownCloud and WordPress:]
        AllowOverride All
       10  vim /etc/apache2/sites-enabled/000-default
    [edit:]
            DocumentRoot /var/www/no-ssl
       11  /etc/init.d/apache2 restart

Set up ownCloud
---------------

       12  apt-get install git libapache2-mod-php5 php5-sqlite
       15  git clone git://gitorious.org/owncloud/owncloud.git
       16  mv owncloud/ /var/www
       18  chown -R www-data /var/www/owncloud
       19  /etc/init.d/apache2 restart
    [browse to http://myfavouritesandwich.org/owncloud/ and follow setup wizard]
    [go into ownCloud as admin and activate the 'Unhosted Web' app]


Set up WordPress
----------------

       27  cd
       28  wget http://wordpress.org/latest.tar.gz
       29  tar -xzvf latest.tar.gz 
       30  mv wordpress/* /var/www/
       31  cd /var/www
       32  mysql -p
    create database wordpress;
    exit;
    [browse to http://myfavouritesandwich.org/index.php and follow setup wizard]
       33  vim wp-config.php
    [paste config from setup wizard]
       34  mv index.html maintenance.html
    [in wordpress dashboard, add a wordpress blogpost explaining maintenance]
    [in wordpress dashboard, install and activate plugins: well-known, host-meta, webfinger]
       35  touch /var/www/.htaccess
       36  chown www-data /var/www/.htaccess
       37  /etc/init.d/apache2 restart
    [visit https://myfavouritesandwich.org/wp-admin/options-permalink.php and choose a format with no '?' in it]
    [visit https://myfavouritesandwich.org/wp-admin/options-general.php and change the site url and WordPress url to https://myfavouritesandwich.org/]
    [visit https://myfavouritesandwich.org/wp-admin/plugin-editor.php?file=webfinger/plugin.php and just above 'echo "\n</XRD>";', if 'mich' is your username, paste:]
        echo '<Link rel="http://unhosted.org/spec/dav/0.1" href="https://myfavouritesandwich.org/owncloud/apps/core_unhosted/compat.php/mich/unhosted/"/>';

Set up node
-----------
       38 apt-get install python g++ libssl-dev make
    [follow instructions on https://github.com/joyent/node/wiki/Installation step 3a]
       50 apt-get install curl
       51 curl http://npmjs.org/install.sh | sh

Set up BrowserMail
------------------
       52 npm install smtp
       53 npm install socket.io
       54 cd /root/unhosted/browsermail
       55 vim server.js
     [replace hard-coded 'mich@myfavouritesandwich.org' with your own user address]
       56 node server.js

Set up BrowserId
----------------
    [browse to http://myfavouritesandwich.org:8001 - you should see a message like 'raw MIME emails will appear here'.]
    [browse to http://myfavoritebeer.org and register your user address]
    [go back to your browsermail tab, copy the link from the email, and open it, *BUT* carefully removing the '3D' from the '?token=3D...' bit]
