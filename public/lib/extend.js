define([
  './toArray',
  './assert',
  './merge'
], function (toArray, assert, merge) {

  'use strict';

  return function extend () {

    // convert the argument list into an array
    var args = toArray(arguments);

    // validate input
    assert(args.length > 0, 'extend expect one or more objects');

    // loop through the arguments
    // & merging them recursively
    var object = args.shift();
    while (args.length) {
      merge(object, args.shift());
    }

    return object;
  };
});