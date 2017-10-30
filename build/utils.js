'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.cleanData = exports.concatArrays = exports.requestPromised = undefined;

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const requestPromised = exports.requestPromised = async opts => new Promise((resolve, reject) => (0, _request2.default)(opts, (error, response, body) => {
    if (error) {
        return reject(error);
    }
    return resolve({ body, response });
}));

const concatArrays = exports.concatArrays = (...args) => args.reduce((acc, val) => [...acc, ...val], []);

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