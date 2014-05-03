describe('WBLogger', function () {

  'use strict';

  var WBLogger = require('WBLogger');

  afterEach(function () {

    WBLogger.release();
  });

  describe('constructor', function () {

    it ('should cache logger instances by namespace', function () {

      var logger1 = new WBLogger('boom');
      var logger2 = new WBLogger('boom');
      var logger3 = new WBLogger('new-boom');

      expect(logger1).to.equal(logger2);
      expect(logger1).to.not.equal(logger3);
    });
  });
});