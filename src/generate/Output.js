import Apify from 'apify';

export default class OutputGenerator {
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
            pageError: null,
        };
        this.writeTimeout = null;
        this.writeOutput = this.writeOutput.bind(this);
    }

    get(field) {
        return this.fields[field];
    }

    async writeOutput() {
        const data = JSON.stringify(this.fields, null, 2);
        try {
            await Apify.setValue('OUTPUT', data, { contentType: 'application/json' });
            if (this.fields.analysisEnded) this.fields.outputFinished = true;
        } catch (error) {
            console.error('could not save output');
            console.error(error);
        }
    }

    set(field, value) {
        this.fields[field] = value;

        if (!this.fields.analysisEnded) {
            const done = [
                'windowPropertiesSearched',
                'metadataSearched',
                'schemaOrgSearched',
                'jsonLDSearched',
                'htmlSearched',
                'xhrRequestsSearched',
            ].reduce((finished, property) => {
                return this.fields[property] !== null && finished;
            }, true);

            if (done || this.fields.error || this.fields.pageError) {
                this.fields.analysisEnded = new Date();
                console.log('done');
            }
        }

        if (this.writeTimeout) clearTimeout(this.writeTimeout);
        this.writeTimeout = setTimeout(this.writeOutput, 300);
    }
}
