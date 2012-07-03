remoteStorage.defineModule('money', function(myBaseClient) {
  function genUuid() {
    var uuid = '',
      i,
      random;
    for(i=0; i<32; i++) {
        random = Math.random() * 16 | 0;
        if(i === 8 || i === 12 || i === 16 || i === 20 ) {
            uuid += '-';
        }
        uuid += (i === 12 ? 4 : (i === 16 ? (random & 3 | 8) : random)).toString(16);
    }
    return uuid;
  }
  
  function addIOU(tag, thing, amount, currency, owee, ower) {
    var uuid = genUuid();
    myBaseClient.storeObject('IOU', 'IOUs/'+ower+'/'+owee+'/'+currency+'/'+uuid, {
      tag: tag,
      thing: thing,
      amount: -amount
    });
    myBaseClient.storeObject('IOU', 'IOUs/'+owee+'/'+ower+'/'+currency+'/'+uuid, {
      tag: tag,
      thing: thing,
      amount: amount
    });
  }
  function addDeclaration(owee, ower, comment, date, amount, currency) {
  //addIOU( tag,   thing, amount, currency, owee, ower) {
    addIOU(date, comment, amount, currency, owee, ower);
  }
  function reportTransfer(from, to, date, amount, currency) {
  //addIOU( tag,      thing, amount, currency,owee,ower) {
    addIOU(date, 'transfer', amount, currency, from, to);
  }
  function getBalance(personName, currency) {
    var peers = myBaseClient.getListing('IOUs/'+personName+'/'),
      balance = 0;
    for(var i=0; i<peers.length; i++) {
      var thisPeerBalance = 0;
      var thisPeerIOUs = myBaseClient.getListing('IOUs/'+personName+'/'+peers[i]+currency+'/');
      for(var j=0; j<thisPeerIOUs.length; j++) {
        var thisIOU = myBaseClient.getObject('IOUs/'+personName+'/'+peers[i]+currency+'/'+thisPeerIOUs[j]);
        thisPeerBalance += thisIOU.amount;
      }
      balance += thisPeerBalance;
    }
    return balance;
  }
  function getBalances2(currency) {
    var peers = myBaseClient.getListing('IOUs/');
    var balances = {};
    for(var i=0; i<peers.length; i++) {
      var peerName = peers[i].substring(0, peers[i].length-1);
      balances[peerName] = getBalance(peerName, currency);
    }
    return balances;
  }
  //function getBalances(date, currency) {
  //  var balances={};
  //  var peers=myBaseClient.getListing(date+'/0/');
  //  for(var i in peers) {
  //    var peerName = i.substring(0, i.length-1);
  //    balances[peerName] = myBaseClient.getObject(date+'/0/'+i+'balance')[currency];
  //  }
  //  return balances;
  //}
  function setBalance(date, peer, amount, currency) {
    var obj={};
    obj[currency]=amount;
    myBaseClient.storeObject('balance', date+'/0/'+peer+'/balance', obj);
  }
  return {
    name: 'money',
    dataVersion: '0.1',
    dataHints: {
      "module": "Peer-to-peer bookkeeping based on IOUs (writing down who owes who how much)"
    },
    codeVersion: '0.1.0',
    exports: {
      reportTransfer: reportTransfer,
      addDeclaration: addDeclaration,
      //getBalances: getBalances,
      getBalances2: getBalances2,
      setBalance: setBalance
    }
  };
});
