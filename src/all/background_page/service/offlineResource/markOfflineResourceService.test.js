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

import { enableFetchMocks } from "jest-fetch-mock";
import { mockApiResponse, mockApiResponseError } from "passbolt-styleguide/test/mocks/mockApiResponse";
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import PassboltApiFetchError from "passbolt-styleguide/src/shared/lib/Error/PassboltApiFetchError";
import PassboltServiceUnavailableError from "passbolt-styleguide/src/shared/lib/Error/PassboltServiceUnavailableError";
import ResourceEntity, {
  METADATA_KEY_TYPE_METADATA_KEY,
  METADATA_KEY_TYPE_USER_KEY,
} from "../../model/entity/resource/resourceEntity";
import { defaultOfflineItemDto } from "passbolt-styleguide/src/shared/models/entity/offline/offlineItemEntity.test.data";
import MarkOfflineResourceService from "./markOfflineResourceService";
import OfflineItemEntity from "passbolt-styleguide/src/shared/models/entity/offline/offlineItemEntity";
import { v4 as uuidv4 } from "uuid";
import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";
import ResourceLocalStorage from "../local_storage/resourceLocalStorage";
import {
  defaultResourceDto,
  resourceMetadataEncryptedDto,
} from "passbolt-styleguide/src/shared/models/entity/resource/resourceEntity.test.data";
import { defaultMetadataPrivateKeyDto } from "passbolt-styleguide/src/shared/models/entity/metadata/metadataPrivateKeyEntity.test.data";
import { defaultMetadataKeyDto } from "passbolt-styleguide/src/shared/models/entity/metadata/metadataKeyEntity.test.data";
import { pgpKeys } from "passbolt-styleguide/test/fixture/pgpKeys/keys";
import MetadataKeysCollection from "passbolt-styleguide/src/shared/models/entity/metadata/metadataKeysCollection";
import { readSecret as readSecretDto } from "passbolt-styleguide/src/shared/models/entity/secret/secretEntity.test.data";

describe("MarkOfflineResourceService", () => {
  let apiClientOptions, account;

  beforeEach(async () => {
    enableFetchMocks();
    fetch.resetMocks();
    apiClientOptions = defaultApiClientOptions();
    account = new AccountEntity(defaultAccountDto());
  });

  describe("::create", () => {
    it("successfully mark a resource available offline without metadata key storage", async () => {
      expect.assertions(6);
      const resourceId = uuidv4();
      const apiResponse = defaultOfflineItemDto({ foreign_key: resourceId });
      fetch.doMockOnceIf(new RegExp(`/offline/${ResourceEntity.ENTITY_NAME.toLowerCase()}/${resourceId}`), () =>
        mockApiResponse(apiResponse),
      );
      const resource = defaultResourceDto({ id: resourceId });
      const resourceEntityExpected = new ResourceEntity(resource);
      resourceEntityExpected.offline = new OfflineItemEntity(apiResponse);
      jest.spyOn(ResourceLocalStorage, "getResourceById").mockResolvedValue(resource);
      jest.spyOn(ResourceLocalStorage, "updateResource").mockResolvedValue();

      const service = new MarkOfflineResourceService(account, apiClientOptions);
      const secretDto = readSecretDto({ resource_id: resourceId });
      const resourceEncrypted = resourceMetadataEncryptedDto({
        metadata_key_type: METADATA_KEY_TYPE_USER_KEY,
        id: resourceId,
        secrets: [secretDto],
      });
      const expectedResourceEncryptedEntity = new ResourceEntity(resourceEncrypted);
      jest
        .spyOn(service.findResourcesService, "findOneByIdForOffline")
        .mockResolvedValue(expectedResourceEncryptedEntity);
      jest.spyOn(service.metadataKeyOPFSStorage, "get");
      jest.spyOn(service.offlineResourcesOPFSStorage, "addResource");
      jest.spyOn(service.offlineSecretsOPFSStorage, "addSecret");

      const result = await service.create(resourceId);

      expect(result).toBeInstanceOf(OfflineItemEntity);
      expect(result).toEqual(new OfflineItemEntity(apiResponse));
      expect(ResourceLocalStorage.updateResource).toHaveBeenCalledWith(resourceEntityExpected);
      expect(service.metadataKeyOPFSStorage.get).not.toHaveBeenCalled();
      expect(service.offlineResourcesOPFSStorage.addResource).toHaveBeenCalledWith(expectedResourceEncryptedEntity);
      expect(service.offlineSecretsOPFSStorage.addSecret).toHaveBeenCalledWith(
        expectedResourceEncryptedEntity.secrets.items[0],
      );
    });

    it("successfully mark a resource available offline and find metadata key for offline storage if not set", async () => {
      expect.assertions(6);
      const resourceId = uuidv4();
      const apiResponse = defaultOfflineItemDto({ foreign_key: resourceId });
      fetch.doMockOnceIf(new RegExp(`/offline/${ResourceEntity.ENTITY_NAME.toLowerCase()}/${resourceId}`), () =>
        mockApiResponse(apiResponse),
      );
      const resource = defaultResourceDto({ id: resourceId });
      const resourceEntityExpected = new ResourceEntity(resource);
      resourceEntityExpected.offline = new OfflineItemEntity(apiResponse);
      jest.spyOn(ResourceLocalStorage, "getResourceById").mockResolvedValue(resource);
      jest.spyOn(ResourceLocalStorage, "updateResource").mockResolvedValue();

      const service = new MarkOfflineResourceService(account, apiClientOptions);
      const secretDto = readSecretDto({ resource_id: resourceId });
      const resourceEncrypted = resourceMetadataEncryptedDto({
        metadata_key_type: METADATA_KEY_TYPE_METADATA_KEY,
        id: resourceId,
        secrets: [secretDto],
      });
      const expectedResourceEncryptedEntity = new ResourceEntity(resourceEncrypted);
      jest
        .spyOn(service.findResourcesService, "findOneByIdForOffline")
        .mockResolvedValue(expectedResourceEncryptedEntity);
      jest.spyOn(service.metadataKeyOPFSStorage, "get").mockResolvedValue(undefined);
      jest.spyOn(service.metadataKeyOPFSStorage, "set");
      jest.spyOn(service.offlineResourcesOPFSStorage, "addResource");
      jest.spyOn(service.offlineSecretsOPFSStorage, "addSecret");
      // Mock data relative to service call
      const id = uuidv4();
      const metadataPrivateKeysDto = [
        defaultMetadataPrivateKeyDto({
          metadata_key_id: id,
          data: pgpKeys.metadataKey.encryptedMetadataPrivateKeyDataMessage,
        }),
      ];
      const metadataKeysDto = [
        defaultMetadataKeyDto({
          id: id,
          metadata_private_keys: metadataPrivateKeysDto,
          fingerprint: "c0dce0aaea4d8cce961c26bddfb6e74e598f025c",
        }),
      ];
      const expectedMetadataKeysDto = JSON.parse(JSON.stringify(metadataKeysDto));
      jest
        .spyOn(service.findMetadataKeysService.metadataKeysApiService, "findAll")
        .mockImplementation(() => metadataKeysDto);

      const result = await service.create(resourceId);

      expect(result).toBeInstanceOf(OfflineItemEntity);
      expect(result).toEqual(new OfflineItemEntity(apiResponse));
      expect(ResourceLocalStorage.updateResource).toHaveBeenCalledWith(resourceEntityExpected);
      expect(service.metadataKeyOPFSStorage.set).toHaveBeenCalledWith(
        new MetadataKeysCollection(expectedMetadataKeysDto),
      );
      expect(service.offlineResourcesOPFSStorage.addResource).toHaveBeenCalledWith(expectedResourceEncryptedEntity);
      expect(service.offlineSecretsOPFSStorage.addSecret).toHaveBeenCalledWith(
        expectedResourceEncryptedEntity.secrets.items[0],
      );
    });

    it("throws an Error if the parameter is not an uuid", async () => {
      expect.assertions(1);
      const service = new MarkOfflineResourceService(account, apiClientOptions);

      await expect(() => service.create({})).rejects.toThrow("The given parameter is not a valid UUID");
    });

    it("throws service unavailable error if an error occurred but not from the API", async () => {
      expect.assertions(1);
      const resourceId = uuidv4();
      fetch.doMockOnceIf(new RegExp(`/offline/${ResourceEntity.ENTITY_NAME.toLowerCase()}/${resourceId}`), () => {
        throw new Error("Service unavailable");
      });

      const service = new MarkOfflineResourceService(account, apiClientOptions);

      await expect(() => service.create(resourceId)).rejects.toThrow(PassboltServiceUnavailableError);
    });

    it("throws API error if the API encountered an issue", async () => {
      expect.assertions(1);
      const resourceId = uuidv4();
      fetch.doMockOnceIf(new RegExp(`/offline/${ResourceEntity.ENTITY_NAME.toLowerCase()}/${resourceId}`), () =>
        mockApiResponseError(500, "Something wrong happened!"),
      );

      const service = new MarkOfflineResourceService(account, apiClientOptions);

      await expect(() => service.create(resourceId)).rejects.toThrow(PassboltApiFetchError);
    });
  });
});
