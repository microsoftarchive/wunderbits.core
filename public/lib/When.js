define([
  'WBSingleton',
  'WBDeferred'
], function (WBSingleton, WBDeferred) {

  'use strict';

  var arrayRef = [];

  return WBSingleton.extend({

    'when': function(requirement) {

      var resolvedCount = 0;
      // the deferred that must be completed to satisfy the promise
      var requirements = arrayRef.slice.call(arguments);
      var len = requirements.length;

      // the main deferred
      var deferred = new WBDeferred();
      var remaining = resolvedCount !== 1 || (requirement && typeof requirement.promise === 'function') ? resolvedCount : 0;


      for(; resolvedCount < len; resolvedCount++) {


      }


      if (!remaining) {

        deferred.resolve();
      }

      return deferred.promise();
    }
  });
});