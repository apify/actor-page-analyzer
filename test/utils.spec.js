import { expect } from 'chai';
import { concatArrays } from '../src/utils';

describe('The concatArrays function', () => {
    it('concatenates arrays', () => {
        const base = [['a', 'b'], ['c', 'd']];
        const expectedResult = ['a', 'b', 'c', 'd'];
        const result = concatArrays(base);
        expect(result).to.be.equal(expectedResult);
    });
});
