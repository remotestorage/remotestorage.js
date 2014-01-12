(function() {
  /**
   * Class: cachinglayer
   *
   * local storages should implement this.getNodes, this.setNodes, and this.forAllDocuments
   * the rest is blended in here to create a GPD (get/put/delete) interface
   * which the baseclient can talk to.
   */

  var methods = {
    _isFolder: function(path) {
      return path.substr(-1) === '/';
    },
    
    //GPD interface:
    get: function(path) {
      var promise = promising();
      this.getNodes([path]).then(function(objs) {
        var latest;
        if (objs[path].local) {
          latest = objs[path].local;
        } else {
          latest = objs[path].official;
        }
        if (latest && latest.body && latest.contentType) {
            promise.fulfill(200, latest.body, latest.contentType);
        } else {
          promise.fulfill(404);
        }       
      }, function(err) {
        promise.reject(err);
      });
      return promise;
    },
    put: function(path, body, contentType) {
      var i, now = new Date().getTime(), pathNodes = this._nodesFromRoot(path);
      return this.getNodes(pathNodes).then(function(objs) {
        for(i=0; i<pathNodes.lengh; i++) {
          if (!objs[pathNodes[i]]) {
            objs[pathNodes[i]]] = {
              path: pathNodes[i],
              official: {
                timestamp: now
              }
            };
            if(this._isFolder(pathNodes[i])) {
              objs[pathNodes[i]]].official.items = {};
            }
          }
          if(i === 0) {
            //save the document itself
            objs[path].local = {
              body: body,
              contentType: contentType,
              timestamp: now
            };
          } else {
            //add it to all parents
            itemName = pathNodes[i-1].substring(pathNodes[i].length);
            if (!objs[pathNodes[i]]].local) {
              objs[pathNodes[i]]].local = objs[pathNodes[i]]].official;
            }
            objs[pathNodes[i]]].local.itemsMap[itemName] = true;
          }
        }
        return this.setNodes(objs);
      });
    },
    delete: function(path) {
      var i, now = new Date().getTime(), pathNodes = this._nodesFromRoot(path);
      return this.getNodes(pathNodes).then(function(objs) {
        for(i=0; i<pathNodes.lengh; i++) {
          if (!objs[pathNodes[i]]) {
            throw new Exception('cannot delete a non-existing node; retrieve its parent folder first');
          }
          if(i === 0) {
            //delete the document itself
            objs[path].local = {
              timestamp: now
            };
          } else {
            //remove it from all parents
            itemName = pathNodes[i-1].substring(pathNodes[i].length);
            if (!objs[pathNodes[i]]].local) {
              objs[pathNodes[i]]].local = objs[pathNodes[i]]].official;
            }
            delete objs[pathNodes[i]]].local.itemsMap[itemName];
          }
        }
        return this.setNodes(objs);
      });
    },

    fireInitial: function() {
      this.forAllNodes(function(node) {
        var latest;
        if (this._isFolder(node.path)) {
          if (node.local) {
            latest = node.local;
          } else {
            latest = node.agreed;
          }
          if (latest && latest.body && latest.contentType) {
            this._emit('change', {
              path: node.path,
              origin: 'local',
              oldValue: undefined,
              oldContentType: undefined,
              newValue: latest.body,
              newContentType: latest.contentType
            });
          }
        }
      });
    },
    _disagree: function(path, remoteRevision) {
    
    },
    handleResponse: function(path, method, status, revision) {
      if (status ==== 412) {
        _disagree(path, revision);
      } else if (method === 'PUT') {
        _agree(path, revision);  
      } else if (method === 'DELETE')
  };


  //1, a local document is created:
  {
    path: string,
    official: { timestamp },
    local: { body, contentType, timestamp }
  }

  //2, a push request is initiated:
  {
    path: string,
    official: { timestamp },
    sent: { body, contentType, timestamp },
    local: { body, contentType, timestamp }
  }

  //3, it is successful:
  {
    path: string,
    official: { body, contentType, revision, timestamp },
    local: { body, contentType, timestamp }
  }

  //it errors or times out:
  // back to 1
  
  //4, it's a conflict:
  {
    path: string,
    official: { timestamp },
    local: { body, contentType, timestamp },
    remote: { revision, timestamp }
  }
  
  //5, the remote version is retrieved:
  {
    path: string,
    official: { timestamp },
    local: { body, contentType, timestamp },
    remote: { body, contentType, revision, timestamp }
  }

  //the module resolves the conflict as local-wins ([remote] moves to [agreed]):
  {
    path: string,
    official: { body, contentType, revision, timestamp },
    local: { body, contentType, timestamp }
  }

  //the module resolves the conflict as remote-wins ([local] is discarded and [remote] moves to [official] and [local]):
  {
    path: string,
    official: { body, contentType, revision, timestamp },
    local: { body, contentType, revision, timestamp }
  }

  //a local change is made while the outgoing push is still pending:
  {
    path: string,
    official: { timestamp },
    sent: { body, contentType, timestamp },
    local: { body, contentType, timestamp }
  }
  
  //during conflict, the parent folder is retrieved and the revision matches [remote]
  {
    path: string,
    local: { body, contentType, timestamp },
    agreed: {},
    remote: { body, contentType, contentLength, revision, timestamp }
  }
  
  //during conflict, the parent folder is retrieved and the revision doesn't match [remote]
  {
    path: string,
    local: { body, contentType, timestamp },
    agreed: {},
    remote: { revision, contentType, contentLength, timestamp } //removing body, updating other fields, re-emitting conflict event
  }
  
  //during agreed, the parent folder is retrieved and the revision matches [local]
  {
    path: string,
    local: { body, contentType, contentLength, revision, timestamp },
    agreed: { body, contentType, contentLength, revision, timestamp }
  }
  
  //during agreed, the parent folder is retrieved and the revision doesn't match [local]
  {
    path: string,
    local: { body, contentType, contentLength, revision, timestamp },
    agreed: true,
    remote: { revision, contentType, contentLength, timestamp } //removing body, updating other fields, re-emitting conflict event   
  }
  
  //other fields:
  {
    path: string,
    fetching: timestamp, // a fetch is initiated
    syncedTree: timestamp,
    syncedAll: timestamp
  }
 
//in sync: 
1  . . . . [official]
 
//fetching:
2  . . . . [official]
                \
                 \ . . . . [fetch]
  
//dirty:
3  . . . . [official]
                \
                 \ . . . . [remote]
 
//dirty and fetching:
4  . . . . [official]
                \
                 \ . . . . [fetch] . . . . [remote]
 
//local change:
5  . . . . [official] . . . . [local]
 
//local change and fetching:
6  . . . . [official] . . . . [local]
                \
                 \ . . . . [fetch]
 
//local change and known dirty:
7  . . . . [official] . . . . [local]
                \
                 \ . . . . [remote]
 
//conflict and dirty
8  . . . . [official] . . . . [local]
                \
                 \ . . . . [fetch] . . . . [remote]
 
//local change and pushing:
9  . . . . [official] . . . . [push] . . . . [local]
 
//local change, pushing and fetching (should abort the fetch):
10  . . . . [official] . . . . [push] . . . . [local]
                 \
                  \ . . . . [fetch]
 
//local change, pushing, and known dirty (should abort the push):
11  . . . . [official] . . . . [push] . . . . [local]
                 \
                  \ . . . . [remote]
 
//local change, pushing, known dirty, and fetching (should abort the push)
12  . . . . [official] . . . . [push] . . . . [local]
                 \
                  \ . . . . [fetch] . . . . [remote]
 
  
  /**
   * Function: cachingLayer
   *
   * Mixes common caching layer functionality into an object.
   *
   * The first parameter is always the object to be extended.
   *
   * Example:
   *   (start code)
   *   var MyConstructor = function() {
   *     cachingLayer(this);
   *   };
   *   (end code)
   */
  RemoteStorage.cachingLayer = function(object) {
    for (var key in methods) {
      object[key] = methods[key];
    }
  };
})();
