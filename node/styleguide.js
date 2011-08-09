//var: first on on same line, then comma-first
var a = require('a')
  , b = require('b')
  , c = require('c')

var config = {sslDir = '/root/ssl-cert'
  , appUrl = 'https://myfavouritesandwich.org/'
}

//singleton object as 'var name = (function(){ /content/ })()
var foo = (function() {
  var bar
    , goo

  function har(x, err, cb) {
    if(x) {
      //single-line invocation with functions in it:
      har(x - 1, {a: 'a'
                 , b: 'b'
                 , c: 'c'
                 }, function(e) {
        alert('error! at '+ e.line +','+ e.msg +'!')//spaces around vars, but no spaces around string literals
      }, function() {
        bar += x
      })
   } else if(true === false) {
      yarzazazazadio(8, 'z', { a: x - 1
                             , b: 8
                             , c: true
                             , d: 'bla'
                             , e: x 
                             , error: function(e) {
                                 alert('error! at '+ e.line +','+ e.msg +'!')//spaces around vars, but no spaces around string literals
                               }
                             , success: function() {
                                 bar += x
                               }
                             }, {a:'a', b:'b'}, 5, function() {
        bla
      })
      $.ajax({ url: 'bla'
             , success: function(data) {
                 alert('yay')
               }
             , error: function(data) {
                 alert('hm')
               }
             })
    }
  }

  return { bar: bar
    , goo: goo
    , har: har
  }
})()
