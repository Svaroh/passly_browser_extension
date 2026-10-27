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
import ParseAppUrlService from "../service/app/parseAppUrlService";
import { PortEvents } from "../event/portEvents";
import GetActiveAccountService from "../service/account/getActiveAccountService";
import BuildApiClientOptionsService from "../service/account/buildApiClientOptionsService";
import FindAndUpdateActiveSessionLocalStorageService from "../service/activeSession/findAndUpdateActiveSessionLocalStorageService";
import isMissingAccountError from "../service/account/isMissingAccountError";
import OfflineSessionService from "../service/auth/offlineSessionService";

class AppBootstrap extends Pagemod {
  /**
   * @inheritDoc
   * @returns {string}
   */
  get appName() {
    return "AppBootstrap";
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
    return ["contentScripts/js/dist/vendors.js", "contentScripts/js/dist/app.js"];
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
    if (!this.assertTopFrameAttachConstraint(frameDetails)) {
      return false;
    }
    if (!(await this.assertUrlAttachConstraint(frameDetails))) {
      return false;
    }
    const isAuthenticated = await this.assertUserAuthenticated();
    if (!isAuthenticated) {
      const hasReplica = await OfflineSessionService.hasLocalReplica().catch(() => false);
      const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
      if (isOffline && hasReplica) {
        return true;
      }
      try {
        const account = await GetActiveAccountService.get();
        if (account?.domain && frameDetails.tabId) {
          const loginUrl = `${account.domain.replace(/\/*$/, "")}/auth/login`;
          if (frameDetails.url !== loginUrl && !frameDetails.url.startsWith(loginUrl)) {
            console.debug(`Unauthenticated session in vault route, redirecting to ${loginUrl}`);
            await browser.tabs.update(frameDetails.tabId, { url: loginUrl });
          }
        }
      } catch (err) {
        console.error(err);
      }
      return false;
    }
    return true;
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
      await GetActiveAccountService.get();
      return ParseAppUrlService.test(frameDetails.url);
    } catch (error) {
      if (isMissingAccountError(error)) {
        return false;
      }
      console.error(error);
      return false;
    }
  }

  /**
   * Is the constraint validated
   * @returns {Promise<boolean>}
   */
  async assertUserAuthenticated() {
    const account = await GetActiveAccountService.get();
    const apiClientOptions = BuildApiClientOptionsService.buildFromAccount(account);
    const findAndUpdateActiveSessionLocalStorageService = new FindAndUpdateActiveSessionLocalStorageService(
      account,
      apiClientOptions,
    );
    const activeSessionEntity = await findAndUpdateActiveSessionLocalStorageService.findAndUpdateAuthenticationStatus();
    const isOfflineSessionOpen = await OfflineSessionService.isOpen();
    return (
      (activeSessionEntity.isAuthenticated || isOfflineSessionOpen) &&
      (activeSessionEntity.isSessionOnline || activeSessionEntity.isSessionOffline || isOfflineSessionOpen)
    );
  }
}

export default new AppBootstrap();
