describe('merge', function () {

  'use strict';

  var topic = require('lib/merge');

  it('should be a function', function () {
    expect(topic).to.be.a('function');
  });

  it('should merge objects', function () {

    var a = { 'p': 5, 'q': 6 };
    var b = { 'q': false };

    topic(a, b);
    expect(a).to.deep.equal({
      'p': 5,
      'q': false
    });
  });

  it('should not merge properties from prototype', function () {

    var a = { 'p': 5, 'q': 6 };
    var b = Object.create({ 'q': false });

    topic(a, b);
    expect(a).to.deep.equal({
      'p': 5,
      'q': 6
    });
    expect(a.q).to.not.equal(false);
  });
});