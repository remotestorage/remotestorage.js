      return FrontendObj();
    })()//end window.remoteStorage = ...
  }//end shim switch
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
function ButtonClick(el, category) {
  if(window.remoteStorage.isConnected()) {
    window.remoteStorage.disconnect();
    DisplayConnectionState();
  } else {
    if(document.getElementById('userAddressInput').value!='') {
      window.remoteStorage._tryConnect();
      window.remoteStorage.configure({
        userAddress: document.getElementById('userAddressInput').value,
        category: category
      });
      DisplayConnectionState();
    }
  }
}

function NeedLoginBox() {
  if(window.remoteStorage.options.suppressDialog) {
    return 'none';
  } else {
    return 'legacy';
  }
}

window.remoteStorage.configure = function(setOptions) {
  window.remoteStorage.options = {//set defaults
    category: location.host,
    onChange: function() {},
    preferBrowserSessionIfNative: true,
    preferBrowserIdIfNative: true,
    preferBrowserIdAlways: false
  };
  if(setOptions) {
    for(var option in setOptions) {
      window.remoteStorage.options[option] = setOptions[option];
    }
  }
  if(window.remoteStorage.options.userAddress) {
    localStorage.setItem('_remoteStorageUserAddress', window.remoteStorage.options.userAddress);
  }
  if(window.remoteStorage.options.token) {
    localStorage.setItem('_remoteStorageOauthToken', window.remoteStorage.options.token);
  }

  if(NeedLoginBox()=='legacy') {
    var divEl = document.createElement('div');
    divEl.id = 'remoteStorageDiv';
    divEl.innerHTML = '<link rel="stylesheet" href="'+remoteStorage.cssFilePath+'" />'
      +'<input id="userAddressInput" type="text" placeholder="you@yourremotestorage" onkeyup="InputKeyUp(this);">'
      +'<span id="userAddress" style="display:none" onmouseover="SpanMouseOver(this);" onmouseout="SpanMouseOut(this);" onclick="SpanClick(this)"></span>'
      +'<input id="userButton" type="submit" value="Sign in" onclick="ButtonClick(this,'
      +'\''+window.remoteStorage.options.category+'\')">';
    document.body.insertBefore(divEl, document.body.firstChild);
  }
  window.remoteStorage._tryConnect();
  if(window.remoteStorage.isConnected()) {
    window.remoteStorage._init();
  }
  if(NeedLoginBox()=='legacy') {
    DisplayConnectionState();
  }
  return window.remoteStorage.options;
}
