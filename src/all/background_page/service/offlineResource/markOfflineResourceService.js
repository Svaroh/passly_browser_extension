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
 * @since         5.13.0
 */

import { assertUuid } from "../../utils/assertions";
import MarkOfflineResourceApiService from "../api/offlineResource/markOfflineResourceApiService";
import OfflineItemEntity from "passbolt-styleguide/src/shared/models/entity/offline/offlineItemEntity";

class MarkOfflineResourceService {
  /**
   * @constructor
   * @param {ApiClientOptions} apiClientOptions The api client options
   */
  constructor(apiClientOptions) {
    this.markOfflineResourceApiService = new MarkOfflineResourceApiService(apiClientOptions);
  }

  /**
   * Mark a resource available offline
   * @param {string} resourceId The Resource id
   * @returns {Promise<OfflineItemEntity>} The offline item entity
   */
  async create(resourceId) {
    assertUuid(resourceId);
    const result = await this.markOfflineResourceApiService.create(resourceId);
    return new OfflineItemEntity(result.body);
  }
}

export default MarkOfflineResourceService;
