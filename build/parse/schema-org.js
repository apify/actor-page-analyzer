'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = parseSchemaOrgData;

var _cheerio = require('cheerio');

var _cheerio2 = _interopRequireDefault(_cheerio);

var _utils = require('../utils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function extractValue($elem) {
    return $elem.attr('content') || $elem.text() || $elem.attr('src') || $elem.attr('href') || null;
}

function extractItemScope($, $itemScope) {
    const item = {
        _type: $itemScope.attr('itemtype')
    };
    let count = 0;
    // iterate itemprops not nested in another itemscope
    $itemScope.find('[itemprop]').filter(function () {
        const $itemProp = $(this);
        const $parents = $itemProp.parents('[itemscope]');
        return $($parents[0]).is($itemScope);
    }).each(function () {
        const $itemProp = $(this);
        let value = $itemProp.is('[itemscope]') ? extractItemScope($, $itemProp) : extractValue($itemProp);
        if (typeof value === 'string') {
            value = value.trim();
        }
        const propName = $itemProp.attr('itemprop');
        if (Array.isArray(item[propName])) {
            item[propName].push(value);
        } else if (typeof item[propName] !== 'undefined') {
            item[propName] = [item[propName], value];
        } else {
            item[propName] = value;
        }
        count++;
    });
    // special case - output at least something
    if (count === 0) {
        item._value = extractValue($itemScope);
    }
    return item;
}

function parseSchemaOrgData({ html, $ }) {
    if (!$) {
        $ = _cheerio2.default.load(html);
    }
    const result = [];
    $('[itemscope]').filter(function () {
        return $(this).parents('[itemscope]').length === 0;
    }).each(function () {
        result.push(extractItemScope($, $(this)));
    });

    // remove circular references
    return (0, _utils.cleanData)(result);
}