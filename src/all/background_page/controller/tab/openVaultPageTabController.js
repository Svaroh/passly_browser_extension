/**
 * Passly ~ Open source password manager for teams
 * Copyright (c) 2026 Svaroh
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) Svaroh
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://passly.svaroh.net Passly
 * @since         6.1.1
 */

import OpenTrustedDomainTabService from "../../service/ui/openTrustedDomainTabService";
import { assertString } from "../../utils/assertions";

/**
 * Opens a page of the vault in a new tab.
 */
export default class OpenVaultPageTabController {
  /**
   * @constructor
   * @param {Worker} worker The associated worker.
   * @param {string} requestId The associated request id.
   */
  constructor(worker, requestId) {
    this.worker = worker;
    this.requestId = requestId;
    this.openTrustedDomainTabService = new OpenTrustedDomainTabService();
  }

  /**
   * Wrapper of exec function to run it with worker.
   * @param {{pathname: string, action: string}} page the page of the vault to open
   * @return {Promise<void>}
   */
  async _exec(page) {
    try {
      await this.exec(page);
      this.worker.port.emit(this.requestId, "SUCCESS");
    } catch (error) {
      console.error(error);
      this.worker.port.emit(this.requestId, "ERROR", error);
    }
  }

  /**
   * Open the page.
   * @param {{pathname: string, action: string}} page the page of the vault to open
   * @return {Promise<void>}
   */
  async exec(page = {}) {
    const { pathname, action } = page || {};
    if (pathname) {
      assertString(pathname, "The pathname should be a string.");
    }
    if (action) {
      assertString(action, "The action should be a string.");
    }
    if (pathname && !pathname.startsWith("/app/")) {
      throw new Error("The pathname should be a route of the application.");
    }

    await this.openTrustedDomainTabService.openTabAtPath(pathname, action);
  }
}
