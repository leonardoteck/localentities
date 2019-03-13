/// <reference path="../../src/localentities.js">
var expect = chai.expect;
describe('Things that can\'t happen', function () {
    before(function () {
        localforage.clear();
    });
    
    it('won\'t store anything other than objects or arrays of objects', function () {
        expect(() => localEntities.set('asdf')).to.throw(TypeError);
        expect(() => localEntities.set(1234)).to.throw(TypeError);
        expect(() => localEntities.set(null)).to.throw(TypeError);
        expect(() => localEntities.set(false)).to.throw(TypeError);
        expect(() => localEntities.set([[{}]])).to.throw(TypeError);
    });

    it('won\'t store an unregistered entity', function () {
        expect(() => localEntities.set({ prop: 'just being random' })).to.throw(/not registered/ig);
        expect(() => localEntities.set(new Es6Class('asdf', 1234))).to.throw(/not registered/ig);
        expect(() => localEntities.setRange([new Es6Class('asdf', 1234)])).to.throw(/not registered/ig);
        expect(() => localEntities.refresh([new Es6Class('asdf', 1234)])).to.throw(/not registered/ig);

    });
    
    it('won\'t get not registered entities', function () {
        expect(localEntities.get('Es6Class', 37)).to.be.rejectedWith(/not registered/ig);
        expect(localEntities.get(Es6Class, 12, 'propA')).to.be.rejectedWith(/not registered/ig);
        expect(localEntities.get('', 25)).to.be.rejectedWith(/invalid type/ig);
        expect(localEntities.get(false, 48)).to.be.rejectedWith(/invalid type/ig);
    });

    it('won\'t remove not registered entities', function () {
        expect(localEntities.remove('Es6Class', 37)).to.be.rejectedWith(/not registered/ig);
        expect(localEntities.remove(Es6Class, 12, 'propA')).to.be.rejectedWith(/not registered/ig);
        expect(localEntities.remove('', 25)).to.be.rejectedWith(/invalid type/ig);
        expect(localEntities.remove(false, 48)).to.be.rejectedWith(/invalid type/ig);
        expect(localEntities.clear('Es6Class')).to.be.rejectedWith(/not registered/ig);
        expect(localEntities.clear(Es6Class)).to.be.rejectedWith(/not registered/ig);
        expect(localEntities.clear('')).to.be.rejectedWith(/invalid type/ig);
        expect(localEntities.clear(false)).to.be.rejectedWith(/invalid type/ig);
    });
});
