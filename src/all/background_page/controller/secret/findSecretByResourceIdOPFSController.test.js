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
import FindSecretByResourceIdOPFSController from "./findSecretByResourceIdOPFSController";
import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";
import ResourcesCollection from "../../model/entity/resource/resourcesCollection";
import PlaintextEntity from "../../model/entity/plaintext/plaintextEntity";
import ResourceLocalStorage from "../../service/local_storage/resourceLocalStorage";
import PassphraseStorageService from "../../service/session_storage/passphraseStorageService";
import EncryptMessageService from "../../service/crypto/encryptMessageService";
import { OpenpgpAssertion } from "../../utils/openpgp/openpgpAssertions";

describe("FindSecretByResourceIdOPFSController", () => {
  let account, controller, service, worker;

  beforeEach(async () => {
    // Restore and not only clear, the spied implementations must not leak from one test to another.
    jest.restoreAllMocks();
    worker = {
      port: {
        emit: jest.fn(),
        request: jest.fn(),
      },
    };
    account = new AccountEntity(defaultAccountDto());
    await MockExtension.withConfiguredAccount();
    controller = new FindSecretByResourceIdOPFSController(worker, null, defaultApiClientOptions(), account);
    service = controller.findSecretOPFSService;
    // flush account related storage before each.
    await service.offlineSecretsOPFSStorage.flush();
    await ResourceLocalStorage.flush();
  });

  describe("::_exec", () => {
    it("emits a success message with the decrypted secret.", async () => {
      expect.assertions(3);

      const resourceId = uuidv4();
      const plaintextSecret = PlaintextEntity.createFromLegacyPlaintextSecret("secret-password");
      jest.spyOn(service, "findByResourceId").mockImplementationOnce(() => plaintextSecret);

      await controller._exec(resourceId);

      expect(service.findByResourceId).toHaveBeenCalledTimes(1);
      expect(service.findByResourceId).toHaveBeenCalledWith(resourceId);
      expect(worker.port.emit).toHaveBeenCalledWith(null, "SUCCESS", plaintextSecret);
    });

    it("emits an error message if the find service fails.", async () => {
      expect.assertions(1);

      const error = new Error("The secret could not be found in the OPFS storage.");
      jest.spyOn(service, "findByResourceId").mockImplementationOnce(() => {
        throw error;
      });

      await controller._exec(uuidv4());

      expect(worker.port.emit).toHaveBeenCalledWith(null, "ERROR", error);
    });
  });

  describe("::exec", () => {
    it("throws if the resource id is not a valid uuid.", async () => {
      expect.assertions(1);

      await expect(() => controller.exec("not-a-uuid")).rejects.toThrow("The resource id should be a valid UUID");
    });

    it("returns the secret decrypted from the OPFS store.", async () => {
      expect.assertions(3);

      const plaintextSecretDto = plaintextSecretPasswordAndDescriptionDto();
      const resourceId = uuidv4();
      const encryptedSecretData = await EncryptMessageService.encrypt(
        JSON.stringify(plaintextSecretDto),
        await OpenpgpAssertion.readKeyOrFail(pgpKeys.ada.public),
      );
      const secretDto = readSecret({
        user_id: account.userId,
        resource_id: resourceId,
        data: encryptedSecretData,
      });
      await service.offlineSecretsOPFSStorage.set(new SecretsCollection([secretDto]));
      const resourceDto = defaultResourceDto({
        id: resourceId,
        resource_type_id: TEST_RESOURCE_TYPE_V5_DEFAULT,
      });
      await ResourceLocalStorage.set(new ResourcesCollection([resourceDto]));
      jest
        .spyOn(service.getSecretSchemaResourceTypeService.getOrFindResourceTypesService, "getOrFindAll")
        .mockImplementation(async () => new ResourceTypesCollection(resourceTypesCollectionDto()));
      jest.spyOn(PassphraseStorageService, "get").mockImplementation(() => pgpKeys.ada.passphrase);

      const plaintextSecret = await controller.exec(resourceId);

      expect(plaintextSecret).toBeInstanceOf(PlaintextEntity);
      expect(plaintextSecret.password).toEqual(plaintextSecretDto.password);
      expect(plaintextSecret.description).toEqual(plaintextSecretDto.description);
    });
  });
});
