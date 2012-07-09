
remoteStorage.defineModule('contacts', function(base) {

  var DEBUG = true;

  if(typeof(VCard) === 'undefined') {
    console.error("remoteStorage.contacts requires vCardJS from https://github.com/nilclass/vcardjs");
    return { version: '0.0', exports: {} };
  }

  // Copy over all properties from source to destination.
  // Return destination.
  function extend(destination, source) {
      var keys = Object.keys(source);
      for(var i=0;i<keys.length;i++) {
          var key = keys[i];
          destination[key] = source[key];
      }
      return destination;
  }

  function bindContext(cb, context) {
    if(! context) {
      return cb;
    }
    return function() { return cb.apply(context, arguments); };
  }

  var debug = DEBUG ? bindContext(console.log, console) : function() {};

  /**
   ** The Contact class.
   **/
  var Contact = function() {
    VCard.apply(this, arguments);
  }

  Contact.prototype = extend({
    isNew: true,

    save: function() {
      this.validate();

      if(this.errors && this.errors.length > 0) {
        return false;
      } else {
        base.storeObject('vcard', this.uid, this.toJCard());
        this.markSaved();
        return true;
      }
    },

    markSaved: function() {
      this.isNew = false;
      // attribute defined & used in vCardJS
      this.changed = false;
      return this;
    }

  }, VCard.prototype);

  /**
   ** THE CONTACTS MODULE
   **/

  var contacts = {
    
    /**
     ** NAMESPACE
     **/
    
    Contact: Contact,
    
    /**
     ** PUBLIC METHODS
     **/

    list: function(limit, offset) {
      var list = base.getListing('');
      if(! offset) {
        offset = 0;
      }
      if(! limit) {
        limit = list.length - offset;
      }

      for(var i=0;i<limit;i++) {
        list[i + offset] = this.get(list[i + offset]);
      }
      return list;
    },

    // Get a Contact instance based on it's UID.
    get: function(uid, cb, context) {
      if(cb) {
        base.getObject(uid, function(data) {
          bindContext(cb, context)(this._load(data));
        }, this);
      } else {
        return this._load(base.getObject(uid));
      }
    },

    build: function(attributes) {
      return this._wrap(attributes);
    },

    create: function(attributes) {
      var instance = this.build(attributes);
      instance.save();
      return instance;
    },

    filter: function(cb, context) {
      // this is highly ineffective. go fix it!
      var list = this.list();
      var results = [];
      var item;
      for(var i=0;i<list.length;i++) {
        item = bindContext(cb, context)(list[i]);
        if(item) {
          results.push(item)
        }
      }
      return results;
    },

    search: function(filter) {
      var keys = Object.keys(filter);

      return this.filter(function(item) {
        for(var i=0;i<keys.length;i++) {
          var k = keys[i], v = filter[k];
          debug('check ', k, ' == ', v, ' in ', item, '(', item[k], ')');
          if(typeof(v) === 'string' && v.length === 0) {
            continue;
          } else if(v instanceof RegExp) {
            if(! v.test(item[k])) {
              return false;
            }
          } else if(item[k] !== v) {
            return false;
          }
        }
        debug('success');
        return item;
      }, this);
    },

    /**
     ** PRIVATE METHODS
     **/

    // _wrap given data and mark as saved.
    _load: function(data) {
      return this._wrap(data).markSaved();
    },

    // return given data as a Contact instance.
    // do nothing, if it's already a contact.
    _wrap: function(data) {
      return(data instanceof Contact ? data : new Contact(data));
    }

    
  };
  
  return {
    
    version: '0.1',
    
    exports: contacts
  }
});
