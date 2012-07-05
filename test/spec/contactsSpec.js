
(function() {

  var fakeCallback = {
    cb: function() { this.args = arguments }
  }

  describe('contacts module', function() {

    var version, contacts;

    beforeEach(function() {
      version = remoteStorage.loadModule('contacts', 'rw');
      contacts = remoteStorage.contacts;
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
        fixture.save();
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
    });

    describe('list', function() {
      var fixtures, result;

      beforeEach(function() {
        fixtures = [
          contacts.create({ fn: "Bob Bathtub" }),
          contacts.create({ fn: "Alice" }),
        ];
        result = contacts.list();
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
          contacts.create({
            fn: "Alice",
            email: { type: 'internet', value: 'alice@wonderland.lit' }
          }),
          contacts.create({ fn: "Bob Bathtub" }),
        ];
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
