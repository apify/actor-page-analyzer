const VALUABLE_CONTENT_TYPES = [
    /* 'text/html', */
    'application/json',
    'application/ld+json',
];

// attempt to parse JSON response, save error if parsing fails
async function parseJSONResponse(response) {
    let result;
    try {
        const json = await response.json();
        result = {
            valid: true,
            data: json,
        };
    } catch (err) {
        // Parsing JSON failed
        result = {
            valid: false,
            error: err,
        };
    }
    return result;
}

export default async function parseResponse(response) {
    const result = {};
    result.status = response.status;
    result.headers = response.headers;

    // ignore body if request failed remove this optimization if you want to store
    // errors too
    if (Number(result.status || 200) > 300) {
        return result;
    }

    const contentType = response.headers['content-type'];
    const valueableType = VALUABLE_CONTENT_TYPES.filter(ct => (contentType && contentType.indexOf(ct) !== -1));
    // ignore body if it's not important
    if (!valueableType.length) {
        return result;
    }

    try {
        if (contentType === 'application/json') {
            result.body = await parseJSONResponse(response);
        } else {
            result.body = await response.text();
        }
    } catch (err) {
        // Parsing BODY Failed, log error
        console.log(err);
    }
    return result;
}
