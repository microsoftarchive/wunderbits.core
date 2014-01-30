define([

  '../WBMixin',
  '../WBDeferred',
  '../When',

  '../lib/forEach',
  '../lib/delay',
  '../lib/defer'

], function (
  WBMixin, WBDeferred, When,
  forEach, delay, defer,
  undefined
) {

  'use strict';

  var arrRef = [];

  return WBMixin.extend({

    'deferred': function () {
      var self = this;
      return new WBDeferred(self);
    },

    'when': function () {
      var self = this;
      return When.when.apply(self, arguments);
    },

    'defer': function () {
      var args = arrRef.slice.call(arguments);
      args[1] = args[1] || this;
      return defer.apply(null, args);
    },

    'delay': function () {
      var args = arrRef.slice.call(arguments);
      var context = (args[2] = args[2] || this);
      var fn = args[0];
      (typeof fn === 'string') && (args[0] = context[fn]);
      return delay.apply(null, args);
    },

    'forEach': function (collection, fn, context) {
      var self = this;
      context = context || self;
      (typeof fn === 'string') && (fn = self[fn]);
      forEach(collection, fn, context);
    }
  });
});