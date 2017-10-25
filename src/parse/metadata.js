import cheerio from 'cheerio';

export default function parseMetadata({ html, $ }) {
    if (!$) {
        $ = cheerio.load(html);
    }
    const result = {};
    $('meta').each(function () {
        const $tag = $(this);
        const name = $tag.attr('name') || $tag.attr('property');
        if (name) {
            result[name] = $tag.attr('content');
        }
    });

    return result;
}
