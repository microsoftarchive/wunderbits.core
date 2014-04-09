describe('forEach', function () {

  'use strict';

  var topic = require('lib/forEach');

  it('should be a function', function () {
    expect(topic).to.be.a('function');
  });

  describe('arrays', function () {

    var arr;
    beforeEach(function () {
      arr = ['a', 'b', 'c'];
    });

    it('should loop arrays', function () {

      var spy = sinon.spy();
      topic(arr, spy);

      expect(spy).to.have.been.calledWith('a', 0, arr);
      expect(spy).to.have.been.calledWith('b', 1, arr);
      expect(spy).to.have.been.calledWith('c', 2, arr);
    });

    it('should loop arrays with context', function () {

      var context = {};
      var spy = sinon.spy();
      topic(arr, spy, context);

      expect(spy).to.have.been.calledThrice;
      expect(spy).to.have.been.calledOn(context);
    });

    it('should stop looping if iterator returns false', function () {

      var spy = sinon.stub().returns(false);
      topic(arr, spy);

      expect(spy).to.have.been.calledOnce;
      expect(spy).to.have.not.been.calledThrice;
    });
  });

  describe('objects', function () {

    var obj;
    beforeEach(function () {
      obj = {
        'a': 8,
        'b': 7,
        'c': 6
      };
    });

    it('should loop objects', function () {

      var spy = sinon.spy();
      topic(obj, spy);

      expect(spy).to.have.been.calledWith(8, 'a');
      expect(spy).to.have.been.calledWith(7, 'b');
      expect(spy).to.have.been.calledWith(6, 'c');
    });

    it('should loop objects with context', function () {

      var context = {};
      var spy = sinon.spy();
      topic(obj, spy, context);

      expect(spy).to.have.been.calledThrice;
      expect(spy).to.have.been.calledOn(context);
    });

    it('should not properties from prototype', function () {

      var spy = sinon.spy();
      topic(Object.create(obj), spy);

      expect(spy).to.not.have.been.called;
      expect(spy).to.not.have.been.calledWith(8, 'a');
    });

    it('should stop looping if iterator returns false', function () {

      var spy = sinon.stub().returns(false);
      topic(obj, spy);

      expect(spy).to.have.been.calledOnce;
      expect(spy).to.have.not.been.calledThrice;
    });
  });

});
