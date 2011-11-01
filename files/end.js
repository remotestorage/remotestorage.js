
      return {
        length: calcLength(),
        key: function(req) {
          for(var i=0; i<localStorage.length; i++) {
            if(localStorage.key(i).substring(0,15)=='_remoteStorage_') {
              if(req == 0) {
                return localStorage.key(i).substring(15);
              }
              req--;
            }
          }
        },
        getItem: function(k) {
          return localStorage.getItem('_remoteStorage_'+k);
        },
        setItem: function(k,v) {
          if(v == localStorage.getItem('_remoteStorage_'+k)) {
            return;
          }
          pushAction({action: 'setItem', key: k, value: v});
          if(this.isConnected()) {
            work(0);
          }
          var ret = localStorage.setItem('_remoteStorage_'+k, v);
          this.length = calcLength();
          return ret;
        },
        removeItem: function(k) {
          pushAction({action: 'removeItem', key: k});
          if(this.isConnected()) {
            work(0);
          }
          var ret = localStorage.removeItem('_remoteStorage_'+k);
          window.remoteStorage.length = calcLength();
          return ret;
        },
        clear: function() {
          localStorage.setItem('_remoteStorageActionQueue', '[{"action": "clear"}]');
          if(this.isConnected()) {
            work(0);
          }
          for(var i=0;i<localStorage.length;i++) {
            if(localStorage.key(i).substring(0,15)=='_remoteStorage_') {
              localStorage.removeItem(localStorage.key(i));
            }
          }
        },
        connect: function(userAddress, dataScope) {
          backend.connect(userAddress, dataScope, function() {
            work(0);
          })
        },
        isConnected: function() {
          return (localStorage.getItem('_remoteStorageOauthToken') != null);
        },
        getUserAddress: function() {
          return localStorage.getItem('_remoteStorageUserAddress');
        },
        disconnect: function() {
          localStorage.removeItem('_remoteStorageUserAddress');
          localStorage.removeItem('_remoteStorageDataScope');
          localStorage.removeItem('_remoteStorageKV');
          localStorage.removeItem('_remoteStorageAPI');
          localStorage.removeItem('_remoteStorageAuthAddress');
          localStorage.removeItem('_remoteStorageOauthToken');
          localStorage.removeItem('remoteStorageIndex');
          for(var i=0; i<localStorage.length; i++) {
            if(localStorage.key(i).substring(0,15)=='_remoteStorage_') {
              var keyName = localStorage.key(i);
              localStorage.removeItem(keyName);
              if(window.remoteStorage.options.onChange) {
                remoteStorage.options.onChange(keyName.substring(15), localStorage.getItem(keyName), null);
              }
              localStorage.removeItem(keyName);
            }
          }
        },
        _init: function() {
          backend.sync();
        }
      }
    })()
  }
})()

  ////////
 // UI //
////////
function DisplayConnectionState() {
  if(remoteStorage.isConnected()) {
    //button to disconnect:
    document.getElementById('userButton').value='Disconnect';
    //display span:
    document.getElementById('userAddress').style.display='inline';
    document.getElementById('userAddress').innerHTML=remoteStorage.getUserAddress();
    //hide input:
    document.getElementById('userAddressInput').style.display='none';
    document.getElementById('userAddressInput').disabled='disabled';
  } else {
    //button to Sign in:
    document.getElementById('userButton').value='Sign in';
    //display input:
    document.getElementById('userAddressInput').value='';
    document.getElementById('userAddressInput').style.display='inline';
    document.getElementById('userAddressInput').disabled='';
    //hide input:
    document.getElementById('userAddress').style.display='none';
    document.getElementById('userAddress').disabled='disabled';
  }
}

function InputKeyUp(el) {
  if(el.value=='') {
    document.getElementById('userButton').className='';
    document.getElementById('userButton').disabled='disabled';
    el.parentNode.style.opacity='.5';
  } else {
    document.getElementById('userButton').disabled='';
    document.getElementById('userButton').className='green';
    el.parentNode.style.opacity='1';
  }
}
function SpanMouseOver(el) {
  el.className='red';
}
function SpanMouseOut(el) {
  el.className='';
}
function SpanClick(el) {
  window.remoteStorage.disconnect();
}
function ButtonClick(el, dataScope) {
  if(window.remoteStorage.isConnected()) {
    window.remoteStorage.disconnect();
    DisplayConnectionState();
  } else {
    if(document.getElementById('userAddressInput').value!='') {
      window.remoteStorage.connect(document.getElementById('userAddressInput').value, dataScope);
      DisplayConnectionState();
    }
  }
}

window.remoteStorage.init = function(options) {
  if(!options) {
    options = {};
  }
  if (!(options.dataScope)) {
    options.dataScope = location.host;
  }
  var divEl = document.createElement('div');
  divEl.id = 'remoteStorageDiv';
  divEl.innerHTML = '<link rel="stylesheet" href="../../remoteStorage.css" />'
    +'<input id="userAddressInput" type="text" placeholder="you@yourremotestorage" onkeyup="InputKeyUp(this);">'
    +'<span id="userAddress" style="display:none" onmouseover="SpanMouseOver(this);" onmouseout="SpanMouseOut(this);" onclick="SpanClick(this)"></span>'
    +'<input id="userButton" type="submit" value="Sign in" onclick="ButtonClick(this,'
    +'\''+options.dataScope+'\')">';
  document.body.insertBefore(divEl, document.body.firstChild);
  if(window.remoteStorage.isConnected()) {
    window.remoteStorage._init();
  }
  DisplayConnectionState();
  window.remoteStorage.options = options;
}
