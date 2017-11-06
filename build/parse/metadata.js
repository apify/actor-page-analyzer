'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = parseMetadata;

var _cheerio = require('cheerio');

var _cheerio2 = _interopRequireDefault(_cheerio);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function parseMetadata({ html, $ }) {
    if (!$) {
        $ = _cheerio2.default.load(html);
    }
    const result = {};
    $('meta').each(function () {
        const $tag = $(this);
        const name = $tag.attr('name') || $tag.attr('property');
        if (name) {
            result[name] = $tag.attr('content');
        }
    });
    $('head title').each(function () {
        result.title = $(this).text();
    });

    return result;
}