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
 * @since         5.12.106
 */

import {
  PASSKEY_PROVIDER_BRIDGE_SCRIPT_PATH,
  PASSKEY_PROVIDER_PAGE_SCRIPT_PATH,
} from "../../../../all/passkey/passkeyProviderConstants";

export const PASSKEY_PROVIDER_BRIDGE_SCRIPT = PASSKEY_PROVIDER_BRIDGE_SCRIPT_PATH;
export const PASSKEY_PROVIDER_PAGE_SCRIPT = PASSKEY_PROVIDER_PAGE_SCRIPT_PATH;

class PasskeyContentScriptInjectionService {
  /**
   * Inject the passkey fallback into already-open tabs. Manifest
   * document_start content scripts only run on future document loads, so this
   * is needed after an extension reload/update while a relying party tab is
   * already open.
   * @returns {Promise<number>} number of tabs where injection was attempted.
   */
  static async injectIntoExistingTabs() {
    if (!this.canInject()) {
      return 0;
    }

    const tabs = await chrome.tabs.query({
      url: ["http://*/*", "https://*/*"],
    });
    const eligibleTabs = tabs.filter((tab) => Number.isInteger(tab.id) && this.isInjectableUrl(tab.url));

    await Promise.all(eligibleTabs.map((tab) => this.injectIntoTab(tab.id)));

    return eligibleTabs.length;
  }

  /**
   * @param {number} tabId
   * @returns {Promise<void>}
   */
  static async injectIntoTab(tabId) {
    try {
      await chrome.scripting.executeScript({
        files: [PASSKEY_PROVIDER_BRIDGE_SCRIPT],
        target: { tabId, allFrames: true },
        world: "ISOLATED",
      });
      await chrome.scripting.executeScript({
        files: [PASSKEY_PROVIDER_PAGE_SCRIPT],
        target: { tabId, allFrames: true },
        world: "MAIN",
      });
    } catch {
      // Some browser pages reject script injection; startup should continue for other tabs.
    }
  }

  /**
   * @returns {boolean}
   */
  static canInject() {
    return typeof chrome !== "undefined" && Boolean(chrome.tabs?.query && chrome.scripting?.executeScript);
  }

  /**
   * @param {string} url
   * @returns {boolean}
   */
  static isInjectableUrl(url) {
    return typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"));
  }
}

export default PasskeyContentScriptInjectionService;
