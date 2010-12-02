 /*----------------------------------------------------------------------------*/
 // Copyright (c) 2009 pidder <www.pidder.com>
 // Permission to use, copy, modify, and/or distribute this software for any
 // purpose with or without fee is hereby granted, provided that the above
 // copyright notice and this permission notice appear in all copies.
 //
 // THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 // WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 // MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 // ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 // WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 // ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 // OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
/*----------------------------------------------------------------------------*/
/**
*
*  PKCS#1 encryption-style padding (type 2) En- / Decryption for use in
*  pidCrypt Library. The pidCrypt RSA module is based on the implementation
*  by Tom Wu.
*  See http://www-cs-students.stanford.edu/~tjw/jsbn/ for details and for his
*  great job.
*
*  Depends on pidCrypt (pidcrypt.js, pidcrypt_util.js), BigInteger (jsbn.js),
*  random number generator (rng.js) and a PRNG backend (prng4.js) (the random
*  number scripts are only needed for key generation).
/*----------------------------------------------------------------------------*/
 /*
 * Copyright (c) 2003-2005  Tom Wu
 * All Rights Reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS-IS" AND WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS, IMPLIED OR OTHERWISE, INCLUDING WITHOUT LIMITATION, ANY
 * WARRANTY OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.
 *
 * IN NO EVENT SHALL TOM WU BE LIABLE FOR ANY SPECIAL, INCIDENTAL,
 * INDIRECT OR CONSEQUENTIAL DAMAGES OF ANY KIND, OR ANY DAMAGES WHATSOEVER
 * RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER OR NOT ADVISED OF
 * THE POSSIBILITY OF DAMAGE, AND ON ANY THEORY OF LIABILITY, ARISING OUT
 * OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * In addition, the following condition applies:
 *
 * All redistributions must retain an intact copy of this copyright notice
 * and disclaimer.
 */
//Address all questions regarding this license to:
//  Tom Wu
//  tjw@cs.Stanford.EDU
/*----------------------------------------------------------------------------*/
if(typeof(pidCrypt) != 'undefined' &&
   typeof(BigInteger) != 'undefined' &&//must have for rsa
   typeof(SecureRandom) != 'undefined' &&//only needed for key generation
   typeof(Arcfour) != 'undefined'//only needed for key generation
)
{

//  Author: Tom Wu
//  tjw@cs.Stanford.EDU
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

    // PKCS#1 (type 2, random) pad input string s to n bytes, and return a bigint
        function pkcs1pad2(s,n) {
          if(n < s.length + 11) {
            alert("Message too long for RSA");
            return null;
          }
          var ba = new Array();
          var i = s.length - 1;
          while(i >= 0 && n > 0) {ba[--n] = s.charCodeAt(i--);};
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
    //RSA key constructor
    pidCrypt.RSA = function() {
      this.n = null;
      this.e = 0;
      this.d = null;
      this.p = null;
      this.q = null;
      this.dmp1 = null;
      this.dmq1 = null;
      this.coeff = null;

    }
    // protected
    // Perform raw private operation on "x": return x^d (mod n)
    pidCrypt.RSA.prototype.doPrivate = function(x) {
      if(this.p == null || this.q == null)
        return x.modPow(this.d, this.n);

      // TODO: re-calculate any missing CRT params
      var xp = x.mod(this.p).modPow(this.dmp1, this.p);
      var xq = x.mod(this.q).modPow(this.dmq1, this.q);

      while(xp.compareTo(xq) < 0)
        xp = xp.add(this.p);
      return xp.subtract(xq).multiply(this.coeff).mod(this.p).multiply(this.q).add(xq);
    }


    // Set the public key fields N and e from hex strings
    pidCrypt.RSA.prototype.setPublic = function(N,E,radix) {
      if (typeof(radix) == 'undefined') radix = 16;

      if(N != null && E != null && N.length > 0 && E.length > 0) {
        this.n = parseBigInt(N,radix);
        this.e = parseInt(E,radix);
      }
      else
        alert("Invalid RSA public key");

//       alert('N='+this.n+'\nE='+this.e);
//document.writeln('Schlüssellaenge = ' + this.n.toString().length +'<BR>');
    }

    // Perform raw public operation on "x": return x^e (mod n)
    pidCrypt.RSA.prototype.doPublic = function(x) {
      return x.modPowInt(this.e, this.n);
    }

    // Return the PKCS#1 RSA encryption of "text" as an even-length hex string
    pidCrypt.RSA.prototype.encryptRaw = function(text) {
      var m = pkcs1pad2(text,(this.n.bitLength()+7)>>3);
      if(m == null) return null;
      var c = this.doPublic(m);
      if(c == null) return null;
      var h = c.toString(16);
      if((h.length & 1) == 0) return h; else return "0" + h;
    }

    pidCrypt.RSA.prototype.encrypt = function(text) {
      //base64 coding for supporting 8bit chars
      text = pidCryptUtil.encodeBase64(text);
      return this.encryptRaw(text)
    }
    // Return the PKCS#1 RSA decryption of "ctext".
    // "ctext" is an even-length hex string and the output is a plain string.
    pidCrypt.RSA.prototype.decryptRaw = function(ctext) {
//     alert('N='+this.n+'\nE='+this.e+'\nD='+this.d+'\nP='+this.p+'\nQ='+this.q+'\nDP='+this.dmp1+'\nDQ='+this.dmq1+'\nC='+this.coeff);
      var c = parseBigInt(ctext, 16);
      var m = this.doPrivate(c);
      if(m == null) return null;
      return pkcs1unpad2(m, (this.n.bitLength()+7)>>3)
    }

    pidCrypt.RSA.prototype.decrypt = function(ctext) {
      var str = this.decryptRaw(ctext)
      //base64 coding for supporting 8bit chars
      str = (str) ? pidCryptUtil.decodeBase64(str) : "";
      return str;
    }

/*
    // Return the PKCS#1 RSA encryption of "text" as a Base64-encoded string
    pidCrypt.RSA.prototype.b64_encrypt = function(text) {
      var h = this.encrypt(text);
      if(h) return hex2b64(h); else return null;
    }
*/
    // Set the private key fields N, e, and d from hex strings
    pidCrypt.RSA.prototype.setPrivate = function(N,E,D,radix) {
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
    pidCrypt.RSA.prototype.setPrivateEx = function(N,E,D,P,Q,DP,DQ,C,radix) {
        if (typeof(radix) == 'undefined') radix = 16;

        if(N != null && E != null && N.length > 0 && E.length > 0) {
        this.n = parseBigInt(N,radix);//modulus
        this.e = parseInt(E,radix);//publicExponent
        this.d = parseBigInt(D,radix);//privateExponent
        this.p = parseBigInt(P,radix);//prime1
        this.q = parseBigInt(Q,radix);//prime2
        this.dmp1 = parseBigInt(DP,radix);//exponent1
        this.dmq1 = parseBigInt(DQ,radix);//exponent2
        this.coeff = parseBigInt(C,radix);//coefficient
      }
      else
        alert("Invalid RSA private key");
//     alert('N='+this.n+'\nE='+this.e+'\nD='+this.d+'\nP='+this.p+'\nQ='+this.q+'\nDP='+this.dmp1+'\nDQ='+this.dmq1+'\nC='+this.coeff);

    }

    // Generate a new random private key B bits long, using public expt E
    pidCrypt.RSA.prototype.generate = function(B,E) {
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


//pidCrypt extensions start
//
    pidCrypt.RSA.prototype.getASNData = function(tree) {
        var params = {};
        var data = [];
        var p=0;

        if(tree.value && tree.type == 'INTEGER')
          data[p++] = tree.value;
        if(tree.sub)
           for(var i=0;i<tree.sub.length;i++)
           data = data.concat(this.getASNData(tree.sub[i]));

      return data;
    }

//
//
//get parameters from ASN1 structure object created from pidCrypt.ASN1.toHexTree
//e.g. A RSA Public Key gives the ASN structure object:
// {
//   SEQUENCE:
//              {
//                  INTEGER: modulus,
//                  INTEGER: public exponent
//              }
//}
    pidCrypt.RSA.prototype.setKeyFromASN = function(key,asntree) {
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

/**
 * Init RSA Encryption with public key.
 * @param  asntree: ASN1 structure object created from pidCrypt.ASN1.toHexTree
*/
   pidCrypt.RSA.prototype.setPublicKeyFromASN = function(asntree) {
        this.setKeyFromASN('public',asntree);

    }

/**
 * Init RSA Encryption with private key.
 * @param  asntree: ASN1 structure object created from pidCrypt.ASN1.toHexTree
*/
    pidCrypt.RSA.prototype.setPrivateKeyFromASN = function(asntree) {
        this.setKeyFromASN('private',asntree);
    }
/**
 * gets the current paramters as object.
 * @return params: object with RSA parameters
*/
    pidCrypt.RSA.prototype.getParameters = function() {
      var params = {}
      if(this.n != null) params.n = this.n;
      params.e = this.e;
      if(this.d != null) params.d = this.d;
      if(this.p != null) params.p = this.p;
      if(this.q != null) params.q = this.q;
      if(this.dmp1 != null) params.dmp1 = this.dmp1;
      if(this.dmq1 != null) params.dmq1 = this.dmq1;
      if(this.coeff != null) params.c = this.coeff;

      return params;
    }


//pidCrypt extensions end


}

