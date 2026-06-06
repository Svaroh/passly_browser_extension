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

import {
  PASSKEY_PROVIDER_KEEPALIVE_PERIOD,
  PASSKEY_PROVIDER_MESSAGES,
} from "../../../../all/passkey/passkeyProviderConstants";

export const SEND_MESSAGE_TARGET_PASSKEY_KEEPALIVE_START = "passkey-provider-keepalive-start";
export const SEND_MESSAGE_TARGET_PASSKEY_KEEPALIVE_STOP = "passkey-provider-keepalive-stop";
export const SEND_MESSAGE_TARGET_PASSKEY_KEEPALIVE_RESPONSE = "service-worker-passkey-provider-keepalive-response";
export const PASSKEY_PROVIDER_KEEPALIVE_MESSAGE = PASSKEY_PROVIDER_MESSAGES.KEEPALIVE;

export default class PasskeyKeepAliveOffscreenService {
  /**
   * @type {number|null}
   * @private
   */
  static _intervalId = null;

  /**
   * Start polling the service worker so Chrome keeps the MV3 WebAuthn proxy attached.
   * @returns {Promise<object>}
   */
  static async handleStartRequest() {
    await PasskeyKeepAliveOffscreenService.start();

    return {
      data: { started: true },
      target: SEND_MESSAGE_TARGET_PASSKEY_KEEPALIVE_RESPONSE,
    };
  }

  /**
   * Stop polling the service worker.
   * @returns {object}
   */
  static handleStopRequest() {
    PasskeyKeepAliveOffscreenService.stop();

    return {
      data: { started: false },
      target: SEND_MESSAGE_TARGET_PASSKEY_KEEPALIVE_RESPONSE,
    };
  }

  /**
   * @returns {Promise<void>}
   */
  static async start() {
    if (PasskeyKeepAliveOffscreenService._intervalId) {
      return;
    }

    await PasskeyKeepAliveOffscreenService.pollServiceWorker();
    PasskeyKeepAliveOffscreenService._intervalId = setInterval(
      () => PasskeyKeepAliveOffscreenService.pollServiceWorker(),
      PASSKEY_PROVIDER_KEEPALIVE_PERIOD,
    );
  }

  /**
   * @returns {void}
   */
  static stop() {
    if (!PasskeyKeepAliveOffscreenService._intervalId) {
      return;
    }

    clearInterval(PasskeyKeepAliveOffscreenService._intervalId);
    PasskeyKeepAliveOffscreenService._intervalId = null;
  }

  /**
   * @returns {Promise<void>}
   */
  static async pollServiceWorker() {
    try {
      await chrome.runtime.sendMessage({ name: PASSKEY_PROVIDER_KEEPALIVE_MESSAGE });
    } catch {
      // The service worker may be unavailable while Chrome is restarting it.
    }
  }

  /**
   * Reset runtime state for unit tests.
   */
  static flush() {
    PasskeyKeepAliveOffscreenService.stop();
  }
}
