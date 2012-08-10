remoteStorage.defineModule('public', function(client) {
    function getPublicItems()
    {
        return client.getObject("publishedItems");
    }

    return {
        exports: {
            getPublicItems: getPublicItems,
            getObject: client.getObject
        }
    }
});

remoteStorage.defineModule('root', function(myPrivateBaseClient, myPublicBaseClient) {
    function setOnChange(cb)
    {
        myPrivateBaseClient.on('change', function(e)
        {
            console.log(e); cb(e);
        });
        myPublicBaseClient.on('change', function(e)
        {
            console.log(e); cb(e);
        });
    }

    function addToPublicItems(path)
    {
        var data = myPublicBaseClient.getObject("publishedItems");
        if(path[0] == "/")
            path = path.substr(1);

        if(data)
        {
            if(data.indexOf(path) == -1)
            {
                data.unshift(path);
            }
        }
        else
        {
            data = [];
            data.push(path);
        }
        myPublicBaseClient.storeObject('array', "publishedItems", data);
    }

    function removeFromPublicItems(path)
    {
        var data = myPublicBaseClient.getObject("publishedItems");
        if(path[0] == "/")
            path = path.substr(1);
        if(data)
        {
            if($.inArray(path, data) != true)
            {
                data.pop(path);
            }
        }
        else
        {
            data = [];
        }
        myPublicBaseClient.storeObject('array', "publishedItems", data);
    }

    function publishObject(path)
    {
        if(pathIsPublic(path))
            return 'Object has already been made public';

        var data = myPrivateBaseClient.getObject(path);
        var publicPath = "/public" + path;
        addToPublicItems(publicPath);
        myPrivateBaseClient.remove(path);
        myPrivateBaseClient.storeObject(data['@type'], publicPath, data);

        return "Object " + path + " has been published to " + publicPath;
    }

    function archiveObject(path)
    {
        if(!pathIsPublic(path))
            return 'Object has already been made private';

        var data = myPrivateBaseClient.getObject(path);
        var privatePath = path.substring(7, path.length);
        removeFromPublicItems(path);
        myPrivateBaseClient.remove(path);
        myPrivateBaseClient.storeObject(data['@type'], privatePath, data);

        return "Object " + path + " has been archived to " + privatePath;
    }

    function pathIsPublic(path)
    {
        if(path.substring(0, 8) == "/public/")
            return true;
        return false;
    }

    function getClient(path)
    {
        if(!pathIsPublic(path))
            return myPrivateBaseClient;
        return myPublicBaseClient;
    }

    function getObject(path, cb, contex)
    {
       var client = getClient(path);
        return client.getObject(path, cb, contex);
    }

    function setObject(type, path, obj)
    {
        var client = getClient(path);
        client.storeObject(type, path, obj);
    }

    function removeObject(path)
    {
        var client = getClient(path);
        client.remove(path);
    }

    function getListing(path, cb, context)
    {
        var client = getClient(path);
        return client.getListing(path, cb, context);
    }

    return {
        exports: {
            getListing: getListing,
            getObject: getObject,
            setObject: setObject,
            removeObject: removeObject,
            archiveObject: archiveObject,
            publishObject: publishObject,
            setOnChange:setOnChange
        }
    }
});


