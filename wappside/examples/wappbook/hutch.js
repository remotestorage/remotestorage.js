var me = "michiel@example.unhosted.org";
var nodes = {"michiel@example.unhosted.org":{}};
var recommendationsInbox = {};
var recommendationsOutbox = {};
var hutch = new function() {
	//private:
	var bytesToBits = function(bytes) {
		var i, j, bits = "", theseBits;
		for(i = 0; i < bytes.length; i++) {
			theseBits = bytes[i].toString(2);
			for(j=0;j<8-theseBits.length;j++) {//leading zeroes
				bits += '0';
			}
			bits += theseBits;
		}
		return bits;
	}
	var toBitString = function(str) {
		var sha1bin = sha1.dec(str);
		return bytesToBits(sha1bin);
	}
	var chooseAntecedent = function(fromStr, toStr) {
		var res = chooseAntecedentByBits(fromStr, toBitString(toStr));
		return res.bit;
	}
	var chooseAntecedentByBits = function(fromStr, toBits) {
		var fromBits = toBitString(fromStr);
		var i, antecedent="", res = {};
		while(fromBits.length < toBits.length) {
			fromBits += '=';
		}
		while(toBits.length < fromBits.length) {
			toBits += '=';
		}
		for(i=0; i < fromBits.length; i++) {
			if(fromBits[i]!=toBits[i]) {
				if(typeof res.bit == 'undefined') {//first bit of difference is the antecedent.bit:
					res.bit = i;
				} else {//second bit that's different, indicates antecedent.quality:
					res.quality = i;
					return res;
				}
			}
		}
		res.bit = null;
		res.quality = null;
		return res;
	}
	var recommendAntecedentTo = function(recommendation, toWhom) {
		if(toWhom == me) {
			recommendationsInbox[recommendation] = true;
		} else {
			recommendationsOutbox[recommendation+" "+toWhom] = true;
		}
	}
	var flushRecommendationsOutbox = function() {
		//processing own recommendations may generate some outgoing as well, so do them first:
		processRecommendations(recommendationsInbox);
		recommendationsInbox = {};
		for(i in recommendationsOutbox) {
			parts = i.split(" ", 2)
			unhosted.send(me, parts[1], 'StarSign', parts[0]);
		}
		recommendationsOutbox = {};
	}
	var processRecommendations = function(recommendations) {
		var candidate, higherAntecedent, maxAntecedent, starskeyRaw, starskey, StarSign, myBits = toBitString(me), recommendation;
		starskeyRaw = unhosted.rawGet(me, '.stars');
		if(starskeyRaw === null) {
			starskey = {};
		} else {
			starskey = starskeyRaw.cmd.value;
		}
		for(recommendation in recommendations) {
			candidate = chooseAntecedentByBits(recommendation, myBits);
			if(candidate !== null) {
				if((typeof starskey[candidate.bit] == 'undefined') || (candidate.quality > starskey[candidate.bit].quality)) {
					maxAntecedent = myBits.length;
					//higher antecedents will want the same lower ones as you. 
					//lower ones might prefer the newcomer to you. so recommend to all your current antecedents.
					for(higherAntecedent = 0; higherAntecedent < maxAntecedent; higherAntecedent++) {
						if(typeof(starskey[higherAntecedent]) != 'undefined') {
							recommendAntecedentTo(recommendation, starskey[higherAntecedent].antipod);
						}
					}
					//and adopt the new antecedent yourself
					StarSign = unhosted.makeStarSign(me, recommendation);
					starskey[candidate.bit]={"antipod":recommendation, "quality":candidate.quality, "StarSign":StarSign};
				}
			}
		}
		unhosted.rawSet(me, '.stars', starskey, false);
	}
	var getAntecedent = function(from, bit) {
		var starskey = unhosted.rawGet(from, '.stars');
		if((starskey === null) 
				|| (typeof starskey.cmd == 'undefined') 
				|| (typeof starskey.cmd.value == 'undefined') 
				|| (typeof starskey.cmd.value[bit] == 'undefined')) {
			return null;
		}
		return starskey.cmd.value[bit];
	}
	var hutchByBits = function(fromStr, toBits, toStr) {
		var path = [], pivot = fromStr, candidate;
		var antecedentBit = chooseAntecedentByBits(pivot, toBits);
		while(antecedentBit.bit !== null) {
			path.push(pivot);//for debugging
			candidate = getAntecedent(pivot, antecedentBit.bit);
			if(candidate === null) {//pivot's off the map!
				//dead end! this means the current pivot's antecedents aren't optimal.
				if(typeof toStr !== 'undefined') {
					recommendAntecedentTo(toStr, pivot);
					recommendAntecedentTo(pivot, toStr);
				}
				//TODO: should backtrack one and find alternative routes.
				return null;
			}
			if(!unhosted.checkStarSign(pivot, candidate.antipod, candidate.StarSign)) {
				return "fabric torn between "+pivot+" and "+candidate.antipod;
			}
			pivot = candidate.antipod;
			if(toBitString(pivot)==toBits) {
				path.push(pivot);//for debugging
				return pivot;
			}
			antecedentBit = chooseAntecedentByBits(pivot, toBits);
		}
		return null;//if you get here, then toStr is already one of fromStr's antecedent.
	}

	//public:
	this.hutch = function(fromStr, myAntipod) {
		var ret = (hutchByBits(fromStr, toBitString(myAntipod), myAntipod) != null);
		flushRecommendationsOutbox();
		return ret;
	}
	this.meet = function(firstFriend) {
		recommendAntecedentTo(me, firstFriend);//if you are the second person to join, this is necessary. if not, it can't hurt either.
		this.improveAntecedents(me, firstFriend);
		flushRecommendationsOutbox();
	}
	this.improveAntecedents = function(nodeName, refNode) {
		var antecedentBit, myBits = toBitString(nodeName), candidate, prefix="", suffix=myBits, candidateStr;
		for(antecedentBit=0; antecedentBit < myBits.length; antecedentBit++) {//find good antecedents, leveraging refNode's vantage point
			suffix = suffix.substring(1);
			candidateStr = prefix + (1 - myBits[antecedentBit]).toString() + suffix;
			candidate = hutchByBits(refNode, candidateStr, nodeName);//here, toStr indicates who to recommend to when you reach the end of the path
			if(candidate !== null) {
				recommendAntecedentTo(candidate, newStr);
				recommendAntecedentTo(newStr, candidate);
			}
			prefix += myBits[antecedentBit];
		}
		flushRecommendationsOutbox();
	}
	this.receiveRecommendations = function() {
		var recommendations = unhosted.receive(me, 'StarSign', true);
		var recommendationAddresses = {};
		for (i in recommendations) {
			recommendationAddresses[recommendations[i].body] = true;
		}
		processRecommendations(recommendationAddresses);
		flushRecommendationsOutbox();
	}
}
