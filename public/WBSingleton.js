define([

  './lib/extend',
  './lib/createUID',
  './WBEvents'

], function (extend, createUID, WBEvents, undefined) {

  'use strict';

  function applyMixins (mixins, instance) {
    var mixin;
    while (mixins.length) {
      mixin = mixins.shift();
      (typeof mixin.applyTo === 'function') &&
        mixin.applyTo(instance);
    }
  }

  function extendSelf (staticProps) {
    /* jshint validthis:true */

    staticProps = staticProps || {};

    // extend from the base singleton
    var BaseSingleton = this || WBSingleton;

    // create a new instance
    Ctor.prototype = BaseSingleton;
    var singleton = new Ctor();

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
    singleton.extend = extendSelf;

    // every signleton gets a UID
    singleton.uid = createUID();

    return singleton;
  }

  var Ctor = function () {};
  Ctor.prototype = {
    'extend': extendSelf
  };

  var WBSingleton = new Ctor();
  return WBSingleton;
});