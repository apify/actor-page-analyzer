import { isArray, isObject } from 'lodash';
import util from 'util';

export default class TreeSearcher {
    constructor() {
        this.findInTree = this.findInTree.bind(this);
    }
    findInTree(data, path = '') {
        const { searchFor, findInTree } = this;

        if (!data) return;
        if (!isArray(data) && !isObject(data)) {
            let item = data;
            if (item.toString) {
                item = item.toString();
            }
            const normalizedText = item.toLowerCase ? item.toLowerCase() : item;
            const foundString = searchFor.reduce((found, searchedString) => {
                if (found) return true;
                return normalizedText.indexOf(searchedString) !== -1;
            }, false);
            if (foundString) {
                this.foundPaths.push({
                    path: `${path}`,
                    value: data,
                });
            }
        } else if (isArray(data)) {
            data.forEach((value, index) => {
                findInTree(value, `${path}[${index}]`);
            });
        } else if (isObject(data)) {
            Object.keys(data).forEach(key => {
                const value = data[key];
                findInTree(value, `${path}.${key}`);
            });
        }
    }
    find(data, searchFor, path = '') {
        this.foundPaths = [];
        this.searchFor = searchFor;
        this.findInTree(data, path);
        // console.log(util.inspect(this.foundPaths, { showHidden: false, depth: null }));
        return this.foundPaths;
    }
}
