describe('WBLogger', function () {

  'use strict';

  var WBLogger = require('WBLogger');

  var notStrings = [0, undefined, null, /foo|bar/, function () {}, {}];

  afterEach(function () {

    WBLogger.release();
    WBLogger.pattern = undefined;
  });

  describe('constructor', function () {

    it ('should cache logger instances by namespace', function () {

      var logger1 = new WBLogger('boom');
      var logger2 = new WBLogger('boom');
      var logger3 = new WBLogger('new-boom');

      expect(logger1).to.equal(logger2);
      expect(logger1).to.not.equal(logger3);
    });

    it ('should throw if namespace is not a string', function () {

      notStrings.forEach(function (namespace) {

        expect(function () {

          new WBLogger(namespace);
        }).to.throw();
      });
    });

    it ('should not throw if namespace is a string', function () {

      expect(function () {

        new WBLogger('test');
      }).to.not.throw('namespace must be a string');
    });
  });

  describe('.log', function () {

    it ('should throw if regexPatternString is not a string', function () {

      notStrings.forEach(function (notAString) {

        expect(function () {

          WBLogger.log(notAString);
        }).to.throw('regexPatternString must be a string');
      });
    });

    it ('should set WBLogger.pattern to a regular expression object', function () {

      var patternString = 'foo|bar';
      var expectedToString = '/foo|bar/';

      WBLogger.log(patternString);
      expect(WBLogger.pattern).to.be.instanceOf(RegExp);
      expect(WBLogger.pattern.toString()).to.equal(expectedToString);
    });

    it ('should convert \'*\' to an all string matching regex pattern', function () {

      var patternString = '*';
      var expectedToString = '/.?/';

      WBLogger.log(patternString);
      expect(WBLogger.pattern).to.be.instanceOf(RegExp);
      expect(WBLogger.pattern.toString()).to.equal(expectedToString);
    });
  });

  describe('#shouldRun', function () {

    it ('should return false if WBLogger.pattern is undefined', function () {

      var logger = new WBLogger('test');
      WBLogger.pattern = undefined;
      expect(logger.shouldRun()).to.be.false;
    });

    it ('should return true if WBLogger.pattern matches instance namespace', function () {

      var logger = new WBLogger('test');
      WBLogger.log('test');
      expect(logger.shouldRun()).to.be.true;
    });

    it ('should return false if WBLogger.pattern does not match instance namespace', function () {

      var logger = new WBLogger('test');
      WBLogger.log('foo');
      expect(logger.shouldRun()).to.be.false;
    });
  });

  describe('Instance Integration Tests', function () {

    describe('#log', function () {

      it ('should run if WBLogger is setup for the instance namespace', function () {

        var logSpy = sinon.spy(console, 'log');
        var logger = new WBLogger('test');
        WBLogger.log('test');

        logger.log('foobar');

        expect(logSpy).to.have.been.calledOnce;
        logSpy.restore();
      });

      it ('should not run if WBLogger is not setup for the instance namespace', function () {

        var logSpy = sinon.spy(console, 'log');
        var logger = new WBLogger('test');
        WBLogger.log('foo');

        logger.log('foobar');

        expect(logSpy).to.not.have.been.calledOnce;
        logSpy.restore();
      });
    });
  });
});