'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.cleanData = exports.normalize = exports.convertCommasInNumbers = exports.removeSpaces = exports.replaceHTMLEntities = exports.removeHTMLTags = exports.requestPromised = undefined;

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _htmlEntities = require('html-entities');

var _lodash = require('lodash');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const entities = new _htmlEntities.AllHtmlEntities();

const requestPromised = exports.requestPromised = async opts => new Promise((resolve, reject) => (0, _request2.default)(opts, (error, response, body) => {
    if (error) {
        return reject(error);
    }
    return resolve({ body, response });
}));

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