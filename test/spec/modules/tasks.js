(function() {
  describe("tasks", function() {
    it("should get a private list", function() {
      var list = specHelper.getModule('tasks').exports.getPrivateList('a');
      expect(typeof(list.add)).toEqual('function');
      expect(typeof(list.get)).toEqual('function');
      expect(typeof(list.getIds)).toEqual('function');
      expect(typeof(list.getStats)).toEqual('function');
      expect(typeof(list.markCompleted)).toEqual('function');
      expect(typeof(list.on)).toEqual('function');
      expect(typeof(list.remove)).toEqual('function');
      expect(typeof(list.set)).toEqual('function');
    });
  });
})();
