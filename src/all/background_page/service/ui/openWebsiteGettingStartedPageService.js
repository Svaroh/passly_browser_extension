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
 * @since         5.10.0
 */

const MOBILE_TRANSFER_ENTRYPOINT_URL =
  "webAccessibleResources/mobile-transfer-entrypoint.html?passbolt=mobile-transfer-entrypoint";

export default class OpenWebsiteGettingStartedPageService {
  /**
   * Opens the local Passbolt setup/recover entrypoint in a new tab.
   * @returns {Promise<void>}
   */
  async openTab() {
    const entrypointUrl = browser.runtime.getURL(MOBILE_TRANSFER_ENTRYPOINT_URL);
    await browser.tabs.create({ url: entrypointUrl });
  }
}
