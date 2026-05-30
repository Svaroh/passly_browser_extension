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
 * @since         3.10.0
 */
import User from "../../model/user";

class ParseAuthUrlService {
  /**
   * Get regex to check URI validity
   * @returns {RegExp}
   */
  static get regex() {
    const user = User.getInstance();
    return this.buildRegexForDomain(user.settings.getDomain());
  }

  /**
   * Build regex to check URI validity for a trusted domain.
   * @param {string} domain The trusted domain.
   * @returns {RegExp}
   */
  static buildRegexForDomain(domain) {
    const escapedDomain = domain.replace(/\/+$/g, "").replace(/\W/g, "\\$&");
    return new RegExp(`^${escapedDomain}/auth/login/?(#.*)?(\\?.*)?$`);
  }

  /**
   * Test regex with the url.
   * @param {string} url The url to test.
   * @returns {boolean}
   */
  static test(url) {
    return this.regex.test(url);
  }

  /**
   * Test regex with the url for a given trusted domain.
   * @param {string} url The url to test.
   * @param {string} domain The trusted domain.
   * @returns {boolean}
   */
  static testForDomain(url, domain) {
    return this.buildRegexForDomain(domain).test(url);
  }

  /**
   * Whether the URL is the intermediate server login URL that is expected to be redirected to a localized URL.
   * @param {string} url The url to test.
   * @returns {boolean}
   */
  static isAwaitingLocaleRedirect(url, domain = null) {
    const isAuthUrl = domain ? this.testForDomain(url, domain) : this.test(url);
    if (!isAuthUrl) {
      return false;
    }

    try {
      const urlObject = new URL(url);
      return urlObject.searchParams.has("redirect") && !urlObject.searchParams.has("locale");
    } catch {
      return false;
    }
  }
}

export default ParseAuthUrlService;
