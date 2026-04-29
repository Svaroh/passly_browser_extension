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

const resolveSrc = relPath => path.resolve(__dirname, relPath);

const browserPolyfillPlugin = new webpack.ProvidePlugin({
  // Inject browser polyfill as a global API, and adapt it depending on the environment (MV2/MV3/Windows app).
  browser: resolveSrc('./src/all/common/polyfill/browserPolyfill.js'),
});

const babelRule = {
  test: /\.(js|jsx)$/,
  exclude: /(node_modules[\\/]((?!(passbolt\-styleguide))))/,
  loader: "babel-loader",
  options: {
    presets: ["@babel/react"],
  },
};

const svgRule = {
  test: /\.svg$/i,
  issuer: /\.[jt]sx?$/,
  use: [
    {
      loader: "@svgr/webpack",
      options: {
        svgoConfig: {
          plugins: [
            {
              name: 'preset-default',
              params: {
                overrides: {
                  removeViewBox: false,
                  cleanupIds: false,
                  removeTitle: false,
                  removeDesc: false,
                },
              },
            },
            {
              name: 'prefixIds',
              params: {
                prefixIds: false,
                prefixClassNames: false,
              },
            },
          ],
        },
      },
    },
  ],
};

const splitChunksConfig = {
  minSize: 0,
  cacheGroups: {
    commons: {
      test: /[\\/]node_modules[\\/]((?!(passbolt\-styleguide)).*)[\\/]/,
      name: 'vendors',
      chunks: 'all',
    },
  },
};

const reactAlias = {
  'react': path.resolve('./node_modules/react'),
  'react-dom': path.resolve('./node_modules/react-dom'),
};

const buildConfig = ({ entry, chunkLoadingGlobal, outputPath, withReact = false, withSvg = false }) => {
  const config = {
    entry,
    mode: 'production',
    plugins: [browserPolyfillPlugin],
    module: {
      rules: withSvg ? [babelRule, svgRule] : [babelRule],
    },
    optimization: {
      splitChunks: splitChunksConfig,
    },
    resolve: {
      extensions: [".js", ".jsx"],
      ...(withReact ? { alias: reactAlias } : {}),
    },
    output: {
      // Set a unique name to ensure the cohabitation of multiple webpack loader on the same page.
      chunkLoadingGlobal,
      path: resolveSrc(outputPath),
      pathinfo: true,
      filename: '[name].js',
    },
  };
  // Enable development mode when NODE_ENV=development; otherwise produce a production build.
  if (process.env.NODE_ENV === "development") {
    config.mode = "development";
    config.devtool = "inline-source-map";
  }
  return config;
};

module.exports = [
  // Content scripts — main app entries.
  buildConfig({
    entry: {
      'app': resolveSrc('./src/all/contentScripts/js/app/App.js'),
      'setup': resolveSrc('./src/all/contentScripts/js/app/Setup.js'),
      'recover': resolveSrc('./src/all/contentScripts/js/app/Recover.js'),
      'login': resolveSrc('./src/all/contentScripts/js/app/Login.js'),
      'account-recovery': resolveSrc('./src/all/contentScripts/js/app/AccountRecovery.js'),
    },
    chunkLoadingGlobal: 'contentScriptChunkLoadingGlobal',
    outputPath: './build/all/contentScripts/js/dist',
  }),
  // Content scripts — browser integration.
  buildConfig({
    entry: {
      'browser-integration': resolveSrc('./src/all/contentScripts/js/app/BrowserIntegration.js'),
    },
    chunkLoadingGlobal: 'contentScriptBrowserIntegrationChunkLoadingGlobal',
    outputPath: './build/all/contentScripts/js/dist/browser-integration',
  }),
  // Content scripts — public website sign-in.
  buildConfig({
    entry: {
      'public-website-sign-in': resolveSrc('./src/all/contentScripts/js/app/PublicWebsiteSignIn.js'),
    },
    chunkLoadingGlobal: 'contentScriptBrowserIntegrationChunkLoadingGlobal',
    outputPath: './build/all/contentScripts/js/dist/public-website-sign-in',
  }),
  // Web-accessible resources — main app entries.
  buildConfig({
    entry: {
      'account-recovery': resolveSrc('./src/all/webAccessibleResources/js/app/AccountRecovery.js'),
      'app': resolveSrc('./src/all/webAccessibleResources/js/app/App.js'),
      'setup': resolveSrc('./src/all/webAccessibleResources/js/app/Setup.js'),
      'recover': resolveSrc('./src/all/webAccessibleResources/js/app/Recover.js'),
      'login': resolveSrc('./src/all/webAccessibleResources/js/app/Login.js'),
      'quickaccess': resolveSrc('./src/all/webAccessibleResources/js/app/QuickAccess.js'),
    },
    chunkLoadingGlobal: 'dataChunkLoadingGlobal',
    outputPath: './build/all/webAccessibleResources/js/dist',
    withReact: true,
    withSvg: true,
  }),
  // Web-accessible resources — download.
  buildConfig({
    entry: {
      'app': resolveSrc('./src/all/webAccessibleResources/js/app/Download.js'),
    },
    chunkLoadingGlobal: 'dataDownloadChunkLoadingGlobal',
    outputPath: './build/all/webAccessibleResources/js/dist/download',
  }),
  // Web-accessible resources — in-form call-to-action.
  buildConfig({
    entry: {
      'app': resolveSrc('./src/all/webAccessibleResources/js/app/InFormCallToAction.js'),
    },
    chunkLoadingGlobal: 'dataInFormCallToActionChunkLoadingGlobal',
    outputPath: './build/all/webAccessibleResources/js/dist/in-form-call-to-action',
    withReact: true,
    withSvg: true,
  }),
  // Web-accessible resources — in-form menu.
  buildConfig({
    entry: {
      'app': resolveSrc('./src/all/webAccessibleResources/js/app/InFormMenu.js'),
    },
    chunkLoadingGlobal: 'dataInFormMenuChunkLoadingGlobal',
    outputPath: './build/all/webAccessibleResources/js/dist/in-form-menu',
    withReact: true,
    withSvg: true,
  }),
];
