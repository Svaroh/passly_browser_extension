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

import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import UserActiveSessionEntity, {
  USER_ACTIVE_SESSION_OFFLINE,
} from "passbolt-styleguide/src/shared/models/entity/session/userActiveSessionEntity";
import OfflineSettingsEntity from "passbolt-styleguide/src/shared/models/entity/offline/offlineSettingsEntity";
import {
  minimalUserActiveSessionDto,
  defaultUserActiveSessionDto,
} from "passbolt-styleguide/src/shared/models/entity/session/userActiveSessionEntity.test.data";
import { defaultOfflineSettingsDto } from "passbolt-styleguide/src/shared/models/entity/offline/offlineSettingsEntity.test.data";
import OfflineRetentionDataFlushService from "./offlineRetentionDataFlushService";

describe("OfflineRetentionDataFlushService", () => {
  let offlineRetentionDataFlushService, account, apiClientOptions;

  beforeEach(() => {
    jest.clearAllMocks();
    account = new AccountEntity(defaultAccountDto());
    apiClientOptions = defaultApiClientOptions();
    offlineRetentionDataFlushService = new OfflineRetentionDataFlushService(account, apiClientOptions);
  });

  const mockActiveSession = (activeSessionDto) => {
    jest
      .spyOn(offlineRetentionDataFlushService.getOrFindActiveSessionService, "getOrFind")
      .mockResolvedValue(new UserActiveSessionEntity(activeSessionDto));
  };

  const mockOfflineSettings = (offlineSettingsDto) => {
    jest
      .spyOn(offlineRetentionDataFlushService.getOrFindOfflineSettingsService, "getOrFind")
      .mockResolvedValue(new OfflineSettingsEntity(offlineSettingsDto));
  };

  describe("::flushIfExceeded", () => {
    it("Do nothing if last seen online property is not defined.", async () => {
      expect.assertions(3);
      mockActiveSession(minimalUserActiveSessionDto());
      mockOfflineSettings(defaultOfflineSettingsDto());

      jest.spyOn(offlineRetentionDataFlushService.metadataKeyOPFSStorage, "flush");
      jest.spyOn(offlineRetentionDataFlushService.offlineResourcesOPFSStorage, "flush");
      jest.spyOn(offlineRetentionDataFlushService.offlineSecretsOPFSStorage, "flush");

      await offlineRetentionDataFlushService.flushIfExceeded();

      expect(offlineRetentionDataFlushService.metadataKeyOPFSStorage.flush).not.toHaveBeenCalled();
      expect(offlineRetentionDataFlushService.offlineResourcesOPFSStorage.flush).not.toHaveBeenCalled();
      expect(offlineRetentionDataFlushService.offlineSecretsOPFSStorage.flush).not.toHaveBeenCalled();
    });

    it("Do nothing if offline settings is not in local storage.", async () => {
      expect.assertions(3);
      mockActiveSession(minimalUserActiveSessionDto({ type: USER_ACTIVE_SESSION_OFFLINE }));
      jest
        .spyOn(offlineRetentionDataFlushService.getOrFindOfflineSettingsService, "getOrFind")
        .mockImplementationOnce(() => null);

      jest.spyOn(offlineRetentionDataFlushService.metadataKeyOPFSStorage, "flush");
      jest.spyOn(offlineRetentionDataFlushService.offlineResourcesOPFSStorage, "flush");
      jest.spyOn(offlineRetentionDataFlushService.offlineSecretsOPFSStorage, "flush");

      await offlineRetentionDataFlushService.flushIfExceeded();

      expect(offlineRetentionDataFlushService.metadataKeyOPFSStorage.flush).not.toHaveBeenCalled();
      expect(offlineRetentionDataFlushService.offlineResourcesOPFSStorage.flush).not.toHaveBeenCalled();
      expect(offlineRetentionDataFlushService.offlineSecretsOPFSStorage.flush).not.toHaveBeenCalled();
    });

    it("Do nothing if time is not exceeded.", async () => {
      expect.assertions(3);
      const last_seen_online = new Date().toISOString();
      mockActiveSession(defaultUserActiveSessionDto({ last_seen_online }));
      mockOfflineSettings(defaultOfflineSettingsDto());

      jest.spyOn(offlineRetentionDataFlushService.metadataKeyOPFSStorage, "flush");
      jest.spyOn(offlineRetentionDataFlushService.offlineResourcesOPFSStorage, "flush");
      jest.spyOn(offlineRetentionDataFlushService.offlineSecretsOPFSStorage, "flush");

      await offlineRetentionDataFlushService.flushIfExceeded();

      expect(offlineRetentionDataFlushService.metadataKeyOPFSStorage.flush).not.toHaveBeenCalled();
      expect(offlineRetentionDataFlushService.offlineResourcesOPFSStorage.flush).not.toHaveBeenCalled();
      expect(offlineRetentionDataFlushService.offlineSecretsOPFSStorage.flush).not.toHaveBeenCalled();
    });

    it("Should flush data if time is exceeded.", async () => {
      expect.assertions(3);
      mockActiveSession(defaultUserActiveSessionDto());
      mockOfflineSettings(defaultOfflineSettingsDto());

      jest.spyOn(offlineRetentionDataFlushService.metadataKeyOPFSStorage, "flush");
      jest.spyOn(offlineRetentionDataFlushService.offlineResourcesOPFSStorage, "flush");
      jest.spyOn(offlineRetentionDataFlushService.offlineSecretsOPFSStorage, "flush");

      await offlineRetentionDataFlushService.flushIfExceeded();

      expect(offlineRetentionDataFlushService.metadataKeyOPFSStorage.flush).toHaveBeenCalledTimes(1);
      expect(offlineRetentionDataFlushService.offlineResourcesOPFSStorage.flush).toHaveBeenCalledTimes(1);
      expect(offlineRetentionDataFlushService.offlineSecretsOPFSStorage.flush).toHaveBeenCalledTimes(1);
    });

    it("Should log error if data has not been flushed.", async () => {
      expect.assertions(4);
      mockActiveSession(defaultUserActiveSessionDto());
      mockOfflineSettings(defaultOfflineSettingsDto());

      jest
        .spyOn(offlineRetentionDataFlushService.metadataKeyOPFSStorage, "flush")
        .mockRejectedValue(new Error("Error"));
      jest
        .spyOn(offlineRetentionDataFlushService.offlineResourcesOPFSStorage, "flush")
        .mockRejectedValue(new Error("Error"));
      jest
        .spyOn(offlineRetentionDataFlushService.offlineSecretsOPFSStorage, "flush")
        .mockRejectedValue(new Error("Error"));

      await offlineRetentionDataFlushService.flushIfExceeded();

      expect(offlineRetentionDataFlushService.metadataKeyOPFSStorage.flush).toHaveBeenCalledTimes(1);
      expect(offlineRetentionDataFlushService.offlineResourcesOPFSStorage.flush).toHaveBeenCalledTimes(1);
      expect(offlineRetentionDataFlushService.offlineSecretsOPFSStorage.flush).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledTimes(3);
    });

    it("Should log error if any service throw an error.", async () => {
      expect.assertions(4);
      jest
        .spyOn(offlineRetentionDataFlushService.getOrFindActiveSessionService, "getOrFind")
        .mockImplementationOnce(() => {
          throw new Error("Error");
        });
      jest.spyOn(offlineRetentionDataFlushService.metadataKeyOPFSStorage, "flush");
      jest.spyOn(offlineRetentionDataFlushService.offlineResourcesOPFSStorage, "flush");
      jest.spyOn(offlineRetentionDataFlushService.offlineSecretsOPFSStorage, "flush");

      await offlineRetentionDataFlushService.flushIfExceeded();

      expect(offlineRetentionDataFlushService.metadataKeyOPFSStorage.flush).not.toHaveBeenCalled();
      expect(offlineRetentionDataFlushService.offlineResourcesOPFSStorage.flush).not.toHaveBeenCalled();
      expect(offlineRetentionDataFlushService.offlineSecretsOPFSStorage.flush).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledTimes(1);
    });
  });
});
