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
 *
 * Two layers, in order:
 *   1) A one-shot wipe of the entire build root before any config starts
 *      compiling — applied to every browser, regardless of NODE_ENV. Each
 *      browser writes to the shared `build/all/` directory and zips it via
 *      WebExtPlugin, so wiping between browsers is mandatory for correctness
 *      (otherwise stale files from the previous browser leak into the next
 *      browser's archive). Replaces what `grunt clean:build` used to do.
 *
 *   2) `output.clean` on every config — production-only — so subsequent
 *      passes / watch rebuilds keep each config's output directory in sync
 *      with its current emit list. For configs whose `output.path` is the
 *      build root (mv2 / safari background page), all sub-directories are
 *      kept — other configs and CopyWebpackPlugin patterns write into them.
 */
const fs = require('fs');
const path = require('path');

const BUILD_ROOT = path.resolve(__dirname, '../build/all');
const PLUGIN_NAME = 'WipeBuildRootPlugin';

class WipeBuildRootPlugin {
  constructor() {
    this.wiped = false;
  }

  apply(compiler) {
    compiler.hooks.beforeRun.tap(PLUGIN_NAME, () => {
      if (this.wiped) {
        return;
      }
      this.wiped = true;
      fs.rmSync(BUILD_ROOT, { recursive: true, force: true });
    });
  }
}

module.exports = function applyOutputClean(configs) {
  const wipePlugin = new WipeBuildRootPlugin();
  const isDevelopment = process.env.NODE_ENV === 'development';
  configs.forEach(config => {
    config.plugins = [wipePlugin, ...(config.plugins || [])];
    if (isDevelopment) {
      return;
    }
    const isRootOutput = path.resolve(config.output.path) === BUILD_ROOT;
    config.output = {
      ...config.output,
      clean: isRootOutput ? { keep: asset => asset.includes('/') } : true,
    };
  });
};
