import { isArray, isObject, sortBy, isNumber, isString } from 'lodash';
import { normalize } from '../utils';

const LETTER_DEDUCTION = 0.01;

function traverseTree(root, path) {
    let item = root;
    path.forEach(step => {
        if (step === '') return;
        if (step.indexOf('[') !== -1) {
            const match = step.match(/^(.*)\[(\d*)\]$/);
            const field = match[1];
            const position = Number(match[2]);
            if (isString(field) && !!field) {
                if (!Object.prototype.hasOwnProperty.call(item, field)) {
                    throw new Error(`${field} is not in supplied tree.`);
                }
                item = item[field];
            }
            if (isNumber(position)) {
                if (position > item.length - 1) {
                    throw new Error(`Array in tree does not have ${position + 1} elements.`);
                }
                item = item[position];
            }
        } else {
            if (!Object.prototype.hasOwnProperty.call(item, step)) {
                throw new Error(`${step} is not in supplied tree.`);
            }
            item = item[step];
        }
    });
    return item;
}

function findSimilarPaths(data, paths) {
    return paths
        .map((foundPath) => {
            const { path } = foundPath;
            const steps = path.split('.');
            const arrayOptions = steps
                .reduce((arrays, step, i) => {
                    if (step.indexOf('[') !== -1 && step.indexOf(']') !== -1) {
                        arrays.push(i);
                    }
                    return arrays;
                }, [])
                .map(index => ({
                    arrayPath: steps.slice(0, index + 1),
                    childPath: steps.slice(index + 1),
                }))
                .reverse()
                .map(({ arrayPath, childPath }) => {
                    arrayPath[arrayPath.length - 1] = arrayPath[arrayPath.length - 1].replace(/^(.*)\[\d+\]$/, '$1');
                    let arrayElement;
                    try {
                        arrayElement = traverseTree(data, arrayPath);
                    } catch (error) {
                        console.error(error);
                        return null;
                    }
                    const possibleIndexes = arrayElement.reduce((indexes, branch, i) => {
                        try {
                            const item = traverseTree(branch, childPath);
                            indexes[i] = item;
                        } catch (error) {
                            // skip error output, this is here just to handle throw from traverseTree
                        }
                        return indexes;
                    }, {});
                    return {
                        arrayPath: arrayPath.join('.'),
                        childPath: childPath.join('.'),
                        possibleIndexes,
                    };
                })
                .filter(item => item !== null && Object.keys(item.possibleIndexes).length > 1);
            if (arrayOptions.length > 0) {
                return {
                    ...foundPath,
                    foundInLists: arrayOptions,
                };
            }
            return foundPath;
        });
}

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
        const sortedPaths = sortBy(this.foundPaths, ['score']).map((foundPath) => ({
            path: foundPath.path,
            value: foundPath.value,
        }));
        const sortedPathsWithDetails = findSimilarPaths(data, sortedPaths);
        return sortedPathsWithDetails;
    }
}
