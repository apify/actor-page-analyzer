'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _apify = require('apify');

var _apify2 = _interopRequireDefault(_apify);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class OutputGenerator {
    constructor() {
        this.fields = {
            analysisStarted: null,
            scrappingStarted: null,
            pageNavigated: null,
            scrappingFinished: null,
            windowPropertiesSearched: null,
            metadataSearched: null,
            schemaOrgSearched: null,
            jsonLDSearched: null,
            htmlSearched: null,
            xhrRequestsSearched: null,
            analysisEnded: null,
            initialResponse: null,
            windowPropertiesParsed: false,
            metaDataParsed: false,
            schemaOrgDataParsed: false,
            jsonLDDataParsed: false,
            htmlParsed: false,
            xhrRequestsParsed: false,
            windowProperties: {},
            windowPropertiesFound: [],
            allWindowProperties: {},
            schemaOrgData: {},
            schemaOrgDataFound: [],
            allSchemaOrgData: {},
            metaData: {},
            metaDataFound: [],
            jsonLDData: {},
            jsonLDDataFound: [],
            allJsonLDData: {},
            htmlFound: [],
            xhrRequests: [],
            xhrRequestsFound: [],
            error: null,
            pageError: null
        };
    }

    get(field) {
        return this.fields[field];
    }

    async set(field, value) {
        this.fields[field] = value;

        if (!this.fields.analysisEnded) {
            const done = ['windowPropertiesSearched', 'metadataSearched', 'schemaOrgSearched', 'jsonLDSearched', 'htmlSearched', 'xhrRequestsSearched'].reduce((finished, property) => {
                return this.fields[property] !== null && finished;
            }, true);

            if (done || this.fields.error || this.fields.pageError) {
                this.fields.analysisEnded = new Date();
                console.log('done');
            }
        }

        try {
            await _apify2.default.setValue('OUTPUT', JSON.stringify(this.fields, null, 2), { contentType: 'application/json' });
        } catch (error) {
            console.log('output error');
            console.error(error);
        }
    }
}
exports.default = OutputGenerator;