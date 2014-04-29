'use strict';

var WBMixin = require('../WBMixin');
var fromSuper = require('../lib/fromSuper');

var ControllableMixin = WBMixin.extend({

  'initialize': function () {

    var self = this;

    self.controllers = [];
    self.implemented = [];

    self.implements = fromSuper.concat(self, 'implements');
    self.createControllerInstances();

    self.bindOnceTo(self, 'destroy', 'destroyControllers');
  },

  'createControllerInstances': function () {

    var self = this;

    var Controllers = self.implements;
    if (typeof Controllers === 'function') {
      Controllers = Controllers.call(self);
    }

    var ControllerClass, controllerInstance, i;

    // the order in which the controllers are implemented is important!
    for (i = Controllers.length; i--;) {
      ControllerClass = Controllers[i];

      // If we have already implemented a controller that inherits from
      // this controller, we don't need another one...
      if (self.implemented.indexOf(ControllerClass.toString()) < 0) {

        controllerInstance = new ControllerClass(self);
        self.controllers.push(controllerInstance);
        controllerInstance.parent = self;

        self.trackImplementedSuperConstructors(ControllerClass);
      }
    }

    return self.implemented;
  },

  'trackImplementedSuperConstructors': function (Controller) {

    var self = this;
    var _super = Controller.__super__;
    var superConstructor = _super && _super.constructor;

    if (superConstructor) {
      self.implemented.push(superConstructor.toString());
      self.trackImplementedSuperConstructors(superConstructor);
    }
  },

  'destroyControllers': function () {

    var self = this;

    // Loop and destroy
    var controller;
    var controllers = self.controllers;

    while (controllers.length) {
      // A controller can exist multiple times in the list,
      // since it's based on the event name,
      // so make sure to only destroy each one once
      controller = controllers.shift();
      controller.destroyed || controller.destroy();
    }
  }
});

module.exports = ControllableMixin;
