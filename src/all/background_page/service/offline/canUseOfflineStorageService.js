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
 * @since         6.0.0
 */
import GetOrFindSiteSettingsService from "../siteSettings/getOrFindSiteSettingsService";
import GetOrFindRbacService from "../rbac/getOrFindRbacService";
import { actions } from "passbolt-styleguide/src/shared/services/rbacs/actionEnumeration";
import { controlFunctions } from "passbolt-styleguide/src/shared/services/rbacs/controlFunctionEnumeration";

/**
 * Returns whether the current user can use offline storage for resources.
 *
 * The check combines two gates:
 *  - The offline plugin is enabled at the org level.
 *  - The current user is granted the `OfflineMode.accessOffline` RBAC action.
 */
export default class CanUseOfflineStorageService {
  /**
   * @constructor
   * @param {AccountEntity} account The current user account.
   * @param {ApiClientOptions} apiClientOptions The api client options.
   */
  constructor(account, apiClientOptions) {
    this.getOrFindSiteSettingsService = new GetOrFindSiteSettingsService(account, apiClientOptions);
    this.getOrFindRbacService = new GetOrFindRbacService(apiClientOptions, account);
  }

  /**
   * Returns true iff the offline feature is configured and the current user can access offline data.
   * @returns {Promise<boolean>}
   */
  async canUseOfflineStorage() {
    const siteSettings = await this.getOrFindSiteSettingsService.getOrFind(false);
    if (!siteSettings.isPluginEnabled("offlineMode")) {
      return false;
    }
    const rbacs = await this.getOrFindRbacService.getOrFindMe();
    const rbac = rbacs?.findRbacByActionName(actions.ALLOW_OFFLINE_RESOURCES_ACCESS);
    if (!rbac) {
      return false;
    }
    return rbac.controlFunction === controlFunctions.ALLOW;
  }
}
