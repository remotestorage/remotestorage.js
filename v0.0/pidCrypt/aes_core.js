/*!Copyright (c) 2009 pidder <www.pidder.com>*/
/*----------------------------------------------------------------------------*/
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License as
// published by the Free Software Foundation; either version 3 of the
// License, or (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA
// 02111-1307 USA or check at http://www.gnu.org/licenses/gpl.html

/*----------------------------------------------------------------------------*/
/*
*  pidCrypt AES core implementation for block en-/decryption for use in pidCrypt
*  Library.
*  Derived from jsaes version 0.1 (See original license below)
*  Only minor Changes (e.g. using a precompiled this.SBoxInv) and port to an
*  AES Core Class for use with different AES modes.
*
*  Depends on pidCrypt (pidcrypt.js, pidcrypt_util.js)
/*----------------------------------------------------------------------------*/
/*    jsaes version 0.1  -  Copyright 2006 B. Poettering
 *    http://point-at-infinity.org/jsaes/
 *    Report bugs to: jsaes AT point-at-infinity.org
 *
 *
 * This is a javascript implementation of the AES block cipher. Key lengths
 * of 128, 192 and 256 bits are supported.
 * The well-functioning of the encryption/decryption routines has been
 * verified for different key lengths with the test vectors given in
 * FIPS-197, Appendix C.
 * The following code example enciphers the plaintext block '00 11 22 .. EE FF'
 * with the 256 bit key '00 01 02 .. 1E 1F'.
 *    AES_Init();
 *    var block = new Array(16);
 *    for(var i = 0; i < 16; i++)
 *        block[i] = 0x11 * i;
 *    var key = new Array(32);
 *    for(var i = 0; i < 32; i++)
 *        key[i] = i;
 *    AES_ExpandKey(key);
 *    AES_Encrypt(block, key);
 *    AES_Done();
/*----------------------------------------------------------------------------*/

if(typeof(pidCrypt) != 'undefined'){
  pidCrypt.AES = function(env) {
    this.env = (env) ? env : new pidCrypt();
    this.blockSize = 16;  // block size fixed at 16 bytes / 128 bits (Nb=4) for AES
    this.ShiftRowTabInv; //initialized by init()
    this.xtime; //initialized by init()
    this.SBox = new Array(
      99,124,119,123,242,107,111,197,48,1,103,43,254,215,171,
      118,202,130,201,125,250,89,71,240,173,212,162,175,156,164,114,192,183,253,
      147,38,54,63,247,204,52,165,229,241,113,216,49,21,4,199,35,195,24,150,5,154,
      7,18,128,226,235,39,178,117,9,131,44,26,27,110,90,160,82,59,214,179,41,227,
      47,132,83,209,0,237,32,252,177,91,106,203,190,57,74,76,88,207,208,239,170,
      251,67,77,51,133,69,249,2,127,80,60,159,168,81,163,64,143,146,157,56,245,
      188,182,218,33,16,255,243,210,205,12,19,236,95,151,68,23,196,167,126,61,
      100,93,25,115,96,129,79,220,34,42,144,136,70,238,184,20,222,94,11,219,224,
      50,58,10,73,6,36,92,194,211,172,98,145,149,228,121,231,200,55,109,141,213,
      78,169,108,86,244,234,101,122,174,8,186,120,37,46,28,166,180,198,232,221,
      116,31,75,189,139,138,112,62,181,102,72,3,246,14,97,53,87,185,134,193,29,
      158,225,248,152,17,105,217,142,148,155,30,135,233,206,85,40,223,140,161,
      137,13,191,230,66,104,65,153,45,15,176,84,187,22
    );
    this.SBoxInv = new Array(
      82,9,106,213,48,54,165,56,191,64,163,158,129,243,215,
      251,124,227,57,130,155,47,255,135,52,142,67,68,196,222,233,203,84,123,148,50,
      166,194,35,61,238,76,149,11,66,250,195,78,8,46,161,102,40,217,36,178,118,91,
      162,73,109,139,209,37,114,248,246,100,134,104,152,22,212,164,92,204,93,101,
      182,146,108,112,72,80,253,237,185,218,94,21,70,87,167,141,157,132,144,216,
      171,0,140,188,211,10,247,228,88,5,184,179,69,6,208,44,30,143,202,63,15,2,193,
      175,189,3,1,19,138,107,58,145,17,65,79,103,220,234,151,242,207,206,240,180,
      230,115,150,172,116,34,231,173,53,133,226,249,55,232,28,117,223,110,71,241,
      26,113,29,41,197,137,111,183,98,14,170,24,190,27,252,86,62,75,198,210,121,32,
      154,219,192,254,120,205,90,244,31,221,168,51,136,7,199,49,177,18,16,89,39,
      128,236,95,96,81,127,169,25,181,74,13,45,229,122,159,147,201,156,239,160,224,
      59,77,174,42,245,176,200,235,187,60,131,83,153,97,23,43,4,126,186,119,214,38,
      225,105,20,99,85,33,12,125
    );
    this.ShiftRowTab = new Array(0,5,10,15,4,9,14,3,8,13,2,7,12,1,6,11);
  }
/*
init: initialize the tables needed at runtime. Call this function
before the (first) key expansion.
*/
  pidCrypt.AES.prototype.init = function() {
    this.env.setParams({blockSize:this.blockSize});
    this.ShiftRowTabInv = new Array(16);
    for(var i = 0; i < 16; i++)
      this.ShiftRowTabInv[this.ShiftRowTab[i]] = i;
    this.xtime = new Array(256);
    for(i = 0; i < 128; i++) {
      this.xtime[i] = i << 1;
      this.xtime[128 + i] = (i << 1) ^ 0x1b;
    }
  }
/*
AES_ExpandKey: expand a cipher key. Depending on the desired encryption
strength of 128, 192 or 256 bits 'key' has to be a byte array of length
16, 24 or 32, respectively. The key expansion is done "in place", meaning
that the array 'key' is modified.
*/
  pidCrypt.AES.prototype.expandKey = function(input) {
    var key = input.slice();
    var kl = key.length, ks, Rcon = 1;
    switch (kl) {
      case 16: ks = 16 * (10 + 1); break;
      case 24: ks = 16 * (12 + 1); break;
      case 32: ks = 16 * (14 + 1); break;
      default:
        alert("AESCore.expandKey: Only key lengths of 16, 24 or 32 bytes allowed!");
    }
    for(var i = kl; i < ks; i += 4) {
      var temp = key.slice(i - 4, i);
      if (i % kl == 0) {
        temp = new Array(this.SBox[temp[1]] ^ Rcon, this.SBox[temp[2]],
                         this.SBox[temp[3]], this.SBox[temp[0]]);
        if ((Rcon <<= 1) >= 256)
          Rcon ^= 0x11b;
      }
      else if ((kl > 24) && (i % kl == 16))
        temp = new Array(this.SBox[temp[0]], this.SBox[temp[1]],
      this.SBox[temp[2]], this.SBox[temp[3]]);
      for(var j = 0; j < 4; j++)
        key[i + j] = key[i + j - kl] ^ temp[j];
    }
    return key;
  }
/*
AES_Encrypt: encrypt the 16 byte array 'block' with the previously
expanded key 'key'.
*/
  pidCrypt.AES.prototype.encrypt = function(input, key) {
    var l = key.length;
    var block = input.slice();
    this.addRoundKey(block, key.slice(0, 16));
    for(var i = 16; i < l - 16; i += 16) {
      this.subBytes(block);
      this.shiftRows(block);
      this.mixColumns(block);
      this.addRoundKey(block, key.slice(i, i + 16));
    }
    this.subBytes(block);
    this.shiftRows(block);
    this.addRoundKey(block, key.slice(i, l));

    return block;
  }
/*
AES_Decrypt: decrypt the 16 byte array 'block' with the previously
expanded key 'key'.
*/
  pidCrypt.AES.prototype.decrypt = function(input, key) {
    var l = key.length;
    var block = input.slice();
    this.addRoundKey(block, key.slice(l - 16, l));
    this.shiftRows(block, 1);//1=inverse operation
    this.subBytes(block, 1);//1=inverse operation
    for(var i = l - 32; i >= 16; i -= 16) {
      this.addRoundKey(block, key.slice(i, i + 16));
      this.mixColumns_Inv(block);
      this.shiftRows(block, 1);//1=inverse operation
      this.subBytes(block, 1);//1=inverse operation
    }
    this.addRoundKey(block, key.slice(0, 16));

    return block;
  }
  pidCrypt.AES.prototype.subBytes = function(state, inv) {
    var box = (typeof(inv) == 'undefined') ? this.SBox.slice() : this.SBoxInv.slice();
    for(var i = 0; i < 16; i++)
      state[i] = box[state[i]];
  }
  pidCrypt.AES.prototype.addRoundKey = function(state, rkey) {
    for(var i = 0; i < 16; i++)
      state[i] ^= rkey[i];
  }
  pidCrypt.AES.prototype.shiftRows = function(state, inv) {
    var shifttab = (typeof(inv) == 'undefined') ? this.ShiftRowTab.slice() : this.ShiftRowTabInv.slice();
    var h = new Array().concat(state);
    for(var i = 0; i < 16; i++)
      state[i] = h[shifttab[i]];
  }
  pidCrypt.AES.prototype.mixColumns = function(state) {
    for(var i = 0; i < 16; i += 4) {
      var s0 = state[i + 0], s1 = state[i + 1];
      var s2 = state[i + 2], s3 = state[i + 3];
      var h = s0 ^ s1 ^ s2 ^ s3;
      state[i + 0] ^= h ^ this.xtime[s0 ^ s1];
      state[i + 1] ^= h ^ this.xtime[s1 ^ s2];
      state[i + 2] ^= h ^ this.xtime[s2 ^ s3];
      state[i + 3] ^= h ^ this.xtime[s3 ^ s0];
    }
  }
  pidCrypt.AES.prototype.mixColumns_Inv = function(state) {
    for(var i = 0; i < 16; i += 4) {
      var s0 = state[i + 0], s1 = state[i + 1];
      var s2 = state[i + 2], s3 = state[i + 3];
      var h = s0 ^ s1 ^ s2 ^ s3;
      var xh = this.xtime[h];
      var h1 = this.xtime[this.xtime[xh ^ s0 ^ s2]] ^ h;
      var h2 = this.xtime[this.xtime[xh ^ s1 ^ s3]] ^ h;
      state[i + 0] ^= h1 ^ this.xtime[s0 ^ s1];
      state[i + 1] ^= h2 ^ this.xtime[s1 ^ s2];
      state[i + 2] ^= h1 ^ this.xtime[s2 ^ s3];
      state[i + 3] ^= h2 ^ this.xtime[s3 ^ s0];
    }
  }
// xor the elements of two arrays together
  pidCrypt.AES.prototype.xOr_Array = function( a1, a2 ){
     var i;
     var res = Array();
     for( i=0; i<a1.length; i++ )
        res[i] = a1[i] ^ a2[i];

     return res;
  }
  pidCrypt.AES.prototype.getCounterBlock = function(){
    // initialise counter block (NIST SP800-38A §B.2): millisecond time-stamp for nonce in 1st 8 bytes,
    // block counter in 2nd 8 bytes
    var ctrBlk = new Array(this.blockSize);
    var nonce = (new Date()).getTime();  // timestamp: milliseconds since 1-Jan-1970
    var nonceSec = Math.floor(nonce/1000);
    var nonceMs = nonce%1000;
    // encode nonce with seconds in 1st 4 bytes, and (repeated) ms part filling 2nd 4 bytes
    for (var i=0; i<4; i++) ctrBlk[i] = (nonceSec >>> i*8) & 0xff;
    for (var i=0; i<4; i++) ctrBlk[i+4] = nonceMs & 0xff;
    
   return ctrBlk.slice();
  }
}
