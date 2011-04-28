function getWallet() {
	try {
		return JSON.parse(localStorage.getItem("unhosted"));
	} catch(e) {
		return {};
	}
}
function setWallet(wallet) {
	var walletStr = JSON.stringify(wallet);
	localStorage.setItem("unhosted", walletStr);
	walletStr = localStorage.getItem("unhosted");
	var wallet2 = JSON.parse(walletStr);
}
