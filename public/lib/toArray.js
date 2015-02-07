'use strict';

function getAllocatedArray (arrLength) {

  arrLength = arrLength > 0 ? arrLength : 0;
  return new Array(arrLength);
}

function toArray (arrayLikeObj, skip) {

  var localSkip = skip || 0;
  var length = arrayLikeObj.length;
  var arr = getAllocatedArray(length - localSkip);

  for (var i = localSkip; i < length; i++) {
    arr[i - localSkip] = arrayLikeObj[i];
  }

  return arr;
}

module.exports = toArray;