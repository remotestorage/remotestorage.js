
/**
 ** Skeleton for new modules
 **/

define(['../remoteStorage', 'modules/deps/vcardjs-0.2'], function(remoteStorage, vCardJS) {
  var moduleName = "contacts";

  var VCard = vCardJS.VCard, VCF = vCardJS.VCF;

  remoteStorage.defineModule(moduleName, function(base) {

    var DEBUG = true;

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

    var contacts = {};

    // Copy over all properties from source to destination.
    // Return destination.
    function extend() {
      var destination = arguments[0], source;
      for(var i=1;i<arguments.length;i++) {
        source = arguments[i];
        var keys = Object.keys(source);
        for(var j=0;j<keys.length;j++) {
          var key = keys[j];
          destination[key] = source[key];
        }
      }
      return destination;
    }


    var bindContext = (
      ( (typeof (function() {}).bind === 'function') ?
        // native version
        function(cb, context) { return cb.bind(context); } :
        // custom version
        function(cb, context) {
          return function() { return cb.apply(context, arguments); }
        } )
    );

    var debug = DEBUG ? bindContext(console.log, console) : function() {};

    var nodePrototype = {

      isNew: true,

      markSaved: function() {
        this.isNew = false;
        return this;
      },

      save: function() {
        this.validate();

        if(this.errors && this.errors.length > 0) {
          return false;
        } else {
          base.storeObject('vcard+' + this.kind, this.uid, this.toJCard());
          this.markSaved();
          return true;
        }
      },
    }

    /**
     ** The Contact class.
     **/
    var Contact = function() {
      VCard.apply(this, arguments);
      this.setAttribute('kind', 'individual');
    }

    extend(Contact.prototype, nodePrototype, VCard.prototype, {
    });

    /**
     ** The Group class.
     **/

    var Group = function(name) {
      VCard.apply(this, arguments);
      this.setAttribute('kind', 'group');
    }

    extend(Group.prototype, nodePrototype, {

      getMembers: function() {
        var members = [];
        for(var i=0;i<this.member.length;i++) {
          members.push(this.lookupMember(member[i]));
        }
        return members;
      },

      // resolve a URI to a contact an return it.
      lookupMember: function(uri) {
        var md = uri.match(/^([^:]):(.*)$/), scheme = md[1], rest = md[2];
        var key;
        switch(scheme) {
          // URN and UUID directly resolve to the contact's key.
          // if they don't, there is nothing we can do about it.
        case 'urn':
        case 'uuid':
          return contacts.get(uri);
        case 'mailto':
        case 'xmpp':
        case 'sip':
        case 'tel':
          var query = {};
          query[{
            mailto: 'email',
            xmpp: 'impp',
            sip: 'impp',
            tel: 'tel'
          }[scheme]] = rest;
          var results = contacts.search(query);
          if(results.length > 0) {
            return results[0];
          }
          if(scheme == 'tel') {
            break; // no fallback for TEL
          }
          // fallback for MAILTO, XMPP, SIP schems is webfinger:
        case 'acct':
          console.error("FIXME: implement contact-lookup via webfinger!");
          break;
          // HTTP could resolve to a foaf profile, a vcard, a jcard...
        case 'http':
          console.error("FIXME: implement contact-lookup via HTTP!");
          break;
        default:
          console.error("FIXME: unknown URI scheme " + scheme);
        }
        return undefined;
      }

    });

    /**
     ** THE CONTACTS MODULE
     **/

    extend(contacts, {
      /**
       ** NAMESPACE
       **/

      Contact: Contact,

      /**
       ** PUBLIC METHODS
       **/

      on: function(eventType, callback) {
        base.on(eventType, function(event) {
          if(event.oldValue) {
            event.oldValue = new Contact(event.oldValue);
          }
          if(event.newValue) {
            event.newValue = new Contact(event.newValue);
          }
          callback(event);
        });
      },

      sync: function() {
        debug("contacts.sync()");
        base.sync('/');
      },

      list: function(limit, offset) {
        var list = base.getListing('');
        if(! offset) {
          offset = 0;
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
          return this.searchMatch(item, filter, keys);
        }, this);
      },

      searchMatch: function(item, filter, filterKeys) {
        if(! filterKeys) {
          filterKeys = Object.keys(filter);
        }

        var check = function(value, ref) {
          if(value instanceof Array) {
            // multiples, such as MEMBER, EMAIL, TEL
            for(var i=0;i<value.length;i++) {
              check(value[i], ref);
            }
          } else if(typeof value === 'object' && value.value) {
            // compounds, such as EMAIL, TEL, IMPP
            check(value.value, ref);
          } else {
            if(typeof(ref) === 'string' && ref.length === 0) {
              return true; // the empty string always matches
            } else if(ref instanceof RegExp) {
              if(! ref.test(value)) {
                return false;
              }
            } else if(value !== ref) {
              // equality is fallback.
              return false;
            }
          }
        }

        return this.filter(function(item) {
          for(var i=0;i<keys.length;i++) {
            var k = keys[i], v = filter[k];
            if(! check(item[k], v)) {
              return false;
            }
          }
          debug('success');
          return item;
        });
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

    });


    return {
      name: moduleName,

      dataHints: {
      },

      exports: contacts
    }
  });


  return remoteStorage[moduleName];

});
