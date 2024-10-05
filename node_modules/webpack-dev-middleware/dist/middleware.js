"use strict";

const path = require("path");
const mime = require("mime-types");
const onFinishedStream = require("on-finished");
const getFilenameFromUrl = require("./utils/getFilenameFromUrl");
const {
  setStatusCode,
  getStatusCode,
  getRequestHeader,
  getRequestMethod,
  getRequestURL,
  getResponseHeader,
  setResponseHeader,
  removeResponseHeader,
  getResponseHeaders,
  getHeadersSent,
  send,
  finish,
  pipe,
  createReadStreamOrReadFileSync,
  getOutgoing,
  initState,
  setState,
  getReadyReadableStreamState
} = require("./utils/compatibleAPI");
const ready = require("./utils/ready");
const parseTokenList = require("./utils/parseTokenList");
const memorize = require("./utils/memorize");

/** @typedef {import("./index.js").NextFunction} NextFunction */
/** @typedef {import("./index.js").IncomingMessage} IncomingMessage */
/** @typedef {import("./index.js").ServerResponse} ServerResponse */
/** @typedef {import("./index.js").NormalizedHeaders} NormalizedHeaders */
/** @typedef {import("fs").ReadStream} ReadStream */

const BYTES_RANGE_REGEXP = /^ *bytes/i;

/**
 * @param {string} type
 * @param {number} size
 * @param {import("range-parser").Range} [range]
 * @returns {string}
 */
function getValueContentRangeHeader(type, size, range) {
  return `${type} ${range ? `${range.start}-${range.end}` : "*"}/${size}`;
}

/**
 * Parse an HTTP Date into a number.
 *
 * @param {string} date
 * @returns {number}
 */
function parseHttpDate(date) {
  const timestamp = date && Date.parse(date);

  // istanbul ignore next: guard against date.js Date.parse patching
  return typeof timestamp === "number" ? timestamp : NaN;
}
const CACHE_CONTROL_NO_CACHE_REGEXP = /(?:^|,)\s*?no-cache\s*?(?:,|$)/;

/**
 * @param {import("fs").ReadStream} stream stream
 * @param {boolean} suppress do need suppress?
 * @returns {void}
 */
function destroyStream(stream, suppress) {
  if (typeof stream.destroy === "function") {
    stream.destroy();
  }
  if (typeof stream.close === "function") {
    // Node.js core bug workaround
    stream.on("open",
    /**
     * @this {import("fs").ReadStream}
     */
    function onOpenClose() {
      // @ts-ignore
      if (typeof this.fd === "number") {
        // actually close down the fd
        this.close();
      }
    });
  }
  if (typeof stream.addListener === "function" && suppress) {
    stream.removeAllListeners("error");
    stream.addListener("error", () => {});
  }
}

/** @type {Record<number, string>} */
const statuses = {
  400: "Bad Request",
  403: "Forbidden",
  404: "Not Found",
  416: "Range Not Satisfiable",
  500: "Internal Server Error"
};
const parseRangeHeaders = memorize(
/**
 * @param {string} value
 * @returns {import("range-parser").Result | import("range-parser").Ranges}
 */
value => {
  const [len, rangeHeader] = value.split("|");

  // eslint-disable-next-line global-require
  return require("range-parser")(Number(len), rangeHeader, {
    combine: true
  });
});
const MAX_MAX_AGE = 31536000000;

/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @typedef {Object} SendErrorOptions send error options
 * @property {Record<string, number | string | string[] | undefined>=} headers headers
 * @property {import("./index").ModifyResponseData<Request, Response>=} modifyResponseData modify response data callback
 */

/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {import("./index.js").FilledContext<Request, Response>} context
 * @return {import("./index.js").Middleware<Request, Response>}
 */
function wrapper(context) {
  return async function middleware(req, res, next) {
    const acceptedMethods = context.options.methods || ["GET", "HEAD"];
    initState(res);
    async function goNext() {
      if (!context.options.serverSideRender) {
        return next();
      }
      return new Promise(resolve => {
        ready(context, () => {
          setState(res, "webpack", {
            devMiddleware: context
          });
          resolve(next());
        }, req);
      });
    }
    const method = getRequestMethod(req);
    if (method && !acceptedMethods.includes(method)) {
      await goNext();
      return;
    }

    /**
     * @param {number} status status
     * @param {Partial<SendErrorOptions<Request, Response>>=} options options
     * @returns {void}
     */
    function sendError(status, options) {
      // eslint-disable-next-line global-require
      const escapeHtml = require("./utils/escapeHtml");
      const content = statuses[status] || String(status);
      let document = Buffer.from(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Error</title>
</head>
<body>
<pre>${escapeHtml(content)}</pre>
</body>
</html>`, "utf-8");

      // Clear existing headers
      const headers = getResponseHeaders(res);
      for (let i = 0; i < headers.length; i++) {
        removeResponseHeader(res, headers[i]);
      }
      if (options && options.headers) {
        const keys = Object.keys(options.headers);
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          const value = options.headers[key];
          if (typeof value !== "undefined") {
            setResponseHeader(res, key, value);
          }
        }
      }

      // Send basic response
      setStatusCode(res, status);
      setResponseHeader(res, "Content-Type", "text/html; charset=utf-8");
      setResponseHeader(res, "Content-Security-Policy", "default-src 'none'");
      setResponseHeader(res, "X-Content-Type-Options", "nosniff");
      let byteLength = Buffer.byteLength(document);
      if (options && options.modifyResponseData) {
        ({
          data: document,
          byteLength
        } = /** @type {{ data: Buffer, byteLength: number }} */
        options.modifyResponseData(req, res, document, byteLength));
      }
      setResponseHeader(res, "Content-Length", byteLength);
      finish(res, document);
    }

    /**
     * @param {NodeJS.ErrnoException} error
     */
    function errorHandler(error) {
      switch (error.code) {
        case "ENAMETOOLONG":
        case "ENOENT":
        case "ENOTDIR":
          sendError(404, {
            modifyResponseData: context.options.modifyResponseData
          });
          break;
        default:
          sendError(500, {
            modifyResponseData: context.options.modifyResponseData
          });
          break;
      }
    }
    function isConditionalGET() {
      return getRequestHeader(req, "if-match") || getRequestHeader(req, "if-unmodified-since") || getRequestHeader(req, "if-none-match") || getRequestHeader(req, "if-modified-since");
    }
    function isPreconditionFailure() {
      // if-match
      const ifMatch = /** @type {string} */getRequestHeader(req, "if-match");

      // A recipient MUST ignore If-Unmodified-Since if the request contains
      // an If-Match header field; the condition in If-Match is considered to
      // be a more accurate replacement for the condition in
      // If-Unmodified-Since, and the two are only combined for the sake of
      // interoperating with older intermediaries that might not implement If-Match.
      if (ifMatch) {
        const etag = getResponseHeader(res, "ETag");
        return !etag || ifMatch !== "*" && parseTokenList(ifMatch).every(match => match !== etag && match !== `W/${etag}` && `W/${match}` !== etag);
      }

      // if-unmodified-since
      const ifUnmodifiedSince = /** @type {string} */
      getRequestHeader(req, "if-unmodified-since");
      if (ifUnmodifiedSince) {
        const unmodifiedSince = parseHttpDate(ifUnmodifiedSince);

        // A recipient MUST ignore the If-Unmodified-Since header field if the
        // received field-value is not a valid HTTP-date.
        if (!isNaN(unmodifiedSince)) {
          const lastModified = parseHttpDate( /** @type {string} */getResponseHeader(res, "Last-Modified"));
          return isNaN(lastModified) || lastModified > unmodifiedSince;
        }
      }
      return false;
    }

    /**
     * @returns {boolean} is cachable
     */
    function isCachable() {
      const statusCode = getStatusCode(res);
      return statusCode >= 200 && statusCode < 300 || statusCode === 304 ||
      // For Koa and Hono, because by default status code is 404, but we already found a file
      statusCode === 404;
    }

    /**
     * @param {import("http").OutgoingHttpHeaders} resHeaders
     * @returns {boolean}
     */
    function isFresh(resHeaders) {
      // Always return stale when Cache-Control: no-cache to support end-to-end reload requests
      // https://tools.ietf.org/html/rfc2616#section-14.9.4
      const cacheControl = /** @type {string} */
      getRequestHeader(req, "cache-control");
      if (cacheControl && CACHE_CONTROL_NO_CACHE_REGEXP.test(cacheControl)) {
        return false;
      }

      // fields
      const noneMatch = /** @type {string} */
      getRequestHeader(req, "if-none-match");
      const modifiedSince = /** @type {string} */
      getRequestHeader(req, "if-modified-since");

      // unconditional request
      if (!noneMatch && !modifiedSince) {
        return false;
      }

      // if-none-match
      if (noneMatch && noneMatch !== "*") {
        if (!resHeaders.etag) {
          return false;
        }
        const matches = parseTokenList(noneMatch);
        let etagStale = true;
        for (let i = 0; i < matches.length; i++) {
          const match = matches[i];
          if (match === resHeaders.etag || match === `W/${resHeaders.etag}` || `W/${match}` === resHeaders.etag) {
            etagStale = false;
            break;
          }
        }
        if (etagStale) {
          return false;
        }
      }

      // A recipient MUST ignore If-Modified-Since if the request contains an If-None-Match header field;
      // the condition in If-None-Match is considered to be a more accurate replacement for the condition in If-Modified-Since,
      // and the two are only combined for the sake of interoperating with older intermediaries that might not implement If-None-Match.
      if (noneMatch) {
        return true;
      }

      // if-modified-since
      if (modifiedSince) {
        const lastModified = resHeaders["last-modified"];

        //  A recipient MUST ignore the If-Modified-Since header field if the
        //  received field-value is not a valid HTTP-date, or if the request
        //  method is neither GET nor HEAD.
        const modifiedStale = !lastModified || !(parseHttpDate(lastModified) <= parseHttpDate(modifiedSince));
        if (modifiedStale) {
          return false;
        }
      }
      return true;
    }
    function isRangeFresh() {
      const ifRange = /** @type {string | undefined} */
      getRequestHeader(req, "if-range");
      if (!ifRange) {
        return true;
      }

      // if-range as etag
      if (ifRange.indexOf('"') !== -1) {
        const etag = /** @type {string | undefined} */
        getResponseHeader(res, "ETag");
        if (!etag) {
          return true;
        }
        return Boolean(etag && ifRange.indexOf(etag) !== -1);
      }

      // if-range as modified date
      const lastModified = /** @type {string | undefined} */
      getResponseHeader(res, "Last-Modified");
      if (!lastModified) {
        return true;
      }
      return parseHttpDate(lastModified) <= parseHttpDate(ifRange);
    }

    /**
     * @returns {string | undefined}
     */
    function getRangeHeader() {
      const range = /** @type {string} */getRequestHeader(req, "range");
      if (range && BYTES_RANGE_REGEXP.test(range)) {
        return range;
      }

      // eslint-disable-next-line no-undefined
      return undefined;
    }

    /**
     * @param {import("range-parser").Range} range
     * @returns {[number, number]}
     */
    function getOffsetAndLenFromRange(range) {
      const offset = range.start;
      const len = range.end - range.start + 1;
      return [offset, len];
    }

    /**
     * @param {number} offset
     * @param {number} len
     * @returns {[number, number]}
     */
    function calcStartAndEnd(offset, len) {
      const start = offset;
      const end = Math.max(offset, offset + len - 1);
      return [start, end];
    }
    async function processRequest() {
      // Pipe and SendFile
      /** @type {import("./utils/getFilenameFromUrl").Extra} */
      const extra = {};
      const filename = getFilenameFromUrl(context, /** @type {string} */getRequestURL(req), extra);
      if (extra.errorCode) {
        if (extra.errorCode === 403) {
          context.logger.error(`Malicious path "${filename}".`);
        }
        sendError(extra.errorCode, {
          modifyResponseData: context.options.modifyResponseData
        });
        await goNext();
        return;
      }
      if (!filename) {
        await goNext();
        return;
      }
      if (getHeadersSent(res)) {
        await goNext();
        return;
      }
      const {
        size
      } = /** @type {import("fs").Stats} */extra.stats;
      let len = size;
      let offset = 0;

      // Send logic
      if (context.options.headers) {
        let {
          headers
        } = context.options;
        if (typeof headers === "function") {
          headers = /** @type {NormalizedHeaders} */
          headers(req, res, context);
        }

        /**
         * @type {{key: string, value: string | number}[]}
         */
        const allHeaders = [];
        if (typeof headers !== "undefined") {
          if (!Array.isArray(headers)) {
            // eslint-disable-next-line guard-for-in
            for (const name in headers) {
              allHeaders.push({
                key: name,
                value: headers[name]
              });
            }
            headers = allHeaders;
          }
          for (const {
            key,
            value
          } of headers) {
            setResponseHeader(res, key, value);
          }
        }
      }
      if (!getResponseHeader(res, "Accept-Ranges")) {
        setResponseHeader(res, "Accept-Ranges", "bytes");
      }
      if (!getResponseHeader(res, "Cache-Control")) {
        // TODO enable the `cacheImmutable` by default for the next major release
        const cacheControl = context.options.cacheImmutable && extra.immutable ? {
          immutable: true
        } : context.options.cacheControl;
        if (cacheControl) {
          let cacheControlValue;
          if (typeof cacheControl === "boolean") {
            cacheControlValue = "public, max-age=31536000";
          } else if (typeof cacheControl === "number") {
            const maxAge = Math.floor(Math.min(Math.max(0, cacheControl), MAX_MAX_AGE) / 1000);
            cacheControlValue = `public, max-age=${maxAge}`;
          } else if (typeof cacheControl === "string") {
            cacheControlValue = cacheControl;
          } else {
            const maxAge = cacheControl.maxAge ? Math.floor(Math.min(Math.max(0, cacheControl.maxAge), MAX_MAX_AGE) / 1000) : MAX_MAX_AGE / 1000;
            cacheControlValue = `public, max-age=${maxAge}`;
            if (cacheControl.immutable) {
              cacheControlValue += ", immutable";
            }
          }
          setResponseHeader(res, "Cache-Control", cacheControlValue);
        }
      }
      if (context.options.lastModified && !getResponseHeader(res, "Last-Modified")) {
        const modified = /** @type {import("fs").Stats} */
        extra.stats.mtime.toUTCString();
        setResponseHeader(res, "Last-Modified", modified);
      }

      /** @type {number} */
      let start;
      /** @type {number} */
      let end;

      /** @type {undefined | Buffer | ReadStream} */
      let bufferOrStream;
      /** @type {number | undefined} */
      let byteLength;
      const rangeHeader = getRangeHeader();
      if (context.options.etag && !getResponseHeader(res, "ETag")) {
        /** @type {import("fs").Stats | Buffer | ReadStream | undefined} */
        let value;

        // TODO cache etag generation?
        if (context.options.etag === "weak") {
          value = /** @type {import("fs").Stats} */extra.stats;
        } else {
          if (rangeHeader) {
            const parsedRanges = /** @type {import("range-parser").Ranges | import("range-parser").Result} */
            parseRangeHeaders(`${size}|${rangeHeader}`);
            if (parsedRanges !== -2 && parsedRanges !== -1 && parsedRanges.length === 1) {
              [offset, len] = getOffsetAndLenFromRange(parsedRanges[0]);
            }
          }
          [start, end] = calcStartAndEnd(offset, len);
          try {
            const result = createReadStreamOrReadFileSync(filename, context.outputFileSystem, start, end);
            value = result.bufferOrStream;
            ({
              bufferOrStream,
              byteLength
            } = result);
          } catch (error) {
            errorHandler( /** @type {NodeJS.ErrnoException} */error);
            await goNext();
            return;
          }
        }
        if (value) {
          // eslint-disable-next-line global-require
          const result = await require("./utils/etag")(value);

          // Because we already read stream, we can cache buffer to avoid extra read from fs
          if (result.buffer) {
            bufferOrStream = result.buffer;
          }
          setResponseHeader(res, "ETag", result.hash);
        }
      }
      if (!getResponseHeader(res, "Content-Type") || getStatusCode(res) === 404) {
        removeResponseHeader(res, "Content-Type");
        // content-type name(like application/javascript; charset=utf-8) or false
        const contentType = mime.contentType(path.extname(filename));

        // Only set content-type header if media type is known
        // https://tools.ietf.org/html/rfc7231#section-3.1.1.5
        if (contentType) {
          setResponseHeader(res, "Content-Type", contentType);
        } else if (context.options.mimeTypeDefault) {
          setResponseHeader(res, "Content-Type", context.options.mimeTypeDefault);
        }
      }

      // Conditional GET support
      if (isConditionalGET()) {
        if (isPreconditionFailure()) {
          sendError(412, {
            modifyResponseData: context.options.modifyResponseData
          });
          await goNext();
          return;
        }
        if (isCachable() && isFresh({
          etag: ( /** @type {string | undefined} */
          getResponseHeader(res, "ETag")),
          "last-modified": ( /** @type {string | undefined} */
          getResponseHeader(res, "Last-Modified"))
        })) {
          setStatusCode(res, 304);

          // Remove content header fields
          removeResponseHeader(res, "Content-Encoding");
          removeResponseHeader(res, "Content-Language");
          removeResponseHeader(res, "Content-Length");
          removeResponseHeader(res, "Content-Range");
          removeResponseHeader(res, "Content-Type");
          finish(res);
          await goNext();
          return;
        }
      }
      let isPartialContent = false;
      if (rangeHeader) {
        let parsedRanges = /** @type {import("range-parser").Ranges | import("range-parser").Result | []} */
        parseRangeHeaders(`${size}|${rangeHeader}`);

        // If-Range support
        if (!isRangeFresh()) {
          parsedRanges = [];
        }
        if (parsedRanges === -1) {
          context.logger.error("Unsatisfiable range for 'Range' header.");
          setResponseHeader(res, "Content-Range", getValueContentRangeHeader("bytes", size));
          sendError(416, {
            headers: {
              "Content-Range": getResponseHeader(res, "Content-Range")
            },
            modifyResponseData: context.options.modifyResponseData
          });
          await goNext();
          return;
        } else if (parsedRanges === -2) {
          context.logger.error("A malformed 'Range' header was provided. A regular response will be sent for this request.");
        } else if (parsedRanges.length > 1) {
          context.logger.error("A 'Range' header with multiple ranges was provided. Multiple ranges are not supported, so a regular response will be sent for this request.");
        }
        if (parsedRanges !== -2 && parsedRanges.length === 1) {
          // Content-Range
          setStatusCode(res, 206);
          setResponseHeader(res, "Content-Range", getValueContentRangeHeader("bytes", size, /** @type {import("range-parser").Ranges} */parsedRanges[0]));
          isPartialContent = true;
          [offset, len] = getOffsetAndLenFromRange(parsedRanges[0]);
        }
      }

      // When strong Etag generation is enabled we already read file, so we can skip extra fs call
      if (!bufferOrStream) {
        [start, end] = calcStartAndEnd(offset, len);
        try {
          ({
            bufferOrStream,
            byteLength
          } = createReadStreamOrReadFileSync(filename, context.outputFileSystem, start, end));
        } catch (error) {
          errorHandler( /** @type {NodeJS.ErrnoException} */error);
          await goNext();
          return;
        }
      }
      if (context.options.modifyResponseData) {
        ({
          data: bufferOrStream,
          byteLength
        } = context.options.modifyResponseData(req, res, bufferOrStream, /** @type {number} */
        byteLength));
      }
      setResponseHeader(res, "Content-Length", /** @type {number} */
      byteLength);
      if (method === "HEAD") {
        if (!isPartialContent) {
          setStatusCode(res, 200);
        }
        finish(res);
        await goNext();
        return;
      }
      if (!isPartialContent) {
        setStatusCode(res, 200);
      }
      const isPipeSupports = typeof ( /** @type {import("fs").ReadStream} */bufferOrStream.pipe) === "function";
      if (!isPipeSupports) {
        send(res, /** @type {Buffer} */bufferOrStream);
        await goNext();
        return;
      }

      // Cleanup
      const cleanup = () => {
        destroyStream( /** @type {import("fs").ReadStream} */bufferOrStream, true);
      };

      // Error handling
      /** @type {import("fs").ReadStream} */
      bufferOrStream.on("error", error => {
        // clean up stream early
        cleanup();
        errorHandler(error);
        goNext();
      }).on(getReadyReadableStreamState(res), () => {
        goNext();
      });
      pipe(res, /** @type {ReadStream} */bufferOrStream);
      const outgoing = getOutgoing(res);
      if (outgoing) {
        // Response finished, cleanup
        onFinishedStream(outgoing, cleanup);
      }
    }
    ready(context, processRequest, req);
  };
}
module.exports = wrapper;