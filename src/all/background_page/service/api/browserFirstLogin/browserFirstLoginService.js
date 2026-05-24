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
 */
import AbstractService from "../abstract/abstractService";

const BROWSER_FIRST_LOGIN_RESOURCE_NAME = "mobile/browser-first-login/requests";

class BrowserFirstLoginService extends AbstractService {
  /**
   * Constructor.
   * @param {ApiClientOptions} apiClientOptions The API client options.
   */
  constructor(apiClientOptions) {
    super(apiClientOptions, BrowserFirstLoginService.RESOURCE_NAME);
  }

  /**
   * API resource name.
   * @returns {string}
   */
  static get RESOURCE_NAME() {
    return BROWSER_FIRST_LOGIN_RESOURCE_NAME;
  }

  /**
   * Create a browser first-login pairing request.
   * @returns {Promise<object>}
   */
  async create() {
    const response = await this.apiClient.create({});
    return response.body;
  }

  /**
   * View a browser first-login pairing request.
   * @param {string} requestId The request id.
   * @param {string} secret The pairing secret.
   * @returns {Promise<object>}
   */
  async view(requestId, secret) {
    return this.postAction(requestId, "view", { secret });
  }

  /**
   * Mark a browser first-login pairing request as complete.
   * @param {string} requestId The request id.
   * @param {string} secret The pairing secret.
   * @returns {Promise<object>}
   */
  async complete(requestId, secret) {
    return this.postAction(requestId, "complete", { secret });
  }

  /**
   * POST to a request sub-action.
   * @param {string} requestId The request id.
   * @param {string} action The action name.
   * @param {object} body The request body.
   * @returns {Promise<object>}
   */
  async postAction(requestId, action, body) {
    this.assertValidId(requestId);
    this.assertNonEmptyData(body);
    const url = this.apiClient.buildUrl(`${this.apiClient.baseUrl}/${requestId}/${action}`);
    const response = await this.apiClient.fetchAndHandleResponse("POST", url, this.apiClient.buildBody(body));
    return response.body;
  }
}

export default BrowserFirstLoginService;
