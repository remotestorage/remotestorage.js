define(['../remoteStorage'], function(remoteStorage) {

  remoteStorage.defineModule('money', function(myPrivateBaseClient, myPublicBaseClient) {
    return {
      name: 'money',
      dataHints: {
      },
      exports: {
        setDayBusiness: function(tab, year, month, day, transactions, endBalances) {
          var datePath = year+'/'+month+'/'+day+'/'+tab.substring(1)+'/';
          for(var i=0; i<transactions.length;i++) {
            myPrivateBaseClient.storeObject('transaction', datePath+'transaction/'+i, transactions[i]);
          }
          for(var j in endBalances) {
            myPrivateBaseClient.storeObject('balance', datePath+'balance/'+j, endBalances[j]);
          }
        }
      }
    };
  });

});