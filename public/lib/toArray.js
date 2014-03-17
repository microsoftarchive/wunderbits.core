define(function () {

  'use strict';

  var slice = Array.prototype.slice;
  return function toArray (obj, skip) {
    return slice.call(obj, skip || 0);
  };
});