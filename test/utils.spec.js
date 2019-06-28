const { expect } = require('chai');
const {
    removeHTMLTags,
    removeSpaces,
    convertCommasInNumbers,
    normalize,
    findCommonAncestors,
} = require('../src/utils');

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

describe('The findCommonAncestors function', () => {
    it('finds ancestor of objects', () => {
        const baseData = {
            item: {
                its: 'contents',
            },
            anotherItem: {
                its: 'contents',
            },
        };

        const basePaths = [
            { path: '.item.its' },
        ];

        const expectedResult = {
            item: {
                its: 'contents',
            },
        };

        const result = findCommonAncestors(baseData, basePaths, true);
        expect(result).to.deep.equal(expectedResult);
    });
    it('finds ancestor of arrays', () => {
        const baseData = [
            {
                its: 'contents',
            },
            {
                anothers: 'contents',
            },
            {
                its: 'another content',
            },
        ];

        const basePaths = [
            { path: '[0].its' },
        ];

        const expectedResult = {
            0: {
                its: 'contents',
            },
        };

        const result = findCommonAncestors(baseData, basePaths);
        expect(result).to.deep.equal(expectedResult);
    });
});
