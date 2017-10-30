import cheerio from 'cheerio';
import { cleanData } from '../utils';

function extractValue($elem) {
    return $elem.attr('content') ||
        $elem.text() ||
        $elem.attr('src') ||
        $elem.attr('href') ||
        null;
}

function extractItemScope($, $itemScope) {
    const item = {
        _type: $itemScope.attr('itemtype'),
    };
    let count = 0;
    // iterate itemprops not nested in another itemscope
    $itemScope
        .find('[itemprop]')
        .filter(function () {
            const $itemProp = $(this);
            const $parents = $itemProp.parents('[itemscope]');
            return $($parents[0]).is($itemScope);
        }).each(function () {
            const $itemProp = $(this);
            let value = $itemProp.is('[itemscope]')
                ? extractItemScope($, $itemProp)
                : extractValue($itemProp);
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

export default function parseSchemaOrgData({ html, $ }) {
    if (!$) {
        $ = cheerio.load(html);
    }
    const result = [];
    $('[itemscope]').filter(function () {
        return $(this).parents('[itemscope]').length === 0;
    }).each(function () {
        result.push(extractItemScope($, $(this)));
    });

    // remove circular references
    return cleanData(result);
}
