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
import { readSecret } from "passbolt-styleguide/src/shared/models/entity/secret/secretEntity.test.data";
import SecretsCollection from "passbolt-styleguide/src/shared/models/entity/secret/secretsCollection";
import { defaultResourceDto } from "passbolt-styleguide/src/shared/models/entity/resource/resourceEntity.test.data";
import ResourceTypesCollection from "passbolt-styleguide/src/shared/models/entity/resourceType/resourceTypesCollection";
import { resourceTypesCollectionDto } from "passbolt-styleguide/src/shared/models/entity/resourceType/resourceTypesCollection.test.data";
import { TEST_RESOURCE_TYPE_V5_DEFAULT } from "passbolt-styleguide/src/shared/models/entity/resourceType/resourceTypeEntity.test.data";
import { plaintextSecretPasswordAndDescriptionDto } from "passbolt-styleguide/src/shared/models/entity/plaintextSecret/plaintextSecretEntity.test.data";
import { pgpKeys } from "passbolt-styleguide/test/fixture/pgpKeys/keys";
import MockExtension from "../../../../../test/mocks/mockExtension";
import FindSecretOPFSService from "./findSecretOPFSService";
import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";
import ResourcesCollection from "../../model/entity/resource/resourcesCollection";
import PlaintextEntity from "../../model/entity/plaintext/plaintextEntity";
import ResourceLocalStorage from "../local_storage/resourceLocalStorage";
import PassphraseStorageService from "../session_storage/passphraseStorageService";
import GetPassphraseService from "../passphrase/getPassphraseService";
import EncryptMessageService from "../crypto/encryptMessageService";
import { OpenpgpAssertion } from "../../utils/openpgp/openpgpAssertions";

describe("FindSecretOPFSService", () => {
  let account, service, worker;

  /**
   * Store a resource in the resource local storage and its secret, encrypted for ada, in the OPFS store.
   * @param {string} resourceTypeId The resource type id of the resource.
   * @param {string} secretData The secret data to encrypt, stringified if the resource type expects an object.
   * @returns {Promise<string>} The resource id.
   */
  const mockOfflineResourceWithSecret = async (resourceTypeId, secretData) => {
    const resourceId = uuidv4();
    const encryptedSecretData = await EncryptMessageService.encrypt(
      secretData,
      await OpenpgpAssertion.readKeyOrFail(pgpKeys.ada.public),
    );
    const secretDto = readSecret({
      user_id: account.userId,
      resource_id: resourceId,
      data: encryptedSecretData,
    });
    await service.offlineSecretsOPFSStorage.set(new SecretsCollection([secretDto]));
    const resourceDto = defaultResourceDto({ id: resourceId, resource_type_id: resourceTypeId });
    await ResourceLocalStorage.set(new ResourcesCollection([resourceDto]));

    return resourceId;
  };

  beforeEach(async () => {
    // Restore and not only clear, the spied implementations must not leak from one test to another.
    jest.restoreAllMocks();
    worker = { port: { request: jest.fn() } };
    account = new AccountEntity(defaultAccountDto());
    await MockExtension.withConfiguredAccount();
    service = new FindSecretOPFSService(account, defaultApiClientOptions(), worker);
    // flush account related storage before each.
    await service.offlineSecretsOPFSStorage.flush();
    await ResourceLocalStorage.flush();
    // The resource types are not retrieved from the API in offline mode.
    jest
      .spyOn(service.getSecretSchemaResourceTypeService.getOrFindResourceTypesService, "getOrFindAll")
      .mockImplementation(async () => new ResourceTypesCollection(resourceTypesCollectionDto()));
    jest.spyOn(PassphraseStorageService, "get").mockImplementation(() => pgpKeys.ada.passphrase);
  });

  describe("::findByResourceId", () => {
    it("throws if the resource id is not a valid uuid.", async () => {
      expect.assertions(1);

      await expect(() => service.findByResourceId("not-a-uuid")).rejects.toThrow(
        "The resource id should be a valid UUID",
      );
    });

    it("decrypts the secret found in the OPFS store, as per its resource type secret schema.", async () => {
      expect.assertions(3);

      const plaintextSecretDto = plaintextSecretPasswordAndDescriptionDto();
      const resourceId = await mockOfflineResourceWithSecret(
        TEST_RESOURCE_TYPE_V5_DEFAULT,
        JSON.stringify(plaintextSecretDto),
      );

      const plaintextSecret = await service.findByResourceId(resourceId);

      expect(plaintextSecret).toBeInstanceOf(PlaintextEntity);
      expect(plaintextSecret.password).toEqual(plaintextSecretDto.password);
      expect(plaintextSecret.description).toEqual(plaintextSecretDto.description);
    });

    it("throws if the secret is not in the OPFS store.", async () => {
      expect.assertions(1);

      const resourceDto = defaultResourceDto();
      await ResourceLocalStorage.set(new ResourcesCollection([resourceDto]));

      await expect(() => service.findByResourceId(resourceDto.id)).rejects.toThrow(
        "The secret could not be found in the OPFS storage.",
      );
    });

    it("throws if the resource is not in the resource local storage.", async () => {
      expect.assertions(1);

      const resourceId = await mockOfflineResourceWithSecret(
        TEST_RESOURCE_TYPE_V5_DEFAULT,
        JSON.stringify(plaintextSecretPasswordAndDescriptionDto()),
      );
      await ResourceLocalStorage.flush();

      await expect(() => service.findByResourceId(resourceId)).rejects.toThrow(
        "The resource could not be found in the local storage.",
      );
    });

    it("prompts the user passphrase with the worker whenever it is not in the session storage.", async () => {
      expect.assertions(2);

      const plaintextSecretDto = plaintextSecretPasswordAndDescriptionDto();
      const resourceId = await mockOfflineResourceWithSecret(
        TEST_RESOURCE_TYPE_V5_DEFAULT,
        JSON.stringify(plaintextSecretDto),
      );
      jest.spyOn(PassphraseStorageService, "get").mockImplementation(() => null);
      jest.spyOn(GetPassphraseService.prototype, "requestPassphrase").mockImplementation(() => pgpKeys.ada.passphrase);

      const plaintextSecret = await service.findByResourceId(resourceId);

      expect(GetPassphraseService.prototype.requestPassphrase).toHaveBeenCalledWith(worker);
      expect(plaintextSecret.password).toEqual(plaintextSecretDto.password);
    });

    it("throws if the passphrase cannot decrypt the user private key.", async () => {
      expect.assertions(1);

      const resourceId = await mockOfflineResourceWithSecret(
        TEST_RESOURCE_TYPE_V5_DEFAULT,
        JSON.stringify(plaintextSecretPasswordAndDescriptionDto()),
      );
      jest.spyOn(PassphraseStorageService, "get").mockImplementation(() => "wrong-passphrase");

      await expect(() => service.findByResourceId(resourceId)).rejects.toThrow();
    });
  });
});
