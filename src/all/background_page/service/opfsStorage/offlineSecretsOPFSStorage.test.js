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
import { v4 as uuidv4 } from "uuid";
import OfflineSecretsOPFSStorage from "./offlineSecretsOPFSStorage";
import SecretEntity from "passbolt-styleguide/src/shared/models/entity/secret/secretEntity";
import { readSecret } from "passbolt-styleguide/src/shared/models/entity/secret/secretEntity.test.data";
import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";
import SecretsCollection from "passbolt-styleguide/src/shared/models/entity/secret/secretsCollection";

describe("OfflineSecretsOPFSStorage", () => {
  let account, storage;
  beforeEach(async () => {
    account = new AccountEntity(defaultAccountDto());
    storage = new OfflineSecretsOPFSStorage(account);
    // flush account related storage before each.
    await storage.flush();
  });

  describe("::get", () => {
    it("Should return undefined if nothing stored in the storage", async () => {
      expect.assertions(1);
      const result = await storage.get();
      expect(result).toBeUndefined();
    });

    it("Should return content stored in the OPFS storage", async () => {
      expect.assertions(3);
      const secretsDto = [readSecret()];
      await storage._setOPFSStorage(storage.storageKey, secretsDto);
      const result = await storage.get();
      expect(result).toEqual(expect.any(Array));
      expect(result).toHaveLength(1);
      expect(result).toEqual(secretsDto);
    });

    it("Should initialize the cache when getting the data for the first time", async () => {
      expect.assertions(5);
      const secretsDto = [readSecret()];
      await storage._setOPFSStorage(storage.storageKey, secretsDto);
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toBeUndefined();
      await storage.get();
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toBeDefined();
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toEqual(expect.any(Array));
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toHaveLength(1);
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toEqual(secretsDto);
    });

    it("Should return content stored in the local storage from the cache if set", async () => {
      expect.assertions(4);
      const secretsDto = [readSecret()];
      await storage._setOPFSStorage(storage.storageKey, secretsDto);
      // call a first time to initialize the cache.
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toBeUndefined();
      await storage.get();
      // delete voluntarily the local storage data to ensure it is not used.
      await storage.opfsStorage.delete(storage.storageKey);
      const result = await storage.get();
      expect(result).toEqual(expect.any(Array));
      expect(result).toHaveLength(1);
      expect(result).toEqual(secretsDto);
    });
  });

  describe("::set", () => {
    it("Should throw if parameter is invalid.", async () => {
      expect.assertions(1);
      await expect(() => storage.set(42)).rejects.toThrow(
        "The `secretsCollection` parameter should be of type SecretsCollection",
      );
    });

    it("Should set OPFS storage with empty data", async () => {
      expect.assertions(2);
      const secrets = new SecretsCollection([]);
      await storage.set(secrets);
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData).toEqual(expect.any(Array));
      expect(storageData).toHaveLength(0);
    });

    it("Should store data in the OPFS storage", async () => {
      expect.assertions(3);

      const secretsDto = [readSecret(), readSecret()];
      const secrets = new SecretsCollection(secretsDto);
      await storage.set(secrets);
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData).toBeInstanceOf(Array);
      expect(storageData).toHaveLength(2);
      expect(storageData).toEqual(secrets.toDto(OfflineSecretsOPFSStorage.DEFAULT_CONTAIN));
    });

    it("Should set the cache when setting the local storage", async () => {
      expect.assertions(5);

      const secretsDto = [readSecret(), readSecret()];
      const secrets = new SecretsCollection(secretsDto);
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toBeUndefined();
      await storage.set(secrets);
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toBeDefined();
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toEqual(expect.any(Array));
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toHaveLength(2);
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toEqual(
        secrets.toDto(OfflineSecretsOPFSStorage.DEFAULT_CONTAIN),
      );
    });
  });

  describe("::getOfflineSecretByResourceId", () => {
    it("Should return undefined if the OPFS storage is not yet initialized", async () => {
      expect.assertions(1);
      const result = await storage.getOfflineSecretByResourceId(uuidv4());
      expect(result).toBeUndefined();
    });

    it("Should return nothing if the target resource id is not found in the OPFS storage", async () => {
      expect.assertions(1);
      const secretsDto = [readSecret(), readSecret()];
      await storage._setOPFSStorage(storage.storageKey, secretsDto);
      const result = await storage.getOfflineSecretByResourceId(uuidv4());
      expect(result).toBeUndefined();
    });

    it("Should return the target resource if found in the OPFS storage", async () => {
      expect.assertions(2);
      const secretsDto = [readSecret(), readSecret()];
      await storage._setOPFSStorage(storage.storageKey, secretsDto);
      const result = await storage.getOfflineSecretByResourceId(secretsDto[0].resource_id);
      expect(result).toEqual(expect.any(Object));
      expect(result).toEqual(secretsDto[0]);
    });
  });

  describe("::addSecret", () => {
    it("Should throw if no data passed as parameter", async () => {
      expect.assertions(1);
      const promise = storage.addSecret();
      await expect(promise).rejects.toThrow("The `secretEntity` parameter should be of type SecretEntity");
    });

    it("Should throw if the secret parameter is not a SecretEntity", async () => {
      expect.assertions(1);
      const promise = storage.addSecret(42);
      await expect(promise).rejects.toThrow("The `secretEntity` parameter should be of type SecretEntity");
    });

    it("Should store a new secret", async () => {
      expect.assertions(3);
      const secretDto = readSecret();
      const secret = new SecretEntity(secretDto);
      await storage.addSecret(secret);
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData).toEqual(expect.any(Array));
      expect(storageData).toHaveLength(1);
      expect(storageData[0]).toEqual(secretDto);
    });

    it("Should update the cache with the added resource", async () => {
      expect.assertions(5);
      const secretDto = readSecret();
      const secret = new SecretEntity(secretDto);
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toBeUndefined();
      await storage.addSecret(secret);
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toBeDefined();
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toEqual(expect.any(Array));
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toHaveLength(1);
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id][0]).toEqual(secretDto);
    });
  });

  describe("::updateSecret", () => {
    it("Should throw if no data passed as parameter", async () => {
      expect.assertions(1);
      const promise = storage.updateSecret();
      await expect(promise).rejects.toThrow("The `secretEntity` parameter should be of type SecretEntity");
    });

    it("Should throw if the secret parameter is not a ResourceEntity", async () => {
      expect.assertions(1);
      const promise = storage.updateSecret(42);
      await expect(promise).rejects.toThrow("The `secretEntity` parameter should be of type SecretEntity");
    });

    it("Should throw if the secret is not found in the OPFS storage", async () => {
      expect.assertions(1);
      const secretDto = readSecret();
      const resource = new SecretEntity(secretDto);
      const promise = storage.updateSecret(resource);
      await expect(promise).rejects.toThrow("The offline secret could not be found in the OPFS storage");
    });

    it("Should update the secret", async () => {
      expect.assertions(4);
      const secretDto = readSecret();
      const secretsDtos = [secretDto];
      await storage._setOPFSStorage(storage.storageKey, secretsDtos);
      const resource = new SecretEntity({ ...secretDto, modified: "2026-03-04T13:59:11+00:00" });
      await storage.updateSecret(resource);
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData).toEqual(expect.any(Array));
      expect(storageData).toHaveLength(1);
      expect(storageData[0]).toEqual(resource.toDto(OfflineSecretsOPFSStorage.DEFAULT_CONTAIN));
      expect(storageData[0].modified).not.toEqual(secretDto.modified);
    });

    it("Should update the cache with the updated secret", async () => {
      expect.assertions(6);
      const secretDto = readSecret();
      const secretsDtos = [secretDto];
      await storage._setOPFSStorage(storage.storageKey, secretsDtos);
      const secret = new SecretEntity({ ...secretDto, modified: "2026-03-04T13:59:11+00:00" });
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toBeUndefined();
      await storage.updateSecret(secret);
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toBeDefined();
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toEqual(expect.any(Array));
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toHaveLength(1);
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id][0]).toEqual(
        secret.toDto(OfflineSecretsOPFSStorage.DEFAULT_CONTAIN),
      );
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id][0].modified).not.toEqual(secretDto.modified);
    });
  });

  describe("::updateSecretsCollection", () => {
    it("Should throw if no data passed as parameter", async () => {
      expect.assertions(1);
      const promise = storage.updateSecretsCollection();
      await expect(promise).rejects.toThrow("The parameter secretsCollection should be of SecretsCollection type.");
    });

    it("Should throw if the secretsCollection parameter is not an array", async () => {
      expect.assertions(1);
      const promise = storage.updateSecretsCollection(42);
      await expect(promise).rejects.toThrow("The parameter secretsCollection should be of SecretsCollection type.");
    });

    it("Should throw if one of the secrets is not found in the OPFS storage", async () => {
      expect.assertions(1);

      const secretDto = readSecret();
      const secrets = new SecretsCollection([secretDto]);

      const promise = storage.updateSecretsCollection(secrets);
      await expect(promise).rejects.toThrow("The secret could not be found in the OPFS storage");
    });

    it("Should update secrets", async () => {
      expect.assertions(6);
      const secretDto1 = readSecret();
      const secretDto2 = readSecret();
      const secretDto3 = readSecret();
      const secretDto4 = readSecret();
      const secretsDtos = [secretDto1, secretDto2, secretDto3, secretDto4];
      await storage._setOPFSStorage(storage.storageKey, secretsDtos);
      const secrets = new SecretsCollection([
        secretDto1,
        { ...secretDto2, modified: "2026-03-04T13:59:11+00:00" },
        secretDto3,
        { ...secretDto4, modified: "2026-05-04T13:59:11+00:00" },
      ]);
      await storage.updateSecretsCollection(secrets);
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData).toEqual(expect.any(Array));
      expect(storageData).toHaveLength(4);
      expect(storageData[0]).toEqual(secretDto1);
      expect(storageData[1]).toEqual({ ...secretDto2, modified: "2026-03-04T13:59:11+00:00" });
      expect(storageData[2]).toEqual(secretDto3);
      expect(storageData[3]).toEqual({ ...secretDto4, modified: "2026-05-04T13:59:11+00:00" });
    });

    it("Should update cache when updating secrets", async () => {
      expect.assertions(8);
      const secretDto1 = readSecret();
      const secretDto2 = readSecret();
      const secretDto3 = readSecret();
      const secretDto4 = readSecret();
      const secretsDtos = [secretDto1, secretDto2, secretDto3, secretDto4];
      await storage._setOPFSStorage(storage.storageKey, secretsDtos);
      const secrets = new SecretsCollection([
        secretDto1,
        { ...secretDto2, modified: "2026-03-04T13:59:11+00:00" },
        secretDto3,
        { ...secretDto4, modified: "2026-05-04T13:59:11+00:00" },
      ]);
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toBeUndefined();
      await storage.updateSecretsCollection(secrets);
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toBeDefined();
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toEqual(expect.any(Array));
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toHaveLength(4);
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id][0]).toEqual(secretDto1);
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id][1]).toEqual({
        ...secretDto2,
        modified: "2026-03-04T13:59:11+00:00",
      });
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id][2]).toEqual(secretDto3);
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id][3]).toEqual({
        ...secretDto4,
        modified: "2026-05-04T13:59:11+00:00",
      });
    });
  });

  describe("::addOrReplaceSecretsCollection", () => {
    it("Should throw if no data passed as parameter", async () => {
      expect.assertions(1);
      const promise = storage.addOrReplaceSecretsCollection();
      await expect(promise).rejects.toThrow("The parameter secretsCollection should be of SecretsCollection type.");
    });

    it("Should throw if the secretsCollection parameter is not an array", async () => {
      expect.assertions(1);
      const promise = storage.addOrReplaceSecretsCollection(42);
      await expect(promise).rejects.toThrow("The parameter secretsCollection should be of SecretsCollection type.");
    });

    it("Should add the secret if one of the secret is not found in the OPFS storage", async () => {
      expect.assertions(3);

      const secretDto = readSecret();
      const secrets = new SecretsCollection([secretDto]);
      await storage.addOrReplaceSecretsCollection(secrets);
      const storageData = await storage.opfsStorage.get(storage.storageKey);

      expect(storageData).toEqual(expect.any(Array));
      expect(storageData).toHaveLength(1);
      expect(storageData[0]).toEqual(secretDto);
    });

    it("Should update secrets", async () => {
      expect.assertions(6);
      const secretDto1 = readSecret();
      const secretDto2 = readSecret();
      const secretDto3 = readSecret();
      const secretDto4 = readSecret();
      const secretsDtos = [secretDto1, secretDto2, secretDto3, secretDto4];
      await storage._setOPFSStorage(storage.storageKey, secretsDtos);
      const secrets = new SecretsCollection([
        secretDto1,
        { ...secretDto2, modified: "2026-03-04T13:59:11+00:00" },
        secretDto3,
        { ...secretDto4, modified: "2026-05-04T13:59:11+00:00" },
      ]);
      await storage.addOrReplaceSecretsCollection(secrets);
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData).toEqual(expect.any(Array));
      expect(storageData).toHaveLength(4);
      expect(storageData[0]).toEqual(secretDto1);
      expect(storageData[1]).toEqual({ ...secretDto2, modified: "2026-03-04T13:59:11+00:00" });
      expect(storageData[2]).toEqual(secretDto3);
      expect(storageData[3]).toEqual({ ...secretDto4, modified: "2026-05-04T13:59:11+00:00" });
    });

    it("Should update cache when updating secrets", async () => {
      expect.assertions(8);
      const secretDto1 = readSecret();
      const secretDto2 = readSecret();
      const secretDto3 = readSecret();
      const secretDto4 = readSecret();
      const secretsDtos = [secretDto1, secretDto2, secretDto3, secretDto4];
      await storage._setOPFSStorage(storage.storageKey, secretsDtos);
      const secrets = new SecretsCollection([
        secretDto1,
        { ...secretDto2, modified: "2026-03-04T13:59:11+00:00" },
        secretDto3,
        { ...secretDto4, modified: "2026-05-04T13:59:11+00:00" },
      ]);
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toBeUndefined();
      await storage.addOrReplaceSecretsCollection(secrets);
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toBeDefined();
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toEqual(expect.any(Array));
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toHaveLength(4);
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id][0]).toEqual(secretDto1);
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id][1]).toEqual({
        ...secretDto2,
        modified: "2026-03-04T13:59:11+00:00",
      });
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id][2]).toEqual(secretDto3);
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id][3]).toEqual({
        ...secretDto4,
        modified: "2026-05-04T13:59:11+00:00",
      });
    });
  });

  describe("::deleteByResourceId", () => {
    it("Should throw if no data passed as parameter", async () => {
      expect.assertions(1);
      const promise = storage.deleteByResourceId();
      await expect(promise).rejects.toThrow("The parameter resourceId should be a UUID.");
    });

    it("Should throw if the SECRET parameter is not a UUID", async () => {
      expect.assertions(1);
      const promise = storage.deleteByResourceId(42);
      await expect(promise).rejects.toThrow("The parameter resourceId should be a UUID.");
    });

    it("Should do nothing if the secret is not found in the OPFS storage", async () => {
      expect.assertions(2);
      const secretDto = readSecret();
      const secretsDtos = [secretDto];
      await storage._setOPFSStorage(storage.storageKey, secretsDtos);
      await storage.deleteByResourceId(uuidv4());
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData).toEqual(expect.any(Array));
      expect(storageData).toHaveLength(1);
    });

    it("Should delete the secret", async () => {
      expect.assertions(3);
      const secretDto1 = readSecret();
      const secretDto2 = readSecret();
      const secretsDtos = [secretDto1, secretDto2];
      await storage._setOPFSStorage(storage.storageKey, secretsDtos);
      await storage.deleteByResourceId(secretDto1.resource_id);
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData).toEqual(expect.any(Array));
      expect(storageData).toHaveLength(1);
      expect(storageData[0]).toEqual(secretDto2);
    });

    it("Should update cache after deleting the secret", async () => {
      expect.assertions(5);
      const secretDto1 = readSecret();
      const secretDto2 = readSecret();
      const secretsDtos = [secretDto1, secretDto2];
      await storage._setOPFSStorage(storage.storageKey, secretsDtos);
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toBeUndefined();
      await storage.deleteByResourceId(secretDto1.resource_id);
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toBeDefined();
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toEqual(expect.any(Array));
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toHaveLength(1);
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id][0]).toEqual(secretDto2);
    });
  });

  describe("::flush", () => {
    it("Should flush not initialized OPFS storage and cache", async () => {
      expect.assertions(2);
      await storage.flush();
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData).toBeUndefined();
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toBeUndefined();
    });

    it("Should flush", async () => {
      expect.assertions(2);
      const secretsDto = [readSecret(), readSecret()];
      const secrets = new SecretsCollection(secretsDto);
      await storage.set(secrets);
      await storage.flush();
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData).toBeUndefined();
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toBeUndefined();
    });
  });

  describe("::deleteByResourceIds", () => {
    it("Should throw if no data passed as parameter", async () => {
      expect.assertions(1);
      const promise = storage.deleteByResourceIds();
      await expect(promise).rejects.toThrow("The given parameter is not a valid array of uuid");
    });

    it("Should throw if the resourceIds parameter is not a valid entry", async () => {
      expect.assertions(1);
      const promise = storage.deleteByResourceIds(42);
      await expect(promise).rejects.toThrow("he given parameter is not a valid array of uuid");
    });

    it("Should do nothing if the resource is not found in the OPFS storage", async () => {
      expect.assertions(2);
      const secretDto = readSecret();
      const secretsDtos = [secretDto];
      await storage._setOPFSStorage(storage.storageKey, secretsDtos);
      await storage.deleteByResourceIds([uuidv4()]);
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData).toEqual(expect.any(Array));
      expect(storageData).toHaveLength(1);
    });

    it("Should update the secrets", async () => {
      expect.assertions(3);
      const secretDto1 = readSecret();
      const secretDto2 = readSecret();
      const secretDto3 = readSecret();
      const secretsDtos = [secretDto1, secretDto2, secretDto3];
      await storage._setOPFSStorage(storage.storageKey, secretsDtos);
      await storage.deleteByResourceIds([secretDto1.resource_id, secretDto2.resource_id]);
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData).toEqual(expect.any(Array));
      expect(storageData).toHaveLength(1);
      expect(storageData[0]).toEqual(secretDto3);
    });

    it("Should update cache after deleting the secrets", async () => {
      expect.assertions(5);
      const secretDto1 = readSecret();
      const secretDto2 = readSecret();
      const secretDto3 = readSecret();
      const secretsDtos = [secretDto1, secretDto2, secretDto3];
      await storage._setOPFSStorage(storage.storageKey, secretsDtos);
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toBeUndefined();
      await storage.deleteByResourceIds([secretDto1.resource_id, secretDto2.resource_id]);
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toBeDefined();
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toEqual(expect.any(Array));
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id]).toHaveLength(1);
      expect(OfflineSecretsOPFSStorage._runtimeCachedData[account.id][0]).toEqual(secretDto3);
    });
  });
});
