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
import MetadataKeyOPFSStorage from "./metadataKeyOPFSStorage";
import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";
import MetadataKeysCollection from "passbolt-styleguide/src/shared/models/entity/metadata/metadataKeysCollection";
import MetadataKeyEntity from "passbolt-styleguide/src/shared/models/entity/metadata/metadataKeyEntity";
import { defaultMetadataKeyDto } from "passbolt-styleguide/src/shared/models/entity/metadata/metadataKeyEntity.test.data";
import {
  decryptedMetadataPrivateKeyDto,
  defaultMetadataPrivateKeyDto,
} from "passbolt-styleguide/src/shared/models/entity/metadata/metadataPrivateKeyEntity.test.data";

/**
 * Build an encrypted metadata key dto.
 * @param {object} data
 * @returns {object}
 */
const encryptedMetadataKeyDto = (data = {}) => {
  const id = data.id || uuidv4();
  return defaultMetadataKeyDto({
    id,
    metadata_private_keys: [defaultMetadataPrivateKeyDto({ metadata_key_id: id })],
    ...data,
  });
};

/**
 * Build a decrypted metadata key dto.
 * @param {object} data
 * @returns {object}
 */
const decryptedMetadataKeyDto = (data = {}) => {
  const id = data.id || uuidv4();
  return defaultMetadataKeyDto({
    id,
    metadata_private_keys: [decryptedMetadataPrivateKeyDto({ metadata_key_id: id })],
    ...data,
  });
};

describe("MetadataKeyOPFSStorage", () => {
  let account, storage;
  beforeEach(async () => {
    account = new AccountEntity(defaultAccountDto());
    storage = new MetadataKeyOPFSStorage(account);
    await storage.flush();
  });

  describe("::constructor", () => {
    it("throws if no account is provided.", () => {
      expect.assertions(1);
      expect(() => new MetadataKeyOPFSStorage()).toThrow(TypeError);
    });

    it("throws if account is not an AccountEntity.", () => {
      expect.assertions(1);
      expect(() => new MetadataKeyOPFSStorage({})).toThrow(TypeError);
    });

    it("builds a storage key scoped to the account id.", () => {
      expect.assertions(1);
      expect(storage.storageKey).toEqual(`metadata_keys_offline-${account.id}`);
    });
  });

  describe("::get", () => {
    it("returns undefined if nothing is stored.", async () => {
      expect.assertions(1);
      const result = await storage.get();
      expect(result).toBeUndefined();
    });

    it("returns content stored in the OPFS storage.", async () => {
      expect.assertions(3);
      const dtos = [encryptedMetadataKeyDto()];
      await storage._setOPFSStorage(storage.storageKey, dtos);
      const result = await storage.get();
      expect(result).toEqual(expect.any(Array));
      expect(result).toHaveLength(1);
      expect(result).toEqual(dtos);
    });

    it("initializes the runtime cache on first read.", async () => {
      expect.assertions(3);
      const dtos = [encryptedMetadataKeyDto()];
      await storage._setOPFSStorage(storage.storageKey, dtos);
      expect(MetadataKeyOPFSStorage._runtimeCachedData[account.id]).toBeUndefined();
      await storage.get();
      expect(MetadataKeyOPFSStorage._runtimeCachedData[account.id]).toEqual(dtos);
      expect(MetadataKeyOPFSStorage._runtimeCachedData[account.id]).toHaveLength(1);
    });

    it("returns content from the runtime cache when set.", async () => {
      expect.assertions(2);
      const dtos = [encryptedMetadataKeyDto()];
      await storage._setOPFSStorage(storage.storageKey, dtos);
      // Prime the cache.
      await storage.get();
      // Delete the underlying OPFS data so that only the runtime cache can answer.
      await storage.opfsStorage.delete(storage.storageKey);
      const result = await storage.get();
      expect(result).toEqual(dtos);
      expect(result).toHaveLength(1);
    });
  });

  describe("::set", () => {
    it("throws if the parameter is not a MetadataKeysCollection.", async () => {
      expect.assertions(1);
      await expect(() => storage.set(42)).rejects.toThrow(
        "The `metadataKeysCollection` parameter should be of type MetadataKeysCollection",
      );
    });

    it("throws if the collection contains a decrypted metadata private key.", async () => {
      expect.assertions(1);
      const collection = new MetadataKeysCollection([decryptedMetadataKeyDto()]);
      await expect(() => storage.set(collection)).rejects.toThrow(
        "The `metadataKeysCollection` parameter should contain only encrypted metadata private keys.",
      );
    });

    it("stores an empty collection.", async () => {
      expect.assertions(2);
      await storage.set(new MetadataKeysCollection([]));
      const stored = await storage.opfsStorage.get(storage.storageKey);
      expect(stored).toEqual(expect.any(Array));
      expect(stored).toHaveLength(0);
    });

    it("stores encrypted metadata keys with the default contain.", async () => {
      expect.assertions(3);
      const dtos = [encryptedMetadataKeyDto(), encryptedMetadataKeyDto()];
      const collection = new MetadataKeysCollection(dtos);
      await storage.set(collection);
      const stored = await storage.opfsStorage.get(storage.storageKey);
      expect(stored).toBeInstanceOf(Array);
      expect(stored).toHaveLength(2);
      expect(stored).toEqual(collection.toDto(MetadataKeyOPFSStorage.DEFAULT_CONTAIN));
    });

    it("updates the runtime cache.", async () => {
      expect.assertions(1);
      const dtos = [encryptedMetadataKeyDto()];
      const collection = new MetadataKeysCollection(dtos);
      await storage.set(collection);
      expect(MetadataKeyOPFSStorage._runtimeCachedData[account.id]).toEqual(
        collection.toDto(MetadataKeyOPFSStorage.DEFAULT_CONTAIN),
      );
    });
  });

  describe("::flush", () => {
    it("clears the OPFS storage and runtime cache.", async () => {
      expect.assertions(2);
      const dtos = [encryptedMetadataKeyDto()];
      await storage.set(new MetadataKeysCollection(dtos));
      await storage.flush();
      expect(await storage.opfsStorage.get(storage.storageKey)).toBeUndefined();
      expect(MetadataKeyOPFSStorage._runtimeCachedData[account.id]).toBeUndefined();
    });
  });

  describe("::getOfflineMetadataKeyById", () => {
    it("returns the metadata key matching the id.", async () => {
      expect.assertions(1);
      const dtos = [encryptedMetadataKeyDto(), encryptedMetadataKeyDto()];
      await storage._setOPFSStorage(storage.storageKey, dtos);
      const found = await storage.getOfflineMetadataKeyById(dtos[1].id);
      expect(found).toEqual(dtos[1]);
    });

    it("returns undefined when nothing is stored.", async () => {
      expect.assertions(1);
      const found = await storage.getOfflineMetadataKeyById(uuidv4());
      expect(found).toBeUndefined();
    });
  });

  describe("::addMetadataKey", () => {
    it("throws if not a MetadataKeyEntity.", async () => {
      expect.assertions(1);
      await expect(() => storage.addMetadataKey({})).rejects.toThrow(
        "MetadataKeyOPFSStorage expects an object of type MetadataKeyEntity",
      );
    });

    it("throws if the metadata private keys are decrypted.", async () => {
      expect.assertions(1);
      const entity = new MetadataKeyEntity(decryptedMetadataKeyDto());
      await expect(() => storage.addMetadataKey(entity)).rejects.toThrow(
        "MetadataKeyOPFSStorage expects MetadataKeyEntity metadata_private_keys to be encrypted",
      );
    });

    it("adds a metadata key to an empty storage.", async () => {
      expect.assertions(2);
      const entity = new MetadataKeyEntity(encryptedMetadataKeyDto());
      await storage.addMetadataKey(entity);
      const stored = await storage.opfsStorage.get(storage.storageKey);
      expect(stored).toHaveLength(1);
      expect(stored[0]).toEqual(entity.toDto(MetadataKeyOPFSStorage.DEFAULT_CONTAIN));
    });

    it("appends a metadata key to an existing storage.", async () => {
      expect.assertions(1);
      const initial = encryptedMetadataKeyDto();
      await storage._setOPFSStorage(storage.storageKey, [initial]);
      const entity = new MetadataKeyEntity(encryptedMetadataKeyDto());
      await storage.addMetadataKey(entity);
      const stored = await storage.opfsStorage.get(storage.storageKey);
      expect(stored).toHaveLength(2);
    });
  });

  describe("::updateMetadataKey", () => {
    it("throws when the metadata key does not exist.", async () => {
      expect.assertions(1);
      const entity = new MetadataKeyEntity(encryptedMetadataKeyDto());
      await expect(() => storage.updateMetadataKey(entity)).rejects.toThrow(
        "The offline metadata key could not be found in the OPFS storage",
      );
    });

    it("replaces an existing metadata key.", async () => {
      expect.assertions(2);
      const initialDto = encryptedMetadataKeyDto();
      await storage._setOPFSStorage(storage.storageKey, [initialDto]);
      const updatedDto = encryptedMetadataKeyDto({ id: initialDto.id, fingerprint: "a".repeat(40) });
      const entity = new MetadataKeyEntity(updatedDto);
      await storage.updateMetadataKey(entity);
      const stored = await storage.opfsStorage.get(storage.storageKey);
      expect(stored).toHaveLength(1);
      expect(stored[0]).toEqual(entity.toDto(MetadataKeyOPFSStorage.DEFAULT_CONTAIN));
    });
  });

  describe("::addOrReplaceMetadataKeysCollection", () => {
    it("throws if the parameter is not a MetadataKeysCollection.", async () => {
      expect.assertions(1);
      await expect(() => storage.addOrReplaceMetadataKeysCollection({})).rejects.toThrow(
        "The parameter `metadataKeysCollection` should be of type MetadataKeysCollection.",
      );
    });

    it("throws if the collection contains a decrypted metadata private key.", async () => {
      expect.assertions(1);
      const collection = new MetadataKeysCollection([decryptedMetadataKeyDto()]);
      await expect(() => storage.addOrReplaceMetadataKeysCollection(collection)).rejects.toThrow(
        "The `metadataKeysCollection` parameter should contain only encrypted metadata private keys.",
      );
    });

    it("appends new metadata keys and replaces existing ones.", async () => {
      expect.assertions(3);
      const existing = encryptedMetadataKeyDto();
      await storage._setOPFSStorage(storage.storageKey, [existing]);
      const replacedDto = encryptedMetadataKeyDto({ id: existing.id, fingerprint: "b".repeat(40) });
      const newDto = encryptedMetadataKeyDto();
      const collection = new MetadataKeysCollection([replacedDto, newDto]);
      await storage.addOrReplaceMetadataKeysCollection(collection);
      const stored = await storage.opfsStorage.get(storage.storageKey);
      expect(stored).toHaveLength(2);
      expect(stored.find((item) => item.id === existing.id).fingerprint).toEqual("b".repeat(40));
      expect(stored.find((item) => item.id === newDto.id)).toBeDefined();
    });
  });

  describe("::delete", () => {
    it("throws if id is not a UUID.", async () => {
      expect.assertions(1);
      await expect(() => storage.delete("not-a-uuid")).rejects.toThrow(
        "The parameter metadataKeyId should be a UUID.",
      );
    });

    it("removes a metadata key from the storage.", async () => {
      expect.assertions(2);
      const a = encryptedMetadataKeyDto();
      const b = encryptedMetadataKeyDto();
      await storage._setOPFSStorage(storage.storageKey, [a, b]);
      await storage.delete(a.id);
      const stored = await storage.opfsStorage.get(storage.storageKey);
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toEqual(b.id);
    });

    it("does nothing when the metadata key is not in the storage.", async () => {
      expect.assertions(1);
      const a = encryptedMetadataKeyDto();
      await storage._setOPFSStorage(storage.storageKey, [a]);
      await storage.delete(uuidv4());
      const stored = await storage.opfsStorage.get(storage.storageKey);
      expect(stored).toHaveLength(1);
    });
  });

  describe("::assertEntityBeforeSave", () => {
    it("throws when no entity is given.", () => {
      expect.assertions(1);
      expect(() => MetadataKeyOPFSStorage.assertEntityBeforeSave(null)).toThrow(
        "MetadataKeyOPFSStorage expects a MetadataKeyEntity to be set",
      );
    });

    it("throws when entity is not a MetadataKeyEntity.", () => {
      expect.assertions(1);
      expect(() => MetadataKeyOPFSStorage.assertEntityBeforeSave({})).toThrow(
        "MetadataKeyOPFSStorage expects an object of type MetadataKeyEntity",
      );
    });

    it("throws when entity id is missing.", () => {
      expect.assertions(1);
      const dto = defaultMetadataKeyDto();
      delete dto.id;
      const entity = new MetadataKeyEntity(dto);
      expect(() => MetadataKeyOPFSStorage.assertEntityBeforeSave(entity)).toThrow(
        "MetadataKeyOPFSStorage expects MetadataKeyEntity id to be set",
      );
    });

    it("throws when metadata_private_keys association is missing.", () => {
      expect.assertions(1);
      const dto = defaultMetadataKeyDto();
      const entity = new MetadataKeyEntity(dto);
      expect(() => MetadataKeyOPFSStorage.assertEntityBeforeSave(entity)).toThrow(
        "MetadataKeyOPFSStorage expects MetadataKeyEntity metadata_private_keys association to be set",
      );
    });
  });
});
