remoteStorage.defineModule('root', function(client) {
    function addToPublicItems(path)
    {
        var data = client.getObject("/public/publishedItems");
        if(path[0] == "/")
            path = path.substr(1);

        if(data)
        {
            if($.inArray(path, data) != true)
            {
                data.unshift(path);
            }
        }
        else
        {
            data = [];
            data.push(path);
        }
        client.storeObject('array', "/public/publishedItems", data);
    }

    function removeFromPublicItems(path)
    {
        var data = client.getObject("/public/publishedItems");
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
        client.storeObject('array', "/public/publishedItems", data);
    }

    function publishObject(path)
    {
        if(path.substring(0, 8) == "/public/")
            return 'Object has already been made public';

        var data = client.getObject(path);
        var publicPath = "/public" + path;
        addToPublicItems(path);
        client.remove(path);
        client.storeObject(data['@type'], publicPath, data);

        return "Object " + path + " has been published to " + publicPath;
    }

    function archiveObject(path)
    {
        if(path.substring(0, 8) != "/public/")
            return 'Object has already been made private';

        var data = client.getObject(path);
        var privatePath = path.substring(7, path.length);
        removeFromPublicItems(path);
        client.remove(path);
        client.storeObject(data['@type'], privatePath, data);

        return "Object " + path + " has been archived to " + privatePath;
    }

    return {
        exports: {
            getListing: client.getListing,
            getObject: client.getObject,
            setObject: client.storeObject,
            removeObject: client.remove,
            archiveObject: archiveObject,
            publishObject: publishObject
        }
    }
});