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
      if(node.binary) {
        node.data = util.decodeBinary(node.data);
      }
      if(node.mimeType === 'application/json' && node.data) {
        if(node.data instanceof ArrayBuffer) {
          // convert accidental binary data back into a string
          node.binary = false;
          node.data = util.bufferToRaw(node.data);
        } else if(typeof(node.data) === 'object') {
          return node;
        }
        try {
          node.data = JSON.parse(node.data);
        } catch(exc) {
          console.error("Failed to parse node: ", node);
          throw new Error("Failed to parse JSON data: " + node.data + " (Error was: " + exc.message + ')');
        };
      }
      return node;
    }
  };

});