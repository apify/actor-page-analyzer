import { URL } from 'url';

export default function crawlerTeplate({
    url,
    pageFunction,
    requiresJQuery,
}) {
    return {
        "clickableElementsSelector": null,
        "pageFunction": pageFunction,
        "interceptRequest": "function interceptRequest(context, newRequest) {\n    // called whenever the crawler finds a link to a new page,\n    // use it to override default behavior\n    return newRequest;\n}\n",
        "loadImages": false,
        "loadCss": false,
        "injectJQuery": !!requiresJQuery,
        "ignoreRobotsTxt": false,
        "cookiesPersistence": "PER_PROCESS",
        "customId": new URL(url).hostname.replace('.', '-'),
        "comments": null,
        "startUrls": [
            {
              "key": "",
              "value": url
            }
        ],
    };
}
