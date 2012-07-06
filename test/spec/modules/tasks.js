(function() {
  describe("tasks", function() {
    it("should get a private list", function() {
      var list = module.exports.getPrivateList('a');
      expect(list).toEqual('a');
    });
  });
})();
