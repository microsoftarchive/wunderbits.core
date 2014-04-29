describe('ControllableMixin', function () {

  'use strict';

  var EventEmitter = require('BaseEventEmitter');
  var ControllableMixin = require('mixins/ControllableMixin');

  var Topic;
  beforeEach (function () {
    Topic = EventEmitter.extend({
      'mixins': [ControllableMixin]
    });
  });

  describe('#createControllerInstances', function () {

    it('should not implement a controller if a subclass of that controller has already been implemented', function () {

      var ControllerClass1 = EventEmitter.extend();
      var ControllerClass2 = ControllerClass1.extend();
      var ControllerClass3 = ControllerClass2.extend();

      var PresenterClass1 = Topic.extend({
        'implements': [ControllerClass1]
      });

      var PresenterClass2 = PresenterClass1.extend({
        'implements': [ControllerClass3]
      });

      var presenter = new PresenterClass2();

      expect(presenter.controllers.length).to.equal(1);
      expect(presenter.controllers[0].constructor).to.equal(ControllerClass3);
    });
  });

  describe('#destroy', function () {

    it('should call destroy on each Controller', function () {

      var spy = sinon.spy();

      var ControllerClass = EventEmitter.extend({
        'destroy': spy
      });
      var ViewClass = Topic.extend({
        'implements': [ControllerClass]
      });

      var view = new ViewClass();
      view.destroy();

      expect(spy).to.have.been.calledOnce;
    });
  });
});