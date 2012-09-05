
define(['../remoteStorage'], function(remoteStorage) {

  var moduleName = "money";



  remoteStorage.defineModule(moduleName, function(myBaseClient) {
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
    function groupPayment(box, id, payers, beneficiaries, date, comment) {
      for(var payer in payers) {
        var euros = payers[payer];
        remoteStorage.money.addIOU(id, comment, euros, 'EUR', payer, box);
        var perPerson = euros/beneficiaries.length;
        for(var i=0; i<beneficiaries.length; i++) {
          remoteStorage.money.addIOU(id, comment, perPerson, 'EUR', box, beneficiaries[i]);
        }
      }
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

    function getTransactions(year, month, day) {
      return [];
    }
    //we want to return all the transactions that affect the current user, even if the current user is not a peer.
    //this may give a problem where i don't know about some transaction between two of my friends, and it looks to me like they
    //have an outstanding balance that could be resolved. so there should always be a one-on-one balance at any time, but this cannot necessarily be public
    //to people who can see some of the transactions between them. so there may be two versions of a transaction, one that gets tagged for more friends, 
    //like the unhosted central pot, and only has a "+" or "-" resulting balance,
    //and a private one displaying the real balance.
/*

what parts need work?
- change data format: store each tab that we know of only once. what if we know it partially? topic tabs (multiple users), full tabs (two peers) and gates (two peers)
- display transactions app 
- manually enter and edit transactions
- a balance can be taken off-topic, e.g. from '#unhosted' to '#personal'. so viewers of the #unhosted tab can see that a balance between me and Hugo was moved to #personal.
- i have a #me tab with my bank accounts. if i get money from my brother's bank account to my bank account, then i'm suddenly richer no my #me tab but poorer on my #brothers tab.
my specific bank accounts don''t show up on the other tabs, there it''s just my name.

transactions: <-
credit: ->
debt: <-

#broers
jurgen <- michiel 93eur

#banks
michiel <- ing 93eur

bootstrap tab display:

tab name
*/

    return {
      name: moduleName,
      dataVersion: '0.1',
      dataHints: {
        "module": "Peer-to-peer bookkeeping based on IOUs (writing down who owes who how much)"
      },
      codeVersion: '0.1.0',
      exports: {
        reportTransfer: reportTransfer,
        addIOU: addIOU,
        addDeclaration: addDeclaration,
        groupPayment: groupPayment,
        //getBalances: getBalances,
        getBalances2: getBalances2,
        setBalance: setBalance,
        getTransactions: getTransactions
      }
    };
  });

  return remoteStorage[moduleName];

});
