if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define([
  '../../node_modules/teste/lib/teste',
  'util'
], function(teste, util) {

  var container = document.getElementById('container');

  function toggleSuite(el, e) {
    el.classList.toggle('hidden');
  }

  function runSuites(path, done) {
    console.log('LOADING SUITES FROM', path);
    require([path], function(suites) {
      var testOutput = document.createElement('pre');
      testOutput.id = 'test-output';
      testOutput.classList.add('test-output');
      var heading = document.createElement('h3');
      heading.textContent = path;
      var collapser = document.createElement('span');
      collapser.classList.add('collapser');
      collapser.textContent = '-';
      var wrapper = document.createElement('li');
      wrapper.appendChild(heading);
      wrapper.appendChild(testOutput);
      wrapper.appendChild(collapser);
      heading.addEventListener('click', toggleSuite.bind(this, wrapper));
      collapser.addEventListener('click', toggleSuite.bind(this, wrapper));
  

      container.appendChild(wrapper);

      util.outputTarget = testOutput;
      console.log('FOUND', suites.length, 'SUITES');
      teste.reset(); // removing earlier suites
      suites.forEach(load);
      teste.begin(function(t){
        done();
      });
    });
  }

  function load(suite) {
    teste.loadSuite(suite);
  }

  function runAllSuites(allSuites) {
    requirejs.config({baseUrl : '../../'});

    var n = allSuites.length, i = 0;
    function runOne() {
      runSuites(allSuites.shift(), oneDone);
    }
    function oneDone() {
      i++;
      if(i === n) {
        alert('all really done now.');
      } else {
        runOne();
      }
    }
    runOne();
  }


  var noScroll = false;
  document.addEventListener('keypress', function (e) {
    if(e.which === 32) {
      e.preventDefault();
      noScroll = !noScroll;
    }
  });

  util.changeHandler = function() {
    if(noScroll) return;
    var out = document.getElementsByClassName('test-output');
    out = out[out.length-1];
    window.scrollTo(0, out.scrollHeight);
  };

  runAllSuites(['./test/unit/wireclient-suite',
                './test/unit/access-suite',
                './test/unit/caching-suite',
                './test/unit/baseclient-suite',
                './test/unit/baseclient/types-suite',
                './test/unit/authorize-suite',
                './test/unit/sync-suite',
                './test/unit/i18n-suite',
                './test/unit/localstorage-suite',
                './test/unit/inmemorycaching-suite',
                './test/unit/indexeddb-suite',
                './test/unit/discover-suite',
                './test/unit/googledrive-suite',
                './test/unit/dropbox-suite',
                './test/unit/remotestorage-suite'
               ]);

});
