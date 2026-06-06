const path = require('path');
const {buildProductionMinimizer} = require("./webpack.production-minimizer");

const config = {
  entry: {
    'offscreen': path.resolve(__dirname, './src/chrome-mv3/offscreens/offscreen.js'),
  },
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /(node_modules[\\/]((?!(passbolt\-styleguide))))/,
        loader: "babel-loader",
        options: {
          presets: ["@babel/react"],
        }
      }
    ]
  },
  optimization: {
    minimize: true,
    minimizer: [buildProductionMinimizer()],
    splitChunks: {
      minSize: 0,
      cacheGroups: {
        commons: {
          test: /[\\/]node_modules[\\/]((?!(passbolt\-styleguide)).*)[\\/]/,
          name: 'vendors',
          chunks: 'all'
        },
      }
    },
  },
  resolve: {extensions: ["*", ".js"], fallback: {crypto: false}},
  output: {
    // Set a unique name to ensure the cohabitation of multiple webpack loader on the same page.
    chunkLoadingGlobal: 'offscreensFetchChunkLoadingGlobal',
    path: path.resolve(__dirname, './build/all/offscreens'),
    pathinfo: true,
    filename: '[name].js'
  }
};

exports.default = function (env) {
  env = env || {};
  // Enable debug mode.
  if (env.debug) {
    config.mode = "development";
    config.devtool = "inline-source-map";
    config.optimization.minimize = false;
    config.optimization.minimizer = [];
  }
  return config;
};
