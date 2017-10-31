'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.getNativeWindowProperties = undefined;
exports.default = evalWindowProperties;

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const getNativeWindowProperties = exports.getNativeWindowProperties = async page => {
    const keys = await page.evaluate(() => Object.keys(window)); // eslint-disable-line
    // Other concurrent worker might have done the same in the meantime
    const nativeWindowsProperties = {};
    _lodash2.default.each(keys, key => {
        nativeWindowsProperties[key] = true;
    });
    return nativeWindowsProperties;
};

// Evaluate window properties, save content for variables that are not function
function evalWindowProperties(properties) {
    const result = {};
    let cache = [];
    properties.filter(prop => prop !== 'frames').forEach(property => {
        const propertyContent = window[property]; // eslint-disable-line
        switch (typeof propertyContent) {
            // Skip functions, used switch for future improvements
            case 'function':
                result[property] = 'function';
                break;
            default:
                try {
                    // remove circular references and functions from variable content
                    result[property] = JSON.parse(JSON.stringify(propertyContent, (key, value) => {
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
                } catch (err) {
                    result[property] = err;
                }
        }
    });
    cache = null;
    console.log(Object.keys(result));
    return result;
}