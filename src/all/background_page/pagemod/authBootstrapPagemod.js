/**
 * Passbolt ~ Open source password manager for teams
 * Copyright (c) 2023 Passbolt SA (https://www.passbolt.com)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) 2023 Passbolt SA (https://www.passbolt.com)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://www.passbolt.com Passbolt(tm)
 * @since         4.0.0
 */
import Pagemod from "./pagemod";
import { PortEvents } from "../event/portEvents";
import ParseAuthUrlService from "../service/auth/parseAuthUrlService";
import GetActiveAccountService from "../service/account/getActiveAccountService";
import isMissingAccountError from "../service/account/isMissingAccountError";

class AuthBootstrap extends Pagemod {
  /**
   * @inheritDoc
   * @returns {string}
   */
  get appName() {
    return "AuthBootstrap";
  }

  /**
   * @inheritDoc
   */
  get contentStyleFiles() {
    return ["webAccessibleResources/css/themes/default/ext_external.min.css"];
  }

  /**
   * @inheritDoc
   */
  get contentScriptFiles() {
    return ["contentScripts/js/dist/vendors.js", "contentScripts/js/dist/login.js"];
  }

  /**
   * @inheritDoc
   */
  get events() {
    return [PortEvents];
  }

  /**
   * @inheritDoc
   */
  get mustReloadOnExtensionUpdate() {
    return true;
  }

  /**
   * @inheritDoc
   */
  async canBeAttachedTo(frameDetails) {
    return this.assertTopFrameAttachConstraint(frameDetails) && (await this.assertUrlAttachConstraint(frameDetails));
  }

  /**
   * Assert that the attached frame is a top frame.
   * @param {Object} frameDetails
   * @returns {boolean}
   */
  assertTopFrameAttachConstraint(frameDetails) {
    return frameDetails.frameId === Pagemod.TOP_FRAME_ID;
  }

  /**
   * Assert that the attached frame is a top frame.
   * @param {Object} frameDetails
   * @returns {Promise<boolean>}
   */
  async assertUrlAttachConstraint(frameDetails) {
    try {
      const account = await GetActiveAccountService.get();
      const canAttach =
        ParseAuthUrlService.testForDomain(frameDetails.url, account.domain) &&
        !ParseAuthUrlService.isAwaitingLocaleRedirect(frameDetails.url, account.domain);
      if (!canAttach) {
        console.debug(`AuthBootstrap cannot be attached to URL: ${frameDetails.url}`);
      }
      return canAttach;
    } catch (error) {
      if (isMissingAccountError(error)) {
        console.debug("AuthBootstrap cannot be attached because no active account is configured.");
        return false;
      }
      console.log(error);
      return false;
    }
  }
}

export default new AuthBootstrap();
