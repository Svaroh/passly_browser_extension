/**
 * Passbolt ~ Open source password manager for teams
 * Copyright (c) 2026 Passbolt SA (https://www.passbolt.com)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) 2026 Passbolt SA (https://www.passbolt.com)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://www.passbolt.com Passbolt(tm)
 * @since         5.13.0
 */
import GetActiveAccountService from "../account/getActiveAccountService";

const SESSION_COOKIE_NAME = "passbolt_session";
const CSRF_TOKEN_COOKIE_NAME = "csrfToken";

/**
 * Remove the API session cookies stored locally by the browser.
 *
 * Used by the local sign-out flow when the server is unreachable: the server
 * cannot be asked to expire the session via Set-Cookie, so the extension
 * deletes the cookies itself.
 */
class SessionCookieFlushService {
  /**
   * Flush the session and CSRF cookies for the configured account.
   * @return {Promise<void>}
   */
  static async flush() {
    try {
      const account = await GetActiveAccountService.get();
      const url = account.domain;
      await browser.cookies.remove({ url, name: SESSION_COOKIE_NAME });
      await browser.cookies.remove({ url, name: CSRF_TOKEN_COOKIE_NAME });
    } catch (error) {
      console.error("SessionCookieFlushService::flush failed", error);
    }
  }
}

export default SessionCookieFlushService;
