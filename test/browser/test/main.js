if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define([
  '../../../node_modules/teste/lib/teste',
  './util'
], function(teste, util) {

  var container = document.getElementById('container');

  function runSuites(path, done) {
    console.log('LOADING SUITES FROM', path);
    var origEnv = Object.keys(window).reduce(function(e,k) {e[k]=true;return e;},{});
    require([path], function(suites) {
      var testOutput = document.createElement('pre');
      testOutput.id = 'test-output';
      testOutput.classList.add('test-output');
      var heading = document.createElement('h3');
      heading.textContent = path;
      var wrapper = document.createElement('li');
      wrapper.appendChild(heading);
      wrapper.appendChild(testOutput);
      container.appendChild(wrapper);

      util.outputTarget = testOutput;

      console.log('FOUND', suites.length, 'SUITES');
      teste.reset(); // removing earlier suites
      suites.forEach(load);
      teste.begin(function(t){
        for(var key in window) {
          if(! (key in origEnv)) delete window[key];
        }
        require.config({
          urlArgs: new Date().getTime().toString()
        });
        done();
      });
    });
  }

  function load(suite) {
    teste.loadSuite(suite);
  };

  function runAllSuites(allSuites) {
    var n = allSuites.length, i = 0;
    function runOne() {
      runSuites(allSuites.shift(), oneDone);
    }
    function oneDone() {
      i++;
      if(i == n) {
        alert('all really done now.');
      } else {
        runOne();
      }
    }
    runOne();
  }


  var noScroll = false;
  document.addEventListener('keypress', function (e) {
    if(e.which == 32) {
     e.preventDefault();
      noScroll = !noScroll;
    }
  })

  util.changeHandler = function() {
    if(noScroll) return;
    var out = document.getElementsByClassName('test-output');
    out = out[out.length-1];
    window.scrollTo(0, out.scrollHeight)
  };


  runAllSuites(['../../unit/wireclient-suite', 
                '../../unit/access-suite',
                '../../unit/caching-suite',
                '../../unit/baseclient-suite',
                '../../unit/authorize-suite',
                '../../unit/sync-suite',
                '../../unit/i18n-suite',
                '../../unit/localstorage-suite',
                '../../unit/inmemorycaching-suite',
                '../../unit/indexeddb-suite',
                '../../unit/discover-suite',
                //'../../unit/baseclient/types-suite',
                '../../unit/googledrive-suite',
                '../../unit/dropbox-suite',
                '../../unit/remotestorage-suite']);

});

/***


define([
  '../../../node_modules/teste/lib/teste', 
  './util',
  '../../unit/wireclient-suite', 
  '../../unit/access-suite',
  '../../unit/caching-suite',
  '../../unit/baseclient-suite',
  '../../unit/authorize-suite',
  '../../unit/sync-suite',
  '../../unit/i18n-suite',
  '../../unit/localstorage-suite',
  '../../unit/inmemorycaching-suite',
  '../../unit/indexeddb-suite',
  '../../unit/discover-suite',
  //'../../unit/baseclient/types-suite',
  '../../unit/googledrive-suite',
  '../../unit/dropbox-suite',
  '../../unit/remotestorage-suite'    
], function(
  teste,
  util,
  wireclient, 
  access, 
  caching, 
  baseclient,
  authorize,
  sync,
  i18n,
  localstorage,
  ims,
  idb,
  discover,
  //types,
  googledrive,
  dropbox,
  remotestorage
) {
  function load(suite) {
    teste.loadSuite(suite);
  };
  
  remotestorage.forEach(load);
  wireclient.forEach(load);
  access.forEach(load);
  caching.forEach(load);
  baseclient.forEach(load);
  authorize.forEach(load);
  sync.forEach(load);
  i18n.forEach(load);
  localstorage.forEach(load);
  ims.forEach(load);
  idb.forEach(load);
  discover.forEach(load);
  // // types.forEach(load);
  googledrive.forEach(load);
  dropbox.forEach(load);
  
  var noScroll = false;
  document.addEventListener('keypress', function (e) {
    if(e.which == 32) {
     e.preventDefault();
      noScroll = !noScroll;
    }
  })

  util.changeHandler = function() {
    if(noScroll) return;
    var out = document.getElementById('test-output');
    window.scrollTo(0, out.scrollHeight)
  };
  teste.begin(function(t){
    alert("Tests Done");
  });  
  
});
*/
