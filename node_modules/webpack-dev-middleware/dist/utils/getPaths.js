"use strict";

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
function getPaths(context) {
  const {
    stats,
    options
  } = context;
  /** @type {Stats[]} */
  const childStats = /** @type {MultiStats} */
  stats.stats ? /** @type {MultiStats} */stats.stats : [( /** @type {Stats} */stats)];
  const publicPaths = [];
  for (const {
    compilation
  } of childStats) {
    if (compilation.options.devServer === false) {
      // eslint-disable-next-line no-continue
      continue;
    }

    // The `output.path` is always present and always absolute
    const outputPath = compilation.getPath(compilation.outputOptions.path || "");
    const publicPath = options.publicPath ? compilation.getPath(options.publicPath) : compilation.outputOptions.publicPath ? compilation.getPath(compilation.outputOptions.publicPath) : "";
    publicPaths.push({
      outputPath,
      publicPath,
      assetsInfo: compilation.assetsInfo
    });
  }
  return publicPaths;
}
module.exports = getPaths;