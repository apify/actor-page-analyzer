import Apify from 'apify';

export default class OutputGenerator {
    constructor() {
        this.fields = {
            analysisStarted: null,
            pageNavigated: null,
            initialResponse: null,
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
            html: '',
            htmlParsed: false,
            htmlFound: [],
            xhrRequestsParsed: false,
            xhrRequests: [],
            xhrRequestsFound: [],
            crawler: '',
            scrappingFinished: null,
            analysisEnded: null,
            screenshot: '',
            error: null,
            pageError: null,
        };
    }

    async set(field, value) {
        this.fields[field] = value;
        try {
            await Apify.setValue('OUTPUT', JSON.stringify(this.fields), { contentType: 'application/json' });
        } catch (error) {
            console.log('output error');
            console.error(error);
        }
    }
}
