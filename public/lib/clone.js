define(function () {

  'use strict';

  var nativeIsArray = Array.isArray;

  function cloneArray (arr) {
    return arr.slice();
  }

  function cloneDate (date) {
    return new Date(date);
  }

  function cloneObject (source) {
    var object = {};
    for (var key in source) {
      if (source.hasOwnProperty(key)) {
        var value = source[key];
        if (value instanceof Date) {
          object[key] = cloneDate(value);
        } else if (typeof value === 'object' && value !== null) {
          object[key] = clone(value);
        } else {
          object[key] = value;
        }
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