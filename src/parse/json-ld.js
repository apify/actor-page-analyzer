import cheerio from 'cheerio';

export default function parseJsonLD({ html, $ }) {
    if (!$) {
        $ = cheerio.load(html);
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
