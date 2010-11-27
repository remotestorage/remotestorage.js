// Depends on jsbn.js and rng.js

// convert a (hex) string to a bignum object
function parseBigInt(str,r) {
    return new BigInteger(str,r);
}

function linebrk(s,n) {
    var ret = "";
    var i = 0;
    while(i + n < s.length) {
        ret += s.substring(i,i+n) + "\n";
        i += n;
    }
    return ret + s.substring(i,s.length);
}

function byte2Hex(b) {
    if(b < 0x10)
        return "0" + b.toString(16);
    else
        return b.toString(16);
}

// PKCS#1 (type 2, random) pad input string s to n bytes, and return a bigint
function pkcs1pad2(s,n) {
    if(n < s.length + 11) {
        alert("Message too long for RSA");
        return null;
    }
    var ba = new Array();
    var i = s.length - 1;
    while(i >= 0 && n > 0) ba[--n] = s.charCodeAt(i--);
    ba[--n] = 0;
    var rng = new SecureRandom();
    var x = new Array();
    while(n > 2) { // random non-zero pad
        x[0] = 0;
        while(x[0] == 0) rng.nextBytes(x);
        ba[--n] = x[0];
    }
    ba[--n] = 2;
    ba[--n] = 0;
    return new BigInteger(ba);
}

// "empty" RSA key constructor
function RSAKey() {
    this.n = null;
    this.e = 0;
    this.d = null;
    this.p = null;
    this.q = null;
    this.dmp1 = null;
    this.dmq1 = null;
    this.coeff = null;
}

// Set the public key fields N and e from hex strings
function RSASetPublic(N,E,radix) {
    if (typeof(radix) == 'undefined') radix = 16;
    if(N != null && E != null && N.length > 0 && E.length > 0) {
        this.n = parseBigInt(N,radix);
        this.e = parseInt(E,radix);
    }
    else
        alert("Invalid RSA public key");
}

// Perform raw public operation on "x": return x^e (mod n)
function RSADoPublic(x) {
    return x.modPowInt(this.e, this.n);
}

// Return the PKCS#1 RSA encryption of "text" as an even-length hex string
function RSAEncrypt(text) {
    var m = pkcs1pad2(text,(this.n.bitLength()+7)>>3);
    if(m == null) return null;
    var c = this.doPublic(m);
    if(c == null) return null;
    var h = c.toString(16);
    if((h.length & 1) == 0) return h; else return "0" + h;
}

// Return the PKCS#1 RSA encryption of "text" as a Base64-encoded string
function RSAEncryptB64(text) {
    var h = this.encrypt(text);
    if(h) return hex2b64(h); else return null;
}

// protected
RSAKey.prototype.doPublic = RSADoPublic;

// public
RSAKey.prototype.setPublic = RSASetPublic;
RSAKey.prototype.encrypt = RSAEncrypt;
//RSAKey.prototype.encrypt_b64 = RSAEncryptB64;

// Depends on rsa.js and jsbn2.js

// Undo PKCS#1 (type 2, random) padding and, if valid, return the plaintext
function pkcs1unpad2(d,n) {
    var b = d.toByteArray();
    var i = 0;
    while(i < b.length && b[i] == 0) ++i;
    if(b.length-i != n-1 || b[i] != 2)
        return null;
    ++i;
    while(b[i] != 0)
        if(++i >= b.length) return null;
    var ret = "";
    while(++i < b.length)
        ret += String.fromCharCode(b[i]);
    return ret;
}

// Set the private key fields N, e, and d from hex strings
function RSASetPrivate(N,E,D,radix) {
    if (typeof(radix) == 'undefined') radix = 16;
    if(N != null && E != null && N.length > 0 && E.length > 0) {
        this.n = parseBigInt(N,radix);
        this.e = parseInt(E,radix);
        this.d = parseBigInt(D,radix);
    }
    else
        alert("Invalid RSA private key");
}

// Set the private key fields N, e, d and CRT params from hex strings
function RSASetPrivateEx(N,E,D,P,Q,DP,DQ,C,radix) {
    if (typeof(radix) == 'undefined') radix = 16;
    if(N != null && E != null && N.length > 0 && E.length > 0) {
        this.n = parseBigInt(N,radix);
        this.e = parseInt(E,radix);
        this.d = parseBigInt(D,radix);
        this.p = parseBigInt(P,radix);
        this.q = parseBigInt(Q,radix);
        this.dmp1 = parseBigInt(DP,radix);
        this.dmq1 = parseBigInt(DQ,radix);
        this.coeff = parseBigInt(C,radix);
    }
    else
        alert("Invalid RSA private key");
}

// Generate a new random private key B bits long, using public expt E
function RSAGenerate(B,E) {
    var rng = new SecureRandom();
    var qs = B>>1;
    this.e = parseInt(E,16);
    var ee = new BigInteger(E,16);
    for(;;) {
        for(;;) {
            this.p = new BigInteger(B-qs,1,rng);
            if(this.p.subtract(BigInteger.ONE).gcd(ee).compareTo(BigInteger.ONE) == 0 && this.p.isProbablePrime(10)) break;
        }
        for(;;) {
            this.q = new BigInteger(qs,1,rng);
            if(this.q.subtract(BigInteger.ONE).gcd(ee).compareTo(BigInteger.ONE) == 0 && this.q.isProbablePrime(10)) break;
        }
        if(this.p.compareTo(this.q) <= 0) {
            var t = this.p;
            this.p = this.q;
            this.q = t;
        }
        var p1 = this.p.subtract(BigInteger.ONE);
        var q1 = this.q.subtract(BigInteger.ONE);
        var phi = p1.multiply(q1);
        if(phi.gcd(ee).compareTo(BigInteger.ONE) == 0) {
            this.n = this.p.multiply(this.q);
            this.d = ee.modInverse(phi);
            this.dmp1 = this.d.mod(p1);
            this.dmq1 = this.d.mod(q1);
            this.coeff = this.q.modInverse(this.p);
            break;
        }
    }
}

// Perform raw private operation on "x": return x^d (mod n)
function RSADoPrivate(x) {
    if(this.p == null || this.q == null)
        return x.modPow(this.d, this.n);

    // TODO: re-calculate any missing CRT params
    var xp = x.mod(this.p).modPow(this.dmp1, this.p);
    var xq = x.mod(this.q).modPow(this.dmq1, this.q);

    while(xp.compareTo(xq) < 0)
        xp = xp.add(this.p);
    return xp.subtract(xq).multiply(this.coeff).mod(this.p).multiply(this.q).add(xq);
}

// Return the PKCS#1 RSA decryption of "ctext".
// "ctext" is an even-length hex string and the output is a plain string.
function RSADecrypt(ctext) {
    var c = parseBigInt(ctext, 16);
    alert(ctext);
    var m = this.doPrivate(c);
    if(m == null) return null;
    return pkcs1unpad2(m, (this.n.bitLength()+7)>>3);
}

// Return the PKCS#1 RSA decryption of "ctext".
// "ctext" is a Base64-encoded string and the output is a plain string.
//function RSAB64Decrypt(ctext) {
//  var h = b64tohex(ctext);
//  if(h) return this.decrypt(h); else return null;
//}

// protected
RSAKey.prototype.doPrivate = RSADoPrivate;

// public
RSAKey.prototype.setPrivate = RSASetPrivate;
RSAKey.prototype.setPrivateEx = RSASetPrivateEx;
RSAKey.prototype.generate = RSAGenerate;
RSAKey.prototype.decrypt = RSADecrypt;
RSAKey.prototype.b64_encrypt = RSAEncryptB64;
//RSAKey.prototype.b64_decrypt = RSAB64Decrypt;


    RSAKey.prototype.getASNData = function(tree) {
        var params = {};
        var data = [];
        var p=0;

        if(tree.value)
          data[p++] = tree.value;
        if(tree.sub)
           for(var i=0;i<tree.sub.length;i++)
           data = data.concat(this.getASNData(tree.sub[i]));

      return data;
    }

//
//
//get parameters from ASN1 structure object e.g. created from pidCrypt.ASN1
//e.g. RSA Public Key
// {
//   SEQUENCE:
//              {
//                  INTEGER: modulus,
//                  INTEGER: public exponent
//              }
//}
    RSAKey.prototype.setKeyFromASN = function(key,asntree) {
       var keys = ['N','E','D','P','Q','DP','DQ','C'];
       var params = {};

       var asnData = this.getASNData(asntree);
       switch(key){
           case 'Public':
           case 'public':
                for(var i=0;i<asnData.length;i++)
                  params[keys[i]] = asnData[i].toLowerCase();
                this.setPublic(params.N,params.E,16);
            break;
           case 'Private':
           case 'private':
                for(var i=1;i<asnData.length;i++)
                  params[keys[i-1]] = asnData[i].toLowerCase();
                this.setPrivateEx(params.N,params.E,params.D,params.P,params.Q,params.DP,params.DQ,params.C,16);
//                  this.setPrivate(params.N,params.E,params.D);
            break;
        }

    }
    RSAKey.prototype.setPublicKeyFromASN = function(asntree) {
        this.setKeyFromASN('public',asntree);

    }

    RSAKey.prototype.setPrivateKeyFromASN = function(asntree) {
        this.setKeyFromASN('private',asntree);
    }

