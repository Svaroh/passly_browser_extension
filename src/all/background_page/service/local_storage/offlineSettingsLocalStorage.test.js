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

import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";
import { defaultOfflineSettingsDto } from "passbolt-styleguide/src/shared/models/entity/offline/offlineSettingsEntity.test.data";
import OfflineSettingsLocalStorage from "./offlineSettingsLocalStorage";
import OfflineSettingsEntity from "passbolt-styleguide/src/shared/models/entity/offline/offlineSettingsEntity";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("OfflineSettingsLocalStorage", () => {
  let account, storage;
  beforeEach(() => {
    account = new AccountEntity(defaultAccountDto());
    storage = new OfflineSettingsLocalStorage(account);
    // flush account related storage before each.
    storage.flush();
  });

  describe("::constructor", () => {
    it("throws an error if no account is provided.", () => {
      expect.assertions(1);
      expect(() => new OfflineSettingsLocalStorage()).toThrow(TypeError);
    });

    it("throws an error if parameter account is not a valid AccountEntity.", () => {
      expect.assertions(1);
      expect(() => new OfflineSettingsLocalStorage({})).toThrow(TypeError);
    });
  });

  describe("::get", () => {
    it("returns undefined if nothing is stored in the local storage.", async () => {
      expect.assertions(1);
      const result = await storage.get();
      expect(result).toBeUndefined();
    });

    it("returns content stored in the local storage.", async () => {
      const settingsDto = defaultOfflineSettingsDto();
      expect.assertions(1);
      browser.storage.local.set({ [storage.storageKey]: settingsDto });
      const result = await storage.get();
      expect(result).toEqual(settingsDto);
    });

    it("returns content stored in the runtime cache.", async () => {
      const settingsDto = defaultOfflineSettingsDto();
      expect.assertions(2);
      // Force the runtime cache, to ensure it is hit even if the local storage is empty.
      OfflineSettingsLocalStorage._runtimeCachedData[account.id] = settingsDto;
      const result = await storage.get();
      expect(result).toEqual(settingsDto);
      // Control the local storage was well empty.
      expect(browser.storage.local.store[storage.storageKey]).toBeUndefined();
    });
  });

  describe("::set", () => {
    it("stores content in the local storage.", async () => {
      expect.assertions(3);
      const settings = new OfflineSettingsEntity(defaultOfflineSettingsDto());
      await storage.set(settings);
      // Expect the local storage (mocked here) to be set.
      expect(browser.storage.local.store[storage.storageKey]).toEqual(settings.toDto());
      // Expect the runtime cache to be set.
      expect(OfflineSettingsLocalStorage._runtimeCachedData[account.id]).toEqual(settings.toDto());
      // Expect the get to retrieve the set data.
      const resultGet = await storage.get();
      expect(resultGet).toEqual(settings.toDto());
    });

    it("throws if no data is given to store.", async () => {
      expect.assertions(3);
      await expect(() => storage.set()).rejects.toThrow(TypeError);
      // Expect the local storage (mocked here) to not be set.
      expect(browser.storage.local.store[storage.storageKey]).toBeUndefined();
      // Expect the runtime cache to not be set.
      expect(OfflineSettingsLocalStorage._runtimeCachedData[account.id]).toBeUndefined();
    });

    it("throws if invalid data is given to store.", async () => {
      expect.assertions(3);
      await expect(() => storage.set({})).rejects.toThrow(TypeError);
      // Expect the local storage (mocked here) to not be set.
      expect(browser.storage.local.store[storage.storageKey]).toBeUndefined();
      // Expect the runtime cache to not be set.
      expect(OfflineSettingsLocalStorage._runtimeCachedData[account.id]).toBeUndefined();
    });

    it("waits any on-going call to set to perform another set.", async () => {
      expect.assertions(3);
      const promisesResolvers = [];

      jest.spyOn(storage, "_setBrowserStorage").mockImplementation(() => {
        let resolve;
        const promise = new Promise((_resolve) => (resolve = _resolve));
        promisesResolvers.push(resolve);
        return promise;
      });

      const offlineSettingsDto = defaultOfflineSettingsDto();
      const offlineSettingsDto2 = defaultOfflineSettingsDto({
        data_retention_period: 172800,
        max_session_duration: 7200,
      });
      const resultPromise1 = storage.set(new OfflineSettingsEntity(offlineSettingsDto));
      const resultPromise2 = storage.set(new OfflineSettingsEntity(offlineSettingsDto2));
      expect(storage._setBrowserStorage).toHaveBeenCalledWith({
        [storage.storageKey]: offlineSettingsDto,
      });
      expect(storage._setBrowserStorage).not.toHaveBeenCalledWith({
        [storage.storageKey]: offlineSettingsDto2,
      });
      promisesResolvers[0]();
      await resultPromise1;
      expect(storage._setBrowserStorage).toHaveBeenCalledWith({
        [storage.storageKey]: offlineSettingsDto,
      });
      promisesResolvers[1]();
      await resultPromise2;
    });
  });

  describe("::flush", () => {
    it("flushes works with not initialized local storage.", async () => {
      expect.assertions(2);
      await storage.flush();
      // Expect the local storage (mocked here) to not be set.
      expect(browser.storage.local.store[storage.storageKey]).toBeUndefined();
      // Expect the runtime cache to not be set.
      expect(OfflineSettingsLocalStorage._runtimeCachedData[account.id]).toBeUndefined();
    });

    it("flushes content of the local storage.", async () => {
      expect.assertions(2);
      const settings = new OfflineSettingsEntity(defaultOfflineSettingsDto());
      await storage.set(settings);
      await storage.flush();
      // Expect the local storage (mocked here) to not be set.
      expect(browser.storage.local.store[storage.storageKey]).toBeUndefined();
      // Expect the runtime cache to not be set.
      expect(OfflineSettingsLocalStorage._runtimeCachedData[account.id]).toBeUndefined();
    });
  });
});
