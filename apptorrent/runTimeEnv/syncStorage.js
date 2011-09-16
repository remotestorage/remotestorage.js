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

if(navigator.id) {
  navigator.id.sessions = [];
  document.addEventListener('login', function(event) {
    navigator.id.getVerifiedEmail(function(assertion) {
      if (assertion) {
        navigator.id.sessions = [{email: 'mich@yourremotestorage.com'}]
      } else {
        navigator.id.sessions = [{email: 'n@o.pe'}]
      }
    })
  }, false);
  document.addEventListener('logout', function(event) {
    navigator.id.sessions = []
    alert('Goodbye!')
  }, false);
} else {
  alert('displaying sync button')
}
