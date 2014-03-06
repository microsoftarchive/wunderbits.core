define([

  '../WBMixin',
  '../lib/fromSuper',
  '../lib/clone'

], function (
  WBMixin,
  fromSuper, clone,
  undefined
) {

  'use strict';

  return WBMixin.extend({

    'initialize': function () {

      var self = this;

      var events, target, handlers;
      var observesHash = fromSuper.merge(self, 'observes');

      for (target in observesHash) {
        events = observesHash[target];
        target = self.resolveTarget(target);

        for (var key in events) {
          handlers = events[key];
          if (typeof handlers === 'string') {
            handlers = [handlers];
          } else {
            handlers = clone(handlers);
          }

          while (handlers.length) {
            self.bindTo(target, key, handlers.shift());
          }
        }
      }
    },

    'resolveTarget': function (key) {

      var self = this;
      var target = self[key];

      if (!target && typeof key === 'string' && key.indexOf('.') > -1) {
        key = key.split('.');
        target = self;
        while (key.length && target) {
          target = target[key.shift()];
        }
      }

      return target;
    }

  });
});