(function() {
  beforeEach(function() {
    sinonXhr = sinon.useFakeXMLHttpRequest();
    sinonRequests = [];
    sinonXhr.onCreate = function (xhr) {
      sinonRequests.push(xhr);
    };
  });
  afterEach(function() {
    sinonXhr.restore();
  });
})();
