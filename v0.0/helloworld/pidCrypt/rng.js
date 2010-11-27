//  Author: Tom Wu
//  tjw@cs.Stanford.EDU
// Random number generator - requires a PRNG backend, e.g. prng4.js

// For best results, put code like
// <body onClick='rng_seed_time();' onKeyPress='rng_seed_time();'>
// in your main HTML document.

function SecureRandom() {
  this.rng_state;
  this.rng_pool;
  this.rng_pptr;


    // Mix in a 32-bit integer into the pool
    this.rng_seed_int = function(x) {
      this.rng_pool[this.rng_pptr++] ^= x & 255;
      this.rng_pool[this.rng_pptr++] ^= (x >> 8) & 255;
      this.rng_pool[this.rng_pptr++] ^= (x >> 16) & 255;
      this.rng_pool[this.rng_pptr++] ^= (x >> 24) & 255;
      if(this.rng_pptr >= rng_psize) this.rng_pptr -= rng_psize;
    }

    // Mix in the current time (w/milliseconds) into the pool
    this.rng_seed_time = function() {
      this.rng_seed_int(new Date().getTime());
    }

    // Initialize the pool with junk if needed.
    if(this.rng_pool == null) {
      this.rng_pool = new Array();
      this.rng_pptr = 0;
      var t;
      if(navigator.appName == "Netscape" && navigator.appVersion < "5" && window.crypto) {
        // Extract entropy (256 bits) from NS4 RNG if available
        var z = window.crypto.random(32);
        for(t = 0; t < z.length; ++t)
          this.rng_pool[this.rng_pptr++] = z.charCodeAt(t) & 255;
      }
      while(this.rng_pptr < rng_psize) {  // extract some randomness from Math.random()
        t = Math.floor(65536 * Math.random());
        this.rng_pool[this.rng_pptr++] = t >>> 8;
        this.rng_pool[this.rng_pptr++] = t & 255;
      }
      this.rng_pptr = 0;
      this.rng_seed_time();
      //this.rng_seed_int(window.screenX);
      //this.rng_seed_int(window.screenY);
    }

    this.rng_get_byte = function() {
      if(this.rng_state == null) {
       this.rng_seed_time();
        this.rng_state = prng_newstate();
        this.rng_state.init(this.rng_pool);
        for(this.rng_pptr = 0; this.rng_pptr < this.rng_pool.length; ++this.rng_pptr)
          this.rng_pool[this.rng_pptr] = 0;
        this.rng_pptr = 0;
        //this.rng_pool = null;
      }
      // TODO: allow reseeding after first request
      return this.rng_state.next();
    }
    
    //public function
    this.nextBytes = function(ba) {
      var i;
      for(i = 0; i < ba.length; ++i) ba[i] = this.rng_get_byte();
    }
}



