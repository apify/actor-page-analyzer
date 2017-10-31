import Apify from 'apify';

export default class OutputGenerator {
    constructor() {
        this.fields = {
            analysisStarted: false,
            windowPropertiesParsed: false,
            windowPropertiesFound: [],
            schemaOrgDataParsed: false,
            schemaOrgDataFound: [],
            metaDataParsed: false,
            metaDataFound: [],
            jsonLDDataParsed: false,
            jsonLDDataFound: [],
            htmlParsed: false,
            htmlFound: [],
            crawler: '',
            analysisEnded: false,
        };
    }

    async set(field, value) {
        this.fields[field] = value;
        try {
            await Apify.setValue('OUTPUT', JSON.stringify(this.fields), { contentType: 'application/json' });
        } catch (error) {
            console.error(error);
        }
    }
}
