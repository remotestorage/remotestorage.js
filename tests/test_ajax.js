define(['../ajax'], function(ajax) {
  function timeOut() {
    timestamp = new Date().getTime();
    var url = 'http://'+timestamp+'.time_me_out.asdfasdfasdf.at';
    ajax.ajax({
      url: url,
      success: function(data) {
        console.log("FAIL: timeOut succeeded. Is "+url+" a valid domain these days?");
      },
      error: function(data) {
        console.log("FAIL: timeOut erred out. Is "+url+" a 404 these days?");
      },
      timeout: function() {
        console.log("Success: timeOut timed out. Just what we wanted.");
      },
      time: 1000
    });
  }

  function errOut() {
    var url = 'http://unhosted.org/404_here';
    ajax.ajax({
      url: url,
      success: function(data) {
        console.log("FAIL: errOut succeeded. Is "+url+" responding with a 20? these days?");
      },
      error: function(data) {
        console.log("Success: errOut erred out.");
      },
      timeout: function() {
        console.log("FAIL: errOut timed out. So we can't get to "+url+"?");
      }
    });
  }

  function succeed() {
    var url = 'http://unhosted.org';
    ajax.ajax({
      url: url,
      success: function(data) {
        console.log("Success: succeed succeeded.");
      },
      error: function(data) {
        console.log("FAIL: succeed erred out. - Can't get to"+url+".");
      },
      timeout: function() {
        console.log("FAIL: succeed timed out. - Can't get to"+url+".");
      }
    });
  }

  return {
    timeOut: timeOut,
    errOut: errOut,
    succeed: succeed
  }
});
