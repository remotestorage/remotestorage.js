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
/*
*  AES CTR (Counter) Mode for use in pidCrypt Library
*  The pidCrypt AES CTR is based on the implementation by Chris Veness 2005-2008.
*  See http://www.movable-type.co.uk/scripts/aes.html for details and for his
*  great job.
*
*  Depends on pidCrypt (pcrypt.js, pidcrypt_util.js), AES (aes_core.js)
/*----------------------------------------------------------------------------*/
/*  AES implementation in JavaScript (c) Chris Veness 2005-2008
* You are welcome to re-use these scripts [without any warranty express or
* implied] provided you retain my copyright notice and when possible a link to
* my website (under a LGPL license). §ection numbers relate the code back to
* sections in the standard.
/*----------------------------------------------------------------------------*/
if(typeof(pidCrypt) != 'undefined' && typeof(pidCrypt.AES) != 'undefined')
{
  pidCrypt.AES.CTR = function () {
    this.pidcrypt = new pidCrypt();
    this.aes = new  pidCrypt.AES(this.pidcrypt);
    //shortcuts to pidcrypt methods
    this.getOutput = function(){
      return this.pidcrypt.getOutput();
    }
    this.getAllMessages = function(lnbrk){
      return this.pidcrypt.getAllMessages(lnbrk);
    }
    this.isError = function(){
      return this.pidcrypt.isError();
    }
  }
/**
 * Initialize CTR for encryption from password.
 * @param  password: String
 * @param  options {
 *           nBits: aes bit size (128, 192 or 256)
 *         }
*/
  pidCrypt.AES.CTR.prototype.init = function(password, options) {
    if(!options) options = {};
    if(!password)
      this.pidcrypt.appendError('pidCrypt.AES.CTR.initFromEncryption: Sorry, can not crypt or decrypt without password.\n');
    this.pidcrypt.setDefaults();
    var pObj = this.pidcrypt.getParams(); //loading defaults
    for(var o in options)
      pObj[o] = options[o];
    pObj.password = password;
    pObj.key = password;
    pObj.dataOut = '';
    this.pidcrypt.setParams(pObj);
    this.aes.init();
  }

/**
* Init CTR Encryption from password.
* @param  dataIn: plain text
* @param  password: String
* @param  options {
*           nBits: aes bit size (128, 192 or 256)
*         }
*/
  pidCrypt.AES.CTR.prototype.initEncrypt = function(dataIn, password, options) {
    this.init(password, options);
    this.pidcrypt.setParams({dataIn:dataIn, encryptIn: pidCryptUtil.toByteArray(dataIn)})//setting input for encryption
 }
/**
* Init CTR for decryption from encrypted text (encrypted with pidCrypt.AES.CTR)
* @param  crypted: base64 encrypted text
* @param  password: String
* @param  options {
*           nBits: aes bit size (128, 192 or 256)
*         }
*/
  pidCrypt.AES.CTR.prototype.initDecrypt = function(crypted, password, options){
    var pObj = {};
    this.init(password, options);
    pObj.dataIn = crypted;
    var cipherText = pidCryptUtil.decodeBase64(crypted);
    // recover nonce from 1st 8 bytes of ciphertext
    var salt = cipherText.substr(0,8);//nonce in ctr
    pObj.salt = pidCryptUtil.convertToHex(salt);
    cipherText = cipherText.substr(8)
    pObj.decryptIn = pidCryptUtil.toByteArray(cipherText);
    this.pidcrypt.setParams(pObj);
  }

  pidCrypt.AES.CTR.prototype.getAllMessages = function(lnbrk){
    return this.pidcrypt.getAllMessages(lnbrk);
  }

  pidCrypt.AES.CTR.prototype.getCounterBlock = function(bs){
// initialise counter block (NIST SP800-38A §B.2): millisecond time-stamp for
// nonce in 1st 8 bytes, block counter in 2nd 8 bytes
    var ctrBlk = new Array(bs);
    var nonce = (new Date()).getTime();  // timestamp: milliseconds since 1-Jan-1970
    var nonceSec = Math.floor(nonce/1000);
    var nonceMs = nonce%1000;
    // encode nonce with seconds in 1st 4 bytes, and (repeated) ms part filling
    // 2nd 4 bytes
    for (var i=0; i<4; i++) ctrBlk[i] = (nonceSec >>> i*8) & 0xff;
    for (i=0; i<4; i++) ctrBlk[i+4] = nonceMs & 0xff;

    return ctrBlk.slice();
  }

/**
* Encrypt a text using AES encryption in CTR mode of operation
*  - see http://csrc.nist.gov/publications/nistpubs/800-38a/sp800-38a.pdf
* one of the pidCrypt.AES.CTR init funtions must be called before execution
*
* @param  plaintext: text to encrypt
*
*
* @return          encrypted text
*/
  pidCrypt.AES.CTR.prototype.encryptRaw = function(byteArray) {
    var aes = this.aes;
    var pidcrypt = this.pidcrypt;
    var p = pidcrypt.getParams(); //get parameters for operation set by init
    if(!byteArray)
      byteArray = p.encryptIn;
    pidcrypt.setParams({encryptIn:byteArray});
    var password = p.key;
    // use AES itself to encrypt password to get cipher key (using plain
    // password as source for key expansion) - gives us well encrypted key
    var nBytes = Math.floor(p.nBits/8);  // no bytes in key
    var pwBytes = new Array(nBytes);
    for (var i=0; i<nBytes; i++)
      pwBytes[i] = isNaN(password.charCodeAt(i)) ? 0 : password.charCodeAt(i);
    var key = aes.encrypt(pwBytes.slice(0,16), aes.expandKey(pwBytes));  // gives us 16-byte key
    key = key.concat(key.slice(0, nBytes-16));  // expand key to 16/24/32 bytes long
    var counterBlock = this.getCounterBlock(p.blockSize);
    // and convert it to a string to go on the front of the ciphertext
    var ctrTxt = pidCryptUtil.byteArray2String(counterBlock.slice(0,8));
    pidcrypt.setParams({salt:pidCryptUtil.convertToHex(ctrTxt)});
    // generate key schedule - an expansion of the key into distinct Key Rounds
    // for each round
    var keySchedule = aes.expandKey(key);
    var blockCount = Math.ceil(byteArray.length/p.blockSize);
    var ciphertxt = new Array(blockCount);  // ciphertext as array of strings
    for (var b=0; b<blockCount; b++) {
    // set counter (block #) in last 8 bytes of counter block (leaving nonce in 1st 8 bytes)
    // done in two stages for 32-bit ops: using two words allows us to go past 2^32 blocks (68GB)
      for (var c=0; c<4; c++) counterBlock[15-c] = (b >>> c*8) & 0xff;
      for (var c=0; c<4; c++) counterBlock[15-c-4] = (b/0x100000000 >>> c*8)
      var cipherCntr = aes.encrypt(counterBlock, keySchedule);  // -- encrypt counter block --
      // block size is reduced on final block
      var blockLength = b<blockCount-1 ? p.blockSize : (byteArray.length-1)%p.blockSize+1;
      var cipherChar = new Array(blockLength);
      for (var i=0; i<blockLength; i++) {  // -- xor plaintext with ciphered counter char-by-char --
        cipherChar[i] = cipherCntr[i] ^ byteArray[b*p.blockSize+i];
        cipherChar[i] = String.fromCharCode(cipherChar[i]);
      }
      ciphertxt[b] = cipherChar.join('');
    }
//    alert(pidCryptUtil.encodeBase64(ciphertxt.join('')));
    // Array.join is more efficient than repeated string concatenation
    var ciphertext = ctrTxt + ciphertxt.join('');
    pidcrypt.setParams({dataOut:ciphertext, encryptOut:ciphertext});
    //remove all parameters from enviroment for more security is debug off
    if(!pidcrypt.isDebug() && pidcrypt.clear) pidcrypt.clearParams();
  return ciphertext;  
}

/**
* Encrypt a text using AES encryption in CTR mode of operation
*  - see http://csrc.nist.gov/publications/nistpubs/800-38a/sp800-38a.pdf
* one of the pidCrypt.AES.CTR init funtions must be called before execution
*
* Unicode multi-byte character safe
*
*
* @param  plaintext: text to encrypt
*
*
* @return          encrypted text
*/
  pidCrypt.AES.CTR.prototype.encrypt = function(plaintext) {
    var pidcrypt = this.pidcrypt;
    var p = pidcrypt.getParams(); //get parameters for operation set by init
    if(!plaintext)
      plaintext = p.dataIn;
    if(p.UTF8){
      plaintext = pidCryptUtil.encodeUTF8(plaintext);
      pidcrypt.setParams({key:pidCryptUtil.encodeUTF8(pidcrypt.getParam('key'))});
    }
    pidcrypt.setParams({dataIn:plaintext, encryptIn: pidCryptUtil.toByteArray(plaintext)});
    var ciphertext = this.encryptRaw();
    ciphertext = pidCryptUtil.encodeBase64(ciphertext);  // encode in base64
    pidcrypt.setParams({dataOut:ciphertext});
    //remove all parameters from enviroment for more security is debug off
    if(!pidcrypt.isDebug() && pidcrypt.clear) pidcrypt.clearParams();

    return ciphertext;
  }

/**
* Encrypt a text using AES encryption in CTR mode of operation
*  - see http://csrc.nist.gov/publications/nistpubs/800-38a/sp800-38a.pdf
* one of the pidCrypt.AES.CTR init funtions must be called before execution
*
* Unicode multi-byte character safe
*
* @param  dataIn: plain text
* @param  password: String
* @param  options {
*           nBits: aes bit size (128, 192 or 256)
*         }
*
* @return          encrypted text
*/
  pidCrypt.AES.CTR.prototype.encryptText = function(dataIn, password, options) {
   this.initEncrypt(dataIn, password, options);
   return this.encrypt();
 }


/**
* Decrypt a text encrypted by AES in CTR mode of operation
*
* one of the pidCrypt.AES.CTR init funtions must be called before execution
*
* @param  ciphertext: text to decrypt
*
* @return           decrypted text as String
*/
  pidCrypt.AES.CTR.prototype.decryptRaw = function(byteArray) {
    var pidcrypt = this.pidcrypt;
    var aes = this.aes;
    var p = pidcrypt.getParams(); //get parameters for operation set by init
    if(!byteArray)
      byteArray = p.decryptIn;
    pidcrypt.setParams({decryptIn:byteArray});
    if(!p.dataIn) pidcrypt.setParams({dataIn:byteArray});
    // use AES to encrypt password (mirroring encrypt routine)
    var nBytes = Math.floor(p.nBits/8);  // no bytes in key
    var pwBytes = new Array(nBytes);
    for (var i=0; i<nBytes; i++) {
      pwBytes[i] = isNaN(p.key.charCodeAt(i)) ? 0 : p.key.charCodeAt(i);
    }
    var key = aes.encrypt(pwBytes.slice(0,16), aes.expandKey(pwBytes));  // gives us 16-byte key
    key = key.concat(key.slice(0, nBytes-16));  // expand key to 16/24/32 bytes long
    var counterBlock = new Array(8);
    var ctrTxt = pidCryptUtil.convertFromHex(p.salt);
    for (i=0; i<8; i++) counterBlock[i] = ctrTxt.charCodeAt(i);
    // generate key schedule
    var keySchedule =  aes.expandKey(key);
    // separate ciphertext into blocks (skipping past initial 8 bytes)
    var nBlocks = Math.ceil((byteArray.length) / p.blockSize);
    var blockArray = new Array(nBlocks);
    for (var b=0; b<nBlocks; b++) blockArray[b] = byteArray.slice(b*p.blockSize, b*p.blockSize+p.blockSize);
    // plaintext will get generated block-by-block into array of block-length
    // strings
    var plaintxt = new Array(blockArray.length);
    var cipherCntr = [];
    var plaintxtByte = [];
    for (b=0; b<nBlocks; b++) {
    // set counter (block #) in last 8 bytes of counter block (leaving nonce in 1st 8 bytes)
      for (var c=0; c<4; c++) counterBlock[15-c] = ((b) >>> c*8) & 0xff;
      for (c=0; c<4; c++) counterBlock[15-c-4] = (((b+1)/0x100000000-1) >>> c*8) & 0xff;
      cipherCntr = aes.encrypt(counterBlock, keySchedule);  // encrypt counter block
      plaintxtByte = new Array(blockArray[b].length);
      for (i=0; i<blockArray[b].length; i++) {
      // -- xor plaintxt with ciphered counter byte-by-byte --
        plaintxtByte[i] = cipherCntr[i] ^ blockArray[b][i];
        plaintxtByte[i] = String.fromCharCode(plaintxtByte[i]);
      }
      plaintxt[b] = plaintxtByte.join('');
    }
    // join array of blocks into single plaintext string
    var plaintext = plaintxt.join('');
    pidcrypt.setParams({dataOut:plaintext});
    //remove all parameters from enviroment for more security is debug off
    if(!pidcrypt.isDebug() && pidcrypt.clear) pidcrypt.clearParams();

    return plaintext;
  }
  
/**
* Decrypt a text encrypted by AES in CTR mode of operation
*
* one of the pidCrypt.AES.CTR init funtions must be called before execution
*
* @param  ciphertext: text to decrypt
*
* @return  decrypted text as String
*/
  pidCrypt.AES.CTR.prototype.decrypt = function(ciphertext) {
    var pidcrypt = this.pidcrypt;
    var p = pidcrypt.getParams(); //get parameters for operation set by init
    if(ciphertext)
      pidcrypt.setParams({dataIn:ciphertext, decryptIn: pidCryptUtil.toByteArray(ciphertext)});
    if(p.UTF8){
      pidcrypt.setParams({key:pidCryptUtil.encodeUTF8(pidcrypt.getParam('key'))});
    }
    var plaintext = this.decryptRaw();
    plaintext = pidCryptUtil.decodeUTF8(plaintext);  // decode from UTF8 back to Unicode multi-byte chars

    pidcrypt.setParams({dataOut:plaintext});
    //remove all parameters from enviroment for more security is debug off
    if(!pidcrypt.isDebug() && pidcrypt.clear) pidcrypt.clearParams();

    return plaintext;
  }
/**
* Decrypt a text encrypted by AES in CTR mode of operation
*
* one of the pidCrypt.AES.CTR init funtions must be called before execution
*
* @param  crypted: base64 encrypted text
* @param  password: String
* @param  options {
*
* @return  decrypted text as String
*/
  pidCrypt.AES.CTR.prototype.decryptText = function(crypted, password, options) {
    this.initDecrypt(crypted, password, options);
    return this.decrypt();
  }


}
