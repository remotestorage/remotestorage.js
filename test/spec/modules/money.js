(function() {
  describe("money", function() {
    it("should have the right functions", function() {
      var module = specHelper.getModule('money').exports;
      expect(typeof(module.addDeclaration)).toEqual('function');
      expect(typeof(module.addIOU)).toEqual('function');
      expect(typeof(module.getBalances2)).toEqual('function');
      expect(typeof(module.groupPayment)).toEqual('function');
      expect(typeof(module.reportTransfer)).toEqual('function');
      expect(typeof(module.setBalance)).toEqual('function');
    });
  });
})();
