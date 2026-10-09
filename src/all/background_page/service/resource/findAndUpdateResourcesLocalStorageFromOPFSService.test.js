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

import { v4 as uuidv4 } from "uuid";
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import { defaultResourceDto } from "passbolt-styleguide/src/shared/models/entity/resource/resourceEntity.test.data";
import { resourceTypesCollectionDto } from "passbolt-styleguide/src/shared/models/entity/resourceType/resourceTypesCollection.test.data";
import { defaultDecryptedSharedMetadataKeysDtos } from "passbolt-styleguide/src/shared/models/entity/metadata/metadataKeysCollection.test.data";
import MetadataKeysCollection from "passbolt-styleguide/src/shared/models/entity/metadata/metadataKeysCollection";
import ResourceTypesCollection from "passbolt-styleguide/src/shared/models/entity/resourceType/resourceTypesCollection";
import UserPassphraseRequiredError from "passbolt-styleguide/src/shared/error/userPassphraseRequiredError";
import { metadata } from "passbolt-styleguide/test/fixture/encryptedMetadata/metadata";
import { pgpKeys } from "passbolt-styleguide/test/fixture/pgpKeys/keys";
import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";
import ResourcesCollection from "../../model/entity/resource/resourcesCollection";
import ResourceLocalStorage from "../local_storage/resourceLocalStorage";
import PassphraseStorageService from "../session_storage/passphraseStorageService";
import FindAndUpdateResourcesLocalStorageFromOPFSService from "./findAndUpdateResourcesLocalStorageFromOPFSService";
import { multipleResourceWithMetadataEncrypted } from "./findResourcesService.test.data";

/**
 * Build a resource dto with its metadata encrypted with ada's key, as persisted in the OPFS storage.
 * @param {object} [data = {}] The resource dto data to override.
 * @returns {object}
 */
const privateResourceWithEncryptedMetadataDto = (data = {}) =>
  defaultResourceDto({
    metadata: metadata.withAdaKey.encryptedMetadata[0],
    metadata_key_id: null,
    metadata_key_type: "user_key",
    personal: true,
    ...data,
  });

beforeEach(() => {
  jest.clearAllMocks();
});

describe("FindAndUpdateResourcesLocalStorageFromOPFSService", () => {
  let service, account;

  beforeEach(async () => {
    account = new AccountEntity(defaultAccountDto());
    service = new FindAndUpdateResourcesLocalStorageFromOPFSService(account, defaultApiClientOptions());
    // flush account related storage before each.
    await service.offlineResourcesOPFSStorage.flush();
    await ResourceLocalStorage.flush();
    jest
      .spyOn(service.getOrFindResourceTypesService, "getOrFindAll")
      .mockImplementation(async () => new ResourceTypesCollection(resourceTypesCollectionDto()));
  });

  describe("::findAndUpdateAll", () => {
    it("returns an empty collection and empties the local storage if the OPFS storage is empty.", async () => {
      expect.assertions(3);

      const collection = await service.findAndUpdateAll(pgpKeys.ada.passphrase);

      expect(collection).toBeInstanceOf(ResourcesCollection);
      expect(collection).toHaveLength(0);
      expect(await ResourceLocalStorage.get()).toHaveLength(0);
    });

    it(
      "retrieves the resources from the OPFS storage, decrypts their metadata and stores them into the local storage.",
      async () => {
        const metadataKeysDto = defaultDecryptedSharedMetadataKeysDtos();
        const resourcesDto = multipleResourceWithMetadataEncrypted(metadataKeysDto[0].id);

        expect.assertions(3 + resourcesDto.length);

        await service.offlineResourcesOPFSStorage.set(new ResourcesCollection(resourcesDto));
        jest
          .spyOn(service.decryptMetadataService.getOrFindMetadataKeysService, "getOrFindAll")
          .mockImplementation(async () => new MetadataKeysCollection(metadataKeysDto));
        jest.spyOn(PassphraseStorageService, "get").mockImplementation(() => pgpKeys.ada.passphrase);

        const collection = await service.findAndUpdateAll();

        expect(collection).toBeInstanceOf(ResourcesCollection);
        expect(collection).toHaveLength(resourcesDto.length);
        for (const resource of collection) {
          expect(resource.isMetadataDecrypted()).toStrictEqual(true);
        }

        const storageValue = await ResourceLocalStorage.get();
        expect(storageValue).toHaveLength(resourcesDto.length);
      },
      10 * 1000,
    );

    it("does not retrieve the passphrase from the session storage if passed as parameter.", async () => {
      expect.assertions(1);

      const resourcesDto = [privateResourceWithEncryptedMetadataDto()];
      await service.offlineResourcesOPFSStorage.set(new ResourcesCollection(resourcesDto));
      jest.spyOn(PassphraseStorageService, "get");

      await service.findAndUpdateAll(pgpKeys.ada.passphrase);

      expect(PassphraseStorageService.get).not.toHaveBeenCalled();
    });

    it("throws an error if the user passphrase is not set and is required.", async () => {
      expect.assertions(1);

      const resourcesDto = [privateResourceWithEncryptedMetadataDto()];
      await service.offlineResourcesOPFSStorage.set(new ResourcesCollection(resourcesDto));
      jest.spyOn(PassphraseStorageService, "get").mockImplementation(() => null);

      await expect(() => service.findAndUpdateAll()).rejects.toThrow(UserPassphraseRequiredError);
    });

    it("filters out the resources having an unsupported resource type.", async () => {
      expect.assertions(2);

      const supportedResourceDto = privateResourceWithEncryptedMetadataDto();
      const unsupportedResourceDto = privateResourceWithEncryptedMetadataDto({ resource_type_id: uuidv4() });
      await service.offlineResourcesOPFSStorage.set(
        new ResourcesCollection([supportedResourceDto, unsupportedResourceDto]),
      );

      const collection = await service.findAndUpdateAll(pgpKeys.ada.passphrase);

      expect(collection).toHaveLength(1);
      expect(collection.items[0].id).toStrictEqual(supportedResourceDto.id);
    });

    it(
      "filters out the resources having their metadata still encrypted (shared metadata key cannot be found).",
      async () => {
        const resourcesDto = multipleResourceWithMetadataEncrypted(uuidv4());

        expect.assertions(2);

        await service.offlineResourcesOPFSStorage.set(new ResourcesCollection(resourcesDto));
        jest
          .spyOn(service.decryptMetadataService.getOrFindMetadataKeysService, "getOrFindAll")
          .mockImplementation(async () => new MetadataKeysCollection([]));

        const collection = await service.findAndUpdateAll(pgpKeys.ada.passphrase);

        // Only the 4 resources having their metadata encrypted with the user key can be decrypted.
        expect(collection).toHaveLength(4);
        expect(await ResourceLocalStorage.get()).toHaveLength(4);
      },
      10 * 1000,
    );

    it("leaves the OPFS storage untouched, it is the source of truth of the offline session.", async () => {
      expect.assertions(2);

      const resourcesDto = [privateResourceWithEncryptedMetadataDto()];
      await service.offlineResourcesOPFSStorage.set(new ResourcesCollection(resourcesDto));
      const opfsSetSpy = jest.spyOn(service.offlineResourcesOPFSStorage, "set");
      const opfsFlushSpy = jest.spyOn(service.offlineResourcesOPFSStorage, "flush");

      await service.findAndUpdateAll(pgpKeys.ada.passphrase);

      expect(opfsSetSpy).not.toHaveBeenCalled();
      expect(opfsFlushSpy).not.toHaveBeenCalled();
    });

    it("overrides the local storage with a second update call.", async () => {
      expect.assertions(2);

      // Store outdated information in the local storage.
      await ResourceLocalStorage.set(new ResourcesCollection([defaultResourceDto(), defaultResourceDto()]));

      const resourcesDto = [privateResourceWithEncryptedMetadataDto()];
      await service.offlineResourcesOPFSStorage.set(new ResourcesCollection(resourcesDto));

      const collection = await service.findAndUpdateAll(pgpKeys.ada.passphrase);

      expect(collection).toHaveLength(1);
      const storageValue = await ResourceLocalStorage.get();
      expect(storageValue).toHaveLength(1);
    });

    it("waits any on-going call to the update and returns the result of the local storage.", async () => {
      expect.assertions(3);

      const resourcesDto = [privateResourceWithEncryptedMetadataDto()];
      await service.offlineResourcesOPFSStorage.set(new ResourcesCollection(resourcesDto));

      let resolve;
      const promise = new Promise((_resolve) => (resolve = _resolve));
      const opfsGetSpy = jest.spyOn(service.offlineResourcesOPFSStorage, "get").mockImplementation(() => promise);

      const promiseFirstCall = service.findAndUpdateAll(pgpKeys.ada.passphrase);
      const promiseSecondCall = service.findAndUpdateAll(pgpKeys.ada.passphrase);
      resolve(resourcesDto);
      const resultFirstCall = await promiseFirstCall;
      await promiseSecondCall;

      expect(opfsGetSpy).toHaveBeenCalledTimes(1);
      expect(resultFirstCall).toHaveLength(1);
      const storageValue = await ResourceLocalStorage.get();
      expect(storageValue).toHaveLength(1);
    });
  });
});
