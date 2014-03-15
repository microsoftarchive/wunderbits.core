define([
  '../lib/forEach',
  '../WBMixin'
], function (forEach, WBMixin, undefined) {

  'use strict';

  function noop () {}

  function Call (fn) {
    var self = this;
    (typeof fn === 'string') && (fn = self[fn]);
    (typeof fn === 'function') && fn.call(self);
  }

  var cleanupMethods = ['unbind', 'unbindAll', 'onDestroy'];

  return WBMixin.extend({

    'destroy': function () {

      var self = this;

      // clean up
      forEach(cleanupMethods, Call, self);

      self.trigger('destroy');

      self.destroyObject(self);

      self.destroyed = true;
    },

    'destroyObject': function (object) {

      var self = this;
      for (var key in object) {
        self.destroyKey(key, object);
      }
    },

    'destroyKey': function (key, context) {

      if (context.hasOwnProperty(key) && key !== 'uid' && key !== 'cid') {
        // make functions noop
        if (typeof context[key] === 'function') {
          context[key] = noop;
        }
        // and others undefined
        else {
          context[key] = undefined;
        }
      }
    }
  });
});