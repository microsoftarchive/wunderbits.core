define([
  './WBSingleton',
  './WBDeferred'
], function (WBSingleton, WBDeferred) {

  'use strict';

  var arrayRef = [];

  var self = WBSingleton.extend({

    'when': function() {

      var resolvedCount = 0;
      // the deferred that must be completed to satisfy the promise
      var requirements = arrayRef.slice.call(arguments);
      var remaining = requirements.length;
      // the main deferred
      var deferred = new WBDeferred();
      for(; resolvedCount < remaining; resolvedCount++) {

        var thisDeferred = requirements[resolvedCount];
        if (thisDeferred && typeof thisDeferred.promise === 'function') {

          thisDeferred.done(function () {
            var args = arrayRef.slice.call(arguments);
            --remaining;
            if (!remaining) {
              deferred.resolveWith(this, args);
            }
          });

          thisDeferred.fail(deferred.reject, deferred);
        }
        else {
          --remaining;
        }
      }

      if (!remaining) {
        deferred.resolve();
      }

      return deferred.promise();
    }
  });

  return self;
});