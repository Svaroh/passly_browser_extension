/**
 * Passbolt ~ Open source password manager for teams
 * Copyright (c) Passbolt SA (https://www.passbolt.com)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) Passbolt SA (https://www.passbolt.com)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://www.passbolt.com Passbolt(tm)
 * @since         5.12.0
 */
const webpack = require('webpack');
const path = require('path');
const TerserPlugin = require("terser-webpack-plugin");
const buildPassboltEnvPlugin = require('./webpack/passboltEnvPlugin');
const { babelRule, splitChunksConfig } = require('./webpack/common-blocks');
const commonConfigs = require('./webpack.common.config.js');

const isDevelopment = process.env.NODE_ENV === "development";

const baseMv3 = {
  mode: isDevelopment ? 'development' : 'production',
  devtool: isDevelopment ? 'inline-source-map' : false,
  module: { rules: [babelRule] },
  optimization: {
    minimize: !isDevelopment,
    minimizer: isDevelopment ? [] : [new TerserPlugin()],
    splitChunks: splitChunksConfig,
  },
  resolve: {
    extensions: [".js"],
    fallback: { crypto: false },
  },
};

const serviceWorkerConfig = {
  ...baseMv3,
  entry: {
    'index': path.resolve(__dirname, './src/chrome-mv3/index.js'),
  },
  plugins: [
    buildPassboltEnvPlugin(),
    new webpack.ProvidePlugin({
      // Inject browser polyfill as a global API, and adapt it depending on the environment (MV2/MV3/Windows app).
      browser: path.resolve(__dirname, './src/all/common/polyfill/browserPolyfill.js'),
      // Inject custom api client fetch to MV3 extension as workaround of the invalid certificate issue.
      customApiClientFetch: path.resolve(__dirname, './src/chrome-mv3/polyfill/fetchOffscreenPolyfill.js'),
      customNavigatorClipboard: path.resolve(__dirname, './src/chrome-mv3/polyfill/clipboardOffscreenPolyfill.js'),
    }),
  ],
  output: {
    // Set a unique name to ensure the cohabitation of multiple webpack loader on the same page.
    chunkLoadingGlobal: 'serviceWorkerIndexChunkLoadingGlobal',
    path: path.resolve(__dirname, './build/all/serviceWorker'),
    pathinfo: true,
    filename: '[name].js',
  },
};

const offscreensConfig = {
  ...baseMv3,
  entry: {
    'offscreen': path.resolve(__dirname, './src/chrome-mv3/offscreens/offscreen.js'),
  },
  output: {
    chunkLoadingGlobal: 'offscreensFetchChunkLoadingGlobal',
    path: path.resolve(__dirname, './build/all/offscreens'),
    pathinfo: true,
    filename: '[name].js',
  },
};

module.exports = [...commonConfigs, serviceWorkerConfig, offscreensConfig];
