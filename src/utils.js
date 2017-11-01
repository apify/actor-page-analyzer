import request from 'request';
import { AllHtmlEntities } from 'html-entities';
import { isString } from 'lodash';

const entities = new AllHtmlEntities();

export const requestPromised = async (opts) => (
    new Promise((resolve, reject) => (
        request(opts, (error, response, body) => {
            if (error) {
                return reject(error);
            }
            return resolve({ body, response });
        })
    ))
);

export const removeHTMLTags = (text) => text.replace(/<[^>]*>?/g, '');
export const replaceHTMLEntities = (text) => entities.decode(text);
export const removeSpaces = (text) => text.replace(/\s/g, '');
export const convertCommasInNumbers = (text) => text.replace(/(\d+),(\d+)/g, '$1.$2');

export const normalize = (text) => {
    if (!isString(text)) return text;
    let normalized = removeHTMLTags(text);
    normalized = replaceHTMLEntities(normalized);
    normalized = removeSpaces(normalized);
    normalized = convertCommasInNumbers(normalized);
    return normalized;
};

export const cleanData = (data) => {
    let cache = [];
    const result = JSON.parse(JSON.stringify(data, (key, value) => {
        if (typeof value === 'function') {
            return 'function';
        }
        if (typeof value === 'object' && value !== null) {
            if (cache.indexOf(value) !== -1) {
                return null;
            }
            cache.push(value);
        }
        return value;
    }));
    cache = null; // clean memory
    return result;
};
