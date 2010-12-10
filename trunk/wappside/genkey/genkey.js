
	rng = new SecureRandom();

	// Generate a new random private key B bits long, using public expt E
	function RSAGenerate() {
		var qs = 512>>1;
		this.e = parseInt("10001",16);
		var ee = new BigInteger("10001",16);
		for(;;) {
			for(;;) {
				p = new BigInteger(512-qs,1,rng);
				if(p.subtract(BigInteger.ONE).gcd(ee).compareTo(BigInteger.ONE) == 0 && p.isProbablePrime(10)) break;
			}
			for(;;) {
				q = new BigInteger(qs,1,rng);
				if(q.subtract(BigInteger.ONE).gcd(ee).compareTo(BigInteger.ONE) == 0 && q.isProbablePrime(10)) break;
			}
			if(p.compareTo(q) <= 0) {
				var t = p;
				p = q;
				q = t;
			}
			var p1 = p.subtract(BigInteger.ONE);
			var q1 = q.subtract(BigInteger.ONE);
			var phi = p1.multiply(q1);
			if(phi.gcd(ee).compareTo(BigInteger.ONE) == 0) {
				//generate some interesting numbers from p and q:
				var qs = 512>>1;		var e = parseInt("10001", 16);  var ee = new BigInteger("10001", 16);
				var p1 = p.subtract(BigInteger.ONE);	var q1 = q.subtract(BigInteger.ONE);
				var phi = p1.multiply(q1);	var n = p.multiply(q);	var d = ee.modInverse(phi);

				return {"n":n.toString(16), "d":d.toString(16)};
			}
		}
	}
	createPub = function(nick, cloud, token) {
		var t = JSON.parse(token);
		key = RSAGenerate();
		key.c = cloud;
		key.r = t.r;
		key.w = t.w;
		var bnSeskey = new BigInteger(128,1,rng);//rijndael function we use uses a 128-bit key
		key.s = bnSeskey.toString(16);
		return key;
	}
	submitNS = function(key) {
		unhosted.importPub(key, "newKey");
		unhosted.rawSet("newKey", ".n", key.n, false);
		unhosted.rawSet("newKey", ".s", key.s, true);
	}

