define(function () {

  'use strict';

  return function merge (object, source) {

    for (var key in source) {
      if (source.hasOwnProperty(key)) {
        object[key] = source[key];
      }
    }

    return object;
  };
});