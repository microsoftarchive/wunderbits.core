define([
  './merge',
  './extend'
], function (merge, extend, undefined) {

  'use strict';

  function mergeFromSuper (instance, key) {

    var constructor = instance.constructor;
    var proto = constructor.prototype;

    var baseData = {};
    if (instance.hasOwnProperty(key)) {
      baseData = instance[key];
    } else if (proto.hasOwnProperty(key)) {
      baseData = proto[key];
    }

    var _super = constructor && constructor.__super__;
    if (_super) {
      baseData = merge(mergeFromSuper(_super, key), baseData);
    }

    return extend({}, baseData);
  }

  function concatFromSuper (instance, key) {

    var constructor = instance.constructor;
    var proto = constructor.prototype;

    var baseData = [];
    if (instance.hasOwnProperty(key)) {
      baseData = instance[key];
    } else if (proto.hasOwnProperty(key)) {
      baseData = proto[key];
    }

    var _super = constructor && constructor.__super__;
    if (_super) {
      baseData = [].concat(concatFromSuper(_super, key), baseData);
    }

    return [].concat(baseData);
  }

  return {
    'merge': mergeFromSuper,
    'concat': concatFromSuper
  };

});