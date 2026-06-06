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
 * @since         5.12.103
 */

import { v4 as uuidv4 } from "uuid";
import {
  SEND_MESSAGE_TARGET_PASSKEY_KEEPALIVE_START,
  SEND_MESSAGE_TARGET_PASSKEY_KEEPALIVE_STOP,
} from "../../../offscreens/service/passkey/passkeyKeepAliveOffscreenService";
import CreateOffscreenDocumentService, { OFFSCREEN_URL } from "../offscreen/createOffscreenDocumentService";
import HandleOffscreenResponseService from "../offscreen/handleOffscreenResponseService";

class PasskeyKeepAliveService {
  /**
   * Start the offscreen keepalive used by Chrome MV3 WebAuthn proxy.
   * @returns {Promise<object>}
   */
  static async start() {
    await CreateOffscreenDocumentService.createIfNotExistOffscreenDocument();

    return this.sendOffscreenMessage(SEND_MESSAGE_TARGET_PASSKEY_KEEPALIVE_START);
  }

  /**
   * Stop the offscreen keepalive if the offscreen document exists.
   * @returns {Promise<object|boolean>}
   */
  static async stop() {
    if (!(await this.hasOffscreenDocument())) {
      return false;
    }

    return this.sendOffscreenMessage(SEND_MESSAGE_TARGET_PASSKEY_KEEPALIVE_STOP);
  }

  /**
   * @returns {Promise<boolean>}
   */
  static async hasOffscreenDocument() {
    if (!chrome.runtime?.getContexts) {
      return false;
    }

    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
    });

    return existingContexts.length > 0;
  }

  /**
   * @param {string} target
   * @returns {Promise<object>}
   */
  static async sendOffscreenMessage(target) {
    const requestId = uuidv4();

    return new Promise((resolve, reject) => {
      HandleOffscreenResponseService.setResponseCallback(requestId, { resolve, reject });
      Promise.resolve(chrome.runtime.sendMessage({ id: requestId, target })).catch(reject);
    });
  }

  /**
   * Handle a keepalive acknowledgement from the offscreen document.
   * @param {object} message
   * @param {{resolve: function}} promise
   */
  static handleResponse(message, promise) {
    promise.resolve(message.data);
  }
}

export default PasskeyKeepAliveService;
