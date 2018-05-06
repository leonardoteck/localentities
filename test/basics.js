/// <reference types="../node_modules/localforage/typings/localforage.d.ts">

describe('The most basic tests', function () {
    class Es6Class {
        constructor(propA, propB) {
            this.propA = propA;
            this.propB = propB;
        }
    }

    before(function () {
        localforage.clear();
    });
    
    it('won\'t store anything other than objects or arrays of objects', function () {
        expect(() => localEntities.set('asdf')).to.throw(TypeError);
        expect(() => localEntities.set(1234)).to.throw(TypeError);
        expect(() => localEntities.set(null)).to.throw(TypeError);
        expect(() => localEntities.set(false)).to.throw(TypeError);
    });

    it('won\'t store an unregistered entity (this may be for the future)', function () {
        expect(() => localEntities.set({ prop: 'just being random' })).to.throw(/not registered/ig);
        expect(() => localEntities.set(new Es6Class('asdf', 1234))).to.throw(/not registered/ig);
    });


});
