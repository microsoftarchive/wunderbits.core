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

  var chrome = global.chrome;
  var localStorage = chrome && chrome.storage && chrome.storage.local;

  return WBClass.extend({

    'getItem': function (key) {

      var deferred = new WBDeferred();

      localStorage.get(key, function (data) {

        if (chrome.runtime.lastError) {
          deferred.reject(chrome.runtime.lastError);
        }
        else {
          var value = data[key];
          deferred.resolve(value);
        }
      });

      return deferred.promise();
    },

    'setItem': function (key, value) {

      var deferred = new WBDeferred();

      var data = {};
      data[key] = value;

      localStorage.set(data, function () {

        if (chrome.runtime.lastError) {
          deferred.reject(chrome.runtime.lastError);
        }
        else {
          deferred.resolve();
        }
      });

      return deferred.promise();
    },

    'removeItem': function (key) {

      var deferred = new WBDeferred();

      localStorage.remove(key, function () {

        if (chrome.runtime.lastError) {
          deferred.reject(chrome.runtime.lastError);
        }
        else {
          deferred.resolve();
        }
      });

      return deferred.promis();
    },

    'clear': function () {

      var deferred = new WBDeferred();

      localStorage.clear(function () {

        if (chrome.runtime.lastError) {
          deferred.reject(chrome.runtime.lastError);
        }
        else {
          deferred.resolve();
        }
      });

      return deferred.promise();
    }
  });
});