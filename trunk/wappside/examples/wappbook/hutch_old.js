var hutchlist = {};
var targets = {};
var ns = {};
var user = {};

function hamming(str1, str2) {
	var dict = {
		"0":"000000", "1":"000001", "2":"000010", "3":"000011", "4":"000100", "5":"000101", "6":"000110", "7":"000111",
		"8":"001000", "9":"001001", "a":"001010", "b":"001011", "c":"001100", "d":"001101", "e":"001110", "f":"001111",
		"g":"010000", "h":"010001", "i":"010010", "j":"010011", "k":"010100", "l":"010101", "m":"010110", "n":"010111",
		"o":"011000", "p":"011001", "q":"011010", "r":"011011", "s":"011100", "t":"011101", "u":"011110", "v":"011111",
		"w":"100000", "x":"100001", "y":"100010", "z":"100011", " ":"100100",
		".":"111101", "@":"111110", "FILL":"111111"
		}
	var total = 0;
	var i=0;
	var binstr1, binstr2;
	while(i < str1.length && i < str2.length) {
		if(i < str1.length) {
			binstr1 = dict[str1.charAt(i)];
		} else {
			binstr1 = dict["FILL"];
		}
		if(i < str2.length) {
			binstr2 = dict[str2.charAt(i)];
		} else {
			binstr2 = dict["FILL"];
		}
		for(var j=0;j<5;j++) {
			if(binstr1.charAt(j) != binstr2.charAt(j)) {
				total++;
			}
		}
		i++;
	}
	return total;
}

function calcHammingDistToUser(address) {
	return hamming(address, makeAddress(user));
}
function addTarget(address) {
	user = parseAddress(address);
	targets[address]=true;
	hutchlist[address]={
		"distance":calcHammingDistToUser(address), 
		"backtrace":null,
		"expanded":false
		};
}
function signKey(r, c) {
	unh
	var StarSign = unhosted.makeStarSign(signerGuid, signeeGuid);
	//send your star to the signee:
	unhosted.send(signerGuid, signeeGuid, "StarSign", StarSign);
	//TODO: call a callback that also adds it directly into your own addressbook.
	targets[r+"@"+c] = false;
}
function expandNode(address) {
	var parsedAddress = parseAddress(address);
	var finished = false;
	//retrieve starskey:
	unhosted.importSubN(parsedAddress, address, ".n");
	starskey = unhosted.get(".stars", address);
	//add r@c's stars as new nodes:
	for(starSender in starskey) {
		if(typeof hutchlist[starSender] == 'undefined') {
			hutchlist[starSender]={
				"distance":calcHammingDistToUser(starSender), //on duplicate key, don't recalculate
				"backtrace":{address:{"r":parsedAddress.r, "c":parsedAddress.c}},//on duplicate key, add
				"expanded":false//on duplicate key, don't change.
				};
		} else {
			hutchlist[starSender].backtrace.address={"r":parsedAddress.r, "c":parsedAddress.c};//on duplicate key, add
		}
		if((parsedAddress.r == user.r) && (parsedAddress.c == user.c)) {
			finished = true;
		}
	}
	hutchlist[address].expanded = true;
	return finished;
}

function traceBack(r, c) {
	ns[r+"@"+c] = unhosted.get(r+"@"+c, ".n");
	var backtrace = hutchlist[r+"@"+c].backtrace;
	var ret = {};
	if (backtrace == null) {
		signKey(r, c);
	}
	for(i in backtrace) {
		var br = backtrace[i].r;
		var bc = backtrace[i].c;
		ns[br+"@"+bc] = unhosted.get(br+"@"+bc, ".n");
		var sig = unhosted.get(br+"@"+bc, "StarSign0.1/"+r+"@"+c);
		var star = {
			"signer":{"r":r,"c":c,"n":ns[r+"@"+c]},
			"signee":{"r":br,"c":bc,"n":ns[br+"@"+bc]},
			};
		if(checkStarSign(star, sig, ns[r+"@"+c])) {//sig is correct for star and signer's n
			traceBack(br, bc);
		}
	}
}
function hutchkey() {
	candidate = {
		"guid": null,
		"distance": null
		};
	//find key closest to you that has not been expanded
	for(guid in hutchlist) {
		if(candidate.guid==null || ((hutchlist[guid].expanded== false) && (hutchlist[guid].distance < candidate.distance))) {
			candidate.guid = guid;
			candidate.distance = hutchlist[guid].distance;
		}
	}
	var finished = expandNode(candidate.guid);
	if(finished) {
		traceBack(user.r, user.c);//start with your own key, foreach backtrace, retrieve your signature of them, check it, and traceBack on that node.
	}
}
function haveTargets() {
	for(i in targets) {
		if(targets[i] == true) {
			return true;
		}
	}
	return false;
}
function makeAddress(parts) {
	return parts.r+"@"+parts.c;
}
function parseAddress(address) {
	parts = address.split("@", 2);
	return {"r":parts[0], "c":parts[1]};
}
function hutch(userAddress, addressBook) {
	user = parseAddress(userAddress);
	unhosted.importSubN(user, userAddress, ".n");
	for(contact in addressBook) {
		addTarget(contact);
	}
	while(haveTargets()==true) {
		hutchkey();
	}
}
