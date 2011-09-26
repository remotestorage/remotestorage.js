

var goCrypto = function() {
	if(document.getElementById('pwd2').type=="hidden") {
		unhosted.setCryptoPwd(
			document.getElementById('pwd1').value,
			function() {//callback in case this is the first time
				document.getElementById('pwd2').type="password";
				alert('repeat the same password to use it for the first time, please');
			},
			function() {
				alert('oops');
			},
			function() {
				document.getElementById('pwd1').type = "hidden"; 
				document.getElementById('goCrypto').type = "hidden"; 
				start();
			});
	} else {
		if (document.getElementById('pwd1').value == document.getElementById('pwd2').value) {
			unhosted.setCryptoPwd(
				document.getElementById('pwd1').value,
				null,
				function() {
					alert('oops');
				},
				function() {
					document.getElementById('pwd1').type = "hidden"; 
					document.getElementById('pwd2').type = "hidden"; 
					document.getElementById('goCrypto').type = "hidden"; 
				});
		} else {
			alert("passwords don't match!");
		}
	}
}
