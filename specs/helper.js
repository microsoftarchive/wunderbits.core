'use strict';

var path = require('path');
var chai = require('chai');
global.sinon = require('sinon');
chai.use(require('sinon-chai'));
global.expect = chai.expect;
chai.should();

var oldRequire = require;
global.load = function (name) {
  try {
    // console.log(name, path.join('../public', name));
    return oldRequire(path.join('../public', name));
  } catch (e) {
    return oldRequire.apply(this, arguments);
  }
};
