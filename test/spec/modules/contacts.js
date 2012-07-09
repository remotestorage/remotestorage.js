
(function() {

  var fakeCallback = {
    cb: function() { this.args = arguments }
  }

  describe('contacts module', function() {

    var version, contacts, privateClient;

    beforeEach(function() {
      var module = specHelper.getModule('contacts');
      version = module.version;
      contacts = module.exports;

      privateClient = specHelper.getPrivateBaseClient('contacts').reset();
    });

    afterEach(function() {
      localStorage.clear();
    });

    it('has reached the golden lands of version 0.1', function() {
      expect(version).toBe('0.1');
    });

    describe('Contact model', function() {
      var instance;

      beforeEach(function() {
        instance = new contacts.Contact({fn: 'Alice'});
      });

      it("applies given attributes", function() {
        expect(instance.fn).toEqual('Alice');
      });

      describe('markSaved', function() {
        var result;

        beforeEach(function() {
          result = instance.markSaved();
        });

        it('is chainable', function() {
          expect(result).toBe(instance);
        });

        it('toggles #isNew off', function() {
          expect(instance.isNew).toBe(false);
        });

        it('toggles #changed off', function() {
          expect(instance.changed).toBe(false);
        });
      });

    });
    
    describe('get', function() {
      var fixture, result;

      beforeEach(function() {
        fixture = contacts.build({fn: "foo"});
	fixture.validate(); // generates UID and REV
	privateClient.setResponses([fixture.toJCard()]);
        result = contacts.get(fixture.uid)
      });

      it('returns a Contact instance', function() {
        expect(result instanceof contacts.Contact).toBe(true);
      });

      it('retrieves the correct attributes', function() { 
        expect(
          result.toJCard()
        ).toEqual(
          fixture.toJCard()
        );
      });

      it('calls getObject on the private base client', function() {
	expect(privateClient.getCalled()).toEqual([{
	  name: 'getObject',
	  params: [fixture.uid]
	}]);
      });

    });

    describe('create', function() {
      var fixture, result;

      beforeEach(function() {
        fixture = {
          fn: "Alice",
          email: {
            type: "internet",
            value: "alice@wonderland.lit"
          }
        };
        result = contacts.create(fixture);
      });

      it('returns a new Contact', function() {
        expect(result instanceof contacts.Contact).toBe(true);
      });

      it('applies the given attributes in a valid way', function() {
        expect(result.fn).toEqual(fixture.fn);

        expect(result.email instanceof Array).toBe(true);
        expect(result.email.length).toEqual(1);
        expect(result.email[0]).toEqual(fixture.email);
      });

      it('generates a UID and REV attribute', function() {
        expect('uid' in result).toBe(true)
        expect('rev' in result).toBe(true);
      });

      it('calls storeObject', function() {
	var called = privateClient.getCalled();
	expect(called.length).toEqual(1);
	expect(called[0].name).toEqual('storeObject');
	expect(called[0].params[0]).toEqual('vcard');
	expect(called[0].params[1]).toEqual(result.uid);
	expect(called[0].params[2]).toEqual(result.toJCard());
      });
    });

    describe('list', function() {
      var fixtures, result;

      beforeEach(function() {
        fixtures = [
          contacts.build({ fn: "Bob Bathtub" }),
          contacts.build({ fn: "Alice" }),
        ];
	fixtures[0].validate();
	fixtures[1].validate();
	privateClient.setResponses([
	  [fixtures[0].uid,fixtures[1].uid],
	  fixtures[0].toJCard(),
	  fixtures[1].toJCard()
	]);
        result = contacts.list();
      });

      it('calls getListing', function() {
	var called = privateClient.getCalled();
	expect(called[0].name).toEqual('getListing');
      });

      it('calls getObject twice', function() {
	var called = privateClient.getCalled();
	expect(called[1]).toEqual({
	  name: 'getObject',
	  params: [fixtures[0].uid]
	});
	expect(called[2]).toEqual({
	  name: 'getObject',
	  params: [fixtures[1].uid]
	});
      });

      it('returns all contacts', function() {
        expect(result.length).toBe(2);
      });

      it('wraps them accordingly', function() {
        expect(result[0] instanceof contacts.Contact).toBe(true);
        expect(result[1] instanceof contacts.Contact).toBe(true);
      });

      it('applies the given attributes', function() {
        expect(result[0].fn).toEqual('Bob Bathtub');
      });
    });

    describe('search', function() {
      var fixtures, result;

      beforeEach(function() {
        fixtures = [
          contacts.build({
            fn: "Alice",
            email: { type: 'internet', value: 'alice@wonderland.lit' }
          }),
          contacts.build({ fn: "Bob Bathtub" }),
        ];
	fixtures[0].validate();
	fixtures[1].validate();
	privateClient.setResponses([
	  [fixtures[0].uid, fixtures[1].uid],
	  fixtures[0].toJCard(),
	  fixtures[1].toJCard()
	]);
      });

      it("finds contacts based on their full FN", function() {
        result = contacts.search({ fn: "Alice" });
        expect(result.length).toEqual(1);
        expect(result[0].fn).toEqual('Alice');
      });

      it("understands regular expressions", function() {
        result = contacts.search({ fn: /ob B/ });
        expect(result.length).toEqual(1);
        expect(result[0].fn).toEqual('Bob Bathtub');
      });

      it("recognizes the empty string as a wildcard search", function() {
        result = contacts.search({ fn: '' });
        expect(result.length).toEqual(2);
      });

      it("works for full objects", function() { // PENDING
        // result = contacts.search({ email: [fixtures[0].email[0]] });
        // expect(result.length).toEqual(1);
      });

    });

  });

})();
