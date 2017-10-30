import puppeteer from 'puppeteer';
import _ from 'lodash';
import cheerio from 'cheerio';
import Apify from 'apify';
import { typeCheck } from 'type-check';

import evalWindowProperties, { getNativeWindowProperties } from './parse/window-properties';
import parseResponse from './parse/xhr-requests';
import parseMetadata from './parse/metadata';
import parseSchemaOrgData from './parse/schema-org';
import parseJsonLD from './parse/json-ld';
import DOMSearcher from './search/DOMSearcher';
import TreeSearcher from './search/TreeSearcher';
import CrawlerGenerator from './generate/Crawler';

let nativeWindowsProperties = null;

// Definition of the input
const INPUT_TYPE = `{
    url: String,
    searchFor: [String]
}`;

async function analysePage(browser, url, searchFor) {
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
        screenshotPngBase64: null,
    };

    let page = null;

    try {
        page = await browser.newPage();

        page.on('error', (err) => {
            console.log(`Web page crashed (${url}): ${err}`);
            page.close().catch((err2) => console.log(`Error closing page 1 (${url}): ${err2}`));
        });

        // On first run, get list of native window properties from the browser
        if (!nativeWindowsProperties) {
            const properties = getNativeWindowProperties(page);
            // Other concurrent worker might have done the same in the meantime
            if (!nativeWindowsProperties) {
                nativeWindowsProperties = properties;
            }
        }

        // Key is requestId, value is record in result.requests
        const requestIdToRecord = {};

        // ID of the main page request
        let initialRequestId = null;

        const getOrCreateRequestRecord = (requestId) => {
            let rec = requestIdToRecord[requestId];
            if (!rec) {
                rec = {
                    url: null,
                    method: null,
                    responseStatus: null,
                    responseHeaders: null,
                    responseBytes: 0,
                };
                requestIdToRecord[requestId] = rec;
                result.requests.push(rec);
            }
            return rec;
        };

        page.on('request', (request) => {
            if (!initialRequestId) {
                initialRequestId = request._requestId;
            }
            const rec = getOrCreateRequestRecord(request._requestId);
            rec.url = request.url;
            rec.method = request.method;
        });

        // WORKAROUND: Puppeteer's Network.loadingFinished handler doesn't store encodedDataLength field
        page._networkManager._client.on('Network.dataReceived', (params) => {
            const rec = getOrCreateRequestRecord(params.requestId);
            if (rec) {
                rec.responseBytes += params.encodedDataLength || 0;
            }
            result.responseTotalBytes += params.encodedDataLength || 0;
        });

        page.on('response', async (response) => {
            const request = response.request();
            const rec = getOrCreateRequestRecord(request._requestId);
            if (rec) {
                const data = await parseResponse(response);
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
            text: document.documentElement.innerText, // eslint-disable-line
            iframeCount: document.querySelectorAll('iframe').length, // eslint-disable-line
            scriptCount: document.querySelectorAll('script').length, // eslint-disable-line
            allWindowProperties: Object.keys(window), // eslint-disable-line
        }));

        Object.assign(result, _.pick(evalData, 'html', 'text', 'iframeCount', 'scriptCount', 'modernizr', 'html5'));

        // Extract list of non-native window properties
        const windowProperties = _.filter(evalData.allWindowProperties, (propName) => !nativeWindowsProperties[propName]);

        // Evaluate non-native window properties
        result.windowProperties = await page.evaluate(evalWindowProperties, windowProperties);
        const searchResults = {};
        try {
            const $ = cheerio.load(result.html);
            const treeSearcher = new TreeSearcher();
            result.schemaOrgData = parseSchemaOrgData({ $ });
            searchResults.schemaOrg = treeSearcher.find(result.schemaOrgData, searchFor);
            result.metadata = parseMetadata({ $ });
            searchResults.metadata = treeSearcher.find(result.metadata, searchFor);
            result.jsonld = parseJsonLD({ $ });
            searchResults.jsonLD = treeSearcher.find(result.jsonld, searchFor);
            searchResults.window = treeSearcher.find(result.windowProperties, searchFor);
            const domSearcher = new DOMSearcher({ $ });
            searchResults.html = domSearcher.find(searchFor);
        } catch (err) {
            console.error(err);
        }
        const crawlerGenerator = new CrawlerGenerator();
        const crawler = crawlerGenerator.generate(searchResults, searchFor);
        await Apify.setValue('OUTPUT', crawler, { contentType: 'text/javascript' });
        console.log(crawler);
    } catch (e) {
        console.log(`Loading of web page failed (${url}): ${e}`);
        console.error(e);
        result.errorInfo = e.stack || e.message || String(e);
    } finally {
        if (page) {
            page.close().catch((e) => console.log(`Error closing page 2 (${url}): ${e}`));
        }
    }
}

Apify.main(async () => {
    try {
        // Fetch the input and check it has a valid format
        // You don't need to check the input, but it's a good practice.
        const input = await Apify.getValue('INPUT');
        if (!typeCheck(INPUT_TYPE, input)) {
            console.log('Expected input:');
            console.log(INPUT_TYPE);
            console.log('Received input:');
            console.dir(input);
            throw new Error('Received invalid input');
        }

        console.log(`Analysing url: ${input.url}`);

        const browser = await puppeteer.launch({ args: ['--no-sandbox'], headless: true });
        await analysePage(browser, input.url, input.searchFor);
    } catch (error) {
        console.error(error);
    }
});
