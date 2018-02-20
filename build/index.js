'use strict';

var _puppeteer = require('puppeteer');

var _puppeteer2 = _interopRequireDefault(_puppeteer);

var _cheerio = require('cheerio');

var _cheerio2 = _interopRequireDefault(_cheerio);

var _apify = require('apify');

var _apify2 = _interopRequireDefault(_apify);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _typeCheck = require('type-check');

var _lodash = require('lodash');

var _proxyChain = require('proxy-chain');

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
    console.log(new Date(), `${Math.round((currentLog - lastLog) / 10) / 100}s`, message);
    lastLog = currentLog;
};

// Definition of the global input
const INPUT_TYPE = `{
    pages: Array,
    tests: Maybe Array
}`;

// Definition of the page input
const PAGE_INPUT_TYPE = `{
    url: String,
    searchFor: Array,
    tests: Maybe Array
}`;

function wait(timeout) {
    return new _bluebird2.default(resolve => {
        setTimeout(resolve, timeout);
    });
}

let output = null;

async function waitForEnd(field) {
    let done = output.get(field);
    while (!done) {
        await wait(100); // eslint-disable-line
        done = output.get(field);
    }
    return done;
}

async function analysePage(browser, url, searchFor, tests) {
    output.setNewUrl(url);
    console.log('================================');
    console.log(url);
    console.log('================================');
    log('analysisStarted');
    output.set('analysisStarted', new Date());

    const scrappedData = {
        windowProperties: {},
        html: '<body></body>'
    };

    const scrapper = new _page2.default(browser, tests);

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
            log(`start of html: ${html && html.substr && html.substr(0, 500)}`);
            const $ = _cheerio2.default.load(html);
            if (tests.includes('META')) {
                const metadata = (0, _metadata2.default)({ $ });
                await output.set('metaDataParsed', true);
                await output.set('metaData', metadata);
                const foundMetadata = treeSearcher.find(metadata, searchFor);
                await output.set('metaDataFound', foundMetadata);
            } else {
                await output.set('metaDataParsed', true);
                await output.set('metaData', []);
                await output.set('metaDataFound', []);
            }
            log('metadata searched');
            await output.set('metadataSearched', new Date());

            if (tests.includes('JSON-LD')) {
                const jsonld = (0, _jsonLd2.default)({ $ });
                await output.set('jsonLDDataParsed', true);
                await output.set('allJsonLDData', jsonld);
                const foundJsonLD = treeSearcher.find(jsonld, searchFor);
                await output.set('jsonLDDataFound', foundJsonLD);
                await output.set('jsonLDData', (0, _utils.findCommonAncestors)(jsonld, foundJsonLD));
            } else {
                await output.set('jsonLDDataParsed', true);
                await output.set('allJsonLDData', []);
                await output.set('jsonLDDataFound', []);
                await output.set('jsonLDData', []);
            }
            log('json-ld searched');
            await output.set('jsonLDSearched', new Date());

            if (tests.includes('SCHEMA.ORG')) {
                const schemaOrgData = (0, _schemaOrg2.default)({ $ });
                await output.set('schemaOrgDataParsed', true);
                await output.set('allSchemaOrgData', schemaOrgData);
                const foundSchemaOrg = treeSearcher.find(schemaOrgData, searchFor);
                await output.set('schemaOrgDataFound', foundSchemaOrg);
                await output.set('schemaOrgData', (0, _utils.findCommonAncestors)(schemaOrgData, foundSchemaOrg));
            } else {
                await output.set('schemaOrgDataParsed', true);
                await output.set('allSchemaOrgData', []);
                await output.set('schemaOrgDataFound', []);
                await output.set('schemaOrgData', []);
            }
            log('schema org searched');
            await output.set('schemaOrgSearched', new Date());

            await output.set('htmlParsed', true);
            if (tests.includes('HTML')) {
                const domSearcher = new _DOMSearcher2.default({ $ });
                const foundSelectors = domSearcher.find(searchFor);
                await output.set('htmlFound', foundSelectors);
            } else {
                await output.set('htmlFound', []);
            }
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
            if (tests.includes('HTML')) {
                const $ = _cheerio2.default.load(scrappedData.html || '<body></body>');
                const domSearcher = new _DOMSearcher2.default({ $ });
                const foundSelectors = domSearcher.find(searchFor);
                await output.set('htmlFound', foundSelectors);
            } else {
                await output.set('htmlFound', []);
            }
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

        if (!requests.length) {
            output.set('xhrRequestsFound', []);
            output.set('xhrRequestsSearched', new Date());
            return;
        }

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
        const fullUrl = url.match(/^http(s)?:\/\//i) ? url : `http://${url}`;
        await scrapper.start(fullUrl);
        // prevent act from closing before all data is asynchronously parsed and searched
        await waitForEnd('analysisEnded');
        // force last write of output data
        log('Force write of output with await');
        await output.writeOutput();
    } catch (error) {
        console.error(error);
    }
}

_apify2.default.main(async () => {
    log('Loading data from input');
    try {
        // Fetch the input and check it has a valid format
        // You don't need to check the input, but it's a good practice.
        let input = await _apify2.default.getValue('INPUT');

        const isSinglePageInput = (0, _typeCheck.typeCheck)(PAGE_INPUT_TYPE, input);
        const isMultiPageInput = (0, _typeCheck.typeCheck)(INPUT_TYPE, input);

        if (!isMultiPageInput && !isSinglePageInput) {
            log('Expected input:');
            log(INPUT_TYPE);
            log('or');
            log(PAGE_INPUT_TYPE);
            log('Received input:');
            console.dir(input);
            throw new Error('Received invalid input');
        }
        if (isMultiPageInput) {
            input.pages.forEach(page => {
                if (!(0, _typeCheck.typeCheck)(PAGE_INPUT_TYPE, page) && !isSinglePageInput) {
                    log('Expected input:');
                    log(INPUT_TYPE);
                    log('Received input:');
                    console.dir(input);
                    throw new Error('Received invalid input');
                }
            });
        } else if (isSinglePageInput) {
            input = {
                pages: [input]
            };
        }

        const tests = input.tests || ['SCHEMA.ORG', 'JSON-LD', 'WINDOW', 'XHR', 'META', 'HTML'];
        output = new _Output2.default(tests);

        const args = ['--no-sandbox'];
        if (process.env.PROXY_GROUP && process.env.TOKEN) {
            const { TOKEN, PROXY_GROUP } = process.env;
            const proxyUrl = `http://${PROXY_GROUP}:${TOKEN}@proxy.apify.com:8000`;
            const anonProxy = await (0, _proxyChain.anonymizeProxy)(proxyUrl);
            args.push(`--proxy-server=${anonProxy}`);
        }
        const browser = await _puppeteer2.default.launch({ args, headless: true });

        await _bluebird2.default.mapSeries(input.pages, pageToAnalyze => {
            return analysePage(browser, pageToAnalyze.url, pageToAnalyze.searchFor, pageToAnalyze.tests || tests);
        });

        log('Analyzer finished');
    } catch (error) {
        log('Top level error');
        console.error(error);
    }
});