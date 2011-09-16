var syncStorage = (function(){
  var ret = {}
  ret['length'] = localStorage.length
  ret['clear'] = function() {
      return localStorage.clear()
    }
  ret['key'] = function(i) {
      return localStorage.key(i)
    }
  ret['getItem'] = function(key) {
      return localStorage.getItem(key)
    }
  ret['setItem'] = function(key, val) {
      var ret = localStorage.setItem(key, val)
      this.length = localStorage.length
      return ret
    }
  return ret
})()
