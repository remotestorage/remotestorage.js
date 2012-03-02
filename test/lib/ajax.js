//implementing $.ajax() like a poor man's jQuery:
      //////////
     // ajax //
    //////////

define({
  ajax: function(params) {
    ajaxCalls.push(params);
    if(ajaxResponses.length) {
      window.setTimeout(function() {
        var response = ajaxResponses.pop();
        if(response.success) {
          params.success(response.data);
        } else {
          params.error(response.err);
        }
      }, 10);
    } else {
      alert('ran out of responses!');
    }
  }
});
