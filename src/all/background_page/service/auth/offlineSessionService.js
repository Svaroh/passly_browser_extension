/**
 * Passly - Open source password manager for teams
 * Copyright (c) 2026 Svaroh
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) Svaroh
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://passly.svaroh.net Passly
 * @since         6.0.6
 */
import ResourceLocalStorage from "../local_storage/resourceLocalStorage";

const OFFLINE_SESSION_STORAGE_KEY = "offline_session";

/**
 * Remembers that someone unlocked the vault locally while the API could not be reached.
 *
 * A server session cannot exist without a server, yet a device holding a complete local replica has everything it
 * needs to serve its owner. What stands in for the session is this flag: it is set only after the passphrase has been
 * checked against the locally stored private key, and it lives in session storage, so closing the browser ends it.
 *
 * The passphrase itself is never part of it - nothing here, or anywhere else, persists it.
 */
class OfflineSessionService {
  /**
   * Record that the vault was unlocked locally.
   * @returns {Promise<void>}
   */
  static async open() {
    await browser.storage.session.set({
      [OFFLINE_SESSION_STORAGE_KEY]: { unlocked_at: new Date().toISOString() },
    });
  }

  /**
   * Whether the vault was unlocked locally during this browser session.
   * @returns {Promise<boolean>}
   */
  static async isOpen() {
    const stored = await browser.storage.session.get([OFFLINE_SESSION_STORAGE_KEY]);
    return Boolean(stored?.[OFFLINE_SESSION_STORAGE_KEY]);
  }

  /**
   * Forget the local unlock.
   * @returns {Promise<void>}
   */
  static async close() {
    await browser.storage.session.remove(OFFLINE_SESSION_STORAGE_KEY);
  }

  /**
   * The workspace as served by the extension itself.
   *
   * The application boots on the document it was loaded from and then routes itself, so a page to land on is passed
   * the same way the injected iframe receives it: as query parameters read by the first load route.
   * @param {string} [pathname] the application route to land on, such as /app/passwords/view/<id>
   * @param {string} [action] the action to run once there, such as edit
   * @returns {string}
   */
  static getWorkspaceUrl(pathname = null, action = null) {
    const url = new URL(browser.runtime.getURL("/webAccessibleResources/workspace.html"));
    url.searchParams.set("passbolt", "workspace");
    if (pathname) {
      url.searchParams.set("pathname", pathname);
    }
    if (action) {
      url.searchParams.set("action", action);
    }
    return url.toString();
  }

  /**
   * The sign in page as served by the extension itself.
   * @param {string} [pathname] the application route to redirect to post login
   * @param {string} [action] the action to run once there
   * @returns {string}
   */
  static getSigninUrl(pathname = null, action = null) {
    const url = new URL(browser.runtime.getURL("/webAccessibleResources/signin.html"));
    url.searchParams.set("passbolt", "signin");
    if (pathname) {
      url.searchParams.set("pathname", pathname);
    }
    if (action) {
      url.searchParams.set("action", action);
    }
    return url.toString();
  }

  /**
   * Whether this device carries a replica worth opening without the API.
   *
   * An account that never synchronised has nothing to show, so it still needs the server to get going; one that did
   * can be opened, and stays openable for as long as the replica is there.
   * @returns {Promise<boolean>}
   */
  static async hasLocalReplica() {
    try {
      const resources = await ResourceLocalStorage.get();
      return Array.isArray(resources) && resources.length > 0;
    } catch (error) {
      console.error(error);
      return false;
    }
  }
}

export default OfflineSessionService;
export { OFFLINE_SESSION_STORAGE_KEY };
