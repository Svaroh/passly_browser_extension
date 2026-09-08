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

/**
 * Remove the API session cookies stored locally by the browser.
 *
 * Used by the local sign-out flow when the server is unreachable: the server
 * cannot be asked to expire the session via Set-Cookie, so the extension
 * deletes the cookies itself.
 */
class SessionCookieFlushService {
  /**
   * @constructor
   * @param {AccountEntity} account The user account
   */
  constructor(account) {
    this.account = account;
  }

  /**
   * Flush the session and CSRF cookies for the configured account.
   * @return {Promise<void>}
   */
  async flush() {
    try {
      const url = this.account.domain;
      // As the session cookie name is customizable get all passbolt cookies and remove session cookies
      const passboltCookies = await browser.cookies.getAll({ url });
      passboltCookies.forEach((cookie) => {
        if (cookie.session) {
          browser.cookies.remove({ url, name: cookie.name });
        }
      });
    } catch (error) {
      console.error("SessionCookieFlushService::flush failed", error);
    }
  }
}

export default SessionCookieFlushService;
