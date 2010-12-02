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
*  AES CBC (Cipher Block Chaining) Mode for use in pidCrypt Library
*  The pidCrypt AES CBC mode is compatible with openssl aes-xxx-cbc mode
*  using the same algorithms for key and iv creation and padding as openssl.
*
*  Depends on pidCrypt (pidcrypt.js, pidcrypt_util.js), AES (aes_core.js)
*  and MD5 (md5.js)
*
/*----------------------------------------------------------------------------*/

if(typeof(pidCrypt) != 'undefined' &&
   typeof(pidCrypt.AES) != 'undefined' &&
   typeof(pidCrypt.MD5) != 'undefined')
{
  pidCrypt.AES.CBC = function () {
    this.pidcrypt = new pidCrypt();
    this.aes = new pidCrypt.AES(this.pidcrypt);
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
* Initialize CBC for encryption from password.
* Note: Only for encrypt operation!
* @param  password: String
* @param  options {
*           nBits: aes bit size (128, 192 or 256)
*         }
*/
  pidCrypt.AES.CBC.prototype.init = function(password, options) {
    if(!options) options = {};
    var pidcrypt = this.pidcrypt;
    pidcrypt.setDefaults();
    var pObj = this.pidcrypt.getParams(); //loading defaults
    for(var o in options)
      pObj[o] = options[o];
    var k_iv = this.createKeyAndIv({password:password, salt: pObj.salt, bits: pObj.nBits});
    pObj.key = k_iv.key;
    pObj.iv = k_iv.iv;
    pObj.dataOut = '';
    pidcrypt.setParams(pObj)
    this.aes.init();
  }

/**
* Initialize CBC for encryption from password.
* @param  dataIn: plain text
* @param  password: String
* @param  options {
*           nBits: aes bit size (128, 192 or 256)
*         }
*/
  pidCrypt.AES.CBC.prototype.initEncrypt = function(dataIn, password, options) {
    this.init(password,options);//call standard init
    this.pidcrypt.setParams({dataIn:dataIn, encryptIn: pidCryptUtil.toByteArray(dataIn)})//setting input for encryption
  }
/**
* Initialize CBC for decryption from encrypted text (compatible with openssl).
* see thread http://thedotnet.com/nntp/300307/showpost.aspx
* @param  crypted: base64 encoded aes encrypted text
* @param  passwd: String
* @param  options {
*           nBits: aes bit size (128, 192 or 256),
*           UTF8: boolean, set to false when decrypting certificates,
*           A0_PAD: boolean, set to false when decrypting certificates
*         }
*/
  pidCrypt.AES.CBC.prototype.initDecrypt = function(crypted, password, options){
    if(!options) options = {};
    var pidcrypt = this.pidcrypt;
    pidcrypt.setParams({dataIn:crypted})
    if(!password)
      pidcrypt.appendError('pidCrypt.AES.CBC.initFromEncryption: Sorry, can not crypt or decrypt without password.\n');
    var ciphertext = pidCryptUtil.decodeBase64(crypted);
    if(ciphertext.indexOf('Salted__') != 0)
      pidcrypt.appendError('pidCrypt.AES.CBC.initFromCrypt: Sorry, unknown encryption method.\n');
    var salt = ciphertext.substr(8,8);//extract salt from crypted text
    options.salt = pidCryptUtil.convertToHex(salt);//salt is always hex string
    this.init(password,options);//call standard init
    ciphertext = ciphertext.substr(16);
    pidcrypt.setParams({decryptIn:pidCryptUtil.toByteArray(ciphertext)})
  }
/**
* Init CBC En-/Decryption from given parameters.
* @param  input: plain text or base64 encrypted text
* @param  key: HEX String (16, 24 or 32 byte)
* @param  iv: HEX String (16 byte)
* @param  options {
*           salt: array of bytes (8 byte),
*           nBits: aes bit size (128, 192 or 256)
*         }
*/
  pidCrypt.AES.CBC.prototype.initByValues = function(dataIn, key, iv, options){
    var pObj = {};
    this.init('',options);//empty password, we are setting key, iv manually
    pObj.dataIn = dataIn;
    pObj.key = key
    pObj.iv = iv
    this.pidcrypt.setParams(pObj)
  }

  pidCrypt.AES.CBC.prototype.getAllMessages = function(lnbrk){
    return this.pidcrypt.getAllMessages(lnbrk);
  }
/**
* Creates key of length nBits and an iv form password+salt
* compatible to openssl.
* See thread http://thedotnet.com/nntp/300307/showpost.aspx
*
* @param  pObj {
*    password: password as String
*    [salt]: salt as String, default 8 byte random salt
*    [bits]: no of bits, default pidCrypt.params.nBits = 256
* }
*
* @return         {iv: HEX String, key: HEX String}
*/
  pidCrypt.AES.CBC.prototype.createKeyAndIv = function(pObj){
    var pidcrypt = this.pidcrypt;
    var retObj = {};
    var count = 1;//openssl rounds
    var miter = "3";
    if(!pObj) pObj = {};
    if(!pObj.salt) {
      pObj.salt = pidcrypt.getRandomBytes(8);
      pObj.salt = pidCryptUtil.convertToHex(pidCryptUtil.byteArray2String(pObj.salt));
      pidcrypt.setParams({salt: pObj.salt});
    }
    var data00 = pObj.password + pidCryptUtil.convertFromHex(pObj.salt);
    var hashtarget = '';
    var result = '';
    var keymaterial = [];
    var loop = 0;
    keymaterial[loop++] = data00;
    for(var j=0; j<miter; j++){
      if(j == 0)
        result = data00;   	//initialize
      else {
        hashtarget = pidCryptUtil.convertFromHex(result);
        hashtarget += data00;
        result = hashtarget;
      }
      for(var c=0; c<count; c++){
        result = pidCrypt.MD5(result);
      }
      keymaterial[loop++] = result;
    }
    switch(pObj.bits){
      case 128://128 bit
        retObj.key = keymaterial[1];
        retObj.iv = keymaterial[2];
        break;
      case 192://192 bit
        retObj.key = keymaterial[1] + keymaterial[2].substr(0,16);
        retObj.iv = keymaterial[3];
        break;
      case 256://256 bit
        retObj.key = keymaterial[1] + keymaterial[2];
        retObj.iv = keymaterial[3];
        break;
       default:
         pidcrypt.appendError('pidCrypt.AES.CBC.createKeyAndIv: Sorry, only 128, 192 and 256 bits are supported.\nBits('+typeof(pObj.bits)+') = '+pObj.bits);
    }
    return retObj;
  }
/**
* Encrypt a text using AES encryption in CBC mode of operation
*  - see http://csrc.nist.gov/publications/nistpubs/800-38a/sp800-38a.pdf
*
* one of the pidCrypt.AES.CBC init funtions must be called before execution
*
* @param  byteArray: text to encrypt as array of bytes
*
* @return aes-cbc encrypted text
*/
  pidCrypt.AES.CBC.prototype.encryptRaw = function(byteArray) {
    var pidcrypt = this.pidcrypt;
    var aes = this.aes;
    var p = pidcrypt.getParams(); //get parameters for operation set by init
    if(!byteArray)
      byteArray = p.encryptIn;
    pidcrypt.setParams({encryptIn: byteArray});
    if(!p.dataIn) pidcrypt.setParams({dataIn:byteArray});
    var iv = pidCryptUtil.convertFromHex(p.iv);
    //PKCS5 paddding
    var charDiv = p.blockSize - ((byteArray.length+1) % p.blockSize);
    if(p.A0_PAD)
      byteArray[byteArray.length] = 10
    for(var c=0;c<charDiv;c++) byteArray[byteArray.length] = charDiv;
    var nBytes = Math.floor(p.nBits/8);  // nr of bytes in key
    var keyBytes = new Array(nBytes);
    var key = pidCryptUtil.convertFromHex(p.key);
    for (var i=0; i<nBytes; i++) {
      keyBytes[i] = isNaN(key.charCodeAt(i)) ? 0 : key.charCodeAt(i);
    }
    // generate key schedule
    var keySchedule = aes.expandKey(keyBytes);
    var blockCount = Math.ceil(byteArray.length/p.blockSize);
    var ciphertxt = new Array(blockCount);  // ciphertext as array of strings
    var textBlock = [];
    var state = pidCryptUtil.toByteArray(iv);
    for (var b=0; b<blockCount; b++) {
      // XOR last block and next data block, then encrypt that
      textBlock = byteArray.slice(b*p.blockSize, b*p.blockSize+p.blockSize);
      state = aes.xOr_Array(state, textBlock);
      state = aes.encrypt(state.slice(), keySchedule);  // -- encrypt block --
      ciphertxt[b] = pidCryptUtil.byteArray2String(state);
    }
    var ciphertext = ciphertxt.join('');
    pidcrypt.setParams({dataOut:ciphertext, encryptOut:ciphertext});

    //remove all parameters from enviroment for more security is debug off
    if(!pidcrypt.isDebug() && pidcrypt.clear) pidcrypt.clearParams();
   return ciphertext || '';
  }


/**
* Encrypt a text using AES encryption in CBC mode of operation
*  - see http://csrc.nist.gov/publications/nistpubs/800-38a/sp800-38a.pdf
*
* Unicode multi-byte character safe
*
* one of the pidCrypt.AES.CBC init funtions must be called before execution
*
* @param  plaintext: text to encrypt
*
* @return aes-cbc encrypted text openssl compatible
*/
 pidCrypt.AES.CBC.prototype.encrypt = function(plaintext) {
    var pidcrypt = this.pidcrypt;
    var salt = '';
    var p = pidcrypt.getParams(); //get parameters for operation set by init
    if(!plaintext)
      plaintext = p.dataIn;
    if(p.UTF8)
      plaintext = pidCryptUtil.encodeUTF8(plaintext);
    pidcrypt.setParams({dataIn:plaintext, encryptIn: pidCryptUtil.toByteArray(plaintext)});
    var ciphertext = this.encryptRaw()
    salt = 'Salted__' + pidCryptUtil.convertFromHex(p.salt);
    ciphertext = salt  + ciphertext;
    ciphertext = pidCryptUtil.encodeBase64(ciphertext);  // encode in base64
    pidcrypt.setParams({dataOut:ciphertext});
    //remove all parameters from enviroment for more security is debug off
    if(!pidcrypt.isDebug() && pidcrypt.clear) pidcrypt.clearParams();

    return ciphertext || '';
  }

/**
* Encrypt a text using AES encryption in CBC mode of operation
*  - see http://csrc.nist.gov/publications/nistpubs/800-38a/sp800-38a.pdf
*
* Unicode multi-byte character safe
*
* @param  dataIn: plain text
* @param  password: String
* @param  options {
*           nBits: aes bit size (128, 192 or 256)
*         }
*
* @param  plaintext: text to encrypt
*
* @return aes-cbc encrypted text openssl compatible
*
*/
  pidCrypt.AES.CBC.prototype.encryptText = function(dataIn,password,options) {
   this.initEncrypt(dataIn, password, options);
   return this.encrypt();
  }



/**
* Decrypt a text encrypted by AES in CBC mode of operation
*
* one of the pidCrypt.AES.CBC init funtions must be called before execution
*
* @param  byteArray: aes-cbc encrypted text as array of bytes
* 
* @return           decrypted text as String
*/
pidCrypt.AES.CBC.prototype.decryptRaw = function(byteArray) {
    var aes = this.aes;
    var pidcrypt = this.pidcrypt;
    var p = pidcrypt.getParams(); //get parameters for operation set by init
    if(!byteArray)
      byteArray = p.decryptIn;
    pidcrypt.setParams({decryptIn: byteArray});
    if(!p.dataIn) pidcrypt.setParams({dataIn:byteArray});
    if((p.iv.length/2)<p.blockSize)
      return pidcrypt.appendError('pidCrypt.AES.CBC.decrypt: Sorry, can not decrypt without complete set of parameters.\n Length of key,iv:'+p.key.length+','+p.iv.length);
    var iv = pidCryptUtil.convertFromHex(p.iv);
    if(byteArray.length%p.blockSize != 0)
      return pidcrypt.appendError('pidCrypt.AES.CBC.decrypt: Sorry, the encrypted text has the wrong length for aes-cbc mode\n Length of ciphertext:'+byteArray.length+byteArray.length%p.blockSize);
    var nBytes = Math.floor(p.nBits/8);  // nr of bytes in key
    var keyBytes = new Array(nBytes);
    var key = pidCryptUtil.convertFromHex(p.key);
    for (var i=0; i<nBytes; i++) {
      keyBytes[i] = isNaN(key.charCodeAt(i)) ? 0 : key.charCodeAt(i);
    }
    // generate key schedule
    var keySchedule = aes.expandKey(keyBytes);
    // separate byteArray into blocks
    var nBlocks = Math.ceil((byteArray.length) / p.blockSize);
    // plaintext will get generated block-by-block into array of block-length strings
    var plaintxt = new Array(nBlocks.length);
    var state = pidCryptUtil.toByteArray(iv);
    var ciphertextBlock = [];
    var dec_state = [];
    for (var b=0; b<nBlocks; b++) {
      ciphertextBlock = byteArray.slice(b*p.blockSize, b*p.blockSize+p.blockSize);
      dec_state = aes.decrypt(ciphertextBlock, keySchedule);  // decrypt ciphertext block
      plaintxt[b] = pidCryptUtil.byteArray2String(aes.xOr_Array(state, dec_state));
      state = ciphertextBlock.slice(); //save old ciphertext for next round
    }
    
    // join array of blocks into single plaintext string and return it
    var plaintext = plaintxt.join('');
    if(pidcrypt.isDebug()) pidcrypt.appendDebug('Padding after decryption:'+ pidCryptUtil.convertToHex(plaintext) + ':' + plaintext.length + '\n');
    var endByte = plaintext.charCodeAt(plaintext.length-1);
    //remove oppenssl A0 padding eg. 0A05050505
    if(p.A0_PAD){
        plaintext = plaintext.substr(0,plaintext.length-(endByte+1));
    }
    else {
      var div = plaintext.length - (plaintext.length-endByte);
      var firstPadByte = plaintext.charCodeAt(plaintext.length-endByte);
      if(endByte == firstPadByte && endByte == div)
        plaintext = plaintext.substr(0,plaintext.length-endByte);
    }
    pidcrypt.setParams({dataOut: plaintext,decryptOut: plaintext});

    //remove all parameters from enviroment for more security is debug off
    if(!pidcrypt.isDebug() && pidcrypt.clear) pidcrypt.clearParams();

   return plaintext || '';
  }

/**
* Decrypt a base64 encoded text encrypted by AES in CBC mode of operation
* and removes padding from decrypted text
*
* one of the pidCrypt.AES.CBC init funtions must be called before execution
*
* @param  ciphertext: base64 encoded and aes-cbc encrypted text
*
* @return           decrypted text as String
*/
  pidCrypt.AES.CBC.prototype.decrypt = function(ciphertext) {
    var pidcrypt = this.pidcrypt;
    var p = pidcrypt.getParams(); //get parameters for operation set by init
    if(ciphertext)
      pidcrypt.setParams({dataIn:ciphertext});
    if(!p.decryptIn) {
      var decryptIn = pidCryptUtil.decodeBase64(p.dataIn);
      if(decryptIn.indexOf('Salted__') == 0) decryptIn = decryptIn.substr(16);
      pidcrypt.setParams({decryptIn: pidCryptUtil.toByteArray(decryptIn)});
    }
    var plaintext = this.decryptRaw();
    if(p.UTF8)
      plaintext = pidCryptUtil.decodeUTF8(plaintext);  // decode from UTF8 back to Unicode multi-byte chars
    if(pidcrypt.isDebug()) pidcrypt.appendDebug('Removed Padding after decryption:'+ pidCryptUtil.convertToHex(plaintext) + ':' + plaintext.length + '\n');
    pidcrypt.setParams({dataOut:plaintext});

    //remove all parameters from enviroment for more security is debug off
    if(!pidcrypt.isDebug() && pidcrypt.clear) pidcrypt.clearParams();
    return plaintext || '';
  }

/**
* Decrypt a base64 encoded text encrypted by AES in CBC mode of operation
* and removes padding from decrypted text
*
* one of the pidCrypt.AES.CBC init funtions must be called before execution
*
* @param  dataIn: base64 encoded aes encrypted text
* @param  password: String
* @param  options {
*           nBits: aes bit size (128, 192 or 256),
*           UTF8: boolean, set to false when decrypting certificates,
*           A0_PAD: boolean, set to false when decrypting certificates
*         }
*
* @return           decrypted text as String
*/
   pidCrypt.AES.CBC.prototype.decryptText = function(dataIn, password, options) {
     this.initDecrypt(dataIn, password, options);
     return this.decrypt();
   }

}

