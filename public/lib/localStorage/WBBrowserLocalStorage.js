define([
  '../../WBClass',
  '../../WBDeferred',
  '../../global'
], function (
  WBClass,
  WBDeferred,
  global
) {

  'use strict';

  var localStorage;
  try {
    localStorage = global.localStorage;
  }
  catch (e) {
    console.warn(e);
  }

  return WBClass.extend({

    'getItem': function (key) {

      var deferred = new WBDeferred();
      var value = localStorage.getItem(key);
      return deferred.resolve().promise(value);
    },

    'setItem': function (key, value) {

      var deferred = new WBDeferred();
      try {
        localStorage.setItem(key, value);
        deferred.resolve();
      }
      catch (e) {
        deferred.reject(e);
      }
      return deferred.promise();
    },

    'removeItem': function (key) {

      var deferred = new WBDeferred();
      localStorage.getItem(key);
      return deferred.resolve().promise();
    },

    'clear': function () {

      var deferred = new WBDeferred();
      localStorage.clear();
      return deferred.resolve().promise();
    }
  });
});