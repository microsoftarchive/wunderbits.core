describe('lib/assert', function () {

  'use strict';

  var topic = require('lib/assert');

  it('should be a function', function () {
    expect(topic).to.be.a('function');
  });

  it('should test strings', function () {
    expect(function () {
      topic.string('abcd');
    }).to.not.throw(Error);

    expect(function () {
      topic.string({});
    }).to.throw(Error);
  });

  it('should test numbers', function () {
    expect(function () {
      topic.number('123');
    }).to.throw(Error);

    expect(function () {
      topic.number(parseInt('123', 10));
    }).to.not.throw(Error);

    expect(function () {
      topic.number(123);
    }).to.not.throw(Error);
  });

  describe('should test empty', function () {

    it('array', function () {
      expect(function () {
        topic.empty([]);
      }).to.not.throw(Error);
      expect(function () {
        topic.empty([1, 2, 3]);
      }).to.throw(Error);
    });

    it('object', function () {
      expect(function () {
        topic.empty({});
      }).to.not.throw(Error);
      expect(function () {
        topic.empty({ a: 5 });
      }).to.throw(Error);
    });
  });

  it('should test arrays', function () {
    expect(function () {
      topic.array([]);
    }).to.not.throw(Error);

    expect(function () {
      topic.array({});
    }).to.throw(Error);
  });
});