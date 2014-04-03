'use strict';

var forEach = require('../lib/forEach');
var WBMixin = require('../WBMixin');

function noop () {}

function Call (fn) {
  var self = this;
  (typeof fn === 'string') && (fn = self[fn]);
  (typeof fn === 'function') && fn.call(self);
}

var cleanupMethods = ['unbind', 'unbindAll', 'onDestroy'];

var WBDestroyableMixin = WBMixin.extend({

  'destroy': function () {

    var self = this;

    self.trigger('destroy');

    // clean up
    forEach(cleanupMethods, Call, self);

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

module.exports = WBDestroyableMixin;
