define([

  './lib/extend',
  './lib/clone',
  './WBSingleton'

], function (extend, clone, WBSingleton, undefined) {

  'use strict';

  var WBMixin = WBSingleton.extend({

    // Apply the mixin to an instance of a class
    'applyTo': function (instance) {

      var behavior = clone(this.Behavior);

      // apply mixin's initialize & remove it from the instance
      var initializer;
      if (typeof behavior.initialize === 'function') {
        initializer = behavior.initialize;
        delete behavior.initialize;
      }

      // mixin the behavior
      extend(instance, behavior);

      // apply the initializer, if any
      initializer && initializer.apply(instance);

      return instance;
    },

    // Apply the mixin to the class directly
    'applyToClass': function (klass) {

      var proto = klass.prototype;
      if (!proto || proto.constructor !== klass) {
        throw new Error('applyToClass expects a class');
      }

      var behavior = clone(this.Behavior);

      // cache the mixin's initializer, to be applied later
      var initialize = behavior.initialize;
      if (typeof initialize === 'function') {
        var initializers = proto.initializers = proto.initializers || [];
        initializers.push(initialize);
        delete behavior.initialize;
      }

      // extend the prototype
      extend(proto, behavior);

      return klass;
    }
  });

  // The only real change from a simple singleton is
  // the altered extend class method, which will save
  // "mixinProps" into a specific member, for easy
  // and clean application using #applyTo
  WBMixin.extend = function (mixinProps, staticProps) {

    mixinProps || (mixinProps = {});
    staticProps || (staticProps = {});

    var current = clone(this.Behavior);
    staticProps.Behavior = extend(current, mixinProps);
    var mixin = WBSingleton.extend.call(this, staticProps);

    mixin.extend = WBMixin.extend;

    return mixin;
  };

  return WBMixin;
});