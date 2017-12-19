import cheerio from 'cheerio';
import { concat, isArray, sortBy } from 'lodash';
import { normalize } from '../utils';

const LETTER_DEDUCTION = 0.01;

function findSimilarSelectors($, selectors) {
    return selectors
        .map((foundSelector) => {
            const { selector } = foundSelector;
            const steps = selector.split(' > ');
            const options = steps
                .reduce((lists, step, index) => {
                    const arrayPart = steps.slice(0, index + 1);
                    arrayPart[arrayPart.length - 1] = arrayPart[arrayPart.length - 1].replace(/:nth-child\(\d\)/, '');
                    const arraySelector = arrayPart.join(' > ');
                    const childSelector = steps.slice(index + 1).join(' > ');
                    if (!arraySelector || !childSelector) return lists;
                    const parentElements = $(arraySelector);
                    const children = parentElements.find(childSelector);
                    if (children.length > 1) lists.push({ arraySelector, childSelector });
                    return lists;
                }, [])
                .reverse()
                .map(({ arraySelector, childSelector }) => {
                    const parentElements = $(arraySelector);
                    const possibleIndexes = {};
                    parentElements.each(function (index) {
                        const child = $(this).find(childSelector);
                        if (child.length > 0) possibleIndexes[index] = child.text();
                    });
                    if (Object.keys(possibleIndexes).length) return { arraySelector, childSelector, possibleIndexes };
                    return null;
                })
                .filter(item => !!item);

            if (options.length) {
                return {
                    ...foundSelector,
                    foundInLists: options,
                };
            }
            return foundSelector;
        });
}

export default class DOMSearcher {
    constructor({ $, html }) {
        if (!$ && !html) throw new Error('DOMSearcher requires cheerio instance or HTML code.');
        this.$ = $ || cheerio.load(html);
        this.searchElement = this.searchElement.bind(this);
        this.findPath = this.findPath.bind(this);
        this.createSelector = this.createSelector.bind(this);
    }

    setHTML(html) {
        this.$ = cheerio.load(html);
    }

    createSelector(path, item) {
        const { $ } = this;

        const completePath = concat(path, item);

        const elementsWithId = completePath.map(step => !!step.id);
        const lastUsableID = elementsWithId.lastIndexOf(true);

        const importantPartOfPath = lastUsableID !== -1
            ? completePath.slice(lastUsableID)
            : completePath;

        const parts = importantPartOfPath.map(step => {
            if (step.id) return `#${step.id}`;
            let classes = step.class && step.class.trim() ? `.${step.class.trim().split(' ').join('.')}` : '';
            // remove bootstrap classes
            classes = classes.replace(/.col-[^.]+-\d+/gi, '');
            if (classes === '.') classes = undefined;
            let position = '';
            if (step.nthChild === 0) position = '';
            else if (step.nthChild > 0) position = `:nth-child(${step.nthChild + 1})`;
            return `${step.tag}${classes || position}`;
        });


        let lastPart = parts.pop();
        let selector = lastPart;
        while (($(selector).length > 1 || !!lastPart.match(/(.*):nth-child\((.*)\)/) || !!lastPart.match(/^(\w+)$/)) && parts.length > 0) {
            lastPart = parts.pop();
            selector = `${lastPart} > ${selector}`;
        }
        if ($(selector).length > 1 && lastPart.indexOf(':nth-child') === -1) {
            selector = selector.replace(lastPart, `${lastPart}:first-child`);
        }

        return selector;
    }

    searchElement(tagName, $element) {
        const { searchElement, $ } = this;

        const elementText = $element.text();
        const elementData = {
            tag: tagName,
            class: $element.attr('class'),
            id: $element.attr('id'),
        };
        const normalizedText = normalize(elementText); // to lower case to match most results
        const score = this.normalizedSearch.reduce((lastScore, searchString) => {
            if (normalizedText.indexOf(searchString) === -1) return lastScore;
            const remainingTextLength = normalizedText.replace(searchString, '').length;
            const searchScore = (1 + (remainingTextLength * LETTER_DEDUCTION));
            return Math.max(lastScore, searchScore);
        }, 0);

        if (score === 0) return elementData;

        elementData.textScore = score;

        const childElements = $element.children();
        if (childElements.length === 0) {
            elementData.text = elementText;
            return elementData;
        }

        const children = [];
        let hasViableChild = false;
        $element.children().each(function () {
            const result = searchElement(this.tagName, $(this));
            children.push(result);
            if (result.text || result.children) hasViableChild = true;
        });
        if (hasViableChild) {
            elementData.children = children;
            return elementData;
        }
        elementData.text = elementText;
        return elementData;
    }

    findPath(currentPath, nthChild, item, siblingClasses = {}) {
        const { findPath, createSelector } = this;
        if (item.text) {
            const selector = createSelector(currentPath, item);
            this.foundPaths.push({
                selector,
                text: item.text,
                score: (1 + (selector.split('>').length * 0.2)) * item.textScore,
            });
            return;
        }

        const hasUniqueClass = item.class && siblingClasses[item.class] === 1;

        const newPath = concat(currentPath, {
            tag: item.tag,
            id: item.id,
            class: hasUniqueClass ? item.class : undefined,
            nthChild: !hasUniqueClass ? nthChild : undefined,
        });

        const childrenClasses = item.children.reduce((classes, child) => {
            if (!child.class) return classes;
            if (!classes[child.class]) classes[child.class] = 1;
            else classes[child.class]++;
            return classes;
        }, {});

        item.children.forEach((child, index) => {
            if (!child.text && !child.children) return;
            findPath(newPath, index, child, childrenClasses);
        });
    }

    find(searchFor) {
        const { $, searchElement, findPath } = this;
        if (!searchFor || !isArray(searchFor)) {
            throw new Error('DOMSearcher requires array of search queries.');
        }

        this.searchFor = searchFor;
        this.normalizedSearch = searchFor.map(searchString => normalize(searchString));
        this.foundPaths = [];

        let $body = $('body');
        if (!$body.length) $body = $.root();
        $body = $body.children();
        $body
            .map(function () {
                return searchElement(this.tagName, $(this));
            }).get()
            .filter(child => child.text || child.children)
            .forEach((child, index) => findPath([], index, child));

        const sortedSelectors = sortBy(this.foundPaths, ['score']).map(({ selector, text }) => ({ selector, text }));
        const selectorsWithDetails = findSimilarSelectors($, sortedSelectors);
        console.log(selectorsWithDetails);
        return selectorsWithDetails;
    }
}
