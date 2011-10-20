

//INBOX:
//proposed in
//declined out
//requested out
//sent in

//MAIN:
//accepted in
//accepted out
//proposed out
//requested in

//HISTORY:
//declined in
//closed in
//closed out
//sent out
//received in
//received out








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
