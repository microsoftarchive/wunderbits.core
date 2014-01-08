define([
  './WBSingleton',
  './WBDeferred'
], function (WBSingleton, WBDeferred) {

  'use strict';

  var arrayRef = [];

  return WBSingleton.extend({

    'when': function() {

      var self = this;
      var resolvedCount = 0;
      // the deferred that must be completed to satisfy the promise
      var requirements = arrayRef.slice.call(arguments);
      var remaining = requirements.length;

      // the main deferred
      var deferred = new WBDeferred();

      for(; resolvedCount < remaining; resolvedCount++) {

        var thisDeferred = requirements[resolvedCount];
        var state = thisDeferred.state();

        if (thisDeferred && typeof thisDeferred.promise === 'function') {

          thisDeferred.done(function () {
            --remaining;
            if (!remaining) {
              deferred.resolve();
            }
          });
          if (state === 'pending') {

          } else if (state === 'rejected') {
            deferred.reject();
            --remaining;
          } else if (state === 'resolved') {
            deferred.resolveWith(self, thisDeferred);
            --remaining;
          }
        }
        else {
          --remaining;
        }
      }

      if (!remaining) {

        deferred.resolveWith(self);
      }

      return deferred.promise();
    }
  });
});