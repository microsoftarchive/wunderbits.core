describe('When', function () {

  'use strict';

  var WBWhen, WBDeferred;

  beforeEach(function (done) {
    requirejs([
      'lib/When',
      'WBDeferred'
    ], function (When, deferred) {

      WBWhen = When;
      WBDeferred = deferred;
      done();
    });
  });

  describe('#when', function () {

    var when;
    beforeEach(function () {

      when = WBWhen.when;
    });

    it('should accept multiple deferreds as arguments', function () {

      var deferred1 = new WBDeferred();
      var deferred2 = new WBDeferred();
      var deferred3 = new WBDeferred();
      var spy = sinon.spy();

      when(deferred1, deferred2, deferred3).done(function () {
        spy();
      });

      spy.should.not.have.been.called;
    });

    it('should chain deferred methods', function () {

      var deferred1 = new WBDeferred();
      var deferred2 = new WBDeferred();
      var spy = sinon.spy();

      when(deferred1, deferred2).done(function () {
        spy();
      });

      deferred1.resolve();
      deferred2.resolve();

      spy.should.have.been.called;
    });

    it('should create a promise when no parameter is passed', function () {

      when().done(function(resolveValue) {
        expect(this).to.equal(window);
        expect(resolveValue).to.equal(undefined);
      }, this).promise;
    });

    it('should pass the context', function() {

      var context = {};
      var defer = new WBDeferred();

      when(defer.resolveWith(context)).done(function() {
        expect(this).to.equal(context);
      });
    });


    it('should call #then when the deferred is resolved or rejected', function () {

    });

    it('should call #done when the deferred is resolved', function () {

    });

    it('should call #fail when the deferred is rejected', function () {

    });
  });
});