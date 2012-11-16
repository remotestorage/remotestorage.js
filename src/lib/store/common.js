define(['../util'], function(util) {

  return {
    packData: function(node) {
      node = util.extend({}, node);
      if(typeof(node.data) === 'object' && node.data instanceof ArrayBuffer) {
        node.binary = true;
        node.data = util.encodeBinary(node.data);
      } else {
        node.binary = false;
        if(node.mimeType === 'application/json' && typeof(node.data) === 'object') {
          node.data = JSON.stringify(node.data);
        } else {
          node.data = node.data;
        }
      }
      return node;
    },

    unpackData: function(node) {
      node = util.extend({}, node);
      if(node.mimeType === 'application/json' && typeof(node.data) !== 'object') {
        node.data = JSON.parse(node.data);
      } else if(node.binary) {
        node.data = util.decodeBinary(node.data);
      }
      return node;
    }
  };

});