"use strict";

/** @typedef {import("../index.js").IncomingMessage} IncomingMessage */
/** @typedef {import("../index.js").ServerResponse} ServerResponse */
/** @typedef {import("../index").OutputFileSystem} OutputFileSystem */

/**
 * @typedef {Object} ExpectedIncomingMessage
 * @property {(name: string) => string | string[] | undefined} [getHeader]
 * @property {() => string | undefined} [getMethod]
 * @property {() => string | undefined} [getURL]
 */

/**
 * @typedef {Object} ExpectedServerResponse
 * @property {(status: number) => void} [setStatusCode]
 * @property {() => number} [getStatusCode]
 * @property {(name: string) => string | string[] | undefined | number} [getHeader]
 * @property {(name: string, value: number | string | Readonly<string[]>) => ExpectedServerResponse} [setHeader]
 * @property {(name: string) => void} [removeHeader]
 * @property {(data: string | Buffer) => void} [send]
 * @property {(data?: string | Buffer) => void} [finish]
 * @property {() => string[]} [getResponseHeaders]
 * @property {() => boolean} [getHeadersSent]
 * @property {(data: any) => void} [stream]
 * @property {() => any} [getOutgoing]
 * @property {(name: string, value: any) => void} [setState]
 * @property {() => "ready" | "open" | "readable"} [getReadyReadableStreamState]
 */

/**
 * @template {IncomingMessage & ExpectedIncomingMessage} Request
 * @param {Request} req
 * @param {string} name
 * @returns {string | string[] | undefined}
 */
function getRequestHeader(req, name) {
  // Pseudo API
  if (typeof req.getHeader === "function") {
    return req.getHeader(name);
  }
  return req.headers[name];
}

/**
 * @template {IncomingMessage & ExpectedIncomingMessage} Request
 * @param {Request} req
 * @returns {string | undefined}
 */
function getRequestMethod(req) {
  // Pseudo API
  if (typeof req.getMethod === "function") {
    return req.getMethod();
  }
  return req.method;
}

/**
 * @template {IncomingMessage & ExpectedIncomingMessage} Request
 * @param {Request} req
 * @returns {string | undefined}
 */
function getRequestURL(req) {
  // Pseudo API
  if (typeof req.getURL === "function") {
    return req.getURL();
  }
  return req.url;
}

/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res
 * @param {number} code
 */
function setStatusCode(res, code) {
  // Pseudo API
  if (typeof res.setStatusCode === "function") {
    res.setStatusCode(code);
    return;
  }

  // Node.js API
  // eslint-disable-next-line no-param-reassign
  res.statusCode = code;
}

/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res
 * @returns {number}
 */
function getStatusCode(res) {
  // Pseudo API
  if (typeof res.getStatusCode === "function") {
    return res.getStatusCode();
  }
  return res.statusCode;
}

/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res
 * @param {string} name
 * @returns {string | string[] | undefined | number}
 */
function getResponseHeader(res, name) {
  // Real and Pseudo API
  return res.getHeader(name);
}

/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res
 * @param {string} name
 * @param {number | string | Readonly<string[]>} value
 * @returns {Response}
 */
function setResponseHeader(res, name, value) {
  // Real and Pseudo API
  return res.setHeader(name, value);
}

/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res
 * @param {string} name
 */
function removeResponseHeader(res, name) {
  // Real and Pseudo API
  res.removeHeader(name);
}

/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res
 * @returns {string[]}
 */
function getResponseHeaders(res) {
  // Pseudo API
  if (typeof res.getResponseHeaders === "function") {
    return res.getResponseHeaders();
  }
  return res.getHeaderNames();
}

/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res
 * @returns {boolean}
 */
function getHeadersSent(res) {
  // Pseudo API
  if (typeof res.getHeadersSent === "function") {
    return res.getHeadersSent();
  }
  return res.headersSent;
}

/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res
 * @param {import("fs").ReadStream} bufferOrStream
 */
function pipe(res, bufferOrStream) {
  // Pseudo API and Koa API
  if (typeof res.stream === "function") {
    // Writable stream into Readable stream
    res.stream(bufferOrStream);
    return;
  }

  // Node.js API and Express API and Hapi API
  bufferOrStream.pipe(res);
}

/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res
 * @param {string | Buffer} bufferOrString
 */
function send(res, bufferOrString) {
  // Pseudo API and Express API and Koa API
  if (typeof res.send === "function") {
    res.send(bufferOrString);
    return;
  }
  res.end(bufferOrString);
}

/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res
 * @param {string | Buffer} [data]
 */
function finish(res, data) {
  // Pseudo API and Express API and Koa API
  if (typeof res.finish === "function") {
    res.finish(data);
    return;
  }

  // Pseudo API and Express API and Koa API
  res.end(data);
}

/**
 * @param {string} filename
 * @param {OutputFileSystem} outputFileSystem
 * @param {number} start
 * @param {number} end
 * @returns {{ bufferOrStream: (Buffer | import("fs").ReadStream), byteLength: number }}
 */
function createReadStreamOrReadFileSync(filename, outputFileSystem, start, end) {
  /** @type {string | Buffer | import("fs").ReadStream} */
  let bufferOrStream;
  /** @type {number} */
  let byteLength;

  // Stream logic
  const isFsSupportsStream = typeof outputFileSystem.createReadStream === "function";
  if (isFsSupportsStream) {
    bufferOrStream = /** @type {import("fs").createReadStream} */
    outputFileSystem.createReadStream(filename, {
      start,
      end
    });

    // Handle files with zero bytes
    byteLength = end === 0 ? 0 : end - start + 1;
  } else {
    bufferOrStream = outputFileSystem.readFileSync(filename);
    ({
      byteLength
    } = bufferOrStream);
  }
  return {
    bufferOrStream,
    byteLength
  };
}

/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res
 * @returns {Response} res
 */
function getOutgoing(res) {
  // Pseudo API and Express API and Koa API
  if (typeof res.getOutgoing === "function") {
    return res.getOutgoing();
  }
  return res;
}

/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res
 */
function initState(res) {
  if (typeof res.setState === "function") {
    return;
  }

  // fixes #282. credit @cexoso. in certain edge situations res.locals is undefined.
  // eslint-disable-next-line no-param-reassign
  res.locals = res.locals || {};
}

/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res
 * @param {string} name
 * @param {any} value
 */
function setState(res, name, value) {
  if (typeof res.setState === "function") {
    res.setState(name, value);
    return;
  }

  /** @type {any} */
  // eslint-disable-next-line no-param-reassign
  res.locals[name] = value;
}

/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res
 * @returns {"ready" | "open" | "readable"}
 */
function getReadyReadableStreamState(res) {
  // Pseudo API and Express API and Koa API
  if (typeof res.getReadyReadableStreamState === "function") {
    return res.getReadyReadableStreamState();
  }
  return "ready";
}
module.exports = {
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
  pipe,
  send,
  finish,
  createReadStreamOrReadFileSync,
  getOutgoing,
  initState,
  setState,
  getReadyReadableStreamState
};