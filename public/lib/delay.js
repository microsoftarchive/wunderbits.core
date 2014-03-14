define([
  './toArray'
], function (
  toArray
) {

  'use strict';

  return function delay (fn, time, context) {
    var args = toArray(arguments, 3);
    return setTimeout(function () {
      !context.destroyed && fn.apply(context, args);
    }, time);
  };
});