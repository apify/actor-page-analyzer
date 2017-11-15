'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.cleanData = exports.normalize = exports.convertCommasInNumbers = exports.removeSpaces = exports.replaceHTMLEntities = exports.removeHTMLTags = exports.requestPromised = undefined;
exports.findCommonAncestors = findCommonAncestors;

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _htmlEntities = require('html-entities');

var _lodash = require('lodash');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const requestPromised = exports.requestPromised = async opts => new Promise((resolve, reject) => (0, _request2.default)(opts, (error, response, body) => {
    if (error) {
        return reject(error);
    }
    return resolve({ body, response });
}));

const entities = new _htmlEntities.AllHtmlEntities();

const removeHTMLTags = exports.removeHTMLTags = text => text.replace(/<[^>]*>?/g, '');
const replaceHTMLEntities = exports.replaceHTMLEntities = text => entities.decode(text);
const removeSpaces = exports.removeSpaces = text => text.replace(/\s/g, '');
const convertCommasInNumbers = exports.convertCommasInNumbers = text => text.replace(/(\d+),(\d+)/g, '$1.$2');

const normalize = exports.normalize = text => {
    if (!(0, _lodash.isString)(text)) return text;
    let normalized = removeHTMLTags(text);
    normalized = replaceHTMLEntities(normalized);
    normalized = removeSpaces(normalized);
    normalized = convertCommasInNumbers(normalized);
    return normalized;
};

const cleanData = exports.cleanData = data => {
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

    importantAncestors.forEach(property => {
        cleanedUpProperties[property] = data[property];
    });

    return cleanedUpProperties;
}