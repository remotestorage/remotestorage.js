First setup
-----------

    ssh root@myfavouritesandwich.org
    [type password]
        mkdir .ssh
        exit
    scp .ssh/id_rsa.pub root@myfavouritesandwich.org:.ssh/
    [type password]
        apt-get update
        apt-get upgrade

Set up node
-----------
       apt-get install git python g++ libssl-dev make curl
    [follow instructions on https://github.com/joyent/node/wiki/Installation step 3a]
       curl http://npmjs.org/install.sh | sh

Set up redis
------------
      wget http://redis.googlecode.com/files/redis-2.2.12.tar.gz
      tar -xzvf redis-2.2.12.tar.gz 
      cd redis-2.2.12
      make
      echo daemonize yes >> redis.conf
      src/redis-server redis.conf

Set up demo server
------------------
       npm install redis
       npm install http-proxy
    scp node/ssl-cert/* root@myfavouritesandwich.org:ssl-cert/
    [you can also clone git://github.com/unhosted/unhosted.git as a read-only copy. but for read/write:]
       ssh-keygen -t rsa -C "root@myfavouritesandwich.org"
       cat .ssh/id_rsa.pub 
    [paste it into ssh-keys tab of your github account settings]
       git clone git@github.com:unhosted/unhosted.git
       cd unhosted/
       git checkout devel
       npm -g install forever
       cd demoServer
       forever start server.js
