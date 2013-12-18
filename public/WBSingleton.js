define([

  './lib/extend',
  './lib/createUID',
  './WBEvents',
  './WBClass'

], function (extend, createUID, WBEvents, WBClass, undefined) {

  'use strict';

  var WBSingleton = WBClass.extend({
    'initialize': function () {
      throw new Error('Cannot create instance of singleton class');
    }
  });

  function applyMixins (mixins, instance) {
    var mixin;
    while (mixins.length) {
      mixin = mixins.shift();
      if (typeof mixin.applyTo === 'function') {
        mixin.applyTo(instance);
      }
    }
  }

  WBSingleton.extend = function (staticProps) {

    staticProps = staticProps || {};

    // create a new instance
    var singleton = new WBClass();

    // extend from the base singleton
    var BaseSingleton = this || WBSingleton;
    extend(singleton, BaseSingleton);

    // extract mixins
    var mixins = staticProps.mixins || [];
    staticProps.mixins = undefined;

    // apply mixins to the instance
    applyMixins(mixins, singleton);

    // make the singleton an EventEmitter
    extend(singleton, WBEvents, staticProps);

    // make the singleton extendable
    // Do this after applying mixins,
    // to ensure that no mixin can override `extend` method
    singleton.extend = WBSingleton.extend;

    // every signleton gets a UID
    singleton.uid = createUID();

    return singleton;
  };

  return WBSingleton;
});