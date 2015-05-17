describe('WBUtilsMixin', function () {

  'use strict';

  var WBUtilsMixin = require('mixins/WBUtilsMixin');

  var instance, context;
  beforeEach(function () {
    instance = {
      'id': 'instanceId'
    };

    context = {
      'id': 'providedContext'
    };

    WBUtilsMixin.applyTo(instance);
  });

  describe('#deferred', function () {

    it('should return a deferred', function () {
      var deferred = instance.deferred();
      deferred.state().should.be.equal('pending');
      deferred.resolve();
      deferred.state().should.be.equal('resolved');
    });

    describe('.done', function () {

      describe('given that a context is passed', function () {

        it('should execute the callback with provided context as this', function (done) {

          var deferred = instance.deferred();
          deferred.done(function () {

            expect(this.id).to.equal('providedContext');
            done();
          }, context);

          deferred.resolve();
        });
      });

      describe('given that no context is passed', function () {

        it('should execute the callback with provided context as this', function (done) {

          var deferred = instance.deferred();
          deferred.done(function () {

            expect(this.id).to.equal('instanceId');
            done();
          });

          deferred.resolve();
        });
      });
    });

    describe('.fail', function () {

      describe('given that a context is passed', function () {

        it('should execute the callback with provided context as this', function (done) {

          var deferred = instance.deferred();
          deferred.fail(function () {

            expect(this.id).to.equal('providedContext');
            done();
          }, context);

          deferred.reject();
        });
      });

      describe('given that no context is passed', function () {

        it('should execute the callback with provided context as this', function (done) {

          var deferred = instance.deferred();
          deferred.fail(function () {

            expect(this.id).to.equal('instanceId');
            done();
          });

          deferred.reject();
        });
      });
    });
  });

  describe('#when', function () {

    it('should proxy $.when', function () {

      var deferred1 = instance.deferred();
      var deferred2 = instance.deferred();
      var deferred3 = instance.deferred().reject();
      // var deferred4 = instance.deferred().resolve();
      // var deferred5 = instance.deferred().resolve();

      instance.when(deferred1, deferred2).state().should.be.equal('pending');
      instance.when(deferred2, deferred3).state().should.be.equal('rejected');
      // instance.when(deferred3, deferred4).state().should.be.equal('rejected');
      // instance.when(deferred1, deferred5).state().should.be.equal('pending');
      // instance.when(deferred4, deferred5).state().should.be.equal('resolved');
    });
  });

  describe('#defer', function () {

    describe('given that no context is passed', function () {

      it('should execute the callback with self as this', function (done) {

        var callback = function () {
          expect(this.id).to.equal('instanceId');
          done();
        };

        instance.defer(callback);
      });
    });

    describe('given that a context is passed', function () {

      it('should execute the callback with the provided context as this', function (done) {

        var callback = function () {

          expect(this.id).to.equal('providedContext');
          done();
        };

        instance.defer(callback, context);
      });
    });
  });

  describe('#delay', function () {
    it('should execute the function after the said delay', function(done) {

      var time = (new Date()).getTime();
      var callback = function() {

        var timeDiff = (new Date()).getTime() - time;
        expect(timeDiff).to.be.greaterThan(8); //because browsers can be imprecise
        done();
      };

      instance.delay(callback, 10, context);
    });

    it('should resolve a function name string to the function on self', function(done) {

      instance.callback = function() {
        done();
      };

      instance.delay('callback', 1, context);
    });

    it('should default to self for context, if no context is passed', function(done) {

      var callback = function() {

        expect(this.id).to.equal('instanceId');
        done();
      };

      instance.delay(callback, 1);
    });
  });

  describe('#defer', function () {
    it('should execute the function in the next event loop', function(done) {

      var primaryExecutionCompleted  = false;
      var callback = function() {

        expect(primaryExecutionCompleted).to.be.true;
        done();
      };

      instance.defer(callback, context);
      primaryExecutionCompleted = true;
    });

    it('should resolve a function name string to the function on self', function(done) {

      instance.callback = function() {
        done();
      };

      instance.defer('callback', context);
    });

    it('should default to self for context, if no context is passed', function(done) {

      var callback = function() {

        expect(this.id).to.equal('instanceId');
        done();
      };

      instance.defer(callback);
    });
  });
});
