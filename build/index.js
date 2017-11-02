'use strict';

var _puppeteer = require('puppeteer');

var _puppeteer2 = _interopRequireDefault(_puppeteer);

var _cheerio = require('cheerio');

var _cheerio2 = _interopRequireDefault(_cheerio);

var _apify = require('apify');

var _apify2 = _interopRequireDefault(_apify);

var _typeCheck = require('type-check');

var _lodash = require('lodash');

var _page = require('./scrap/page');

var _page2 = _interopRequireDefault(_page);

var _windowProperties = require('./parse/window-properties');

var _metadata = require('./parse/metadata');

var _metadata2 = _interopRequireDefault(_metadata);

var _schemaOrg = require('./parse/schema-org');

var _schemaOrg2 = _interopRequireDefault(_schemaOrg);

var _jsonLd = require('./parse/json-ld');

var _jsonLd2 = _interopRequireDefault(_jsonLd);

var _DOMSearcher = require('./search/DOMSearcher');

var _DOMSearcher2 = _interopRequireDefault(_DOMSearcher);

var _TreeSearcher = require('./search/TreeSearcher');

var _TreeSearcher2 = _interopRequireDefault(_TreeSearcher);

var _Crawler = require('./generate/Crawler');

var _Crawler2 = _interopRequireDefault(_Crawler);

var _Output = require('./generate/Output');

var _Output2 = _interopRequireDefault(_Output);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Definition of the input
const INPUT_TYPE = `{
    url: String,
    searchFor: Object
}`;

async function analysePage(browser, url, searchFor) {
    const output = new _Output2.default();

    const scrappedData = {
        windowProperties: {},
        html: '<body></body>'
    };
    const scrapper = new _page2.default(browser);

    scrapper.on('started', data => {
        console.log('scrapping started');
        scrappedData.loadingStarted = data;
        output.set('analysisStarted', data.timestamp);
    });

    scrapper.on('loaded', data => {
        console.log('loaded');
        scrappedData.loadingFinished = data;
        output.set('pageNavigated', data.timestamp);
    });

    scrapper.on('initial-response', response => {
        console.log('initial response');
        output.set('initialResponse', response);
    });

    scrapper.on('html', html => {
        console.log('html');
        scrappedData.html = html;
        output.set('htmlParsed', true);
        output.set('html', html);
    });

    scrapper.on('window-properties', properties => {
        console.log('window properties');
        scrappedData.windowProperties = properties;
        output.set('windowPropertiesParsed', true);
        output.set('allWindowProperties', properties);
    });

    scrapper.on('screenshot', data => {
        console.log('screenshot');
        output.set('screenshot', data);
    });

    scrapper.on('requests', requests => {
        console.log('requests');
        scrappedData.xhrRequests = requests;
        output.set('xhrRequestsParsed', true);
        output.set('xhrRequests', requests);
    });

    scrapper.on('done', data => {
        console.log('scrapping finished');
        output.set('scrappingFinished', data.timestamp);
    });

    scrapper.on('page-error', data => {
        console.log('page error');
        scrappedData.pageError = data;
        output.set('pageError', data);
    });

    scrapper.on('error', data => {
        console.log('error');
        scrappedData.pageError = data;
        output.set('error', data);
    });

    try {
        await scrapper.start(url);

        console.log('search started');
        const searchResults = {};
        try {
            const $ = _cheerio2.default.load(scrappedData.html || '<body></body>');
            const treeSearcher = new _TreeSearcher2.default();

            // Evaluate non-native window properties
            searchResults.window = treeSearcher.find(scrappedData.windowProperties, searchFor);
            await output.set('windowPropertiesFound', searchResults.window);
            await output.set('windowProperties', (0, _windowProperties.cleanWindowProperties)(scrappedData.windowProperties, searchResults.window));
            console.log('window properties searched');

            const schemaOrgData = (0, _schemaOrg2.default)({ $ });
            await output.set('schemaOrgDataParsed', true);
            await output.set('schemaOrgData', schemaOrgData);
            searchResults.schemaOrg = treeSearcher.find(schemaOrgData, searchFor);
            await output.set('schemaOrgDataFound', searchResults.schemaOrg);
            console.log('schema org searched');

            const metadata = (0, _metadata2.default)({ $ });
            await output.set('metaDataParsed', true);
            await output.set('metaData', metadata);
            searchResults.metadata = treeSearcher.find(metadata, searchFor);
            await output.set('metaDataFound', searchResults.metadata);
            console.log('metadata searched');

            const jsonld = (0, _jsonLd2.default)({ $ });
            await output.set('jsonLDDataParsed', true);
            await output.set('jsonLDData', jsonld);
            searchResults.jsonLD = treeSearcher.find(jsonld, searchFor);
            await output.set('jsonLDDataFound', searchResults.jsonLD);
            console.log('json-ld searched');

            const domSearcher = new _DOMSearcher2.default({ $ });
            searchResults.html = domSearcher.find(searchFor);
            await output.set('htmlFound', searchResults.html);
            console.log('html searched');

            const xhrRequestResults = [];
            scrappedData.xhrRequests.forEach(request => {
                let results;
                if ((0, _lodash.isString)(request.responseBody)) {
                    const searcher = new _DOMSearcher2.default({ html: request.responseBody });
                    results = searcher.find(searchFor);
                } else {
                    results = treeSearcher.find(request.responseBody, searchFor);
                }
                if (results.length > 0) {
                    xhrRequestResults.push({
                        request,
                        results
                    });
                }
            });
            await output.set('xhrRequestsFound', xhrRequestResults);
            console.log('xhrRequests searched');
        } catch (err) {
            console.error(err);
        }
        const crawlerGenerator = new _Crawler2.default();
        const crawler = crawlerGenerator.generate(searchResults, searchFor);
        await output.set('crawler', crawler);
        console.log('crawler generated');
        await output.set('analysisEnded', new Date());
        console.log('done');
    } catch (error) {
        console.error(error);
        try {
            await output.set('error', error);
        } catch (outputErr) {
            console.error(outputErr);
        }
    }
}

_apify2.default.main(async () => {
    console.log('Analysing url from input');
    try {
        // Fetch the input and check it has a valid format
        // You don't need to check the input, but it's a good practice.
        const input = await _apify2.default.getValue('INPUT');
        if (!(0, _typeCheck.typeCheck)(INPUT_TYPE, input)) {
            console.log('Expected input:');
            console.log(INPUT_TYPE);
            console.log('Received input:');
            console.dir(input);
            throw new Error('Received invalid input');
        }

        const browser = await _puppeteer2.default.launch({ args: ['--no-sandbox'], headless: true });
        await analysePage(browser, input.url, input.searchFor);
    } catch (error) {
        console.error(error);
    }
});