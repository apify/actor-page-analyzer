import puppeteer from 'puppeteer';
import cheerio from 'cheerio';
import Apify from 'apify';
import { typeCheck } from 'type-check';
import { isString } from 'lodash';

import PageScrapper from './scrap/page';
import { cleanWindowProperties } from './parse/window-properties';
import parseMetadata from './parse/metadata';
import parseSchemaOrgData from './parse/schema-org';
import parseJsonLD from './parse/json-ld';
import DOMSearcher from './search/DOMSearcher';
import TreeSearcher from './search/TreeSearcher';
import CrawlerGenerator from './generate/Crawler';
import OutputGenerator from './generate/Output';

// Definition of the input
const INPUT_TYPE = `{
    url: String,
    searchFor: Object
}`;

async function analysePage(browser, url, searchFor) {
    const output = new OutputGenerator();

    const scrappedData = {
        windowProperties: {},
        html: '<body></body>',
    };
    const scrapper = new PageScrapper(browser);

    scrapper.on('started', (data) => {
        console.log('scrapping started');
        scrappedData.loadingStarted = data;
        output.set('analysisStarted', data.timestamp);
    });

    scrapper.on('loaded', (data) => {
        console.log('loaded');
        scrappedData.loadingFinished = data;
        output.set('pageNavigated', data.timestamp);
    });

    scrapper.on('initial-response', (response) => {
        console.log('initial response');
        output.set('initialResponse', response);
    });

    scrapper.on('html', (html) => {
        console.log('html');
        scrappedData.html = html;
        output.set('htmlParsed', true);
        output.set('html', html);
    });

    scrapper.on('window-properties', (properties) => {
        console.log('window properties');
        scrappedData.windowProperties = properties;
        output.set('windowPropertiesParsed', true);
        output.set('allWindowProperties', properties);
    });

    scrapper.on('screenshot', (data) => {
        console.log('screenshot');
        output.set('screenshot', data);
    });

    scrapper.on('requests', (requests) => {
        console.log('requests');
        scrappedData.xhrRequests = requests;
        output.set('xhrRequestsParsed', true);
        output.set('xhrRequests', requests);
    });

    scrapper.on('done', (data) => {
        console.log('scrapping finished');
        output.set('scrappingFinished', data.timestamp);
    });

    scrapper.on('page-error', (data) => {
        console.log('page error');
        scrappedData.pageError = data;
        output.set('pageError', data);
    });

    scrapper.on('error', (data) => {
        console.log('error');
        scrappedData.pageError = data;
        output.set('error', data);
    });

    try {
        await scrapper.start(url);

        console.log('search started');
        const searchResults = {};
        try {
            const $ = cheerio.load(scrappedData.html || '<body></body>');
            const treeSearcher = new TreeSearcher();

            // Evaluate non-native window properties
            searchResults.window = treeSearcher.find(scrappedData.windowProperties, searchFor);
            await output.set('windowPropertiesFound', searchResults.window);
            await output.set(
                'windowProperties',
                cleanWindowProperties(
                    scrappedData.windowProperties,
                    searchResults.window,
                ),
            );
            console.log('window properties searched');

            const schemaOrgData = parseSchemaOrgData({ $ });
            await output.set('schemaOrgDataParsed', true);
            await output.set('schemaOrgData', schemaOrgData);
            searchResults.schemaOrg = treeSearcher.find(schemaOrgData, searchFor);
            await output.set('schemaOrgDataFound', searchResults.schemaOrg);
            console.log('schema org searched');

            const metadata = parseMetadata({ $ });
            await output.set('metaDataParsed', true);
            await output.set('metaData', metadata);
            searchResults.metadata = treeSearcher.find(metadata, searchFor);
            await output.set('metaDataFound', searchResults.metadata);
            console.log('metadata searched');

            const jsonld = parseJsonLD({ $ });
            await output.set('jsonLDDataParsed', true);
            await output.set('jsonLDData', jsonld);
            searchResults.jsonLD = treeSearcher.find(jsonld, searchFor);
            await output.set('jsonLDDataFound', searchResults.jsonLD);
            console.log('json-ld searched');

            const domSearcher = new DOMSearcher({ $ });
            searchResults.html = domSearcher.find(searchFor);
            await output.set('htmlFound', searchResults.html);
            console.log('html searched');

            const xhrRequestResults = [];
            scrappedData.xhrRequests.forEach(request => {
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
            await output.set('xhrRequestsFound', xhrRequestResults);
            console.log('xhrRequests searched');
        } catch (err) {
            console.error(err);
        }
        const crawlerGenerator = new CrawlerGenerator();
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

Apify.main(async () => {
    console.log('Analysing url from input');
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

        const browser = await puppeteer.launch({ args: ['--no-sandbox'], headless: true });
        await analysePage(browser, input.url, input.searchFor);
    } catch (error) {
        console.error(error);
    }
});
