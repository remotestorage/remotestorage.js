    // Add character replacement
    String.prototype.replaceAt = function(index, char) {
      return this.substr(0, index) + char + this.substr(index+char.length);
    }
  
    // Set initial positions (blank board)
    var positions = '0000000000000000000000000000000000000000000000000000000000000000';
    // Set variables for each piece
    var pieces = {
      'R':'<div class="R white piece"><div class="tl l"></div><div class="tl r"></div><div class="base c"></div></div>',      
      'P':'<div class="P white piece"><div class="top"></div><div class="base"></div>',
      'B':'<div class="B white piece"><div class="scale"><div class="top"></div></div><div class="base"></div>',
      'N':'<div class="N white piece"><div class="ear"></div><div class="nose"></div><div class="body"></div><div class="base"></div>',
      'Q':'<div class="Q white piece"><div class="crown c1"></div><div class="crown c2"></div><div class="crown c3"></div><div class="base"></div>',
      'K':'<div class="K white piece"><div class="vert"></div><div class="horz"></div><div class="base"></div></div>',
      'r':'<div class="R black piece"><div class="tl l"></div><div class="tl r"></div><div class="base c"></div></div>',
      'p':'<div class="P black piece"><div class="top"></div><div class="base"></div>',
      'b':'<div class="B black piece"><div class="scale"><div class="top"></div></div><div class="base"></div>',
      'n':'<div class="N black piece"><div class="ear"></div><div class="nose"></div><div class="body"></div><div class="base"></div>',
      'q':'<div class="Q black piece"><div class="crown c1"></div><div class="crown c2"></div><div class="crown c3"></div><div class="base"></div>',
      'k':'<div class="K black piece"><div class="vert"></div><div class="horz"></div><div class="base"></div></div>'
    };
    
    // Create Set Board Function
    // This function should go through and set up the board according to a 64-byte string. Uppercase is white, lowercase is black, and 0 is a blank square.
    var set_board = function (newPositions) {
      for (i = 0; i < 64; i++) {
        $('.square'+i).empty();
        $('.square'+i).append(pieces[newPositions[i]]);
      }
      positions = newPositions;
      $('#positions').val(positions);
      localStorage.setItem('positions',positions);
    };
    
    $(document).ready(function() {
    
      // Resize board to fit screen
      if (window.innerHeight < window.innerWidth) {
        var size = window.innerHeight;
      } else {
        var size = window.innerWidth;
      }
      var ratio = size / 700;
      $('#boardEdge').css('zoom',ratio);
    
      // Populate Board
      var row = '<i><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b></i>';
      for (i = 0; i < 8; i++) {
        $('#board').append(row);
      }
      $('b').addClass(function(i) {
        return 'sq square' + i;
      });
      // Set up the board
      if (localStorage.getItem('positions')) {
        set_board(localStorage.getItem('positions'));
      } else {
        set_board('rnbqkbnrpppppppp00000000000000000000000000000000PPPPPPPPRNBQKBNR');
      }
      
      // Allow pieces to be moved
      var activeIndex = -1;
      var activePiece = '';
      $('.sq').click(function() {
        var newIndex = $('.sq').index($(this));
        if (activeIndex < 0 && activePiece === '') {
          // If no piece is active, make current square active unless it is empty
          var piece = positions[newIndex];
          if (piece !== '0') {
            $(this).addClass('active');
            activeIndex = $('.sq').index($(this));
            activePiece = positions[activeIndex];
          }
        } else {
          // Some piece is active, so take the current piece and move it here
          positions = positions.replaceAt(activeIndex,'0');
          positions = positions.replaceAt(newIndex,activePiece);
          // Redraw board
          set_board(positions);
          // Reset active
          activeIndex = -1;
          activePiece = '';
          $('.sq').removeClass('active'); 
        }
      });
      
      // Allow toggles for info boxes
      $('.btn span').click(function () {
        $(this).parent().find('.info').toggleClass('none');
      });
      
      // Allow for adding pieces, clearing board
      $('.pieces').click(function() {
        activeIndex = 100;
        activePiece = this.classList[1];
      });
      $('#clear').click(function () {
        set_board('0000000000000000000000000000000000000000000000000000000000000000');
      });
      
    });
    