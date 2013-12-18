define(function () {

  'use strict';

  var nativeIsArray = Array.isArray;

  function cloneArray (arr) {
    return arr.slice();
  }

  function cloneObject (source) {
    var object = {};
    for (var key in source) {
      if (source.hasOwnProperty(key)) {
        object[key] = source[key];
      }
    }
    return object;
  }

  function clone (obj) {

    if (nativeIsArray(obj)) {
      return cloneArray(obj);
    }

    return cloneObject(obj);
  }

  return clone;

});