export type IncomingMessage = import("../index.js").IncomingMessage;
export type ServerResponse = import("../index.js").ServerResponse;
export type OutputFileSystem = import("../index").OutputFileSystem;
export type ExpectedIncomingMessage = {
  getHeader?: ((name: string) => string | string[] | undefined) | undefined;
  getMethod?: (() => string | undefined) | undefined;
  getURL?: (() => string | undefined) | undefined;
};
export type ExpectedServerResponse = {
  setStatusCode?: ((status: number) => void) | undefined;
  getStatusCode?: (() => number) | undefined;
  getHeader?:
    | ((name: string) => string | string[] | undefined | number)
    | undefined;
  setHeader?:
    | ((
        name: string,
        value: number | string | Readonly<string[]>,
      ) => ExpectedServerResponse)
    | undefined;
  removeHeader?: ((name: string) => void) | undefined;
  send?: ((data: string | Buffer) => void) | undefined;
  finish?: ((data?: string | Buffer) => void) | undefined;
  getResponseHeaders?: (() => string[]) | undefined;
  getHeadersSent?: (() => boolean) | undefined;
  stream?: ((data: any) => void) | undefined;
  getOutgoing?: (() => any) | undefined;
  setState?: ((name: string, value: any) => void) | undefined;
  getReadyReadableStreamState?:
    | (() => "ready" | "open" | "readable")
    | undefined;
};
/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res
 * @param {number} code
 */
export function setStatusCode<
  Response extends ServerResponse & ExpectedServerResponse,
>(res: Response, code: number): void;
/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res
 * @returns {number}
 */
export function getStatusCode<
  Response extends ServerResponse & ExpectedServerResponse,
>(res: Response): number;
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
export function getRequestHeader<
  Request extends IncomingMessage & ExpectedIncomingMessage,
>(req: Request, name: string): string | string[] | undefined;
/**
 * @template {IncomingMessage & ExpectedIncomingMessage} Request
 * @param {Request} req
 * @returns {string | undefined}
 */
export function getRequestMethod<
  Request extends IncomingMessage & ExpectedIncomingMessage,
>(req: Request): string | undefined;
/**
 * @template {IncomingMessage & ExpectedIncomingMessage} Request
 * @param {Request} req
 * @returns {string | undefined}
 */
export function getRequestURL<
  Request extends IncomingMessage & ExpectedIncomingMessage,
>(req: Request): string | undefined;
/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res
 * @param {string} name
 * @returns {string | string[] | undefined | number}
 */
export function getResponseHeader<
  Response extends ServerResponse & ExpectedServerResponse,
>(res: Response, name: string): string | string[] | undefined | number;
/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res
 * @param {string} name
 * @param {number | string | Readonly<string[]>} value
 * @returns {Response}
 */
export function setResponseHeader<
  Response extends ServerResponse & ExpectedServerResponse,
>(
  res: Response,
  name: string,
  value: number | string | Readonly<string[]>,
): Response;
/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res
 * @param {string} name
 */
export function removeResponseHeader<
  Response extends ServerResponse & ExpectedServerResponse,
>(res: Response, name: string): void;
/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res
 * @returns {string[]}
 */
export function getResponseHeaders<
  Response extends ServerResponse & ExpectedServerResponse,
>(res: Response): string[];
/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res
 * @returns {boolean}
 */
export function getHeadersSent<
  Response extends ServerResponse & ExpectedServerResponse,
>(res: Response): boolean;
/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res
 * @param {import("fs").ReadStream} bufferOrStream
 */
export function pipe<Response extends ServerResponse & ExpectedServerResponse>(
  res: Response,
  bufferOrStream: import("fs").ReadStream,
): void;
/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res
 * @param {string | Buffer} bufferOrString
 */
export function send<Response extends ServerResponse & ExpectedServerResponse>(
  res: Response,
  bufferOrString: string | Buffer,
): void;
/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res
 * @param {string | Buffer} [data]
 */
export function finish<
  Response extends ServerResponse & ExpectedServerResponse,
>(res: Response, data?: string | Buffer | undefined): void;
/**
 * @param {string} filename
 * @param {OutputFileSystem} outputFileSystem
 * @param {number} start
 * @param {number} end
 * @returns {{ bufferOrStream: (Buffer | import("fs").ReadStream), byteLength: number }}
 */
export function createReadStreamOrReadFileSync(
  filename: string,
  outputFileSystem: OutputFileSystem,
  start: number,
  end: number,
): {
  bufferOrStream: Buffer | import("fs").ReadStream;
  byteLength: number;
};
/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res
 * @returns {Response} res
 */
export function getOutgoing<
  Response extends ServerResponse & ExpectedServerResponse,
>(res: Response): Response;
/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res
 */
export function initState<
  Response extends ServerResponse & ExpectedServerResponse,
>(res: Response): void;
/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res
 * @param {string} name
 * @param {any} value
 */
export function setState<
  Response extends ServerResponse & ExpectedServerResponse,
>(res: Response, name: string, value: any): void;
/**
 * @template {ServerResponse & ExpectedServerResponse} Response
 * @param {Response} res
 * @returns {"ready" | "open" | "readable"}
 */
export function getReadyReadableStreamState<
  Response extends ServerResponse & ExpectedServerResponse,
>(res: Response): "ready" | "open" | "readable";
