define(['./util', './store'], function(util, store) {

  var tools = {
    ls: function(path) {
      return store.getNode(path).
        then(function(node) {
          Object.keys(node.data).forEach(function(key) {
            console.log(" - " + key)
          });
        });
    },
    touch: function(path) {
      if(util.isDir(path)) {
        throw "Can't touch directories!";
      }
      return store.getNode(path).
        then(function(node) {
          console.log('GOT NODE', node);
          if(node && node.data) {
            return store.setNodeData(path, node.data, false, node.timestamp, node.mimeType);
          } else {
            return store.setNodeData(path, 'stub', true, new Date().getTime(), 'text/plain');
          }
        });
    }
  }

  return tools;
});
