import _ from 'lodash';

export const getNativeWindowProperties = async (page) => {
    const keys = await page.evaluate(() => Object.keys(window)) // eslint-disable-line
    // Other concurrent worker might have done the same in the meantime
    const nativeWindowsProperties = {};
    _.each(keys, (key) => {
        nativeWindowsProperties[key] = true;
    });
    return nativeWindowsProperties;
};

export function cleanWindowProperties(properties, found) {
    const importantProperties = [];
    found.forEach(({ path }) => {
        const cleanPath = path.substr(1);

        let indexOfBracket = cleanPath.indexOf('[');
        if (indexOfBracket === -1) indexOfBracket = Number.MAX_SAFE_INTEGER;
        let indexOfDot = cleanPath.indexOf('.');
        if (indexOfDot === -1) indexOfDot = Number.MAX_SAFE_INTEGER;
        const endOfPropertyName = Math.min(indexOfBracket, indexOfDot);

        const property = cleanPath.substr(0, endOfPropertyName);
        if (importantProperties.indexOf(property) === -1) importantProperties.push(property);
    });

    const cleanedUpProperties = {};
    Object.keys(properties)
        .filter(property => importantProperties.indexOf(property) !== -1)
        .forEach(property => {
            cleanedUpProperties[property] = properties[property];
        });
    return cleanedUpProperties;
}

// Evaluate window properties, save content for variables that are not function
export default function evalWindowProperties(properties) {
    const result = {};
    let cache = [];


    function isNotImportant(property) {
        return property === null ||
            property === '' ||
            property === {} ||
            property === [] ||
            property === true ||
            property === false;
    }

    properties
        .forEach((property) => {
            const propertyContent = window[property] // eslint-disable-line
            if (isNotImportant(propertyContent)) {
                return;
            }
            if (propertyContent && !!propertyContent.document && !!propertyContent.location) return;
            switch (typeof propertyContent) {
            // Skip functions, used switch for future improvements
            case 'function':
                break;
            default:
                try {
                    // remove circular references and functions from variable content
                    result[property] = JSON.parse(JSON.stringify(propertyContent, (key, value) => {
                        if (isNotImportant(value)) return undefined;
                        if (typeof value === 'function') {
                            return undefined;
                        }
                        if (typeof value === 'object' && value !== null) {
                            if (cache.indexOf(value) !== -1) {
                                return undefined;
                            }
                            cache.push(value);
                        }
                        return value;
                    }));
                } catch (err) {
                    result[property] = err;
                }
            }
        });
    cache = null;
    return result;
}
