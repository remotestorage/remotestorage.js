var hutchlist = {};
var targets = {};
var ns = {};
var user = {};

function calcHammingDistToUser(r, c) {
	return 12345;
}
function addTarget(r,c) {
	targets[r+"@"+c]=true;
	hutchlist[r+"@"+c]={
		"distance":calcHammingDistToUser(r, c), 
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
function expandNode(r, c) {
	var finished = false;
	//retrieve starskey:
	unhosted.importSub({"r":r, "c":c}, r+"@"+c);
	starskey = unhosted.get(".stars", r+"@"+c);
	//add r@c's stars as new nodes:
	var parentGuid = r+"@"+c;
	for(star in starskey) {
		hutchlist[star.r+"@"+star.c]={
			"distance":calcHammingDistToUser(star.r, star.c), //on duplicate key, don't recalculate
			"backtrace":{parentGuid:{"r":r, "c":c}},//on duplicate key, add!
			"expanded":false//on duplicate key, don't change.
			};
		if((star.r == user.r) && (star.c == user.c)) {
			finished = true;
		}
	}
	hutchlist[r+"@"+c].expanded = true;
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
			candidate.r = hutchlist[guid].r;
			candidate.c = hutchlist[guid].c;
			candidate.distance = hutchlist[guid].distance;
		}
	}
	var finished = expandNode(candidate.r, candidate.c);
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
function hutch() {
	while(haveTargets()==true) {
		hutchkey();
	}
}
//main:
user.r = "my_r";
user.c = "demo.unhosted.org";
ns[user.r+"@"+user.c] = unhosted.get(user.r+"@"+user.c, ".n");
addTarget("some_r", "demo.unhosted.org");
hutch();
