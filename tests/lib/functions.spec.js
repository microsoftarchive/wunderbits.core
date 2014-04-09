describe('functions', function () {

  'use strict';

  var topic = require('lib/functions');

  it('should be a function', function () {
    expect(topic).to.be.a('function');
  });

  it('should return only functions on an object', function () {

    var obj = {
      'a': function () {},
      'b': 42,
      'c': String
    };

    var fns = topic(obj);
    expect(fns).to.deep.equal(['a', 'c']);
  });
});