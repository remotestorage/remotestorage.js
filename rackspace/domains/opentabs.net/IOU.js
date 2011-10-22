var sampleData =[
  {
    payer: 'you',
    payee: 'mich@unhosted.org',
    amount: 1,
    currency: 'beer',
    timestamp: 1234567890.123,
    proposer: 'you',
    status: 'proposed'
  },
  {
    payer: 'mich@unhosted.org',
    payee: 'you',
    amount: 2,
    currency: 'beer',
    timestamp: 1234567890.123,
    proposer: 'you',
    status: 'proposed'
  },
  {
    payer: 'you',
    payee: 'mich@unhosted.org',
    amount: 3,
    currency: 'beer',
    timestamp: 1234567890.123,
    proposer: 'mich@unhosted.org',
    status: 'proposed'
  },
  {
    payer: 'mich@unhosted.org',
    payee: 'you',
    amount: 4,
    currency: 'beer',
    timestamp: 1234567890.123,
    proposer: 'mich@unhosted.org',
    status: 'proposed'
  },
  {
    payer: 'you',
    payee: 'mich@unhosted.org',
    amount: 11,
    currency: 'beer',
    timestamp: 1234567890.123,
    proposer: 'you',
    status: 'declined'
  },
  {
    payer: 'mich@unhosted.org',
    payee: 'you',
    amount: 12,
    currency: 'beer',
    timestamp: 1234567890.123,
    proposer: 'you',
    status: 'declined'
  },
  {
    payer: 'you',
    payee: 'mich@unhosted.org',
    amount: 13,
    currency: 'beer',
    timestamp: 1234567890.123,
    proposer: 'mich@unhosted.org',
    status: 'declined'
  },
  {
    payer: 'mich@unhosted.org',
    payee: 'you',
    amount: 14,
    currency: 'beer',
    timestamp: 1234567890.123,
    proposer: 'mich@unhosted.org',
    status: 'declined'
  },
  {
    payer: 'you',
    payee: 'mich@unhosted.org',
    amount: 21,
    currency: 'beer',
    timestamp: 1234567890.123,
    proposer: 'you',
    status: 'accepted'
  },
  {
    payer: 'mich@unhosted.org',
    payee: 'you',
    amount: 22,
    currency: 'beer',
    timestamp: 1234567890.123,
    proposer: 'you',
    status: 'accepted'
  },
  {
    payer: 'you',
    payee: 'mich@unhosted.org',
    amount: 23,
    currency: 'beer',
    timestamp: 1234567890.123,
    proposer: 'mich@unhosted.org',
    status: 'accepted'
  },
  {
    payer: 'mich@unhosted.org',
    payee: 'you',
    amount: 24,
    currency: 'beer',
    timestamp: 1234567890.123,
    proposer: 'mich@unhosted.org',
    status: 'accepted'
  },
  {
    payer: 'you',
    payee: 'mich@unhosted.org',
    amount: 31,
    currency: 'beer',
    timestamp: 1234567890.123,
    proposer: 'you',
    status: 'requested'
  },
  {
    payer: 'mich@unhosted.org',
    payee: 'you',
    amount: 32,
    currency: 'beer',
    timestamp: 1234567890.123,
    proposer: 'you',
    status: 'requested'
  },
  {
    payer: 'you',
    payee: 'mich@unhosted.org',
    amount: 33,
    currency: 'beer',
    timestamp: 1234567890.123,
    proposer: 'mich@unhosted.org',
    status: 'requested'
  },
  {
    payer: 'mich@unhosted.org',
    payee: 'you',
    amount: 34,
    currency: 'beer',
    timestamp: 1234567890.123,
    proposer: 'mich@unhosted.org',
    status: 'requested'
  },
  {
    payer: 'you',
    payee: 'mich@unhosted.org',
    amount: 41,
    currency: 'beer',
    timestamp: 1234567890.123,
    proposer: 'you',
    status: 'sent'
  },
  {
    payer: 'mich@unhosted.org',
    payee: 'you',
    amount: 42,
    currency: 'beer',
    timestamp: 1234567890.123,
    proposer: 'you',
    status: 'sent'
  },
  {
    payer: 'you',
    payee: 'mich@unhosted.org',
    amount: 43,
    currency: 'beer',
    timestamp: 1234567890.123,
    proposer: 'mich@unhosted.org',
    status: 'sent'
  },
  {
    payer: 'mich@unhosted.org',
    payee: 'you',
    amount: 44,
    currency: 'beer',
    timestamp: 1234567890.123,
    proposer: 'mich@unhosted.org',
    status: 'sent'
  },
  {
    payer: 'you',
    payee: 'mich@unhosted.org',
    amount: 51,
    currency: 'beer',
    timestamp: 1234567890.123,
    proposer: 'you',
    status: 'received'
  },
  {
    payer: 'mich@unhosted.org',
    payee: 'you',
    amount: 52,
    currency: 'beer',
    timestamp: 1234567890.123,
    proposer: 'you',
    status: 'received'
  },
  {
    payer: 'you',
    payee: 'mich@unhosted.org',
    amount: 53,
    currency: 'beer',
    timestamp: 1234567890.123,
    proposer: 'mich@unhosted.org',
    status: 'received'
  },
  {
    payer: 'mich@unhosted.org',
    payee: 'you',
    amount: 54,
    currency: 'beer',
    timestamp: 1234567890.123,
    proposer: 'mich@unhosted.org',
    status: 'received'
  },
  {
    payer: 'you',
    payee: 'mich@unhosted.org',
    amount: 61,
    currency: 'beer',
    timestamp: 1234567890.123,
    proposer: 'you',
    status: 'closed'
  },
  {
    payer: 'mich@unhosted.org',
    payee: 'you',
    amount: 62,
    currency: 'beer',
    timestamp: 1234567890.123,
    proposer: 'you',
    status: 'closed'
  },
  {
    payer: 'you',
    payee: 'mich@unhosted.org',
    amount: 63,
    currency: 'beer',
    timestamp: 1234567890.123,
    proposer: 'mich@unhosted.org',
    status: 'closed'
  },
  {
    payer: 'mich@unhosted.org',
    payee: 'you',
    amount: 64,
    currency: 'beer',
    timestamp: 1234567890.123,
    proposer: 'mich@unhosted.org',
    status: 'closed'
  }
  ];

var peers = {};
for(i in sampleData) {
  peers[sampleData[i].payer]=true;
  peers[sampleData[i].payee]=true;
}
delete peers['you'];

document.write('<h2>IMPORTANT</h2><ul>');
for(i in sampleData) {
  var iou = sampleData[i];
  if((iou.proposer != 'you') && (iou.status == 'proposed') && (iou.payer == 'you')) {
    document.write('<li style="background-color:yellow">[incoming invoice:] [?]'+iou.payee+' '+iou.amount+iou.currency+'</li>');
  }
  if((iou.proposer != 'you') && (iou.status == 'proposed') && (iou.payee == 'you')) {
    document.write('<li style="background-color:yellow">[incoming IOU:] [?]'+iou.payer+' '+iou.amount+iou.currency+'</li>');
  }
  if((iou.proposer == 'you') && (iou.status == 'declined') && (iou.payer == 'you')) {
    document.write('<li style="background-color:yellow">[declined your IOU:] [X]'+iou.payee+' '+iou.amount+iou.currency+'</li>');
  }
  if((iou.proposer == 'you') && (iou.status == 'declined') && (iou.payee == 'you')) {
    document.write('<li style="background-color:yellow">[declined your invoice:] [X]'+iou.payer+' '+iou.amount+iou.currency+'</li>');
  }
}
document.write('</ul><h2>Contacts:</h2><table id="contacts"></table>');

for(var peer in peers) {
  document.write('<h2>'+peer+'</h2><ul>');

  for(i in sampleData) {
    var iou = sampleData[i];
    if((iou.payee == peer) && (iou.status == 'requested')) {
      document.write('<li style="background-color:pink">[hurry:] [!]'+iou.amount+iou.currency+'</li>');
    }
    if((iou.payer == peer) && (iou.status == 'sent')) {
      document.write('<li style="background-color:green">[got it?] [&#10003;]'+iou.amount+iou.currency+'</li>');
    }
    if((iou.payer == peer) && (iou.status == 'requested')) {
      document.write('<li style="background-color:green">[you said hurry] [!]'+iou.amount+iou.currency+'</li>');
    }
  }
  document.write('</ul><hr><ul>');
  for(i in sampleData) {
    var iou = sampleData[i];
    if((iou.payee == peer) && (iou.status == 'accepted')) {
      document.write('<li style="background-color:pink">[you owe them]'+iou.amount+iou.currency+'</li>');
    }
    if((iou.payer == peer) && (iou.status == 'accepted')) {
      document.write('<li style="background-color:green">[they owe you]'+iou.amount+iou.currency+'</li>');
    }
    if((iou.payee == peer) && (iou.status == 'proposed')) {
      document.write('<li style="background-color:pink">[you proposed] [?]'+iou.amount+iou.currency+'</li>');
    }
  }
  document.write('</ul>');
}

document.write('<h2>HISTORY</h2><ul>');
for(i in sampleData) {
  var iou = sampleData[i];
  if((iou.proposer != 'you') && (iou.status == 'declined') && (iou.payee=='you')) {
    document.write('<li style="background-color:yellow">[you declined] [X]'+iou.payer+' '+iou.amount+iou.currency+'</li>');
  }
  if((iou.proposer != 'you') && (iou.status == 'declined') && (iou.payer=='you')) {
    document.write('<li style="background-color:yellow">[you declined] [X]'+iou.payee+' '+iou.amount+iou.currency+'</li>');
  }
  if((iou.payer == 'you') &&(iou.status == 'closed')) {
    document.write('<li style="background-color:yellow">[was declined] [X]'+iou.payee+' '+iou.amount+iou.currency+'</li>');
  }
  if((iou.payee == 'you') &&(iou.status == 'closed')) {
    document.write('<li style="background-color:yellow">[was declined] [X]'+iou.payer+' '+iou.amount+iou.currency+'</li>');
  }
  if((iou.payer == 'you') && (iou.status == 'sent')) {
    document.write('<li style="background-color:pink">[you sent] [&#10003;]'+iou.payee+' '+iou.amount+iou.currency+'</li>');
  }
  if((iou.payer == 'you') && (iou.status == 'received')) {
    document.write('<li style="background-color:pink">[they received] [&#10003;]'+iou.payee+' '+iou.amount+iou.currency+'</li>');
  }
  if((iou.payee == 'you') && (iou.status == 'received')) {
    document.write('<li style="background-color:green">[you received] [&#10003;]'+iou.payer+' '+iou.amount+iou.currency+'</li>');
  }
}

document.write('</ul>');
// IMPORTANT (highlighted, by timestamp)
// [?]Y proposed (rcv)
// [X]Y declined (snd)

// PER PEER (peers with ! items inside sorted on top, otherwise by timestamp)
// [!]R requested (payer) highlighted
// [&#10003;]G sent (payee) highlighted
//-------------------------------------
// accepted (both)
// [?]Y proposed (snd)
// [!]G requested (payee)

// HISTORY (greyed out, by timestamp)
// [X]Y declined (rcv)
// [X]Y closed (both)
// [&#10003;]R sent (payer)
// [&#10003;]R/G received (both)



//tab fields:
// payer, payee, timestamp, amount, currency,
//and optionally:
// description, location

function openNewTab(tab, signature) {
  tab.status='proposed';
  //add the first signature:
  tab.signatures = [signature];
  var tabId = localStorage.length;
  localStorage.setItem(tabId, JSON.stringify(tab));
  return tabId;
}

function declineTab(tabId, message, signature) {
  var tab = JSON.parse(localStorage.getItem(tabId));
  tab.status='declined';
  tab.message=message;
  //add the second signature:
  tab.signatures.push(signature);
  localStorage.setItem(tabId, JSON.stringify(tab));
}

function acceptTab(tabId, signature) {
  var tab = JSON.parse(localStorage.getItem(tabId));
  tab.status='accepted';
  //add the second signature:
  tab.signatures.push(signature);
  localStorage.setItem(tabId, JSON.stringify(tab));
}

function requestPayment(tabId, signature) {
  var tab = JSON.parse(localStorage.getItem(tabId));
  tab.status='paymentRequested';
  //add the third signature:
  tab.signatures.push(signature);
  localStorage.setItem(tabId, JSON.stringify(tab));
}

function markAsPaid(tabId, byWhom, signature) {
  var tab = JSON.parse(localStorage.getItem(tabId));
  if(byWhom=='payer') {
    tab.status='paymentSent';
  } else {
    tab.status='paymentReceived';
  }
  //add the extra signature:
  tab.signatures.push(signature);
  localStorage.setItem(tabId, JSON.stringify(tab));
}
