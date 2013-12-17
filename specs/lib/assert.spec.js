describe('assert', function () {

  'use strict';

  var topic;
  beforeEach(function (done) {
    requirejs(['lib/assert'], function (assert) {
      topic = assert;
      done();
    });
  });

  it('should be a function', function () {
    expect(topic).to.be.a('function');
  });

});