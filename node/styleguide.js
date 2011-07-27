//var: first on on same line, then comma-first
var a = require('a')
  , b = require('b')
  , c = require('c')

//singleton object as 'var name = (function(){ /content/ })()
var foo = (function( ){
  var bar
    , goo

  //function header, spaces around all arg names, but not between ) and {. this gives due space to all the important elements
  function har( x, err, cb ){
    if( x ){
      //single-line invocation with functions in it:
      har( x - 1, { a: 'a'
        , b: 'b'
        , c: 'c'
      }, function( e ){
        alert('error! at '+ e.line +','+ e.msg +'!')//spaces around vars, but no spaces around string literals
      }, function( ){
        bar += x
      })
   } else if( true === false ){//give space to important sub-expressions
      //function inside hash inside invocation; code inside in-line functions ends up indented 6 instead of 2 spaces!:
      yarzazazazadio(8, 'z', { x - 1
        , 8
        , true
        , 'bla'
        , x 
        , function( e ){
            alert('error! at '+ e.line +','+ e.msg +'!')//spaces around vars, but no spaces around string literals
          }
        , function( ){
            bar += x
          } 
      }, 5, function() {
        bla
      })
    }
  }

  return { bar: bar
    , goo: goo
    , har: har
  }
})()
