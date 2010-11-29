
/*  /_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/
	charset= shift_jis
	
    [RFC 3174] US Secure Hash Algorithm 1 (SHA1)
    ftp://ftp.isi.edu/in-notes/rfc3174.txt

    LastModified : 2006-11/14
    
    Written by kerry
    http://user1.matsumoto.ne.jp/~goma/

    動作ブラウザ :: IE4+ , NN4.06+ , Gecko , Opera6
    
    ----------------------------------------------------------------
    
    Usage
    
    // 返り値を 16進数で得る
    sha1hash = sha1.hex( data );
	
	// 返り値をバイナリで得る
    sha1bin = sha1.bin( data );
    
    // 返り値を10進数の配列で得る
    sha1decs = sha1.dec( data );
    
    
	* data		-> ハッシュ値を得たいデータ
				data はアンパック済みの配列でも可能

	// e.g.
	
	var data_1 = "abc";
	var hash_1 = sha1.hex( data_1 );
	var data_2 = sha1 Array(data_1.charCodeAt(0), data_1.charCodeAt(1), data_1.charCodeAt(2));
	var hash_2 = sha1.hex( data_2 );
	
	alert( hash_1 === hash_2 ); // true
	
/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/_/   */


sha1 = new function()
{
	var blockLen = 64;
	var state = [ 0x67452301 , 0xefcdab89 , 0x98badcfe , 0x10325476 , 0xc3d2e1f0 ];
	var sttLen = state.length;
	
	this.hex = function(_data)
	{
		return toHex( getMD(_data) );
	}

	this.dec = function(_data)
	{
		return getMD(_data);
	}
	
	this.bin = function(_data)
	{
		return pack( getMD(_data) );
	}
	
	var getMD = function(_data)
	{
		var datz = [];
		if (isAry(_data)) datz = _data;
		else if (isStr(_data)) datz = unpack(_data);
		else "unknown type";
		datz = paddingData(datz);
		return round(datz);
	}
    
    var isAry = function(_ary)
	{
		return _ary && _ary.constructor === [].constructor;
	}
	var isStr = function(_str)
	{
		return typeof(_str) == typeof("string");
	}

    var rotl = function(_v, _s) { return (_v << _s) | (_v >>> (32 - _s)) };

	var round = function(_blk)
	{
		var stt = [];
		var tmpS= [];
		var i, j, tmp, x = [];
		for (j=0; j<sttLen; j++) stt[j] = state[j];
		
		for (i=0; i<_blk.length; i+=blockLen)
		{
			for (j=0; j<sttLen; j++) tmpS[j] = stt[j];
			x = toBigEndian32( _blk.slice(i, i+ blockLen) );
			for (j=16; j<80; j++)
            	x[j] = rotl(x[j-3] ^ x[j-8] ^ x[j-14] ^ x[j-16], 1);
		
	        for (j=0; j<80; j++)
	        {
	     		if (j<20) 
	                tmp = ((stt[1] & stt[2]) ^ (~stt[1] & stt[3])) + K[0];
	            else if (j<40)
	                tmp = (stt[1] ^ stt[2] ^ stt[3]) + K[1];
	            else if (j<60)
	                tmp = ((stt[1] & stt[2]) ^ (stt[1] & stt[3]) ^ (stt[2] & stt[3])) + K[2];
	            else
	                tmp = (stt[1] ^ stt[2] ^ stt[3]) + K[3];

	            tmp += rotl(stt[0], 5) + x[j] + stt[4];
	            stt[4] = stt[3];
	            stt[3] = stt[2];
	            stt[2] = rotl(stt[1], 30);
	            stt[1] = stt[0];
	            stt[0] = tmp;
	        }
			for (j=0; j<sttLen; j++) stt[j] += tmpS[j];
		}

		return fromBigEndian32(stt);
	}

	var paddingData = function(_datz)
	{
		var datLen = _datz.length;
		var n = datLen;
		_datz[n++] = 0x80;
		while (n% blockLen != 56) _datz[n++] = 0;
		datLen *= 8;
		return _datz.concat(0, 0, 0, 0, fromBigEndian32([datLen]) );
	}

	var toHex = function(_decz)
	{
		var i, hex = "";

		for (i=0; i<_decz.length; i++)
			hex += (_decz[i]>0xf?"":"0")+ _decz[i].toString(16);
		return hex;
	}
	
	var fromBigEndian32 = function(_blk)
	{
		var tmp = [];
		for (n=i=0; i<_blk.length; i++)
		{
			tmp[n++] = (_blk[i] >>> 24) & 0xff;
			tmp[n++] = (_blk[i] >>> 16) & 0xff;
			tmp[n++] = (_blk[i] >>>  8) & 0xff;
			tmp[n++] = _blk[i] & 0xff;
		}
		return tmp;
	}
	
	var toBigEndian32 = function(_blk)
	{
		var tmp = [];
		var i, n;
		for (n=i=0; i<_blk.length; i+=4, n++)
			tmp[n] = (_blk[i]<<24) | (_blk[i+ 1]<<16) | (_blk[i+ 2]<<8) | _blk[i+ 3];
		return tmp;
	}
	
	var unpack = function(_dat)
	{
		var i, n, c, tmp = [];

	    for (n=i=0; i<_dat.length; i++) 
	    {
	    	c = _dat.charCodeAt(i);
			if (c <= 0xff) tmp[n++] = c;
			else {
				tmp[n++] = c >>> 8;
				tmp[n++] = c &  0xff;
			}	
	    }
	    return tmp;
	}

	var pack = function(_ary)
    {
        var i, tmp = "";
        for (i in _ary) tmp += String.fromCharCode(_ary[i]);
        return tmp;
    }

	var K = [ 0x5a827999 , 0x6ed9eba1 , 0x8f1bbcdc , 0xca62c1d6 ];

}


