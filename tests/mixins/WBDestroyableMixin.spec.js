describe('WBDestroyableMixin', function () {

  'use strict';

  var WBClass = load('WBClass');
  var WBEventsMixin = load('mixins/WBEventsMixin');
  var WBDestroyableMixin = load('mixins/WBDestroyableMixin');

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

      expect(instance.z).to.be.a('function');
      expect(instance.z.name).to.equal('noop');
      expect(instance.z.length).to.equal(0);
    });

    it('should mark instance as destroyed', function () {
      expect(instance.destroyed).to.be.undefined;
      instance.destroy();
      expect(instance.destroyed).to.be.true;
    });
  });

});