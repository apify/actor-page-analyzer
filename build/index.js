'use strict';

var _puppeteer = require('puppeteer');

var _puppeteer2 = _interopRequireDefault(_puppeteer);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _cheerio = require('cheerio');

var _cheerio2 = _interopRequireDefault(_cheerio);

var _apify = require('apify');

var _apify2 = _interopRequireDefault(_apify);

var _typeCheck = require('type-check');

var _windowProperties = require('./parse/window-properties');

var _windowProperties2 = _interopRequireDefault(_windowProperties);

var _xhrRequests = require('./parse/xhr-requests');

var _xhrRequests2 = _interopRequireDefault(_xhrRequests);

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

let nativeWindowsProperties = null;

// Definition of the input
const INPUT_TYPE = `{
    url: String,
    searchFor: Object
}`;

async function analysePage(browser, url, searchFor) {
    const output = new _Output2.default();
    const result = {
        url,
        // Fix order of fields
        errorInfo: null,
        loadedUrl: null,
        requestedAt: null,
        loadedAt: null,
        analysedAt: null,
        responseStatus: null,
        responseHeaders: null,
        responseTotalBytes: 0,
        iframeCount: null,
        scriptCount: null,
        windowProperties: null,
        requests: [],
        html: null,
        text: null,
        screenshotPngBase64: null
    };

    let page = null;

    try {
        page = await browser.newPage();
        await output.set('analysisStarted', true);

        page.on('error', err => {
            console.log(`Web page crashed (${url}): ${err}`);
            page.close().catch(err2 => console.log(`Error closing page 1 (${url}): ${err2}`));
        });

        // On first run, get list of native window properties from the browser
        if (!nativeWindowsProperties) {
            const properties = (0, _windowProperties.getNativeWindowProperties)(page);
            // Other concurrent worker might have done the same in the meantime
            if (!nativeWindowsProperties) {
                nativeWindowsProperties = properties;
            }
        }

        // Key is requestId, value is record in result.requests
        const requestIdToRecord = {};

        // ID of the main page request
        let initialRequestId = null;

        const getOrCreateRequestRecord = requestId => {
            let rec = requestIdToRecord[requestId];
            if (!rec) {
                rec = {
                    url: null,
                    method: null,
                    responseStatus: null,
                    responseHeaders: null,
                    responseBytes: 0
                };
                requestIdToRecord[requestId] = rec;
                result.requests.push(rec);
            }
            return rec;
        };

        page.on('request', request => {
            if (!initialRequestId) {
                initialRequestId = request._requestId;
            }
            const rec = getOrCreateRequestRecord(request._requestId);
            rec.url = request.url;
            rec.method = request.method;
        });

        // WORKAROUND: Puppeteer's Network.loadingFinished handler doesn't store encodedDataLength field
        page._networkManager._client.on('Network.dataReceived', params => {
            const rec = getOrCreateRequestRecord(params.requestId);
            if (rec) {
                rec.responseBytes += params.encodedDataLength || 0;
            }
            result.responseTotalBytes += params.encodedDataLength || 0;
        });

        page.on('response', async response => {
            const request = response.request();
            const rec = getOrCreateRequestRecord(request._requestId);
            if (rec) {
                const data = await (0, _xhrRequests2.default)(response);
                rec.responseStatus = data.status;
                rec.responseHeaders = data.headers;
                rec.responseBody = data.body;
            }
        });

        console.log(`Loading page: ${url}`);
        result.requestedAt = new Date();
        await page.goto(url);

        console.log(`Page loaded: ${url}`);

        const rec = requestIdToRecord[initialRequestId];
        if (rec) {
            result.responseStatus = rec.responseStatus;
            result.responseHeaders = rec.responseHeaders;
        }

        result.loadedAt = new Date();
        result.loadedUrl = await page.url();

        const evalData = await page.evaluate(() => ({
            html: document.documentElement.innerHTML, // eslint-disable-line
            iframeCount: document.querySelectorAll('iframe').length, // eslint-disable-line
            scriptCount: document.querySelectorAll('script').length, // eslint-disable-line
            allWindowProperties: Object.keys(window) // eslint-disable-line
        }));

        Object.assign(result, _lodash2.default.pick(evalData, 'html', 'text', 'iframeCount', 'scriptCount', 'modernizr', 'html5'));

        // Extract list of non-native window properties
        const windowProperties = _lodash2.default.filter(evalData.allWindowProperties, propName => !nativeWindowsProperties[propName]);

        const searchResults = {};
        try {
            const $ = _cheerio2.default.load(result.html);
            const treeSearcher = new _TreeSearcher2.default();

            // Evaluate non-native window properties
            result.windowProperties = await page.evaluate(_windowProperties2.default, windowProperties);
            await output.set('windowPropertiesParsed', true);
            await output.set('windowProperties', result.windowProperties);
            searchResults.window = treeSearcher.find(result.windowProperties, searchFor);
            await output.set('windowPropertiesFound', searchResults.window);

            result.schemaOrgData = (0, _schemaOrg2.default)({ $ });
            await output.set('schemaOrgDataParsed', true);
            await output.set('schemaOrgData', result.schemaOrgData);
            searchResults.schemaOrg = treeSearcher.find(result.schemaOrgData, searchFor);
            await output.set('schemaOrgDataFound', searchResults.schemaOrg);

            result.metadata = (0, _metadata2.default)({ $ });
            await output.set('metaDataParsed', true);
            await output.set('metadata', result.metadata);
            searchResults.metadata = treeSearcher.find(result.metadata, searchFor);
            await output.set('metaDataFound', searchResults.metadata);

            result.jsonld = (0, _jsonLd2.default)({ $ });
            await output.set('jsonLDDataParsed', true);
            await output.set('jsonLDData', result.jsonld);
            searchResults.jsonLD = treeSearcher.find(result.jsonld, searchFor);
            await output.set('jsonLDDataFound', searchResults.jsonLD);

            const domSearcher = new _DOMSearcher2.default({ $ });
            searchResults.html = domSearcher.find(searchFor);
            await output.set('htmlParsed', true);
            await output.set('htmlFound', searchResults.html);
        } catch (err) {
            console.error(err);
        }
        const crawlerGenerator = new _Crawler2.default();
        const crawler = crawlerGenerator.generate(searchResults, searchFor);
        await output.set('crawler', crawler);
        await output.set('analysisEnded', true);
    } catch (e) {
        console.log(`Loading of web page failed (${url}): ${e}`);
        console.error(e);
        result.errorInfo = e.stack || e.message || String(e);
    } finally {
        if (page) {
            page.close().catch(e => console.log(`Error closing page 2 (${url}): ${e}`));
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