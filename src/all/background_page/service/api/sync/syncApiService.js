/**
 * Passly ~ Open source password manager for teams
 * Copyright (c) Passly (https://passly.svaroh.net)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) Passly (https://passly.svaroh.net)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://passly.svaroh.net Passly
 */
import AbstractService from "../abstract/abstractService";

const SYNC_SERVICE_RESOURCE_NAME = "sync";

export default class SyncApiService extends AbstractService {
  /**
   * @param {ApiClientOptions} apiClientOptions
   */
  constructor(apiClientOptions) {
    super(apiClientOptions, SyncApiService.RESOURCE_NAME);
  }

  static get RESOURCE_NAME() {
    return SYNC_SERVICE_RESOURCE_NAME;
  }

  /**
   * Fetch protocol metadata.
   * GET /sync/meta.json
   * @returns {Promise<object>}
   */
  async getMeta() {
    const url = this.apiClient.buildUrl(`${this.apiClient.baseUrl}/meta`, {});
    return await this.apiClient.fetchAndHandleResponse("GET", url);
  }

  /**
   * Fetch delta change journal entries since given cursor.
   * GET /sync/changes.json?since={since}&limit={limit}
   * @param {number|string} since The client cursor (seq)
   * @param {number} [limit=500] Maximum entries to return
   * @returns {Promise<object>}
   */
  async getChanges(since = 0, limit = 500) {
    const options = {
      since: String(since),
      limit: String(limit),
    };
    const url = this.apiClient.buildUrl(`${this.apiClient.baseUrl}/changes`, options);
    return await this.apiClient.fetchAndHandleResponse("GET", url);
  }

  /**
   * Fetch full bootstrap snapshot page.
   * GET /sync/bootstrap.json?page={page}&limit={limit}&cursor={cursor}
   * @param {number} [page=1] Page number
   * @param {number} [limit=500] Page size
   * @param {number|string|null} [cursor=null] Pinned cursor from page 1
   * @returns {Promise<object>}
   */
  async getBootstrap(page = 1, limit = 500, cursor = null) {
    const options = {
      page: String(page),
      limit: String(limit),
    };
    if (cursor !== null && cursor !== undefined) {
      options.cursor = String(cursor);
    }
    const url = this.apiClient.buildUrl(`${this.apiClient.baseUrl}/bootstrap`, options);
    return await this.apiClient.fetchAndHandleResponse("GET", url);
  }

  /**
   * Fetch compact reconciliation manifest.
   * GET /sync/manifest.json?type={type}
   * @param {string} [type="resources"] Entity type
   * @returns {Promise<object>}
   */
  async getManifest(type = "resources") {
    const options = {
      type: String(type),
    };
    const url = this.apiClient.buildUrl(`${this.apiClient.baseUrl}/manifest`, options);
    return await this.apiClient.fetchAndHandleResponse("GET", url);
  }
}
