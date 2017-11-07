import { isArray, isObject, sortBy } from 'lodash';
import { normalize } from '../utils';

const LETTER_DEDUCTION = 0.01;

export default class TreeSearcher {
    constructor() {
        this.findInTree = this.findInTree.bind(this);
    }
    findInTree(data, path = '', depth = 0) {
        const { normalizedSearch, findInTree } = this;

        if (!data) return;
        if (!isArray(data) && !isObject(data)) {
            let item = data;
            if (item.toString) {
                item = item.toString();
            }
            const normalizedText = normalize(item);
            const pathScore = depth;
            const score = normalizedSearch.reduce((lastScore, searchString) => {
                if (normalizedText.indexOf(searchString) === -1) return lastScore;
                const remainingTextLength = normalizedText.replace(searchString, '').length;
                if (remainingTextLength > 40) return lastScore;
                const searchScore = pathScore * (1 + (remainingTextLength * LETTER_DEDUCTION));
                return Math.max(lastScore, searchScore);
            }, 0);

            if (score > 0) {
                this.foundPaths.push({
                    path: `${path}`,
                    value: data,
                    score,
                });
            }
        } else if (isArray(data)) {
            data.forEach((value, index) => {
                findInTree(value, `${path}[${index}]`, depth + 1);
            });
        } else if (isObject(data)) {
            Object.keys(data).forEach(key => {
                const value = data[key];
                findInTree(value, `${path}.${key}`, depth + 1);
            });
        }
    }
    find(data, searchFor, path = '') {
        this.foundPaths = [];
        this.searchFor = searchFor;
        this.normalizedSearch = searchFor.map(searchString => normalize(searchString));
        this.findInTree(data, path);
        return sortBy(this.foundPaths, ['score']).map((foundPath) => ({
            path: foundPath.path,
            value: foundPath.value,
        }));
    }
}
