define(function () {

  'use strict';

  function assert (condition, message) {
    if (!condition) {
      throw new Error(message || '');
    }
  }

  var nativeIsArray = Array.isArray;
  assert.empty = function (object, message) {
    var keys = nativeIsArray(object) ? object : Object.keys(object);
    assert(keys.length === 0, message);
  };

  assert.array = function (array, message) {
    assert(nativeIsArray(array), message);
  };

  var types = [
    'undefined',
    'boolean',
    'number',
    'string',
    'function',
    'object'
  ];

  function typecheck (type) {
    assert[type] = function (o, message) {
      assert(typeof o === type, message);
    };
  }

  while (types.length) {
    typecheck(types.shift());
  }

  return assert;
});