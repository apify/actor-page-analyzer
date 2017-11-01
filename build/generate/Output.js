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
            analysisStarted: false,
            windowPropertiesParsed: false,
            windowProperties: {},
            windowPropertiesFound: [],
            allWindowProperties: {},
            schemaOrgDataParsed: false,
            schemaOrgData: {},
            schemaOrgDataFound: [],
            metaDataParsed: false,
            metaData: {},
            metaDataFound: [],
            jsonLDDataParsed: false,
            jsonLDData: {},
            jsonLDDataFound: [],
            htmlParsed: false,
            htmlFound: [],
            crawler: '',
            analysisEnded: false
        };
    }

    async set(field, value) {
        this.fields[field] = value;
        try {
            await _apify2.default.setValue('OUTPUT', JSON.stringify(this.fields), { contentType: 'application/json' });
        } catch (error) {
            console.error(error);
        }
    }
}
exports.default = OutputGenerator;