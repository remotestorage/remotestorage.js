/*
 * Edit distance calculation. Taken from https://github.com/cfq/levenshtein.js
 * (license not mentioned, so I assume public domain)
 */
define([], function() {
  function levenshtein( first, second ){
    var d = [],
    flen = first.length,
    slen = second.length;

    for( i = 0; i <= flen; i++ ){
      d[i] = d[i] ? d[i] : [];
      d[i][0] = i;
    }

    for( j = 0; j <= slen; j++ ){
      d[0][j] = d[0][j] ? d[0][j] : [];
      d[0][j] = j;
    }

    for( j = 1; j <= slen; j++ ){
      for( i = 1; i <= flen; i++ ){
        if( first[i-1] == second[j-1] ){
          d[i][j] = d[i-1][j-1];
        } else {
          d[i][j] = Math.min(
            d[i-1][j] + 1,
            d[i][j-1] + 1,
            d[i-1][j-1] + 2
          );
        }
      }
    }

    return d[flen][slen];
  }

  return levenshtein;
});
