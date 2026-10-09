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
import OfflineSettingsLocalStorage, { OFFLINE_SETTINGS } from "./offlineSettingsLocalStorage";
import OfflineSettingsEntity from "passbolt-styleguide/src/shared/models/entity/offline/offlineSettingsEntity";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("OfflineSettingsLocalStorage", () => {
  let account, storage;
  beforeEach(async () => {
    account = new AccountEntity(defaultAccountDto());
    storage = new OfflineSettingsLocalStorage(account);
    // flush account related storage before each.
    await storage.flush();
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

  describe("::key & entityClass", () => {
    it("exposes the expected storage key.", () => {
      expect.assertions(2);
      expect(storage.key).toEqual(OFFLINE_SETTINGS);
      expect(storage.storageDataKey).toEqual(`${OFFLINE_SETTINGS}-${account.id}`);
    });

    it("exposes the expected entity class.", () => {
      expect.assertions(1);
      expect(storage.entityClass).toEqual(OfflineSettingsEntity);
    });
  });

  describe("::getData", () => {
    it("returns undefined if nothing is stored in the local storage.", async () => {
      expect.assertions(1);
      const result = await storage.getData();
      expect(result).toBeUndefined();
    });

    it("returns content stored in the local storage.", async () => {
      const settingsDto = defaultOfflineSettingsDto();
      expect.assertions(1);
      browser.storage.local.set({ [storage.storageDataKey]: settingsDto });
      const result = await storage.getData();
      expect(result).toEqual(settingsDto);
    });
  });

  describe("::setData", () => {
    it("stores content in the local storage.", async () => {
      expect.assertions(2);
      const settings = new OfflineSettingsEntity(defaultOfflineSettingsDto());
      await storage.setData(settings);
      // Expect the local storage (mocked here) to be set.
      expect(browser.storage.local.store[storage.storageDataKey]).toEqual(settings.toDto());
      // Expect the get to retrieve the set data.
      const resultGet = await storage.getData();
      expect(resultGet).toEqual(settings.toDto());
    });

    it("throws if no data is given to store.", async () => {
      expect.assertions(2);
      await expect(() => storage.setData()).rejects.toThrow(TypeError);
      // Expect the local storage (mocked here) to not be set.
      expect(browser.storage.local.store[storage.storageDataKey]).toBeUndefined();
    });

    it("throws if invalid data is given to store.", async () => {
      expect.assertions(2);
      await expect(() => storage.setData({})).rejects.toThrow(TypeError);
      // Expect the local storage (mocked here) to not be set.
      expect(browser.storage.local.store[storage.storageDataKey]).toBeUndefined();
    });
  });

  describe("::flush", () => {
    it("flushes content of the local storage.", async () => {
      expect.assertions(1);
      const settings = new OfflineSettingsEntity(defaultOfflineSettingsDto());
      await storage.setData(settings);
      await storage.flush();
      // Expect the local storage (mocked here) to not be set.
      expect(browser.storage.local.store[storage.storageDataKey]).toBeUndefined();
    });
  });
});
