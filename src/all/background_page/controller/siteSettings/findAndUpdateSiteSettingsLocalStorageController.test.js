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
import SiteSettingsEntity from "passbolt-styleguide/src/shared/models/entity/siteSettings/siteSettingsEntity";
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";
import { defaultProSiteSettings } from "passbolt-styleguide/src/shared/models/entity/siteSettings/siteSettingsEntity.test.data";
import SiteSettingsLocalStorage from "../../service/local_storage/siteSettingsLocalStorage";
import SiteSettingsRuntimeCache from "../../service/siteSettings/siteSettingsRuntimeCache";
import FindAndUpdateSiteSettingsLocalStorageController from "./findAndUpdateSiteSettingsLocalStorageController";
import UserActiveSessionEntity, {
  USER_ACTIVE_SESSION_ONLINE,
} from "passbolt-styleguide/src/shared/models/entity/session/userActiveSessionEntity";
import GetOrFindActiveSessionService from "../../service/activeSession/getOrFindActiveSessionService";

beforeEach(() => {
  jest.clearAllMocks();
  SiteSettingsRuntimeCache.flushAll();
  SiteSettingsLocalStorage._runtimeCachedData = {};
});

describe("FindAndUpdateSiteSettingsLocalStorageController", () => {
  let account, apiClientOptions, worker, controller;

  beforeEach(async () => {
    account = new AccountEntity(defaultAccountDto());
    apiClientOptions = defaultApiClientOptions();
    worker = { port: { emit: jest.fn() } };
    controller = new FindAndUpdateSiteSettingsLocalStorageController(worker, "req-1", apiClientOptions, account);
    await controller.findAndUpdateSiteSettingsLocalStorageService.siteSettingsLocalStorage.flush();
  });

  /**
   * @param {boolean} isAuthenticated
   * @returns {void}
   */
  const mockActiveSession = (isAuthenticated) => {
    jest.spyOn(GetOrFindActiveSessionService.prototype, "getOrFind").mockResolvedValue(
      new UserActiveSessionEntity({
        is_authenticated: isAuthenticated,
        is_mfa_required: false,
        type: USER_ACTIVE_SESSION_ONLINE,
      }),
    );
  };

  describe("::exec", () => {
    it("always calls the API, even when a cache is populated", async () => {
      expect.assertions(2);
      mockActiveSession(true);
      SiteSettingsRuntimeCache.set(new SiteSettingsEntity({ ...defaultProSiteSettings(), serverTimeDiff: 999 }));
      const dto = defaultProSiteSettings();
      const apiSpy = jest
        .spyOn(controller.findAndUpdateSiteSettingsLocalStorageService.findSiteSettingsService, "findSiteSettings")
        .mockResolvedValue(new SiteSettingsEntity(dto));

      const result = await controller.exec();

      expect(apiSpy).toHaveBeenCalledTimes(1);
      expect(result.toDto()).toEqual(dto);
    });

    it("persists the response for an authenticated session", async () => {
      expect.assertions(2);
      mockActiveSession(true);
      const dto = defaultProSiteSettings();
      jest
        .spyOn(controller.findAndUpdateSiteSettingsLocalStorageService.findSiteSettingsService, "findSiteSettings")
        .mockResolvedValue(new SiteSettingsEntity(dto));

      await controller.exec();

      const ls = controller.findAndUpdateSiteSettingsLocalStorageService.siteSettingsLocalStorage;
      expect(await ls.get()).toEqual(dto);
      expect(SiteSettingsRuntimeCache.get()).toEqual(dto);
    });

    it("does not persist the response for an anonymous session", async () => {
      expect.assertions(2);
      mockActiveSession(false);
      const dto = defaultProSiteSettings();
      jest
        .spyOn(controller.findAndUpdateSiteSettingsLocalStorageService.findSiteSettingsService, "findSiteSettings")
        .mockResolvedValue(new SiteSettingsEntity(dto));

      await controller.exec();

      const ls = controller.findAndUpdateSiteSettingsLocalStorageService.siteSettingsLocalStorage;
      expect(await ls.get()).toBeUndefined();
      expect(SiteSettingsRuntimeCache.get()).toEqual(dto);
    });
  });

  describe("::_exec", () => {
    it("emits the site settings on success", async () => {
      expect.assertions(3);
      mockActiveSession(true);
      const dto = defaultProSiteSettings();
      jest
        .spyOn(controller.findAndUpdateSiteSettingsLocalStorageService.findSiteSettingsService, "findSiteSettings")
        .mockResolvedValue(new SiteSettingsEntity(dto));

      await controller._exec();

      const [requestId, status, emitted] = worker.port.emit.mock.calls[0];
      expect(requestId).toBe("req-1");
      expect(status).toBe("SUCCESS");
      expect(emitted.toDto()).toEqual(dto);
    });

    it("emits an error when the server cannot be reached", async () => {
      expect.assertions(1);
      mockActiveSession(true);
      const error = new Error("Unable to reach the server.");
      jest.spyOn(controller.findAndUpdateSiteSettingsLocalStorageService, "findAndUpdateAll").mockRejectedValue(error);
      jest.spyOn(console, "error").mockImplementation(() => {});

      await controller._exec();

      expect(worker.port.emit).toHaveBeenCalledWith("req-1", "ERROR", error);
    });
  });
});
