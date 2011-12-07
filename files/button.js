define(function(require, exports, module) {
  exports = (function() {

    var handlers = {};
    var buttonState;
      ////////
     // UI //
    ////////
    function DisplayConnectionState(isConnected, userAddress) {
      if(isConnected) {
        //button to disconnect:
        document.getElementById('userButton').value='Disconnect';
        //display span:
        document.getElementById('userAddress').style.display='inline';
        document.getElementById('userAddress').innerHTML=userAddress;
        //hide input:
        document.getElementById('userAddressInput').style.display='none';
        document.getElementById('userAddressInput').disabled='disabled';
        buttonState = 'connected';
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
        buttonState = 'disconnected';
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
      console.log('You are clicking the span man. Click the button instead!');
    }
    function ButtonClick(el) {
      if(buttonState == 'connected') {
        handlers['disconnect'](document.getElementById('userAddressInput').value);
        //handlers['disconnect']('test@yourremotestorage.net');
      } else {
        handlers['connect'](document.getElementById('userAddressInput').value);
        //handlers['connect']('test@yourremotestorage.net');
      }
    }

    function show(isConnected, userAddress) {
      if(!document.getElementById('remoteStorageDiv')) {
        var divEl = document.createElement('div');
        divEl.id = 'remoteStorageDiv';
        var cssFilePath = 'http://unhosted.nodejitsu.com/remoteStorage.css';//FIXME: move this to some sort of config
        if(true) {
        //if(false) {
          divEl.innerHTML = '<link rel="stylesheet" href="'+cssFilePath+'" />'
            +'<input id="userAddressInput" type="text" placeholder="you@yourremotestorage"'
            +' onkeyup="require(\'button\').button.trigger(\'InputKeyUp\', this);">'
            +'<span id="userAddress" style="display:none"'
            +' onmouseover="require(\'button\').button.trigger(\'SpanMouseOver\', this);"'
            +' onmouseout="require(\'button\').button.trigger(\'SpanMouseOut\', this);"'
            +' onclick="require(\'button\').button.trigger(\'SpanClick\', this)"></span>'
            +'<input id="userButton" type="submit" value="Sign in"'
            +' onclick="require(\'button\').button.trigger(\'ButtonClick\', this)">';
        } else {
          divEl.innerHTML = '<input id="userAddressInput" type="hidden">'
            +'<input id="userAddress" type="hidden">'
            +'<link rel="stylesheet" href="'+cssFilePath+'" />'
            +'<img id="userButton" src="https://browserid.org/i/sign_in_blue.png" onclick="require(\'button\').button.trigger(\'ButtonClick\', this);">';
        }
        document.body.insertBefore(divEl, document.body.firstChild);
      }
      DisplayConnectionState(isConnected, userAddress);
    }
    function trigger(what, el) {
      if(what == 'InputKeyUp') {
        InputKeyUp(el);
      } else if(what == 'SpanMouseOver') {
        SpanMouseOver(el);
      } else if(what == 'SpanMouseOut') {
        SpanMouseOut(el);
      } else if(what == 'SpanClick') {
        SpanClick(el);
      } else if(what == 'ButtonClick') {
        ButtonClick(el);
      } else {
        alert('unhandled button trigger: '+what);
      }
    }
    function on(what, cb) {
      handlers[what] = cb;
    }
    return {
      show: show,
      trigger: trigger,
      on: on
    }
  })();
});
