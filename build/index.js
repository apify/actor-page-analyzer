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

var _Output = require('./generate/Output');

var _Output2 = _interopRequireDefault(_Output);

var _utils = require('./utils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

let lastLog = Date.now();
const log = message => {
    const currentLog = Date.now();
    console.log(`${Math.round((currentLog - lastLog) / 10) / 100}s`, message);
    lastLog = currentLog;
};

// Definition of the input
const INPUT_TYPE = `{
    url: String,
    searchFor: Array
}`;

function timeoutPromised(timeout) {
    return new Promise(resolve => {
        setTimeout(resolve, timeout);
    });
}

async function waitForEnd(output, field) {
    let done = output.get(field);
    while (!done) {
        await timeoutPromised(100); // eslint-disable-line
        done = output.get(field);
    }
    return done;
}

async function analysePage(browser, url, searchFor) {
    const output = new _Output2.default();
    log('analysisStarted');
    output.set('analysisStarted', new Date());

    const scrappedData = {
        windowProperties: {},
        html: '<body></body>'
    };
    const scrapper = new _page2.default(browser);

    scrapper.on('started', data => {
        log('scrapping started');
        scrappedData.loadingStarted = data;
        output.set('scrappingStarted', data.timestamp);
    });

    scrapper.on('loaded', data => {
        log('loaded');
        scrappedData.loadingFinished = data;
        output.set('pageNavigated', data.timestamp);
    });

    scrapper.on('initial-response', async response => {
        log('initial response');
        output.set('initialResponse', {
            url: response.url,
            status: response.status,
            headers: response.responseHeaders
        });

        const html = response.responseBody;
        const treeSearcher = new _TreeSearcher2.default();
        try {
            const $ = _cheerio2.default.load(html);
            const metadata = (0, _metadata2.default)({ $ });
            await output.set('metaDataParsed', true);
            await output.set('metaData', metadata);
            const foundMetadata = treeSearcher.find(metadata, searchFor);
            await output.set('metaDataFound', foundMetadata);
            log('metadata searched');
            await output.set('metadataSearched', new Date());

            const jsonld = (0, _jsonLd2.default)({ $ });
            await output.set('jsonLDDataParsed', true);
            await output.set('allJsonLDData', jsonld);
            const foundJsonLD = treeSearcher.find(jsonld, searchFor);
            await output.set('jsonLDDataFound', foundJsonLD);
            await output.set('jsonLDData', (0, _utils.findCommonAncestors)(jsonld, foundJsonLD));
            log('json-ld searched');
            await output.set('jsonLDSearched', new Date());

            const schemaOrgData = (0, _schemaOrg2.default)({ $ });
            await output.set('schemaOrgDataParsed', true);
            await output.set('allSchemaOrgData', schemaOrgData);
            const foundSchemaOrg = treeSearcher.find(schemaOrgData, searchFor);
            await output.set('schemaOrgDataFound', foundSchemaOrg);
            await output.set('schemaOrgData', (0, _utils.findCommonAncestors)(schemaOrgData, foundSchemaOrg));
            log('schema org searched');
            await output.set('schemaOrgSearched', new Date());

            output.set('htmlParsed', true);
            const domSearcher = new _DOMSearcher2.default({ $ });
            const foundSelectors = domSearcher.find(searchFor);
            await output.set('htmlFound', foundSelectors);
            log('initial html searched');
        } catch (error) {
            console.error('Intitial response parsing failed');
            console.error(error);
        }
    });

    scrapper.on('html', async html => {
        log('html');
        scrappedData.html = html;
        output.set('htmlFullyParsed', true);
        try {
            const $ = _cheerio2.default.load(scrappedData.html || '<body></body>');
            const domSearcher = new _DOMSearcher2.default({ $ });
            const foundSelectors = domSearcher.find(searchFor);
            await output.set('htmlFound', foundSelectors);
        } catch (error) {
            console.error('HTML search failed');
            console.error(error);
        }
        log('html searched');
        await output.set('htmlSearched', new Date());
    });

    scrapper.on('window-properties', async properties => {
        log('window properties');
        scrappedData.windowProperties = properties;
        output.set('windowPropertiesParsed', true);
        output.set('allWindowProperties', properties);
        // Evaluate non-native window properties

        const treeSearcher = new _TreeSearcher2.default();
        try {
            const foundWindowProperties = treeSearcher.find(scrappedData.windowProperties, searchFor);
            output.set('windowPropertiesFound', foundWindowProperties);
            output.set('windowProperties', (0, _utils.findCommonAncestors)(scrappedData.windowProperties, foundWindowProperties, true));
            log('window properties searched');
        } catch (error) {
            console.error('Window properties parsing failed');
            console.error(error);
        }
        output.set('windowPropertiesSearched', new Date());
    });

    scrapper.on('screenshot', data => {
        log('screenshot');
        output.set('screenshot', data);
    });

    scrapper.on('requests', async requests => {
        log('requests');
        scrappedData.xhrRequests = requests;
        output.set('xhrRequestsParsed', true);
        output.set('xhrRequests', requests);

        try {
            const treeSearcher = new _TreeSearcher2.default();
            const xhrRequestResults = [];
            requests.forEach(request => {
                let results;
                if ((0, _lodash.isString)(request.responseBody)) {
                    const searcher = new _DOMSearcher2.default({ html: request.responseBody });
                    results = searcher.find(searchFor);
                } else {
                    results = treeSearcher.find(request.responseBody, searchFor);
                }
                if (results.length > 0) {
                    xhrRequestResults.push({
                        request: `${request.method} ${request.url}`,
                        response: request.responseBody,
                        searchResults: results
                    });
                }
            });
            output.set('xhrRequestsFound', xhrRequestResults);
            log('xhrRequests searched');
        } catch (err) {
            log('XHR Request search failed');
            console.error(err);
        }
        output.set('xhrRequestsSearched', new Date());
    });

    scrapper.on('done', data => {
        log('scrapping finished');
        output.set('scrappingFinished', data.timestamp);
    });

    scrapper.on('page-error', data => {
        log('page error');
        scrappedData.pageError = data;
        output.set('pageError', data);
    });

    scrapper.on('error', data => {
        log('error');
        scrappedData.pageError = data;
        output.set('error', data);
    });

    try {
        await scrapper.start(url);
        // prevent act from closing before all data is asynchronously parsed and searched
        await waitForEnd(output, 'analysisEnded');

        output.set('crawler', 'crawler is now on frontend');

        await waitForEnd(output, 'outputFinished');
    } catch (error) {
        console.error(error);
    }
}

_apify2.default.main(async () => {
    log('Analysing url from input');
    try {
        // Fetch the input and check it has a valid format
        // You don't need to check the input, but it's a good practice.
        const input = await _apify2.default.getValue('INPUT');
        if (!(0, _typeCheck.typeCheck)(INPUT_TYPE, input)) {
            log('Expected input:');
            log(INPUT_TYPE);
            log('Received input:');
            console.dir(input);
            throw new Error('Received invalid input');
        }

        const args = ['--no-sandbox'];

        if (process.env.PROXY_GROUP && process.env.TOKEN) {
            const { TOKEN, PROXY_GROUP } = process.env;
            const proxyUrl = `${PROXY_GROUP}:${TOKEN}@proxy.apify.com:8000`;
            args.push(`--proxy-server="http=http://${proxyUrl}";"https=https://${proxyUrl}"`);
        }

        const browser = await _puppeteer2.default.launch({ args, headless: true });
        await analysePage(browser, input.url, input.searchFor);
    } catch (error) {
        log('Top level error');
        console.error(error);
    }
});