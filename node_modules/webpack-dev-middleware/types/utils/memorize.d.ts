export = memorize;
/**
 * @template T
 * @param {Function} fn
 * @param {{ cache?: Map<string, { data: T }> } | undefined} cache
 * @param {((value: T) => T)=} callback
 * @returns {any}
 */
declare function memorize<T>(
  fn: Function,
  {
    cache,
  }?:
    | {
        cache?: Map<
          string,
          {
            data: T;
          }
        >;
      }
    | undefined,
  callback?: ((value: T) => T) | undefined,
): any;
