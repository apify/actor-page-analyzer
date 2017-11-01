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
    /* EXAMPLE of found
    [{
        "path": ".dataLayer[0].itemName",
        "value": "Samsung Galaxy A3 (2017) modrý"
    }, {
        "path": ".dataLayer[0].itemPrice",
        "value": "6999"
    }],
    */
    const importantProperties = [];
    found.forEach(({ path }) => {
        const cleanPath = path.substr(1);
        const endOfPropertyName = Math.min(cleanPath.indexOf('['), cleanPath.indexOf('.'));
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


    function isEmpty(property) {
        return property === null || property === '' || property === {} || property === [];
    }

    properties
        .forEach((property) => {
            const propertyContent = window[property] // eslint-disable-line
            if (isEmpty(propertyContent)) {
                return;
            }
            switch (typeof propertyContent) {
            // Skip functions, used switch for future improvements
            case 'function':
                break;
            default:
                try {
                    // remove circular references and functions from variable content
                    result[property] = JSON.parse(JSON.stringify(propertyContent, (key, value) => {
                        if (isEmpty(value)) return undefined;
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
    console.log(Object.keys(result));
    return result;
}
