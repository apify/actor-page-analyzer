'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = parseJsonLD;

var _cheerio = require('cheerio');

var _cheerio2 = _interopRequireDefault(_cheerio);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function parseJsonLD({ html, $ }) {
    if (!$) {
        $ = _cheerio2.default.load(html);
    }
    const result = [];
    $('script[type="application/ld+json"]').each(function () {
        try {
            result.push(JSON.parse($(this).html()));
        } catch (err) {
            console.error(err);
        }
    });
    return result;
}