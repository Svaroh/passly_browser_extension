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

import RbacsCollection from "passbolt-styleguide/src/shared/models/entity/rbac/rbacsCollection";
import {
  defaultRbacWithActionData,
  denyRbacWithActionData,
} from "passbolt-styleguide/src/shared/models/entity/rbac/rbacEntity.test.data";
import { defaultActionData } from "passbolt-styleguide/src/shared/models/entity/rbac/actionEntity.test.data";
import { actions } from "passbolt-styleguide/src/shared/services/rbacs/actionEnumeration";
import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import SiteSettingsEntity from "passbolt-styleguide/src/shared/models/entity/siteSettings/siteSettingsEntity";
import {
  defaultCeSiteSettings,
  offlinePluginEnabledSiteSettings,
} from "../../model/entity/siteSettings/siteSettingsEntity.test.data";
import CanUseOfflineStorageService from "./canUseOfflineStorageService";

const allowOfflineAccessRbac = () =>
  defaultRbacWithActionData({ action: defaultActionData({ name: actions.ALLOW_OFFLINE_RESOURCES_ACCESS }) });

const denyOfflineAccessRbac = () =>
  denyRbacWithActionData({ action: defaultActionData({ name: actions.ALLOW_OFFLINE_RESOURCES_ACCESS }) });

const otherActionRbac = () => defaultRbacWithActionData({ action: defaultActionData({ name: "Resources.add" }) });

describe("CanUseOfflineStorageService", () => {
  let canUseOfflineStorageService, account, apiClientOptions;

  beforeEach(() => {
    jest.clearAllMocks();
    account = new AccountEntity(defaultAccountDto());
    apiClientOptions = defaultApiClientOptions();
    canUseOfflineStorageService = new CanUseOfflineStorageService(account, apiClientOptions);
  });

  const mockSettings = (siteSettingsDto) => {
    jest
      .spyOn(canUseOfflineStorageService.getOrFindSiteSettingsService, "getOrFind")
      .mockResolvedValue(new SiteSettingsEntity(siteSettingsDto));
  };

  const mockRbacs = (rbacs) => {
    jest.spyOn(canUseOfflineStorageService.getOrFindRbacService, "getOrFindMe").mockResolvedValue(rbacs);
  };

  describe("::canUseOfflineStorage", () => {
    it("returns false when the offline plugin is not enabled.", async () => {
      expect.assertions(2);
      mockSettings(defaultCeSiteSettings());
      const rbacsSpy = jest.spyOn(canUseOfflineStorageService.getOrFindRbacService, "getOrFindMe");

      const result = await canUseOfflineStorageService.canUseOfflineStorage();

      expect(result).toBe(false);
      // Short-circuits before consulting RBAC.
      expect(rbacsSpy).not.toHaveBeenCalled();
    });

    it("returns false when the user has no RBAC for offline access.", async () => {
      expect.assertions(1);
      mockSettings(offlinePluginEnabledSiteSettings());
      mockRbacs(new RbacsCollection([otherActionRbac()]));

      const result = await canUseOfflineStorageService.canUseOfflineStorage();

      expect(result).toBe(false);
    });

    it("returns false when the user's RBAC for offline access is DENY.", async () => {
      expect.assertions(1);
      mockSettings(offlinePluginEnabledSiteSettings());
      mockRbacs(new RbacsCollection([denyOfflineAccessRbac()]));

      const result = await canUseOfflineStorageService.canUseOfflineStorage();

      expect(result).toBe(false);
    });

    it("returns false when the RBAC collection is empty.", async () => {
      expect.assertions(1);
      mockSettings(offlinePluginEnabledSiteSettings());
      mockRbacs(new RbacsCollection([]));

      const result = await canUseOfflineStorageService.canUseOfflineStorage();

      expect(result).toBe(false);
    });

    it("returns true when the offline plugin is enabled and the user's RBAC for offline access is ALLOW.", async () => {
      expect.assertions(1);
      mockSettings(offlinePluginEnabledSiteSettings());
      mockRbacs(new RbacsCollection([allowOfflineAccessRbac()]));

      const result = await canUseOfflineStorageService.canUseOfflineStorage();

      expect(result).toBe(true);
    });
  });
});
