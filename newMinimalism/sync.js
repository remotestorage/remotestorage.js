exports.sync = (function() {
  function pushRevision(timestamp) {
    console.log('pushing revision '+timestamp);
  }
  return {
    pushRevision: pushRevision
  };
})();
