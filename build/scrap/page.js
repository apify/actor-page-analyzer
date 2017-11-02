'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _windowProperties = require('../parse/window-properties');

var _windowProperties2 = _interopRequireDefault(_windowProperties);

var _xhrRequests = require('../parse/xhr-requests');

var _xhrRequests2 = _interopRequireDefault(_xhrRequests);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const IGNORED_EXTENSIONS = ['.css', '.png', '.jpg', '.svg'];

class PageScrapper {
    constructor(browser) {
        this.browser = browser;
        this.requests = {};
        this.handlers = {};
        this.mainRequestId = null;

        this.on = this.on.bind(this);
        this.call = this.call.bind(this);
        this.start = this.start.bind(this);
        this.getOrCreateRequestRecord = this.getOrCreateRequestRecord.bind(this);
        this.onRequest = this.onRequest.bind(this);
        this.onResponse = this.onResponse.bind(this);
        this.onPageError = this.onPageError.bind(this);
    }

    on(action, handler) {
        this.handlers[action] = handler;
    }

    call(action, data) {
        if (this.handlers[action]) {
            this.handlers[action](data);
        }
    }

    getOrCreateRequestRecord(requestId) {
        let rec = this.requests[requestId];
        if (!rec) {
            rec = {
                url: null,
                method: null,
                responseStatus: null,
                responseHeaders: null
            };
            this.requests[requestId] = rec;
        }
        return rec;
    }

    onRequest(request) {
        const ignore = IGNORED_EXTENSIONS.reduce((ignored, extension) => {
            if (ignored) return ignored;
            return request.url.endsWith(extension);
        }, false);

        if (ignore) {
            request.abort();
            return;
        }
        request.continue();

        if (!this.mainRequestId) {
            this.mainRequestId = request._requestId;
        }

        const rec = this.getOrCreateRequestRecord(request._requestId);
        rec.url = request.url;
        rec.method = request.method;
        this.call('request', request);
    }
    async onResponse(response) {
        const request = response.request();
        const rec = this.requests[request._requestId];
        if (!rec) return;

        const data = await (0, _xhrRequests2.default)(response);
        if (!data.ignore) {
            rec.responseStatus = data.status;
            rec.responseHeaders = data.headers;
            rec.responseBody = data.body;
            this.requests[request._requestId] = rec;
        } else {
            this.requests[request._requestId] = undefined;
        }
        this.call('response', rec);
    }

    async onPageError(err) {
        this.call('page-error', err);
        this.closePage();
    }

    async closePage() {
        try {
            await this.page.close();
        } catch (error) {
            this.call('error', {
                message: 'Error closing page',
                error
            });
        }
    }

    async start(url) {
        this.requests = {};
        this.mainRequestId = null;
        this.page = null;

        try {
            this.page = await this.browser.newPage();
            this.page.setRequestInterceptionEnabled(true);

            this.page.on('error', this.onPageError);

            const nativeWindowsProperties = await (0, _windowProperties.getNativeWindowProperties)(this.page);

            this.page.on('request', this.onRequest);
            this.page.on('response', this.onResponse);

            this.call('started', { url, timestamp: new Date() });
            await this.page.goto(url);

            this.page.waitForNavigation({ waitUntil: 'networkidle', networkIdleTimeout: 2000 });

            this.call('loaded', { url, timestamp: new Date() });

            const pageUrl = await this.page.url();
            const rec = this.requests[this.mainRequestId];

            if (!rec) {
                this.closePage();
                return;
            }

            this.call('requests', Object.keys(this.requests).filter(requestId => {
                if (requestId === this.mainRequestId) return false;
                if (!this.requests[requestId]) return false;
                if (!this.requests[requestId].responseBody) return false;
                return true;
            }).map(requestId => this.requests[requestId]));

            this.call('initial-response', {
                url: pageUrl,
                status: rec.responseStatus,
                headers: rec.responseHeaders
            });

            const data = await this.page.evaluate(() => ({
                html: document.documentElement.innerHTML, // eslint-disable-line
                allWindowProperties: Object.keys(window) // eslint-disable-line
            }));

            this.call('html', data.html);

            // Extract list of non-native window properties
            let windowProperties = _lodash2.default.filter(data.allWindowProperties, propName => !nativeWindowsProperties[propName]);
            windowProperties = await this.page.evaluate(_windowProperties2.default, windowProperties);
            this.call('window-properties', windowProperties);

            const screenshotBuffer = await this.page.screenshot();
            const screenshotBase64 = screenshotBuffer.toString('base64');
            this.call('screenshot', screenshotBase64);

            this.call('done', new Date());
        } catch (e) {
            this.call('error', `Loading of web page failed (${url}): ${e}`);
        } finally {
            this.closePage();
        }
    }
}
exports.default = PageScrapper;