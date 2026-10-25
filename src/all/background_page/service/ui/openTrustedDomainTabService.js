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
 * @since         5.10.0
 */

import BrowserTabService from "./browserTab.service";
import User from "../../model/user";

export default class OpenTrustedDomainTabService {
  /**
   * Opens the trusted domain in a new tab
   * @returns {Promise<void>}
   */
  async openTab() {
    const user = User.getInstance();
    const domain = user.settings.getDomain();

    await BrowserTabService.openTab(domain);
  }

  /**
   * Opens a page of the vault in a new tab.
   * @param {string} [pathname] the application route, such as /app/passwords/view/<id>
   * @param {string} [action] the action to run once there, such as edit
   * @returns {Promise<void>}
   */
  async openTabAtPath(pathname = null, action = null) {
    const user = User.getInstance();
    const domain = user.settings.getDomain();

    await BrowserTabService.openTab(await this.buildUrl(domain, pathname, action));
  }

  /**
   * The address the vault can actually be opened at right now.
   * @param {string} domain the API domain
   * @param {string} [pathname] the application route
   * @param {string} [action] the action to run once there
   * @returns {Promise<string>}
   */
  async buildUrl(domain, pathname = null, action = null) {
    if (!pathname) {
      return domain;
    }

    const url = new URL(`${domain.replace(/\/*$/, "")}${pathname}`);
    if (action) {
      url.searchParams.set("action", action);
    }
    return url.toString();
  }
}
