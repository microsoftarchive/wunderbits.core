describe('WBDestroyableMixin', function () {

  'use strict';

  var WBClass = require('WBClass');
  var WBEventsMixin = require('mixins/WBEventsMixin');
  var WBDestroyableMixin = require('mixins/WBDestroyableMixin');

  var Klass;
  beforeEach(function () {
    Klass = WBClass.extend({
      'mixins': [
        WBEventsMixin,
        WBDestroyableMixin
      ]
    });
  });

  describe('#destroy', function () {

    var spy, instance;

    beforeEach(function () {
      spy = sinon.spy();
      instance = new Klass();
    });

    it('should trigger destroy', function () {
      instance.on('destroy', spy);
      instance.destroy();
      spy.should.have.been.calledOnce;
    });

    it('should call `unbind`', function () {
      instance.unbind = spy;
      instance.destroy();
      spy.should.have.been.calledOnce;
    });

    it('should call `unbindAll`', function () {
      instance.unbindAll = spy;
      instance.destroy();
      spy.should.have.been.calledOnce;
    });

    it('should call `onDestroy`', function () {
      instance.onDestroy = spy;
      instance.destroy();
      spy.should.have.been.calledOnce;
    });

    it('should cleanup own properies', function () {
      instance.x = 5;
      instance.y = 6;
      instance.z = function () {};
      instance.destroy();
      expect(instance.x).to.be.undefined;
      expect(instance.y).to.be.undefined;
      expect(instance.z).to.not.be.undefined;
    });

    it('should noop own methods', function () {
      instance.z = function () {};
      instance.destroy();

      var z = instance.z;
      expect(z).to.be.a('function');
      expect(z.length).to.equal(0);

      // IE doesn't support function names
      if (z.name) {
        expect(z.name).to.equal('noop');
      }
    });

    it('should mark instance as destroyed', function () {
      expect(instance.destroyed).to.be.undefined;
      instance.destroy();
      expect(instance.destroyed).to.be.true;
    });
  });

});