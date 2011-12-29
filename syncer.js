define([
  'require',
  './ajax',
  './webfinger'
], function(require, ajax, webfinger) {
  var onHandlers = {};
  function on(eventName, handler) {
    if(!onHandlers[eventName]) {
      onHandlers[eventName] = [];
    }
    onHandlers[eventName].push(handler);
  }
  function trigger(eventName, arg0) {
    var i;
    for(i=0;i<onHandlers[eventName].length;i++) {
      onHandlers[eventName][i](arg0);
    }
  }
  function setUserAddress(userAddress, onFail, onSuccess) {
    trigger('status', 'checking');
    onFail('not implemented');
    trigger('status', 'nobody');
  }
  function setAssertion(assertion, onFail, onSuccess) {
    trigger('status', 'pulling');
    onFail('not implemented');
    trigger('status', 'ready');
  }
  return {
    on: on,
    setUserAddress: setUserAddress,
    setAssertion: setAssertion,
    syncNow: syncNow
  };
});
