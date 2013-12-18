define(function () {

  'use strict';

  function clone (source) {

    var object = {};

    for (var key in source) {
      if (source.hasOwnProperty(key)) {
        object[key] = source[key];
      }
    }

    return object;
  }

  return clone;

});