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
 * @since         5.12.135
 */

import GetActiveAccountService from "../../../../all/background_page/service/account/getActiveAccountService";

class PasskeyContentFallbackService {
  /**
   * @param {object} requestDetails
   * @param {object} sender
   * @returns {object}
   */
  static prepareRequestDetails(requestDetails, sender) {
    if (!requestDetails || typeof requestDetails !== "object") {
      throw new TypeError("The content WebAuthn request details should be an object.");
    }

    const senderOrigin = this.getSenderOrigin(sender);
    return {
      ...requestDetails,
      origin: senderOrigin || requestDetails.origin,
    };
  }

  /**
   * @param {object} sender
   * @returns {string|null}
   */
  static getSenderOrigin(sender) {
    try {
      return new URL(sender?.url || sender?.origin || "").origin;
    } catch {
      return null;
    }
  }

  /**
   * Decide if the content-script fallback should yield to native WebAuthn.
   * @param {string} origin
   * @param {Function} isEnabled
   * @returns {Promise<boolean>}
   */
  static async shouldSkip(origin, isEnabled = () => true) {
    return Boolean(await this.getSkipReason(origin, isEnabled));
  }

  /**
   * Explain why the content-script fallback should yield to native WebAuthn.
   * @param {string} origin
   * @param {Function} isEnabled
   * @returns {Promise<string|null>}
   */
  static async getSkipReason(origin, isEnabled = () => true) {
    if (!(await isEnabled())) {
      return "disabled";
    }

    let account;
    try {
      account = await GetActiveAccountService.get();
    } catch {
      return "no-active-account";
    }

    try {
      if (new URL(account.domain).origin === new URL(origin).origin) {
        return "own-passly-domain";
      }
    } catch {
      return "invalid-origin";
    }

    return null;
  }
}

export default PasskeyContentFallbackService;
