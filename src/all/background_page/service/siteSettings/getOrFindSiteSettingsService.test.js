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
import {
  anonymousSiteSettings,
  defaultProSiteSettings,
  offlinePluginEnabledSiteSettings,
} from "passbolt-styleguide/src/shared/models/entity/siteSettings/siteSettingsEntity.test.data";
import SiteSettingsLocalStorage from "../local_storage/siteSettingsLocalStorage";
import SiteSettingsRuntimeCache from "./siteSettingsRuntimeCache";
import GetOrFindSiteSettingsService from "./getOrFindSiteSettingsService";
import UserActiveSessionEntity, {
  USER_ACTIVE_SESSION_OFFLINE,
} from "passbolt-styleguide/src/shared/models/entity/session/userActiveSessionEntity";
import { defaultUserActiveSessionDto } from "passbolt-styleguide/src/shared/models/entity/session/userActiveSessionEntity.test.data";
import GetOrFindActiveSessionService from "../activeSession/getOrFindActiveSessionService";
import PassboltBadResponseError from "../../error/passboltBadResponseError";
import AuthenticationStatusService from "../authenticationStatusService";
import ServerStatusApiService from "../api/status/serverStatusApiService";

/**
 * Mock the active session resolved by the service under test.
 * @param {object} data Fields to override on the default session dto.
 * @returns {void}
 */
const mockActiveSession = (data) => {
  jest
    .spyOn(GetOrFindActiveSessionService.prototype, "getOrFind")
    .mockResolvedValue(new UserActiveSessionEntity(defaultUserActiveSessionDto(data)));
};

/**
 * An unauthenticated session that cannot reach the server, i.e. the offline journeys.
 * @returns {void}
 */
const mockAnonymousOfflineSession = () =>
  mockActiveSession({
    is_authenticated: false,
    is_server_reachable: false,
    type: USER_ACTIVE_SESSION_OFFLINE,
  });

beforeEach(() => {
  jest.clearAllMocks();
  SiteSettingsRuntimeCache.flushAll();
  SiteSettingsLocalStorage._runtimeCachedData = {};
  // Default to "not authenticated" so anything that doesn't explicitly re-mock stays on the safe path.
  jest
    .spyOn(GetOrFindActiveSessionService.prototype, "getOrFind")
    .mockResolvedValue(new UserActiveSessionEntity(defaultUserActiveSessionDto({ is_authenticated: false })));
});

describe("GetOrFindSiteSettingsService", () => {
  let account, apiClientOptions, service;

  beforeEach(async () => {
    account = new AccountEntity(defaultAccountDto());
    apiClientOptions = defaultApiClientOptions();
    service = new GetOrFindSiteSettingsService(account, apiClientOptions);
    await service.siteSettingsLocalStorage.flush();
  });

  /**
   * @returns {jest.SpyInstance} spy on the API call behind the find-and-update fall-back.
   */
  const spyOnApi = () =>
    jest.spyOn(service.findAndUpdateSiteSettingsLocalStorageService.findSiteSettingsService, "findSiteSettings");

  describe("::getOrFind - offline session", () => {
    beforeEach(() => {
      mockAnonymousOfflineSession();
    });

    it("returns the persisted settings, which is what makes the offline login screen reachable", async () => {
      expect.assertions(3);
      const dto = offlinePluginEnabledSiteSettings();
      await service.siteSettingsLocalStorage.set(new SiteSettingsEntity(dto));
      // Emulate an evicted service worker: only the persisted store survives.
      SiteSettingsRuntimeCache.flushAll();
      const apiSpy = spyOnApi();

      const result = await service.getOrFind();

      expect(result.toDto()).toEqual(dto);
      expect(result.isPluginEnabled("offlineMode")).toBe(true);
      expect(apiSpy).not.toHaveBeenCalled();
    });

    it("prefers the persisted settings over a runtime cache holding an anonymous payload", async () => {
      /*
       * Nothing flushes the runtime cache on offline login - PostLoginOfflineService runs only the safe
       * subset of PostLoginService - so an anonymous payload fetched before the network dropped can
       * still be sitting there. It is whitelist-filtered, so trusting it would report plugins the
       * server withheld as disabled.
       */
      expect.assertions(3);
      const persisted = offlinePluginEnabledSiteSettings();
      const anonymous = anonymousSiteSettings();
      await service.siteSettingsLocalStorage.set(new SiteSettingsEntity(persisted));
      SiteSettingsRuntimeCache.set(new SiteSettingsEntity(anonymous));

      const result = await service.getOrFind();

      expect(result.toDto()).toEqual(persisted);
      expect(new SiteSettingsEntity(anonymous).isPluginEnabled("offlineMode")).toBe(false);
      expect(result.isPluginEnabled("offlineMode")).toBe(true);
    });

    it("resolves to null rather than attempting a request that cannot complete", async () => {
      expect.assertions(2);
      const apiSpy = spyOnApi();

      expect(await service.getOrFind()).toBeNull();
      expect(apiSpy).not.toHaveBeenCalled();
    });
  });

  describe("::getOrFind - online session, authenticated", () => {
    beforeEach(() => {
      mockActiveSession({ is_authenticated: true });
    });

    it("returns the persisted settings without calling the API", async () => {
      expect.assertions(2);
      const dto = defaultProSiteSettings();
      await service.siteSettingsLocalStorage.set(new SiteSettingsEntity(dto));
      const apiSpy = spyOnApi();

      const result = await service.getOrFind();

      expect(result.toDto()).toEqual(dto);
      expect(apiSpy).not.toHaveBeenCalled();
    });

    it("seeds the runtime cache so the synchronous username validator stays consistent", async () => {
      /*
       * Regression: SiteSettingsRuntimeCache is the ONLY store AppEmailValidatorService reads
       * (synchronously, while constructing a user entity). It is flushed on login and lost on
       * service-worker restart, whereas SiteSettingsLocalStorage survives both, so a read that hits
       * the persisted store must repopulate it or a custom email regex would be dropped.
       */
      expect.assertions(2);
      const dto = defaultProSiteSettings();
      await service.siteSettingsLocalStorage.set(new SiteSettingsEntity(dto));
      SiteSettingsRuntimeCache.flushAll();
      expect(SiteSettingsRuntimeCache.get()).toBeNull();

      await service.getOrFind();

      expect(SiteSettingsRuntimeCache.get()).toEqual(dto);
    });

    it("ignores the runtime cache and falls through to the API on a persisted miss", async () => {
      /*
       * The runtime cache is auth-agnostic and may hold an anonymous payload.
       * Serving that to an authenticated caller would answer canIUse() with false for every plugin
       * the server withholds from anonymous clients.
       */
      expect.assertions(2);
      SiteSettingsRuntimeCache.set(new SiteSettingsEntity(anonymousSiteSettings()));
      const dto = defaultProSiteSettings();
      const apiSpy = spyOnApi().mockResolvedValue(new SiteSettingsEntity(dto));

      const result = await service.getOrFind();

      expect(apiSpy).toHaveBeenCalledTimes(1);
      expect(result.toDto()).toEqual(dto);
    });
  });

  describe("::getOrFind - online session, anonymous", () => {
    beforeEach(() => {
      mockActiveSession({ is_authenticated: false });
    });

    it("returns the runtime cache without reading the persisted settings", async () => {
      expect.assertions(3);
      const dto = defaultProSiteSettings();
      SiteSettingsRuntimeCache.set(new SiteSettingsEntity(dto));
      const lsSpy = jest.spyOn(service.siteSettingsLocalStorage, "get");
      const apiSpy = spyOnApi();

      const result = await service.getOrFind();

      expect(result.toDto()).toEqual(dto);
      expect(lsSpy).not.toHaveBeenCalled();
      expect(apiSpy).not.toHaveBeenCalled();
    });

    it("falls through to the API on a runtime miss, still without reading the persisted settings", async () => {
      /*
       * The persisted store holds the payload of an authenticated session, which is richer than what
       * the API serves an anonymous caller. With the server reachable it is neither ours to read nor
       * as fresh as simply asking.
       */
      expect.assertions(3);
      await service.siteSettingsLocalStorage.set(new SiteSettingsEntity(defaultProSiteSettings()));
      SiteSettingsRuntimeCache.flushAll();
      const lsSpy = jest.spyOn(service.siteSettingsLocalStorage, "get");
      const dto = anonymousSiteSettings();
      const apiSpy = spyOnApi().mockResolvedValue(new SiteSettingsEntity(dto));

      const result = await service.getOrFind();

      expect(apiSpy).toHaveBeenCalledTimes(1);
      expect(lsSpy).not.toHaveBeenCalled();
      expect(result.toDto()).toEqual(dto);
    });
  });

  describe("::getOrFind (refreshCache=false) — authentication status unavailable", () => {
    beforeEach(() => {
      // An API error occured
      jest.spyOn(ServerStatusApiService.prototype, "find").mockRejectedValue(() => true);
      jest.spyOn(AuthenticationStatusService.prototype, "isAuthenticated").mockRejectedValue(new PassboltBadResponseError());
    });

    it("should return the runtime cache when populated when there is an API error", async () => {
      expect.assertions(3);

      const dto = defaultProSiteSettings();
      SiteSettingsRuntimeCache.set(new SiteSettingsEntity(dto));

      const localStorageSpy = jest.spyOn(service.siteSettingsLocalStorage, "get");
      const apiSpy = jest.spyOn(
        service.findAndUpdateSiteSettingsLocalStorageService.findSiteSettingsService,
        "findSiteSettings",
      );

      const result = await service.getOrFind(false);

      expect(result.toDto()).toEqual(dto);
      expect(localStorageSpy).not.toHaveBeenCalled();
      expect(apiSpy).not.toHaveBeenCalled();
    });

    it("should  call the API when cache is empty when there is an API error", async () => {
      expect.assertions(2);

      const dto = defaultProSiteSettings();

      const apiSpy = jest
        .spyOn(service.findAndUpdateSiteSettingsLocalStorageService.findSiteSettingsService, "findSiteSettings")
        .mockResolvedValue(new SiteSettingsEntity(dto));

      const result = await service.getOrFind(false);

      expect(apiSpy).toHaveBeenCalledTimes(1);
      expect(result.toDto()).toEqual(dto);
    });
  });
});
