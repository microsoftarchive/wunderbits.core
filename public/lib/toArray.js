'use strict';

function getAllocatedArray (arrLength) {

  arrLength = arrLength > 0 ? arrLength : 0;
  return new Array(arrLength);
}

function toArray (arrayLikeObj, skip) {

  skip = skip || 0;

  var length = arrayLikeObj.length;
  var arr = getAllocatedArray(length - skip);

  for (var i = skip; i < length; i++) {
    arr[i - skip] = arrayLikeObj[i];
  }

  return arr;
}

module.exports = toArray;