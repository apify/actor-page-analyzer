import puppeteer from 'puppeteer';
import _ from 'lodash';
import async from 'async';
import fs from 'fs';
import cheerio from 'cheerio';

import evalWindowProperties, { getNativeWindowProperties } from './parse/window-properties';
import parseResponse from './parse/xhr-requests';
import parseMetadata from './parse/metadata';
import parseSchemaOrgData from './parse/schema-org';
import parseJsonLD from './parse/json-ld';
import searchData from './search/search';

// eslint-disable-next-line
const inputURLs = ['http://www.imdb.com/title/tt1856101/?pf_rd_m=A2FGELUUNOQJNL&pf_rd_p=2773216402&pf_rd_r=10DBXD6JX4H7D7C8FEJD&pf_rd_s=right-7&pf_rd_t=15061&pf_rd_i=homepage&ref_=hm_cht_t1'];
const searchFor = ['blade runner 2049', '8.5', 'ryan gosling'];

let nativeWindowsProperties = null;

async function analysePage({ browser, url }) {
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

        Object.assign(result, _.pick(evalData, 'html', 'text', 'iframeCount', 'scriptCount'));

        // Extract list of non-native window properties
        const windowProperties = _.filter(evalData.allWindowProperties, (propName) => !nativeWindowsProperties[propName]);

        // Evaluate non-native window properties
        result.windowProperties = await page.evaluate(evalWindowProperties, windowProperties);

        try {
            const $ = cheerio.load(result.html);
            result.schemaOrgData = parseSchemaOrgData({ $ });
            result.metadata = parseMetadata({ $ });
            result.jsonld = parseJsonLD({ $ });
        } catch (err) {
            console.error(err);
        }

        result.searchResults = searchData(result, searchFor);

        result.analysedAt = new Date();
    } catch (e) {
        console.log(`Loading of web page failed (${url}): ${e}`);
        console.error(e);
        result.errorInfo = e.stack || e.message || String(e);
    } finally {
        if (page) {
            page.close().catch((e) => console.log(`Error closing page 2 (${url}): ${e}`));
        }
    }

    console.log(`Page finished: ${result.url}`);

    fs.writeFile('result.json', JSON.stringify(result), (err) => {
        if (err) {
            throw err;
        }
    });
}

async function main() {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'], headless: true });
    // Load pages in asynchronous queue with a specified concurrency
    const queue = async.queue(analysePage, 1);

    // Push all not-yet-crawled URLs to to the queue
    inputURLs.forEach((url) => {
        queue.push({
            browser,
            url,
        }, (err) => {
            if (err) {
                console.log(`WARNING: Unhandled exception from worker function: ${err.stack || err}`);
            }
        });
    });

    // Wait for the queue to finish all tasks
    if (inputURLs.length > 0) {
        await new Promise((resolve) => {
            queue.drain = resolve;
        });
    }
}

main();
