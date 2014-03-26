'use strict';

var path = require('path');
var chai = require('chai');
global.sinon = require('sinon');
chai.use(require('sinon-chai'));
global.expect = chai.expect;
chai.should();

var oldRequire = require;
var publicPath = process.env.TEST_COV ? '../public-coverage/' : '../public/';
global.load = function (name) {
  try {
    return oldRequire(path.join(publicPath, name));
  } catch (e) {
    return oldRequire.apply(this, arguments);
  }
};
