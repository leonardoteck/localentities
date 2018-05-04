var assert = chai.assert;

function validator() {
    
}

describe('A Validator', function () {
    it('will return error.nonpositive for not strictly positive numbers', function () {
        assert.deepEqual(validator(0), ['error.nonpositive']);
    });
});