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
import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";
import UserPassphraseRequiredError from "passbolt-styleguide/src/shared/error/userPassphraseRequiredError";
import PassphraseStorageService from "../session_storage/passphraseStorageService";
import { pgpKeys } from "passbolt-styleguide/test/fixture/pgpKeys/keys";
import { defaultMetadataPrivateKeyDto } from "passbolt-styleguide/src/shared/models/entity/metadata/metadataPrivateKeyEntity.test.data";
import { defaultMetadataKeyDto } from "passbolt-styleguide/src/shared/models/entity/metadata/metadataKeyEntity.test.data";
import MetadataKeysCollection from "passbolt-styleguide/src/shared/models/entity/metadata/metadataKeysCollection";
import FindAndUpdateMetadataKeysSessionStorageFromOPFSService from "./findAndUpdateMetadataKeysSessionStorageFromOPFSService";

/**
 * Build an encrypted metadata keys dto, as persisted in the OPFS storage.
 * @param {string} id The metadata key id.
 * @returns {array}
 */
const encryptedMetadataKeysDto = (id = uuidv4()) => [
  defaultMetadataKeyDto({
    id: id,
    metadata_private_keys: [
      defaultMetadataPrivateKeyDto({
        metadata_key_id: id,
        data: pgpKeys.metadataKey.encryptedMetadataPrivateKeyDataMessage,
      }),
    ],
    fingerprint: "c0dce0aaea4d8cce961c26bddfb6e74e598f025c",
  }),
];

/**
 * Build the expected decrypted counterpart of the given encrypted metadata keys dto.
 * @param {array} metadataKeysDto The encrypted metadata keys dto.
 * @returns {array}
 */
const expectedDecryptedMetadataKeysDto = (metadataKeysDto) => {
  const expectedMetadataKeysDto = JSON.parse(JSON.stringify(metadataKeysDto));
  expectedMetadataKeysDto[0].metadata_private_keys[0].data = JSON.parse(
    pgpKeys.metadataKey.decryptedMetadataPrivateKeyData,
  );
  return expectedMetadataKeysDto;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("FindAndUpdateMetadataKeysSessionStorageFromOPFSService", () => {
  let service, account;

  beforeEach(async () => {
    account = new AccountEntity(defaultAccountDto());
    service = new FindAndUpdateMetadataKeysSessionStorageFromOPFSService(account);
    // flush account related storage before each.
    await service.metadataKeysSessionStorage.flush();
    await service.metadataKeyOPFSStorage.flush();
  });

  describe("::findAndUpdateAll", () => {
    it("should throw an error if the user passphrase is not set and is required", async () => {
      expect.assertions(1);

      const metadataKeysDto = encryptedMetadataKeysDto();
      await service.metadataKeyOPFSStorage.set(new MetadataKeysCollection(metadataKeysDto));

      await expect(() => service.findAndUpdateAll()).rejects.toThrow(UserPassphraseRequiredError);
    });

    it("retrieves the metadata keys from the OPFS storage and store them into the session storage and decrypt them using the passphrase from the session storage.", async () => {
      expect.assertions(6);

      const metadataKeysDto = encryptedMetadataKeysDto();
      const expectedMetadataKeysDto = expectedDecryptedMetadataKeysDto(metadataKeysDto);
      await service.metadataKeyOPFSStorage.set(new MetadataKeysCollection(metadataKeysDto));
      jest.spyOn(PassphraseStorageService, "get").mockImplementation(() => pgpKeys.ada.passphrase);

      const collection = await service.findAndUpdateAll();

      expect(collection.toDto({ metadata_private_keys: true })).toEqual(expectedMetadataKeysDto);
      expect(collection).toBeInstanceOf(MetadataKeysCollection);
      expect(collection).toHaveLength(1);
      expect(collection.hasEncryptedKeys()).toStrictEqual(false);
      expect(PassphraseStorageService.get).toHaveBeenCalledTimes(1);

      const storageValue = await service.metadataKeysSessionStorage.get();
      expect(storageValue).toEqual(expectedMetadataKeysDto);
    });

    it("does not retrieve the passphrase from the session storage if passed as parameter.", async () => {
      expect.assertions(1);

      const metadataKeysDto = encryptedMetadataKeysDto();
      await service.metadataKeyOPFSStorage.set(new MetadataKeysCollection(metadataKeysDto));
      jest.spyOn(PassphraseStorageService, "get");

      await service.findAndUpdateAll(pgpKeys.ada.passphrase);

      expect(PassphraseStorageService.get).not.toHaveBeenCalled();
    });

    it("leaves the OPFS storage untouched, it is the source of truth of the offline session.", async () => {
      expect.assertions(2);

      const metadataKeysDto = encryptedMetadataKeysDto();
      await service.metadataKeyOPFSStorage.set(new MetadataKeysCollection(metadataKeysDto));
      const opfsSetSpy = jest.spyOn(service.metadataKeyOPFSStorage, "set");
      const opfsFlushSpy = jest.spyOn(service.metadataKeyOPFSStorage, "flush");

      await service.findAndUpdateAll(pgpKeys.ada.passphrase);

      expect(opfsSetSpy).not.toHaveBeenCalled();
      expect(opfsFlushSpy).not.toHaveBeenCalled();
    });

    it("returns an empty collection if the OPFS storage is empty.", async () => {
      expect.assertions(2);

      const collection = await service.findAndUpdateAll(pgpKeys.ada.passphrase);

      expect(collection).toBeInstanceOf(MetadataKeysCollection);
      expect(collection).toHaveLength(0);
    });

    it("overrides session storage with a second update call.", async () => {
      expect.assertions(2);

      // Store outdated information in the session storage.
      const storedId = uuidv4();
      const storedMetadataKeysDto = [
        defaultMetadataKeyDto({
          id: storedId,
          metadata_private_keys: [
            defaultMetadataPrivateKeyDto({
              metadata_key_id: storedId,
              data: JSON.parse(pgpKeys.metadataKey.decryptedMetadataPrivateKeyData),
            }),
          ],
          fingerprint: "c0dce0aaea4d8cce961c26bddfb6e74e598f025c",
        }),
      ];
      await service.metadataKeysSessionStorage.set(new MetadataKeysCollection(storedMetadataKeysDto));

      const metadataKeysDto = encryptedMetadataKeysDto();
      const expectedMetadataKeysDto = expectedDecryptedMetadataKeysDto(metadataKeysDto);
      await service.metadataKeyOPFSStorage.set(new MetadataKeysCollection(metadataKeysDto));

      const collection = await service.findAndUpdateAll(pgpKeys.ada.passphrase);

      expect(collection.toDto({ metadata_private_keys: true })).toEqual(expectedMetadataKeysDto);
      const storageValue = await service.metadataKeysSessionStorage.get();
      expect(storageValue).toEqual(expectedMetadataKeysDto);
    });

    it("waits any on-going call to the update and returns the result of the session storage.", async () => {
      expect.assertions(4);

      const metadataKeysDto = encryptedMetadataKeysDto();
      const expectedMetadataKeysDto = expectedDecryptedMetadataKeysDto(metadataKeysDto);
      await service.metadataKeyOPFSStorage.set(new MetadataKeysCollection(metadataKeysDto));

      let resolve;
      const promise = new Promise((_resolve) => (resolve = _resolve));
      const opfsGetSpy = jest.spyOn(service.metadataKeyOPFSStorage, "get").mockImplementation(() => promise);
      jest.spyOn(PassphraseStorageService, "get").mockImplementation(() => pgpKeys.ada.passphrase);

      const promiseFirstCall = service.findAndUpdateAll();
      const promiseSecondCall = service.findAndUpdateAll();
      resolve(metadataKeysDto);
      const resultFirstCall = await promiseFirstCall;
      const resultSecondCall = await promiseSecondCall;

      expect(opfsGetSpy).toHaveBeenCalledTimes(1);
      expect(resultFirstCall.toDto({ metadata_private_keys: true })).toEqual(expectedMetadataKeysDto);
      expect(resultSecondCall.toDto({ metadata_private_keys: true })).toEqual(expectedMetadataKeysDto);
      const storageValue = await service.metadataKeysSessionStorage.get();
      expect(storageValue).toEqual(expectedMetadataKeysDto);
    });
  });
});
