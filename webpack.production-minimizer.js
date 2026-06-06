/* eslint-disable import/no-extraneous-dependencies, n/no-unpublished-require */
const TerserPlugin = require("terser-webpack-plugin");

const DROPPED_CONSOLE_METHODS = ["debug", "info", "log"].map((method) => `console.${method}`);

function buildProductionMinimizer() {
  return new TerserPlugin({
    terserOptions: {
      compress: {
        pure_funcs: DROPPED_CONSOLE_METHODS,
      },
    },
  });
}

module.exports = {
  buildProductionMinimizer,
};
