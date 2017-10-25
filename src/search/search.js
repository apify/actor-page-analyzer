import _ from 'lodash';
import { concatArrays } from '../utils';

function searchInTree(searchFor, data, path = '') {
    if (!data) {
        return [];
    }
    if (!_.isArray(data) && !_.isObject(data)) {
        let item = data;
        if (item.toString) {
            item = item.toString();
        }
        if (item.toLowerCase) {
            item = item.toLowerCase();
        }
        const foundStrings = searchFor.reduce((found, searchedString) => {
            if (item.indexOf(searchedString) !== -1) {
                return [
                    ...found,
                    searchedString,
                ];
            }
            return found;
        }, []);
        if (foundStrings.length > 0) {
            return [
                {
                    path: `${path}`,
                    value: data,
                },
            ];
        }
        return [];
    }
    const result = Object.keys(data).filter((key) => {
        let item = data[key];
        if (!item) {
            return false;
        }
        if (_.isArray(item) || _.isObject(item)) {
            return true;
        }
        if (item.toString) {
            item = item.toString();
        }
        if (item.toLowerCase) {
            item = item.toLowerCase();
        }
        const foundStrings = searchFor.reduce((found, searchedString) => {
            if (item.indexOf(searchedString) !== -1) {
                return [
                    ...found,
                    searchedString,
                ];
            }
            return found;
        }, []);
        return foundStrings.length > 0;
    }).reduce((foundItems, key) => {
        const item = data[key];
        if (_.isArray(item)) {
            const found = item.reduce((foundInSubtrees, subKey) => {
                const resultsInSubtrees = searchInTree(item[subKey], `${path}.${key}[${subKey}]`);
                return [
                    ...foundInSubtrees,
                    ...resultsInSubtrees,
                ];
            }, []);
            return [
                ...foundItems,
                ...found,
            ];
        } else if (_.isObject(item)) {
            const found = Object.keys(item).reduce((foundInSubtrees, subKey) => {
                const resultsInSubtrees = searchInTree(item[subKey], `${path}.${key}.${subKey}`);
                return [
                    ...foundInSubtrees,
                    ...resultsInSubtrees,
                ];
            }, []);
            return [
                ...foundItems,
                ...found,
            ];
        }
        return [
            ...foundItems,
            {
                path: `${path}.${key}`,
                value: item,
            },
        ];
    }, []);
    return concatArrays(result);
}

export default function searchData(
    {
        schemaOrgData,
        metadata,
        jsonld,
        windowProperties,
        requests,
    },
    searchFor,
) {
    const schemaOrgResults = searchInTree(searchFor, schemaOrgData, 'schemaOrg');
    const metadataResults = searchInTree(searchFor, metadata, 'meta');
    const jsonldResult = searchInTree(searchFor, jsonld, 'jsonLd');
    const windowPropertyResults = searchInTree(searchFor, windowProperties, 'window');
    const xhrRequestsResults = searchInTree(searchFor, requests, 'requests');
    let results = [];
    if (schemaOrgResults.length) {
        results = [...schemaOrgResults];
    }
    if (metadataResults.length) {
        results = [
            ...results,
            ...metadataResults,
        ];
    }
    if (jsonldResult.length) {
        results = [
            ...results,
            ...jsonldResult,
        ];
    }
    if (windowPropertyResults.length) {
        results = [
            ...results,
            ...windowPropertyResults,
        ];
    }
    if (xhrRequestsResults.length) {
        results = [
            ...results,
            ...xhrRequestsResults,
        ];
    }
    return results;
}
