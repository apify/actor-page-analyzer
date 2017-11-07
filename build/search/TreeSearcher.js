'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _lodash = require('lodash');

var _utils = require('../utils');

const LETTER_DEDUCTION = 0.01;

class TreeSearcher {
    constructor() {
        this.findInTree = this.findInTree.bind(this);
    }
    findInTree(data, path = '', depth = 0) {
        const { normalizedSearch, findInTree } = this;

        if (!data) return;
        if (!(0, _lodash.isArray)(data) && !(0, _lodash.isObject)(data)) {
            let item = data;
            if (item.toString) {
                item = item.toString();
            }
            const normalizedText = (0, _utils.normalize)(item);
            const pathScore = depth;
            const score = normalizedSearch.reduce((lastScore, searchString) => {
                if (normalizedText.indexOf(searchString) === -1) return lastScore;
                const remainingTextLength = normalizedText.replace(searchString, '').length;
                if (remainingTextLength > 40) return lastScore;
                const searchScore = pathScore * (1 + remainingTextLength * LETTER_DEDUCTION);
                return Math.max(lastScore, searchScore);
            }, 0);

            if (score > 0) {
                this.foundPaths.push({
                    path: `${path}`,
                    value: data,
                    score
                });
            }
        } else if ((0, _lodash.isArray)(data)) {
            data.forEach((value, index) => {
                findInTree(value, `${path}[${index}]`, depth + 1);
            });
        } else if ((0, _lodash.isObject)(data)) {
            Object.keys(data).forEach(key => {
                const value = data[key];
                findInTree(value, `${path}.${key}`, depth + 1);
            });
        }
    }
    find(data, searchFor, path = '') {
        this.foundPaths = [];
        this.searchFor = searchFor;
        this.normalizedSearch = searchFor.map(searchString => (0, _utils.normalize)(searchString));
        this.findInTree(data, path);
        return (0, _lodash.sortBy)(this.foundPaths, ['score']).map(foundPath => ({
            path: foundPath.path,
            value: foundPath.value
        }));
    }
}
exports.default = TreeSearcher;