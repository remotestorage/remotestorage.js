function getWallet() {
	try {
		var ret = JSON.parse(localStorage.getItem("unhosted"));
		if(ret == null) {
			return {};
		}
		return ret;
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
