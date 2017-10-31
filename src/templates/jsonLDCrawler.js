export default function jsonLDCrawler(searchString, path) {
    const position = path.substr(1, path.indexOf(']') - 1);
    const jsonLDPath = path.substr(3);
    return `
    parsedData['${searchString}'] = $('script[type="application/ld+json"]').get(${position});
    if (parsedData['${searchString}']) parsedData['${searchString}'] = JSON.parse(parsedData['${searchString}'].text);
    if (parsedData['${searchString}']) parsedData['${searchString}'] = parsedData['${searchString}']${jsonLDPath};
    else parsedData['${searchString}'] = '';
    `;
}
