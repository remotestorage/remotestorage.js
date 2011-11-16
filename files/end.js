//... end modules wrapper

  import(exports);
})(function(modules) {
  //shim switch:
  if(!window.remoteStorage) {
    window.remoteStorage = modules.frontendObj;
  }
});

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
