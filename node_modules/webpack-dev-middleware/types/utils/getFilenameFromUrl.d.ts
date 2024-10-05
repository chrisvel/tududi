export = getFilenameFromUrl;
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {import("../index.js").FilledContext<Request, Response>} context
 * @param {string} url
 * @param {Extra=} extra
 * @returns {string | undefined}
 */
declare function getFilenameFromUrl<
  Request extends IncomingMessage,
  Response extends ServerResponse,
>(
  context: import("../index.js").FilledContext<Request, Response>,
  url: string,
  extra?: Extra | undefined,
): string | undefined;
declare namespace getFilenameFromUrl {
  export { Extra, IncomingMessage, ServerResponse };
}
type Extra = {
  stats?: import("fs").Stats | undefined;
  errorCode?: number | undefined;
  immutable?: boolean | undefined;
};
type IncomingMessage = import("../index.js").IncomingMessage;
type ServerResponse = import("../index.js").ServerResponse;
