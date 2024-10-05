"use strict";

/** @typedef {import("webpack").Configuration} Configuration */
/** @typedef {import("webpack").Compiler} Compiler */
/** @typedef {import("webpack").MultiCompiler} MultiCompiler */
/** @typedef {import("webpack").Stats} Stats */
/** @typedef {import("webpack").MultiStats} MultiStats */
/** @typedef {import("../index.js").IncomingMessage} IncomingMessage */
/** @typedef {import("../index.js").ServerResponse} ServerResponse */

/** @typedef {Configuration["stats"]} StatsOptions */
/** @typedef {{ children: Configuration["stats"][] }} MultiStatsOptions */
/** @typedef {Exclude<Configuration["stats"], boolean | string | undefined>} StatsObjectOptions */

/**
 * @template {IncomingMessage} Request
 * @template {ServerResponse} Response
 * @param {import("../index.js").WithOptional<import("../index.js").Context<Request, Response>, "watching" | "outputFileSystem">} context
 */
function setupHooks(context) {
  function invalid() {
    if (context.state) {
      context.logger.log("Compilation starting...");
    }

    // We are now in invalid state
    // eslint-disable-next-line no-param-reassign
    context.state = false;
    // eslint-disable-next-line no-param-reassign, no-undefined
    context.stats = undefined;
  }

  /**
   * @param {StatsOptions} statsOptions
   * @returns {StatsObjectOptions}
   */
  function normalizeStatsOptions(statsOptions) {
    if (typeof statsOptions === "undefined") {
      // eslint-disable-next-line no-param-reassign
      statsOptions = {
        preset: "normal"
      };
    } else if (typeof statsOptions === "boolean") {
      // eslint-disable-next-line no-param-reassign
      statsOptions = statsOptions ? {
        preset: "normal"
      } : {
        preset: "none"
      };
    } else if (typeof statsOptions === "string") {
      // eslint-disable-next-line no-param-reassign
      statsOptions = {
        preset: statsOptions
      };
    }
    return statsOptions;
  }

  /**
   * @param {Stats | MultiStats} stats
   */
  function done(stats) {
    // We are now on valid state
    // eslint-disable-next-line no-param-reassign
    context.state = true;
    // eslint-disable-next-line no-param-reassign
    context.stats = stats;

    // Do the stuff in nextTick, because bundle may be invalidated if a change happened while compiling
    process.nextTick(() => {
      const {
        compiler,
        logger,
        options,
        state,
        callbacks
      } = context;

      // Check if still in valid state
      if (!state) {
        return;
      }
      logger.log("Compilation finished");
      const isMultiCompilerMode = Boolean( /** @type {MultiCompiler} */
      compiler.compilers);

      /**
       * @type {StatsOptions | MultiStatsOptions | undefined}
       */
      let statsOptions;
      if (typeof options.stats !== "undefined") {
        statsOptions = isMultiCompilerMode ? {
          children: /** @type {MultiCompiler} */
          compiler.compilers.map(() => options.stats)
        } : options.stats;
      } else {
        statsOptions = isMultiCompilerMode ? {
          children: /** @type {MultiCompiler} */
          compiler.compilers.map(child => child.options.stats)
        } : /** @type {Compiler} */compiler.options.stats;
      }
      if (isMultiCompilerMode) {
        /** @type {MultiStatsOptions} */
        statsOptions.children = /** @type {MultiStatsOptions} */
        statsOptions.children.map(
        /**
         * @param {StatsOptions} childStatsOptions
         * @return {StatsObjectOptions}
         */
        childStatsOptions => {
          // eslint-disable-next-line no-param-reassign
          childStatsOptions = normalizeStatsOptions(childStatsOptions);
          if (typeof childStatsOptions.colors === "undefined") {
            // eslint-disable-next-line no-param-reassign
            childStatsOptions.colors =
            // eslint-disable-next-line global-require
            require("colorette").isColorSupported;
          }
          return childStatsOptions;
        });
      } else {
        statsOptions = normalizeStatsOptions( /** @type {StatsOptions} */statsOptions);
        if (typeof statsOptions.colors === "undefined") {
          // eslint-disable-next-line global-require
          statsOptions.colors = require("colorette").isColorSupported;
        }
      }
      const printedStats = stats.toString( /** @type {StatsObjectOptions} */statsOptions);

      // Avoid extra empty line when `stats: 'none'`
      if (printedStats) {
        // eslint-disable-next-line no-console
        console.log(printedStats);
      }

      // eslint-disable-next-line no-param-reassign
      context.callbacks = [];

      // Execute callback that are delayed
      for (const callback of callbacks) {
        callback(stats);
      }
    });
  }

  // eslint-disable-next-line prefer-destructuring
  const compiler = /** @type {import("../index.js").Context<Request, Response>} */
  context.compiler;
  compiler.hooks.watchRun.tap("webpack-dev-middleware", invalid);
  compiler.hooks.invalid.tap("webpack-dev-middleware", invalid);
  compiler.hooks.done.tap("webpack-dev-middleware", done);
}
module.exports = setupHooks;