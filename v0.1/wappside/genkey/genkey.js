
	// Generate a new random private key B bits long, using public expt E
	function RSAGenerate() {
	    var rng = new SecureRandom();
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
		    var bnSeskey = new BigInteger(128,1,rng);//rijndael function we use uses a 128-bit key
	            return {"p":p.toString(16),"q":q.toString(16),"pubkey":p.multiply(q).toString(16), "seskey":bnSeskey.toString(16)};
	        }
	    }
	}
	createPub = function(nick, cloud, token) {
		key = RSAGenerate();
		key[cloud]=cloud;
		key[token]=token;
		return key;
	}
