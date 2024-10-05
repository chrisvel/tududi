export = getPaths;
/** @typedef {import("webpack").Compiler} Compiler */
/** @typedef {import("webpack").Stats} Stats */
/** @typedef {import("webpack").MultiStats} MultiStats */
/** @typedef {import("../index.js").IncomingMessage} IncomingMessage */
/** @typedef {import("../index.js").ServerResponse} ServerResponse */
/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {import("../index.js").FilledContext<Request, Response>} context
 */
declare function getPaths<
  Request extends IncomingMessage,
  Response extends ServerResponse,
>(
  context: import("../index.js").FilledContext<Request, Response>,
): {
  outputPath: string;
  publicPath: string;
  assetsInfo: Map<string, import("webpack").AssetInfo>;
}[];
declare namespace getPaths {
  export { Compiler, Stats, MultiStats, IncomingMessage, ServerResponse };
}
type Compiler = import("webpack").Compiler;
type Stats = import("webpack").Stats;
type MultiStats = import("webpack").MultiStats;
type IncomingMessage = import("../index.js").IncomingMessage;
type ServerResponse = import("../index.js").ServerResponse;
