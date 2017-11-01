import { expect } from 'chai';
import {
    removeHTMLTags,
    removeSpaces,
    convertCommasInNumbers,
    normalize,
} from '../src/utils';

describe('The removeHTMLTags function', () => {
    it('removes HTML Tags', () => {
        const base = '<div class="colValue" contenteditable="false"><span class="bigPrice price_withVat">4&nbsp;299,-</span></div>';
        const expectedResult = '4&nbsp;299,-';
        const result = removeHTMLTags(base);
        expect(result).to.be.equal(expectedResult);
    });
});

describe('The removeSpaces function', () => {
    it('removes HTML Tags', () => {
        const base = `a b   c
        d
        e`;
        const expectedResult = 'abcde';
        const result = removeSpaces(base);
        expect(result).to.be.equal(expectedResult);
    });
});

describe('The convertCommasInNumbers function', () => {
    it('removes HTML Tags', () => {
        const base = 'abcd 8999,1 efgh 8999.2 ijkl 8999,';
        const expectedResult = 'abcd 8999.1 efgh 8999.2 ijkl 8999,';
        const result = convertCommasInNumbers(base);
        expect(result).to.be.equal(expectedResult);
    });
});

describe('The normalize function', () => {
    it('normalizes string', () => {
        const base = `<div class="colValue" contenteditable="false">
        <span class="bigPrice price_withVat">4&nbsp;299,-</span>
</div>`;
        const expectedResult = '4299,-';
        const result = normalize(base);
        expect(result).to.be.equal(expectedResult);
    });
    it('normalizes number', () => {
        const base = `<div class="colValue" contenteditable="false">
        <span class="bigPrice price_withVat">4&nbsp;299,23</span>
</div>`;
        const expectedResult = '4299.23';
        const result = normalize(base);
        expect(result).to.be.equal(expectedResult);
    });
});
