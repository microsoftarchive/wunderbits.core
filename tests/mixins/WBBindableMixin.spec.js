describe('WBBindableMixin', function () {

  'use strict';

  var createUID = require('lib/createUID');
  var WBEventsMixin = require('mixins/WBEventsMixin');
  var WBBindableMixin = require('mixins/WBBindableMixin');

  var topic, topic2, model, model2;

  beforeEach(function () {

    model = {
      'uid': createUID()
    };

    model2 = {
      'uid': createUID()
    };

    topic = {
      'uid': createUID()
    };

    topic2 = {
      'uid': createUID()
    };

    WBEventsMixin.applyTo(model);
    WBEventsMixin.applyTo(model2);
    WBEventsMixin.applyTo(topic);
    WBEventsMixin.applyTo(topic2);
    WBBindableMixin.applyTo(topic);
    WBBindableMixin.applyTo(topic2);
  });

  describe('#callbackFactory', function () {

    it ('should take an anonymouse callback function and context and ' +
        'return a callback that always executes with the correct context', function () {

      var spy = sinon.spy();
      var obj = {
        'func': spy
      };

      var callback = topic.callbackFactory(function () {

        this.func();
      }, obj);
      callback();

      spy.should.have.been.calledOnce;
      spy.should.have.been.calledOn(obj);
    });

    it ('should take a string as a callback method name on context ' +
        'and return a callback that executes with the correct context', function () {

      var spy = sinon.spy();
      var obj = {
        'func': spy
      };

      var callback = topic.callbackFactory('func', obj);
      callback();

      spy.should.have.been.calledOnce;
      spy.should.have.been.calledOn(obj);
    });
  });

  describe('#bindTo', function () {

    it('should throw error if called without target', function () {

      var fn = function () {
        topic.bindTo();
      };

      fn.should.throw('Cannot bind to undefined target or target without #on');
    });

    it('should throw error if called without event name', function () {

      var fn = function () {
        topic.bindTo(model);
      };

      fn.should.throw('Cannot bind to target event without event name');
    });

    it('should throw error if called without callback', function () {

      var fn = function () {
        topic.bindTo(model, 'event');
      };

      fn.should.throw('Cannot bind to target event without a function or method name as callback');
    });

    it ('should throw error if called with a method name as callback ' +
        'and method does not exist for context', function () {

      var fn = function () {
        topic.bindTo(model, 'event', 'sdflksjdflksdjflskdjflskdfj');
      };

      fn.should.throw('Cannot bind to target using a method name that does not exist for the context');
    });

    it('should throw error if called with a mothod name as callback does not exist for the context', function () {

      var fn = function () {
        topic.bindTo(model, 'event', 'sdlfksdjflksjdflkj');
        fn.should.throw('Cannot bind to target using a method name that does not exist for the context');
      };
    });

    it('should return binding object', function () {

      var callback = function () {};
      var binding = topic.bindTo(model, 'custom', callback);

      binding.should.be.a('object');
      binding.uid.should.be.a('string');
      binding.target.should.equal(model);
      binding.event.should.equal('custom');
      binding.callback.should.equal(callback);
    });

    it('should actually bind callback to target event', function () {

      var callback = sinon.spy();
      topic.bindTo(model, 'custom', callback);
      model.trigger('custom');

      callback.should.have.been.calledOnce;
    });

    it('should actually bind method name callback to target event and call callback with provided context', function (done) {

      var obj = {
        'id': 'myLittlePony'
      };

      obj.callback = function () {

        expect(this.id).to.equal('myLittlePony');
        done();
      };

      topic.bindTo(model, 'custom', 'callback', obj);
      model.trigger('custom');
    });

    it('should actually bind method name callback to target event and call callback with default context', function (done) {

      topic.id = 'iAmAHappyCamper';

      topic.callback = function () {

        expect(this.id).to.equal('iAmAHappyCamper');
        done();
      };

      topic.bindTo(model, 'custom', 'callback');
      model.trigger('custom');
    });

    it('should store the binding in a private map', function () {

      var callback = function () {};
      var binding = topic.bindTo(model, 'custom', callback);

      topic._bindings.should.be.a('object');
      topic._bindings.should.include.keys(binding.uid);
      topic._bindings[binding.uid].should.equal(binding);
    });

    it('should not unbind other listeners with the same event name and callback but a different context', function () {

      var callback = function () {
        var self = this;
        ++self.counter;
      };

      topic.counter = 0;
      topic2.counter = 0;

      topic.bindTo(model, 'someEvent', callback);
      topic2.bindTo(model, 'someEvent', callback);

      model.trigger('someEvent');

      topic2.unbindAll();

      model.trigger('someEvent');

      expect(topic.counter).to.equal(2);
      expect(topic2.counter).to.equal(1);
    });

    describe('given that the same callback is bound more than once', function () {

      it('should actually only bind the callback once', function () {

        var callback = sinon.spy();

        topic.bindTo(model, 'justone', callback);
        topic.bindTo(model, 'justone', callback);

        model.trigger('justone');

        expect(callback).to.have.been.calledOnce;

        var callback2 = sinon.spy();
        var obj = {};
        obj.callback = callback2;

        topic.bindTo(model, 'justonename', 'callback', obj);
        topic.bindTo(model, 'justonename', 'callback', obj);

        model.trigger('justonename');

        expect(obj.callback).to.have.been.calledOnce;

      });

      it('should return the same binding object', function () {

        var callback = sinon.spy();

        var binding1 = topic.bindTo(model, 'justone', callback);
        var binding2 = topic.bindTo(model, 'justone', callback);

        expect(binding1.uid).to.equal(binding2.uid);

        var callback2 = sinon.spy();
        var obj = {};
        obj.callback = callback2;

        var binding3 = topic.bindTo(model, 'justone', 'callback', obj);
        var binding4 = topic.bindTo(model, 'justone', 'callback', obj);

        expect(binding3.uid).to.equal(binding4.uid);
      });
    });

    describe('given that the same callback is passed for two different events', function () {

      it('should actually bind each callback', function () {

        var callback = sinon.spy();

        topic.bindTo(model, 'eve1', callback);
        topic.bindTo(model, 'eve2', callback);

        model.trigger('eve1');
        model.trigger('eve2');
        expect(callback).to.have.been.calledTwice;
      });
    });

    describe('given that the same callback is passed for two different targets', function () {

      it('should actually bind each callback', function () {

        var callback = sinon.spy();

        topic.bindTo(model, 'evex', callback);
        topic.bindTo(model2, 'evex', callback);

        model.trigger('evex');
        model2.trigger('evex');
        expect(callback).to.have.been.calledTwice;
      });
    });

    describe('given that the target apears to be a jquery object', function () {

      it ('it should use #callbackFactory to generate a wrapped callback that executes', function () {

        var spy = sinon.spy(topic, 'callbackFactory');
        var on = function () {};
        var target = {
          'constructor': {
            'fn': {
              'on': on
            }
          }
        };
        target.on = on;

        topic.bindTo(target, 'foobar', function () {});

        spy.should.have.been.calledOnce;

        topic.callbackFactory.restore();
      });
    });
  });

  describe('#bindOnceTo', function () {

    it('should return binding object', function () {

      var callback = function () {};
      var binding = topic.bindOnceTo(model, 'custom', callback);

      binding.should.be.a('object');
      binding.uid.should.be.a('string');
      binding.target.should.equal(model);
      binding.event.should.equal('custom');
      binding.callback.should.be.a('function');
    });

    it('should actually bind callback to target event', function () {

      var callback = sinon.spy();
      topic.bindOnceTo(model, 'custom', callback);
      model.trigger('custom');

      callback.should.have.been.calledOnce;
    });

    it('should only allow trigger of callback once', function () {

      var callback = sinon.spy();
      topic.bindOnceTo(model, 'custom', callback);
      model.trigger('custom').trigger('custom');

      callback.should.have.been.calledOnce;
    });

    it('should use #unbindFrom to unbind binding after first trigger', function () {

      var callback = function () {};
      topic.unbindFrom = sinon.spy();

      var binding = topic.bindOnceTo(model, 'customOnce', callback);
      model.trigger('customOnce');

      topic.unbindFrom.should.have.been.calledOnce;
      topic.unbindFrom.should.have.been.calledWith(binding);
    });

    describe('given that the same callback is bound more than once', function () {

      it('should actually only bind the callback once', function () {

        var callback = sinon.spy();

        topic.bindOnceTo(model, 'justone', callback);
        topic.bindOnceTo(model, 'justone', callback);

        model.trigger('justone');
        expect(callback).to.have.been.calledOnce;

        var callback2 = sinon.spy();
        var obj = {};
        obj.callback = callback2;

        topic.bindOnceTo(model, 'justonename', 'callback', obj);
        topic.bindOnceTo(model, 'justonename', 'callback', obj);

        model.trigger('justonename');

        expect(obj.callback).to.have.been.calledOnce;

      });

      it('should return the same binding object', function () {

        var callback = sinon.spy();

        var binding1 = topic.bindOnceTo(model, 'justone', callback);
        var binding2 = topic.bindOnceTo(model, 'justone', callback);

        expect(binding1.uid).to.equal(binding2.uid);

        var callback2 = sinon.spy();
        var obj = {};
        obj.callback = callback2;

        var binding3 = topic.bindOnceTo(model, 'justone', 'callback', obj);
        var binding4 = topic.bindOnceTo(model, 'justone', 'callback', obj);

        expect(binding3.uid).to.equal(binding4.uid);
      });
    });
  });

  describe('#unbindFrom', function () {

    it('should throw error if called without valid binding', function () {

      var callback = function () {};
      var binding = topic.bindTo(model, 'event', callback);

      var fn1 = function () {
        topic.unbindFrom();
      };

      var fn2 = function () {
        delete binding.uid;
        topic.unbindFrom(binding);
      };

      fn1.should.throw('Cannot unbind from undefined or invalid binding');
      fn2.should.throw('Cannot unbind from undefined or invalid binding');
    });

    it('should actually unbind callback from target event', function () {

      var callback = sinon.spy();
      var binding = topic.bindTo(model, 'custom', callback);
      topic.unbindFrom(binding);
      model.trigger('custom');

      callback.should.not.have.been.called;
    });

    it('should remove binding from private map', function () {

      var callback = function () {};
      var binding = topic.bindTo(model, 'custom', callback);

      topic._bindings[binding.uid].should.equal(binding);
      topic.unbindFrom(binding);
      topic._bindings.should.not.include.keys(binding.uid);
    });

    it('should remove binding from events map', function () {

      var callback = function () {};
      var binding = topic.bindTo(model, 'asdas', callback);
      topic.unbindFrom(binding);

      var exists = false;
      var events = topic._namedEvents.asdas;
      events.forEach(function (_binding) {
        if (_binding.uid === binding.uid) {
          exists = true;
        }
      });

      expect(exists).to.be.false;
    });

    it('should clean up binding object, but leave uid', function () {

      var callback = function () {};
      var binding = topic.bindTo(model, 'custom', callback);
      topic.unbindFrom(binding);

      binding.should.include.keys('uid');
      binding.should.not.include.keys('callback');
      binding.should.not.include.keys('target');
      binding.should.not.include.keys('event');
    });

    describe('given the binding object is destoyed', function () {

      it ('should return early', function () {

        var spy = sinon.spy();
        var binding = {
          'uid': 'sdlfkjsdflksjdflkj',
          'target': {
            'off': spy
          }
        };

        topic.unbindFrom(binding);

        spy.should.not.have.been.called;
      });
    });
  });

  describe('#unbindFromTarget', function () {

    it('should throw error if called without valid target', function () {

      var callback = function () {};
      topic.bindTo(model, 'event', callback);

      var fn1 = function () {
        topic.unbindFromTarget();
      };

      var fn2 = function () {
        topic.unbindFromTarget({});
      };

      fn1.should.throw('Cannot unbind from undefined or invalid binding target');
      fn2.should.throw('Cannot unbind from undefined or invalid binding target');
    });

    it('should actually unbind all the views callback from target', function () {

      var callback = sinon.spy();
      topic.bindTo(model, 'testing-bind-target', callback);
      topic.bindTo(model, 'testing-target-unbind', callback);
      topic.unbindFromTarget(model);
      model.trigger('testing-bind-target');
      model.trigger('testing-target-unbind');

      callback.should.not.have.been.called;
    });

    it('should remove bindings from private map', function () {

      var callback = function () {};
      var bind1 = topic.bindTo(model, 'testing-bind-target', callback);
      var bind2 = topic.bindTo(model, 'testing-target-unbind', callback);

      topic._bindings.should.include.keys(bind1.uid);
      topic._bindings.should.include.keys(bind2.uid);

      topic.unbindFromTarget(model);

      topic._bindings.should.not.include.keys(bind1.uid);
      topic._bindings.should.not.include.keys(bind2.uid);
    });

    it('should clean up binding object, but keep uid', function () {

      var callback = function () {};
      var binding = topic.bindTo(model, 'custom', callback);
      topic.unbindFromTarget(model);

      binding.should.include.keys('uid');
      binding.should.not.include.keys('callback');
      binding.should.not.include.keys('target');
      binding.should.not.include.keys('event');
    });
  });

  describe('#unbindAll', function () {

    it('should actually unbind all bindings', function () {

      var callback = sinon.spy();
      topic.bindTo(model, 'custom1', callback);
      topic.bindTo(model, 'custom2', callback);

      topic.unbindAll();
      model.trigger('custom1');
      model.trigger('custom2');

      callback.should.not.have.been.called;
    });

    it('should use #unbindFrom for each binding', function () {

      var callback = function () {};
      topic.unbindFrom = sinon.spy();
      var binding1 = topic.bindTo(model, 'custom1', callback);
      var binding2 = topic.bindTo(model, 'custom2', callback);

      topic.unbindAll();

      topic.unbindFrom.should.have.been.calledTwice;
      topic.unbindFrom.should.have.been.calledWith(binding1);
      topic.unbindFrom.should.have.been.calledWith(binding2);
    });
  });

  describe('#isAlreadyBound', function () {

    it ('should return false if target and callback not already bound to event', function () {

      var fn = function () {};
      topic.bindTo(model, 'event', fn);
      var isBound = topic.isAlreadyBound(model2, 'event', fn);
      isBound.should.be.false;
    });

    it ('should return false early if target was bound, then unbound, and ' +
        'now being bound again with same event and callback', function () {

      var fn = function () {};
      var binding = topic.bindTo(model, 'event', fn);
      topic.unbindFrom(binding);

      var isBound = topic.isAlreadyBound(model, 'event', fn);
      isBound.should.be.false;
    });
  });
});