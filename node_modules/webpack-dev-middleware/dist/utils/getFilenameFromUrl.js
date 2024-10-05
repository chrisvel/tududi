"use strict";

const path = require("path");
const {
  parse
} = require("url");
const querystring = require("querystring");
const getPaths = require("./getPaths");
const memorize = require("./memorize");

/** @typedef {import("../index.js").IncomingMessage} IncomingMessage */
/** @typedef {import("../index.js").ServerResponse} ServerResponse */

// eslint-disable-next-line no-undefined
const memoizedParse = memorize(parse, undefined, value => {
  if (value.pathname) {
    // eslint-disable-next-line no-param-reassign
    value.pathname = decode(value.pathname);
  }
  return value;
});
const UP_PATH_REGEXP = /(?:^|[\\/])\.\.(?:[\\/]|$)/;

/**
 * @typedef {Object} Extra
 * @property {import("fs").Stats=} stats
 * @property {number=} errorCode
 * @property {boolean=} immutable
 */

/**
 * decodeURIComponent.
 *
 * Allows V8 to only deoptimize this fn instead of all of send().
 *
 * @param {string} input
 * @returns {string}
 */

function decode(input) {
  return querystring.unescape(input);
}

// TODO refactor me in the next major release, this function should return `{ filename, stats, error }`
// TODO fix redirect logic when `/` at the end, like https://github.com/pillarjs/send/blob/master/index.js#L586
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {import("../index.js").FilledContext<Request, Response>} context
 * @param {string} url
 * @param {Extra=} extra
 * @returns {string | undefined}
 */
function getFilenameFromUrl(context, url, extra = {}) {
  const {
    options
  } = context;
  const paths = getPaths(context);

  /** @type {string | undefined} */
  let foundFilename;
  /** @type {URL} */
  let urlObject;
  try {
    // The `url` property of the `request` is contains only  `pathname`, `search` and `hash`
    urlObject = memoizedParse(url, false, true);
  } catch (_ignoreError) {
    return;
  }
  for (const {
    publicPath,
    outputPath,
    assetsInfo
  } of paths) {
    /** @type {string | undefined} */
    let filename;
    /** @type {URL} */
    let publicPathObject;
    try {
      publicPathObject = memoizedParse(publicPath !== "auto" && publicPath ? publicPath : "/", false, true);
    } catch (_ignoreError) {
      // eslint-disable-next-line no-continue
      continue;
    }
    const {
      pathname
    } = urlObject;
    const {
      pathname: publicPathPathname
    } = publicPathObject;
    if (pathname && pathname.startsWith(publicPathPathname)) {
      // Null byte(s)
      if (pathname.includes("\0")) {
        // eslint-disable-next-line no-param-reassign
        extra.errorCode = 400;
        return;
      }

      // ".." is malicious
      if (UP_PATH_REGEXP.test(path.normalize(`./${pathname}`))) {
        // eslint-disable-next-line no-param-reassign
        extra.errorCode = 403;
        return;
      }

      // Strip the `pathname` property from the `publicPath` option from the start of requested url
      // `/complex/foo.js` => `foo.js`
      // and add outputPath
      // `foo.js` => `/home/user/my-project/dist/foo.js`
      filename = path.join(outputPath, pathname.slice(publicPathPathname.length));
      try {
        // eslint-disable-next-line no-param-reassign
        extra.stats = context.outputFileSystem.statSync(filename);
      } catch (_ignoreError) {
        // eslint-disable-next-line no-continue
        continue;
      }
      if (extra.stats.isFile()) {
        foundFilename = filename;

        // Rspack does not yet support `assetsInfo`, so we need to check if `assetsInfo` exists here
        if (assetsInfo) {
          const assetInfo = assetsInfo.get(pathname.slice(publicPathObject.pathname.length));

          // eslint-disable-next-line no-param-reassign
          extra.immutable = assetInfo ? assetInfo.immutable : false;
        }
        break;
      } else if (extra.stats.isDirectory() && (typeof options.index === "undefined" || options.index)) {
        const indexValue = typeof options.index === "undefined" || typeof options.index === "boolean" ? "index.html" : options.index;
        filename = path.join(filename, indexValue);
        try {
          // eslint-disable-next-line no-param-reassign
          extra.stats = context.outputFileSystem.statSync(filename);
        } catch (__ignoreError) {
          // eslint-disable-next-line no-continue
          continue;
        }
        if (extra.stats.isFile()) {
          foundFilename = filename;
          break;
        }
      }
    }
  }

  // eslint-disable-next-line consistent-return
  return foundFilename;
}
module.exports = getFilenameFromUrl;