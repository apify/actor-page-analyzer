import request from 'request';

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

export const concatArrays = (...args) => args.reduce(
    (acc, val) => [
        ...acc,
        ...val,
    ],
    [],
);

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
