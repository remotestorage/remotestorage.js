	var nodes = {"michiel@demo.unhosted.org":{}};
hutch = new function() {
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
		var candidate = chooseAntecedentByBits(recommendation, toBitString(toWhom)), higherAntecedent, maxAntecedent = toBitString(toWhom).length;
		if(candidate === null) {
			return;
		}
		if((typeof nodes[toWhom][candidate.bit] == 'undefined') || (candidate.quality > nodes[toWhom][candidate.bit].quality)) {
			//higher antecedents will want the same lower ones as you. lower ones might prefer the newcomer to you. so recommend to all your current antecedents.
			for(higherAntecedent = 0; higherAntecedent < maxAntecedent; higherAntecedent++) {
				if(typeof(nodes[toWhom][higherAntecedent]) != 'undefined') {
					recommendAntecedentTo(recommendation, nodes[toWhom][higherAntecedent].antipod);
				}
			}
			//and adopt the new antecedent yourself
			nodes[toWhom][candidate.bit]={"antipod":recommendation, "quality":candidate.quality};
		}
	}
	var getAntecedent = function(from, bit) {
		if((typeof nodes[from] == 'undefined') || (typeof nodes[from][bit] == 'undefined')) {
			return null;
		}
		return nodes[from][bit].antipod;
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
			pivot = candidate;
			if(toBitString(pivot)==toBits) {
				path.push(pivot);//for debugging
				return pivot;
			}
			antecedentBit = chooseAntecedentByBits(pivot, toBits);
		}
		return null;//if you get here, then toStr is already one of fromStr's antecedent.
	}

	//public:
	this.hutch = function(fromStr, toStr) {
		return (hutchByBits(fromStr, toBitString(toStr), toStr) != null);
	}
	this.addNode = function(newStr, firstFriend) {
		nodes[newStr] = {};
		recommendAntecedentTo(newStr, firstFriend);//if you are the second person to join, this is necessary. if not, it can't hurt either.
		recommendAntecedentTo(firstFriend, newStr);//this is probably not necessary, because for yourself you're going antecedent hunting anyway.
		this.improveAntecedents(newStr, firstFriend);
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
	}
}
hutch.addNode('bla', 'michiel@demo.unhosted.org');
hutch.addNode('blue', 'bla');
for(gen = 0; gen < 5; gen++) {
	hutch.addNode("node"+gen.toString(), 'michiel@demo.unhosted.org');
	document.write(gen+" ");
}
document.write(JSON.stringify(hutch.hutch('node4', 'node1')));
