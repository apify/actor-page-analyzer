const { AllHtmlEntities } = require('html-entities');
const { isString } = require('lodash');

const entities = new AllHtmlEntities();

const removeHTMLTags = (text) => text.replace(/<[^>]*>?/g, '');
const replaceHTMLEntities = (text) => entities.decode(text);
const removeSpaces = (text) => text.replace(/\s/g, '');
const convertCommasInNumbers = (text) => text.replace(/(\d+),(\d+)/g, '$1.$2');

const normalize = (text) => {
    if (!isString(text)) return text;
    let normalized = removeHTMLTags(text);
    normalized = replaceHTMLEntities(normalized);
    normalized = removeSpaces(normalized);
    normalized = convertCommasInNumbers(normalized);
    return normalized;
};

const cleanData = (data) => {
    let cache = [];
    const result = JSON.parse(JSON.stringify(data, (key, value) => {
        if (typeof value === 'function') {
            return 'function';
        }
        if (typeof value === 'object' && value !== null) {
            if (cache.indexOf(value) !== -1) {
                return null;
            }
            cache.push(value);
        }
        return value;
    }));
    cache = null; // clean memory
    return result;
};

function findCommonAncestors(data, items, removeFirstCharacter = false) {
    const importantAncestors = [];
    items.forEach(({ path }) => {
        const cleanPath = removeFirstCharacter ? path.substr(1) : path;
        let indexOfBracket = cleanPath.indexOf('[');
        if (indexOfBracket === -1) indexOfBracket = Number.MAX_SAFE_INTEGER;
        let indexOfDot = cleanPath.indexOf('.');
        if (indexOfDot === -1) indexOfDot = Number.MAX_SAFE_INTEGER;
        const endOfPropertyName = Math.min(indexOfBracket, indexOfDot);
        let property = cleanPath.substr(0, endOfPropertyName);
        if (indexOfBracket === 0) {
            property = cleanPath.substr(1, cleanPath.indexOf(']') - 1);
        }
        if (importantAncestors.indexOf(property) === -1) importantAncestors.push(property);
    });
    const cleanedUpProperties = {};

    importantAncestors
        .forEach(property => {
            cleanedUpProperties[property] = data[property];
        });

    return cleanedUpProperties;
}

module.exports = {
    removeHTMLTags,
    replaceHTMLEntities,
    removeSpaces,
    convertCommasInNumbers,
    normalize,
    cleanData,
    findCommonAncestors,
};
