describe('lib/delay', function () {

  'use strict';

  var topic = require('lib/delay');

  it('should be a function', function () {
    expect(topic).to.be.a('function');
  });

  it ('should call callback if no context supplied', function (done) {

    var spy = sinon.spy();

    topic(spy, 10);

    setTimeout(function () {

      expect(spy).to.have.been.calledOnce;
      done();
    }, 20);
  });

  it('should call callback if not context not flagged as destroyed', function (done) {

    var spy = sinon.spy();

    var context = {

      'delay': topic,
      'destroyed': false,
      'fn': function () {
        spy();
      }
    };

    context.delay(context.fn, 10, context);

    setTimeout(function () {

      expect(spy).to.have.been.calledOnce;
      done();
    }, 20);
  });

  it('should not callback if context is flagged as destroyed', function (done) {

    var spy = sinon.spy();

    var context = {

      'delay': topic,
      'destroyed': true,
      'fn': function () {
        spy();
      }
    };

    context.delay(context.fn, 10, context);

    setTimeout(function () {

      expect(spy).to.not.have.been.called;
      done();
    }, 20);
  });
});