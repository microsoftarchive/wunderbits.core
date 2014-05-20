'use strict';

function toArray (arrayLikeObj, skip) {

  skip = skip || 0;

  var length = arrayLikeObj.length;
  var arrLength = length - skip;
  var arr = new Array(arrLength > 0 ? arrLength : 0);

  for (var i = skip; i < length; i++) {
    arr[i - skip] = arrayLikeObj[i];
  }

  return arr;
}

module.exports = toArray;