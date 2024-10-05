"use strict";

const cacheStore = new WeakMap();

/**
 * @template T
 * @param {Function} fn
 * @param {{ cache?: Map<string, { data: T }> } | undefined} cache
 * @param {((value: T) => T)=} callback
 * @returns {any}
 */
function memorize(fn, {
  cache = new Map()
} = {}, callback) {
  /**
   * @param {any} arguments_
   * @return {any}
   */
  const memoized = (...arguments_) => {
    const [key] = arguments_;
    const cacheItem = cache.get(key);
    if (cacheItem) {
      return cacheItem.data;
    }

    // @ts-ignore
    let result = fn.apply(this, arguments_);
    if (callback) {
      result = callback(result);
    }
    cache.set(key, {
      data: result
    });
    return result;
  };
  cacheStore.set(memoized, cache);
  return memoized;
}
module.exports = memorize;