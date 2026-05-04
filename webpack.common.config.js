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
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { svgRule, reactAlias, baseConfigPath } = require('./webpack/common-blocks');
const I18nextExtractionPlugin = require('./webpack/i18nextExtractionPlugin');

const resolveSrc = relPath => path.resolve(__dirname, relPath);

const buildConfig = ({ entry, chunkLoadingGlobal, outputPath, withReact = false, withSvg = false, extraPlugins = [] }) => ({
  extends: baseConfigPath,
  entry,
  ...(extraPlugins.length ? { plugins: extraPlugins } : {}),
  ...(withSvg ? { module: { rules: [svgRule] } } : {}),
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
});

// Plugins attached to the first common config so they run once per build, regardless
// of which top-level config (mv2, mv3, or common alone) consumes the array.
const sharedExtraPlugins = [
  new I18nextExtractionPlugin(),
  new CopyWebpackPlugin({
    patterns: [
      {
        from: resolveSrc('./src/all/locales'),
        to: resolveSrc('./build/all/locales'),
      },
      {
        from: resolveSrc('./src/all/_locales'),
        to: resolveSrc('./build/all/_locales'),
        globOptions: { ignore: ['**/*.test.js'] },
      },
      {
        from: resolveSrc('./src/all/webAccessibleResources/js/themes'),
        to: resolveSrc('./build/all/webAccessibleResources/js/themes'),
      },
      {
        from: '*.html',
        context: resolveSrc('./src/all/webAccessibleResources'),
        to: resolveSrc('./build/all/webAccessibleResources'),
      },
    ],
  }),
];

module.exports = [
  // Content scripts — main app entries. Hosts the i18next extraction + locales
  // copy plugins so they execute exactly once per build.
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
    extraPlugins: sharedExtraPlugins,
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
