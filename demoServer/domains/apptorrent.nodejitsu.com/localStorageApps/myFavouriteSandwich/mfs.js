function onsave() {
  var sandwich = { ingredients: [ document.getElementById('firstIngredient').value
                                , document.getElementById('secondIngredient').value
                                ]
                 }
  localStorage.setItem('favSandwich', JSON.stringify(sandwich))
  show()
}

function show() {
  var sandwich = JSON.parse(localStorage.getItem('favSandwich'))
  if(sandwich) {
    document.getElementById('firstIngredient').value = sandwich.ingredients[0]
    document.getElementById('secondIngredient').value = sandwich.ingredients[1]
    for(var i=0;i < 2; i++) {
      if(!(sandwich.ingredients[i])) {
        sandwich.ingredients[i]='...'
      }
    }
    document.getElementById('showIngredients').innerHTML = 'My favourite sandwich has <strong>'
      +sandwich.ingredients[0]
      +'</strong> and <strong>'
      +sandwich.ingredients[1]
      +'</strong> on it';
  } else {
    document.getElementById('showIngredients').innerHTML = 'My favourite sandwich has'
    document.getElementById('firstIngredient').value = ''
    document.getElementById('secondIngredient').value = ''
  }
}
