import util from 'util';
import crawlerTemplate from '../templates/crawler';
import jsonLDCrawlerTemplate from '../templates/jsonLDCrawler';

const METADA_COEFICIENT = 1;
const SCHEMA_ORG_COEFICIENT = 0.95;
const JSON_LD_COEFICIENT = 0.9;
const WINDOW_COEFICIENT = 0.9;
const HTML_COEFICIENT = 0.8;

const LETTER_COEFICIENT = 0.01;
const INCORRECT_CASE_COEFICIENT = 0.9;

function flattenResults(searchResults) {
    const flattendedSearchResults = [];
    Object.keys(searchResults).forEach(type => {
        const results = searchResults[type];
        results.forEach(result => {
            flattendedSearchResults.push({
                ...result,
                type,
            });
        });
    });
    return flattendedSearchResults;
}

function processResults(results, searchFor) {
    const processedResults = {};
    Object.keys(searchFor).forEach((key) => {
        const searchString = searchFor[key]
        const normalizedSearch = searchString.toLowerCase()
        processedResults[key] = results
            .map(result => {
                const value = String(result.value || result.text);
                const normalizedValue = value.toLowerCase();
                return {
                    ...result,
                    normalizedValue,
                    containsNormalizedSearch: normalizedValue.indexOf(normalizedSearch) !== -1,
                    containsNormalSearch: value.indexOf(searchString) !== -1,
                };
            })
            .filter(result => result.containsNormalizedSearch)
            .map(result => {
                const value = String(result.value || result.text);
                const extraLetters = result.normalizedValue.replace(normalizedSearch);
                const extraLettersDeduction = extraLetters.length * LETTER_COEFICIENT;
                let typeCoeficient = SCHEMA_ORG_COEFICIENT;
                const caseCoeficient = result.containsNormalSearch ? 1 : INCORRECT_CASE_COEFICIENT;
                switch (result.type) {
                case 'metadata':
                    typeCoeficient = METADA_COEFICIENT;
                    break;
                case 'jsonLD':
                    typeCoeficient = JSON_LD_COEFICIENT;
                    break;
                case 'window':
                    typeCoeficient = WINDOW_COEFICIENT;
                    break;
                case 'html':
                    typeCoeficient = HTML_COEFICIENT;
                    break;
                // no default
                }
                return {
                    ...result,
                    score: (typeCoeficient - extraLettersDeduction) * caseCoeficient,
                };
            })
            .sort((resultA, resultB) => {
                if (resultA.score < resultB.score) return 1;
                if (resultA.score > resultB.score) return -1;
                return 0;
            });
    });
    return processedResults;
}

export default class CrawlerGenerator {
    generate(searchResults, searchFor) {
        const flattenedResults = flattenResults(searchResults);
        this.results = processResults(flattenedResults, searchFor);
        const data = {
            requiresJQuery: false,
            requiresSchemaOrg: false,
            crawlerItems: [],
        };
        Object.keys(this.results).map(searchString => {
            const options = this.results[searchString];
            const bestOption = options.length ? options[0] : null;
            if (!bestOption) {
                data.crawlerItems.push(`parsedData['${searchString}'] = '';\n`);
                return;
            }

            const trimmedPath = bestOption.path ? bestOption.path.substr(1) : '';

            switch (bestOption.type) {
            case 'schemaOrg':
                data.requiresJQuery = true;
                data.requiresSchemaOrg = true;
                data.crawlerItems.push(`parsedData['${searchString}'] = schemaOrg${bestOption.path};`);
                break;
            case 'metadata':
                data.requiresJQuery = true;
                data.crawlerItems.push(`parsedData['${searchString}'] = $('meta[property="${trimmedPath}"], meta[name="${trimmedPath}"]').attr('content');`);
                break;
            case 'jsonLD':
                data.requiresJQuery = true;
                data.crawlerItems.push(jsonLDCrawlerTemplate(searchString, bestOption.path));
                break;
            case 'window':
                data.crawlerItems.push(`parsedData['${searchString}'] = window${bestOption.path};`);
                break;
            case 'html':
                data.requiresJQuery = true;
                data.crawlerItems.push(`parsedData['${searchString}'] = $('${bestOption.selector}').text();`);
                break;
            // no default
            }

            return data;
        });

        return crawlerTemplate(data);
    }
}
