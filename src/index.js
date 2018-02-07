import puppeteer from 'puppeteer';
import cheerio from 'cheerio';
import Apify from 'apify';
import { typeCheck } from 'type-check';
import { isString } from 'lodash';
import { anonymizeProxy, closeAnonymizedProxy } from 'proxy-chain';

import PageScrapper from './scrap/page';
import parseMetadata from './parse/metadata';
import parseSchemaOrgData from './parse/schema-org';
import parseJsonLD from './parse/json-ld';
import DOMSearcher from './search/DOMSearcher';
import TreeSearcher from './search/TreeSearcher';
import OutputGenerator from './generate/Output';
import { findCommonAncestors } from './utils';

let lastLog = Date.now();

const log = (message) => {
    const currentLog = Date.now();
    console.log(new Date(), `${Math.round((currentLog - lastLog) / 10) / 100}s`, message);
    lastLog = currentLog;
};

// Definition of the input
const INPUT_TYPE = `{
    url: String,
    searchFor: Array
}`;

function timeoutPromised(timeout) {
    return new Promise((resolve) => {
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
    const output = new OutputGenerator();
    log('analysisStarted');
    output.set('analysisStarted', new Date());

    const scrappedData = {
        windowProperties: {},
        html: '<body></body>',
    };
    const scrapper = new PageScrapper(browser);

    scrapper.on('started', (data) => {
        log('scrapping started');
        scrappedData.loadingStarted = data;
        output.set('scrappingStarted', data.timestamp);
    });

    scrapper.on('loaded', (data) => {
        log('loaded');
        scrappedData.loadingFinished = data;
        output.set('pageNavigated', data.timestamp);
    });

    scrapper.on('initial-response', async (response) => {
        log('initial response');
        output.set('initialResponse', {
            url: response.url,
            status: response.status,
            headers: response.responseHeaders,
        });

        console.log(response);

        const html = response.responseBody;
        const treeSearcher = new TreeSearcher();
        try {
            log(`start of html: ${html && html.substr && html.substr(0, 500)}`);
            const $ = cheerio.load(html);
            const metadata = parseMetadata({ $ });
            await output.set('metaDataParsed', true);
            await output.set('metaData', metadata);
            const foundMetadata = treeSearcher.find(metadata, searchFor);
            await output.set('metaDataFound', foundMetadata);
            log('metadata searched');
            await output.set('metadataSearched', new Date());

            const jsonld = parseJsonLD({ $ });
            await output.set('jsonLDDataParsed', true);
            await output.set('allJsonLDData', jsonld);
            const foundJsonLD = treeSearcher.find(jsonld, searchFor);
            await output.set('jsonLDDataFound', foundJsonLD);
            await output.set(
                'jsonLDData',
                findCommonAncestors(
                    jsonld,
                    foundJsonLD,
                ),
            );
            log('json-ld searched');
            await output.set('jsonLDSearched', new Date());

            const schemaOrgData = parseSchemaOrgData({ $ });
            await output.set('schemaOrgDataParsed', true);
            await output.set('allSchemaOrgData', schemaOrgData);
            const foundSchemaOrg = treeSearcher.find(schemaOrgData, searchFor);
            await output.set('schemaOrgDataFound', foundSchemaOrg);
            await output.set(
                'schemaOrgData',
                findCommonAncestors(
                    schemaOrgData,
                    foundSchemaOrg,
                ),
            );
            log('schema org searched');
            await output.set('schemaOrgSearched', new Date());

            output.set('htmlParsed', true);
            const domSearcher = new DOMSearcher({ $ });
            const foundSelectors = domSearcher.find(searchFor);
            await output.set('htmlFound', foundSelectors);
            log('initial html searched');
        } catch (error) {
            console.error('Intitial response parsing failed');
            console.error(error);
        }
    });

    scrapper.on('html', async (html) => {
        log('html');
        scrappedData.html = html;
        output.set('htmlFullyParsed', true);
        try {
            const $ = cheerio.load(scrappedData.html || '<body></body>');
            const domSearcher = new DOMSearcher({ $ });
            const foundSelectors = domSearcher.find(searchFor);
            await output.set('htmlFound', foundSelectors);
        } catch (error) {
            console.error('HTML search failed');
            console.error(error);
        }
        log('html searched');
        await output.set('htmlSearched', new Date());
    });

    scrapper.on('window-properties', async (properties) => {
        log('window properties');
        scrappedData.windowProperties = properties;
        output.set('windowPropertiesParsed', true);
        output.set('allWindowProperties', properties);
        // Evaluate non-native window properties

        const treeSearcher = new TreeSearcher();
        try {
            const foundWindowProperties = treeSearcher.find(scrappedData.windowProperties, searchFor);
            output.set('windowPropertiesFound', foundWindowProperties);
            output.set(
                'windowProperties',
                findCommonAncestors(
                    scrappedData.windowProperties,
                    foundWindowProperties,
                    true,
                ),
            );
            log('window properties searched');
        } catch (error) {
            console.error('Window properties parsing failed');
            console.error(error);
        }
        output.set('windowPropertiesSearched', new Date());
    });

    scrapper.on('screenshot', (data) => {
        log('screenshot');
        output.set('screenshot', data);
    });

    scrapper.on('requests', async (requests) => {
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
            const treeSearcher = new TreeSearcher();
            const xhrRequestResults = [];
            requests.forEach(request => {
                let results;
                if (isString(request.responseBody)) {
                    const searcher = new DOMSearcher({ html: request.responseBody });
                    results = searcher.find(searchFor);
                } else {
                    results = treeSearcher.find(request.responseBody, searchFor);
                }
                if (results.length > 0) {
                    xhrRequestResults.push({
                        request: `${request.method} ${request.url}`,
                        response: request.responseBody,
                        searchResults: results,
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

    scrapper.on('done', (data) => {
        log('scrapping finished');
        output.set('scrappingFinished', data.timestamp);
    });

    scrapper.on('page-error', (data) => {
        log('page error');
        scrappedData.pageError = data;
        output.set('pageError', data);
    });

    scrapper.on('error', (data) => {
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
        // wait till all async actions are done
        // await new Promise(resolve => setTimeout(resolve, 5000));
        // force last write of output data
        log('Force write of output with await');
        await output.writeOutput();
    } catch (error) {
        console.error(error);
    }
}

Apify.main(async () => {
    log('Analysing url from input');
    try {
        // Fetch the input and check it has a valid format
        // You don't need to check the input, but it's a good practice.
        const input = await Apify.getValue('INPUT');
        if (!typeCheck(INPUT_TYPE, input)) {
            log('Expected input:');
            log(INPUT_TYPE);
            log('Received input:');
            console.dir(input);
            throw new Error('Received invalid input');
        }

        const args = ['--no-sandbox'];
        if (process.env.PROXY_GROUP && process.env.TOKEN) {
            const { TOKEN, PROXY_GROUP } = process.env;
            const proxyUrl = `http://${PROXY_GROUP}:${TOKEN}@proxy.apify.com:8000`;
            const anonProxy = await anonymizeProxy(proxyUrl);
            args.push(`--proxy-server=${anonProxy}`);
        }
        const browser = await puppeteer.launch({ args, headless: true });
        await analysePage(browser, input.url, input.searchFor);
        log('Analyse page finished');
    } catch (error) {
        log('Top level error');
        console.error(error);
    }
});
