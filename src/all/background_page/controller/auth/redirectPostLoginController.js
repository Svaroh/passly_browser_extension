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
 * @since         5.4.0
 */

export default class RedirectPostLoginController {
  /**
   * @constructor
   * @param {Worker} worker
   * @param {string} requestId
   * @param {AbstractAccountEntity} apiClientOptions the api client options
   */
  constructor(worker, requestId, account) {
    this.worker = worker;
    this.requestId = requestId;
    this.account = account;
  }

  /**
   * Controller executor.
   * @returns {Promise<void>}
   */
  async _exec() {
    try {
      const url = this.getRedirectUrl();
      this.worker.port.emit(this.requestId, "SUCCESS");
      chrome.tabs.update(this.worker.tab.id, { url });
    } catch (error) {
      console.error(error);
      this.worker.port.emit(this.requestId, "ERROR", error);
    }
  }

  /**
   * Redirects the user to the app main page
   * or to the redirect url if a `redirect` parameter is given in the worker URL.
   * @returns {Promise<void>}
   */
  async exec() {
    const url = this.getRedirectUrl();

    chrome.tabs.update(this.worker.tab.id, { url });
  }

  /**
   * Get the post-login redirect URL.
   * @returns {string}
   */
  getRedirectUrl() {
    const workerUrl = new URL(this.worker.tab.url);
    const redirectTo = workerUrl.searchParams.get("redirect");
    const domain = this.account.domain.replace(/\/+$/g, "");

    return /^\/[A-Z\d/-]*$/i.test(redirectTo) ? `${domain}${redirectTo}` : domain;
  }
}
