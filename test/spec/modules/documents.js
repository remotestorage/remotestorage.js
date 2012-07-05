(function() {
  describe("documents", function() {
    it("should get a private list", function() {
      var list = modules.documents.exports.getPrivateList('a');
      expect(typeof(list.add)).toEqual('function');
      expect(typeof(list.getContent)).toEqual('function');
      expect(typeof(list.getIds)).toEqual('function');
      expect(typeof(list.getTitle)).toEqual('function');
      expect(typeof(list.on)).toEqual('function');
      expect(typeof(list.setContent)).toEqual('function');
    });
  });
})();
