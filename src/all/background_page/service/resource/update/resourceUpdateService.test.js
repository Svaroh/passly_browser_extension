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
 * @since         4.9.4
 */

import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import AccountEntity from "../../../model/entity/account/accountEntity";
import ResourceUpdateService from "./resourceUpdateService";
import { defaultAccountDto } from "../../../model/entity/account/accountEntity.test.data";
import {
  defaultResourceDto,
  resourceWithTotpDto,
  resourceStandaloneTotpDto,
  resourceMetadataEncryptedDto,
} from "passbolt-styleguide/src/shared/models/entity/resource/resourceEntity.test.data";
import { pgpKeys } from "passbolt-styleguide/test/fixture/pgpKeys/keys";
import { readSecret } from "passbolt-styleguide/src/shared/models/entity/secret/secretEntity.test.data";
import ResourceEntity from "../../../model/entity/resource/resourceEntity";
import EncryptMessageService from "../../crypto/encryptMessageService";
import ResourceLocalStorage from "../../local_storage/resourceLocalStorage";
import Keyring from "../../../model/keyring";
import ProgressService from "../../progress/progressService";
import ResourceTypeService from "../../api/resourceType/resourceTypeService";
import { resourceTypesCollectionDto } from "passbolt-styleguide/src/shared/models/entity/resourceType/resourceTypesCollection.test.data";
import {
  adaExternalPublicGpgKeyEntityDto,
  adminExternalPublicGpgKeyEntityDto,
  bettyExternalPublicGpgKeyEntityDto,
} from "passbolt-styleguide/src/shared/models/entity/gpgkey/externalGpgKeyEntity.test.data";
import {
  resourceTypePasswordAndDescriptionDto,
  resourceTypePasswordDescriptionTotpDto,
  resourceTypePasswordStringDto,
  resourceTypeTotpDto,
  resourceTypeV5DefaultDto,
  resourceTypeV5DefaultTotpDto,
  resourceTypeV5TotpDto,
  resourceTypeV5PasswordStringDto,
  TEST_RESOURCE_TYPE_PASSWORD_STRING,
  TEST_RESOURCE_TYPE_V5_DEFAULT,
  TEST_RESOURCE_TYPE_V5_DEFAULT_TOTP,
  TEST_RESOURCE_TYPE_V5_TOTP,
  TEST_RESOURCE_TYPE_V5_PASSWORD_STRING,
} from "passbolt-styleguide/src/shared/models/entity/resourceType/resourceTypeEntity.test.data";
import ResourceSecretsCollection from "../../../model/entity/secret/resource/resourceSecretsCollection";
import DecryptPrivateKeyService from "../../crypto/decryptPrivateKeyService";
import { OpenpgpAssertion } from "../../../utils/openpgp/openpgpAssertions";
import DecryptMessageService from "../../crypto/decryptMessageService";
import {
  plaintextSecretPasswordAndDescriptionDto,
  plaintextSecretPasswordDescriptionTotpDto,
  plaintextSecretPasswordStringDto,
  plaintextSecretTotpDto,
} from "passbolt-styleguide/src/shared/models/entity/plaintextSecret/plaintextSecretEntity.test.data";
import ResourceTypeEntity from "passbolt-styleguide/src/shared/models/entity/resourceType/resourceTypeEntity";
import MetadataKeysCollection from "passbolt-styleguide/src/shared/models/entity/metadata/metadataKeysCollection";
import { defaultDecryptedSharedMetadataKeysDtos } from "passbolt-styleguide/src/shared/models/entity/metadata/metadataKeysCollection.test.data";
import DecryptMetadataService from "../../metadata/decryptMetadataService";
import { defaultResourceMetadataDto } from "passbolt-styleguide/src/shared/models/entity/resource/metadata/resourceMetadataEntity.test.data.js";
import PermissionService from "../../api/permission/permissionService";
import { ownerGroupPermissionDto } from "passbolt-styleguide/src/shared/models/entity/permission/permissionEntity.test.data";
import GetOrFindActiveSessionService from "../../activeSession/getOrFindActiveSessionService";
import UserActiveSessionEntity from "passbolt-styleguide/src/shared/models/entity/session/userActiveSessionEntity";
import { defaultUserActiveSessionDto } from "passbolt-styleguide/src/shared/models/entity/session/userActiveSessionEntity.test.data";

jest.mock("../../../service/progress/progressService");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ResourceUpdateService", () => {
  let resourceUpdateService, worker;
  const account = new AccountEntity(defaultAccountDto({ user_id: pgpKeys.ada.userId }));
  const apiClientOptions = defaultApiClientOptions();

  /**
   * Decrypt a secret
   * @param {string} secret the secret
   * @param {string} privateKey The private key
   * @param {string} passphrase The passphrase
   * @returns {Promise<string>}
   */
  const decryptSecret = async (secret, privateKey, passphrase) => {
    const decryptedPrivateKey = await DecryptPrivateKeyService.decryptArmoredKey(privateKey, passphrase);
    const secretMessage = await OpenpgpAssertion.readMessageOrFail(secret);
    const signingKey = await OpenpgpAssertion.readKeyOrFail(account.userPublicArmoredKey);
    return DecryptMessageService.decrypt(secretMessage, decryptedPrivateKey, [signingKey]);
  };

  beforeEach(async () => {
    worker = {
      port: {
        emit: jest.fn(),
      },
    };
    resourceUpdateService = new ResourceUpdateService(account, apiClientOptions, new ProgressService(worker, ""));
    jest.spyOn(resourceUpdateService.keyring, "sync").mockImplementation(jest.fn());
    jest
      .spyOn(Keyring.prototype, "getPublicKeysFromStorage")
      .mockImplementation(() => [
        adaExternalPublicGpgKeyEntityDto({ user_id: pgpKeys.ada.userId }),
        adminExternalPublicGpgKeyEntityDto({ user_id: pgpKeys.admin.userId }),
        bettyExternalPublicGpgKeyEntityDto({ user_id: pgpKeys.betty.userId }),
      ]);
    jest
      .spyOn(resourceUpdateService.userModel, "findAllIdsForResourceUpdate")
      .mockImplementation(() => [pgpKeys.ada.userId, pgpKeys.admin.userId, pgpKeys.betty.userId]);
    jest.spyOn(PermissionService.prototype, "findAllByAcoForeignKey").mockImplementation(() => []);
    jest.spyOn(ResourceTypeService.prototype, "findAll").mockImplementation(() => resourceTypesCollectionDto());
    jest
      .spyOn(GetOrFindActiveSessionService.prototype, "getOrFind")
      .mockImplementation(() => new UserActiveSessionEntity(defaultUserActiveSessionDto()));
  });

  describe("ResourceUpdateService::exec", () => {
    it("Should call progress service during the different steps of creation", async () => {
      expect.assertions(7);

      const resourceDto = defaultResourceDto();
      const entity = new ResourceEntity(resourceDto);
      await ResourceLocalStorage.addResource(entity);

      let resourceLocalStorageExpected;
      jest.spyOn(resourceUpdateService.resourceService, "update").mockImplementation((_, resourceDtoToUpdate) => {
        const resourceEntity = new ResourceEntity(resourceDto);
        resourceEntity.secrets = new ResourceSecretsCollection([resourceDtoToUpdate.secrets[0]]);
        resourceLocalStorageExpected = resourceEntity.toV4Dto(ResourceLocalStorage.DEFAULT_CONTAIN);
        return resourceLocalStorageExpected;
      });
      jest.spyOn(ResourceLocalStorage, "updateResource");

      await resourceUpdateService.exec(
        defaultResourceDto(),
        plaintextSecretPasswordAndDescriptionDto(),
        pgpKeys.ada.passphrase,
      );

      expect(resourceUpdateService.progressService.updateGoals).toHaveBeenCalledTimes(1);
      expect(resourceUpdateService.progressService.updateGoals).toHaveBeenCalledWith(2);
      expect(resourceUpdateService.progressService.finishStep).toHaveBeenCalledTimes(2);
      expect(resourceUpdateService.progressService.finishStep).toHaveBeenCalledWith("Encrypting Secret", true);
      expect(resourceUpdateService.progressService.finishStep).toHaveBeenCalledWith("Saving resource", true);
      expect(ResourceLocalStorage.updateResource).toHaveBeenCalledTimes(1);
      expect(ResourceLocalStorage.updateResource).toHaveBeenCalledWith(
        new ResourceEntity(resourceLocalStorageExpected),
      );
    });

    it("Should call progress service during the different steps when permissions and secret changed", async () => {
      expect.assertions(8);

      // A v5 resource so the update path reports its 3 steps (metadata, secret and save).
      const resourceDto = defaultResourceDto({ resource_type_id: TEST_RESOURCE_TYPE_V5_DEFAULT });
      const plaintextDto = plaintextSecretPasswordAndDescriptionDto();
      const passphrase = pgpKeys.ada.passphrase;
      const metadataKeysDtos = defaultDecryptedSharedMetadataKeysDtos({ armored_key: pgpKeys.metadataKey.public });
      const metadataKeys = new MetadataKeysCollection(metadataKeysDtos);
      const entity = new ResourceEntity(resourceDto);
      await ResourceLocalStorage.addResource(entity);

      jest
        .spyOn(resourceUpdateService.encryptMetadataKeysService.getOrFindMetadataKeysService, "getOrFindAll")
        .mockImplementation(() => metadataKeys);
      let resourceUpdated;
      jest
        .spyOn(resourceUpdateService.resourceService, "update")
        .mockImplementation((resourceIdToUpdate, resourceDtoToUpdate) => {
          resourceUpdated = resourceDtoToUpdate;
          const resourceEntity = new ResourceEntity(resourceDto);
          resourceEntity.secrets = new ResourceSecretsCollection([resourceDtoToUpdate.secrets[0]]);
          resourceEntity.metadataKeyId = resourceDtoToUpdate.metadata_key_id;
          resourceEntity.metadataKeyType = resourceDtoToUpdate.metadata_key_type;
          resourceEntity.metadata = resourceDtoToUpdate.metadata;
          return resourceEntity.toDto(ResourceLocalStorage.DEFAULT_CONTAIN);
        });
      jest.spyOn(ResourceLocalStorage, "updateResource");
      jest.spyOn(resourceUpdateService.shareResourceService, "shareAll").mockImplementation(() => {});

      const permissionChanges = [
        {
          aco: "Resource",
          aro: "User",
          aro_foreign_key: pgpKeys.betty.userId,
          aco_foreign_key: null,
          type: 1,
          is_new: true,
        },
      ];

      await resourceUpdateService.exec(resourceDto, plaintextDto, passphrase, permissionChanges);

      // The secret is re-encrypted for every user having access to the resource.
      const secretAdaDecrypted = await decryptSecret(
        resourceUpdated.secrets[0].data,
        account.userPrivateArmoredKey,
        passphrase,
      );
      expect(resourceUpdated.secrets.length).toEqual(3);
      expect(JSON.parse(secretAdaDecrypted)).toEqual(plaintextDto);
      // The goals reserve 3 update steps plus the 8 share steps, and every one of them is finished.
      expect(resourceUpdateService.progressService.updateGoals).toHaveBeenCalledTimes(1);
      expect(resourceUpdateService.progressService.updateGoals).toHaveBeenCalledWith(11);
      expect(resourceUpdateService.progressService.finishStep).toHaveBeenCalledTimes(3); //should be 11 but the share service is mocked for the tests
      expect(resourceUpdateService.progressService.finishStep).toHaveBeenCalledWith("Encrypting Metadata", true);
      expect(resourceUpdateService.progressService.finishStep).toHaveBeenCalledWith("Encrypting Secret", true);
      expect(resourceUpdateService.progressService.finishStep).toHaveBeenCalledWith("Saving resource", true);
    });

    it("Should not report the metadata encryption step when the resource type is not v5", async () => {
      expect.assertions(6);

      // A v4 resource so the update path skips the metadata encryption step.
      const resourceDto = defaultResourceDto();
      const plaintextDto = plaintextSecretPasswordAndDescriptionDto();
      const passphrase = pgpKeys.ada.passphrase;
      const entity = new ResourceEntity(resourceDto);
      await ResourceLocalStorage.addResource(entity);

      let resourceUpdated;
      jest.spyOn(resourceUpdateService.resourceService, "update").mockImplementation((_, resourceDtoToUpdate) => {
        resourceUpdated = resourceDtoToUpdate;
        const resourceEntity = new ResourceEntity(resourceDto);
        resourceEntity.secrets = new ResourceSecretsCollection([resourceDtoToUpdate.secrets[0]]);
        return resourceEntity.toV4Dto(ResourceLocalStorage.DEFAULT_CONTAIN);
      });
      jest.spyOn(ResourceLocalStorage, "updateResource");
      jest.spyOn(resourceUpdateService.shareResourceService, "shareAll").mockImplementation(() => {});

      const permissionChanges = [
        {
          aco: "Resource",
          aro: "User",
          aro_foreign_key: pgpKeys.betty.userId,
          aco_foreign_key: null,
          type: 1,
          is_new: true,
        },
      ];

      await resourceUpdateService.exec(resourceDto, plaintextDto, passphrase, permissionChanges);

      expect(resourceUpdated.secrets.length).toEqual(3);
      // The goals still reserve 3 update steps plus the 8 share steps.
      expect(resourceUpdateService.progressService.updateGoals).toHaveBeenCalledTimes(1);
      expect(resourceUpdateService.progressService.updateGoals).toHaveBeenCalledWith(10);
      // The metadata step is skipped for a v4 resource, so only 2 steps are finished (would be 10 but the share service is mocked for the tests).
      expect(resourceUpdateService.progressService.finishStep).toHaveBeenCalledTimes(2);
      expect(resourceUpdateService.progressService.finishStep).not.toHaveBeenCalledWith("Encrypting Metadata", true);
      expect(resourceUpdateService.progressService.finishStep).toHaveBeenCalledWith("Encrypting Secret", true);
    });

    it("Should apply the permission changes via shareAll after the update, stamping the resource id", async () => {
      expect.assertions(3);

      const resourceDto = defaultResourceDto();
      await ResourceLocalStorage.addResource(new ResourceEntity(resourceDto));
      jest
        .spyOn(resourceUpdateService.resourceService, "update")
        .mockImplementation((resourceIdToUpdate, resourceDtoToUpdate) => {
          const resourceEntity = new ResourceEntity(resourceDto);
          resourceEntity.secrets = new ResourceSecretsCollection([resourceDtoToUpdate.secrets[0]]);
          return resourceEntity.toV4Dto(ResourceLocalStorage.DEFAULT_CONTAIN);
        });
      const shareAllSpy = jest
        .spyOn(resourceUpdateService.shareResourceService, "shareAll")
        .mockImplementation(jest.fn);

      const permissionChanges = [
        {
          aco: "Resource",
          aro: "User",
          aro_foreign_key: pgpKeys.betty.userId,
          aco_foreign_key: null,
          type: 1,
          is_new: true,
        },
      ];
      await resourceUpdateService.exec(
        resourceDto,
        plaintextSecretPasswordAndDescriptionDto(),
        pgpKeys.ada.passphrase,
        permissionChanges,
      );

      expect(shareAllSpy).toHaveBeenCalledTimes(1);
      const [resourcesIds, changesCollection] = shareAllSpy.mock.calls[0];
      expect(resourcesIds).toEqual([resourceDto.id]);
      // The delta's aco_foreign_key must be stamped with the resource id before sharing.
      expect(changesCollection.toDto()[0].aco_foreign_key).toEqual(resourceDto.id);
    });

    it("Should not call shareAll when no permission changes are provided", async () => {
      expect.assertions(1);

      const resourceDto = defaultResourceDto();
      await ResourceLocalStorage.addResource(new ResourceEntity(resourceDto));
      jest
        .spyOn(resourceUpdateService.resourceService, "update")
        .mockImplementation((resourceIdToUpdate, resourceDtoToUpdate) => {
          const resourceEntity = new ResourceEntity(resourceDto);
          resourceEntity.secrets = new ResourceSecretsCollection([resourceDtoToUpdate.secrets[0]]);
          return resourceEntity.toV4Dto(ResourceLocalStorage.DEFAULT_CONTAIN);
        });
      const shareAllSpy = jest
        .spyOn(resourceUpdateService.shareResourceService, "shareAll")
        .mockImplementation(jest.fn);

      await resourceUpdateService.exec(resourceDto, plaintextSecretPasswordAndDescriptionDto(), pgpKeys.ada.passphrase);

      expect(shareAllSpy).not.toHaveBeenCalled();
    });

    it("Should Update the resource with encrypted secrets (password and description) and dto", async () => {
      expect.assertions(14);

      const resourceDto = defaultResourceDto();
      const resourceTypeDto = resourceTypePasswordAndDescriptionDto();
      const plaintextDto = plaintextSecretPasswordAndDescriptionDto();
      const passphrase = pgpKeys.ada.passphrase;
      const entity = new ResourceEntity(resourceDto);
      const resourceTypeEntity = new ResourceTypeEntity(resourceTypeDto);
      await ResourceLocalStorage.addResource(entity);

      jest.spyOn(EncryptMessageService, "encrypt");
      jest.spyOn(resourceUpdateService.resourceModel, "serializePlaintextDto");
      jest.spyOn(resourceUpdateService, "update");
      let resourceUpdated, resourceLocalStorageExpected;
      jest
        .spyOn(resourceUpdateService.resourceService, "update")
        .mockImplementation((resourceIdToUpdate, resourceDtoToUpdate) => {
          resourceUpdated = resourceDtoToUpdate;
          const resourceEntity = new ResourceEntity(resourceDto);
          resourceEntity.secrets = new ResourceSecretsCollection([resourceDtoToUpdate.secrets[0]]);
          resourceLocalStorageExpected = resourceEntity.toV4Dto(ResourceLocalStorage.DEFAULT_CONTAIN);
          return resourceLocalStorageExpected;
        });
      jest.spyOn(ResourceLocalStorage, "updateResource");

      await resourceUpdateService.exec(resourceDto, plaintextDto, passphrase);

      // Get secrets from the resource updated sent to the API
      const secretAda = resourceUpdated.secrets[0];
      const secretAdaDecrypted = await decryptSecret(
        secretAda.data,
        account.userPrivateArmoredKey,
        passphrase,
        resourceUpdated.resource_type_id,
      );
      const secretAdmin = resourceUpdated.secrets[1];
      const secretAdminDecrypted = await decryptSecret(
        secretAdmin.data,
        pgpKeys.admin.private,
        pgpKeys.admin.passphrase,
        resourceUpdated.resource_type_id,
      );
      const secretBetty = resourceUpdated.secrets[2];
      const secretBettyDecrypted = await decryptSecret(
        secretBetty.data,
        pgpKeys.betty.private,
        pgpKeys.betty.passphrase,
        resourceUpdated.resource_type_id,
      );

      expect(resourceUpdated.secrets.length).toEqual(3);
      expect(secretAda.user_id).toEqual(account.userId);
      expect(JSON.parse(secretAdaDecrypted)).toEqual(plaintextDto);
      expect(secretAdmin.user_id).toEqual(pgpKeys.admin.userId);
      expect(JSON.parse(secretAdminDecrypted)).toEqual(plaintextDto);
      expect(secretBetty.user_id).toEqual(pgpKeys.betty.userId);
      expect(JSON.parse(secretBettyDecrypted)).toEqual(plaintextDto);
      expect(resourceUpdateService.resourceModel.serializePlaintextDto).toHaveBeenCalledTimes(1);
      expect(resourceUpdateService.resourceModel.serializePlaintextDto).toHaveBeenCalledWith(
        entity.resourceTypeId,
        plaintextDto,
      );
      expect(EncryptMessageService.encrypt).toHaveBeenCalledTimes(3);
      expect(resourceUpdateService.update).toHaveBeenCalledTimes(1);
      expect(resourceUpdateService.update).toHaveBeenCalledWith(
        expect.objectContaining(entity),
        resourceTypeEntity,
        entity.metadata,
      );
      expect(resourceUpdateService.resourceService.update).toHaveBeenCalledWith(
        entity.id,
        resourceUpdated,
        ResourceLocalStorage.DEFAULT_CONTAIN,
      );
      expect(ResourceLocalStorage.updateResource).toHaveBeenCalledWith(
        new ResourceEntity(resourceLocalStorageExpected),
      );
    });

    it("Should Update the resource with encrypted secrets (string) and dto", async () => {
      expect.assertions(14);

      const resourceDto = defaultResourceDto({ resource_type_id: TEST_RESOURCE_TYPE_PASSWORD_STRING });
      const resourceTypeDto = resourceTypePasswordStringDto();
      const plaintextDto = plaintextSecretPasswordStringDto().password;
      const passphrase = pgpKeys.ada.passphrase;
      const entity = new ResourceEntity(resourceDto);
      const resourceTypeEntity = new ResourceTypeEntity(resourceTypeDto);
      await ResourceLocalStorage.addResource(entity);

      jest.spyOn(EncryptMessageService, "encrypt");
      jest.spyOn(resourceUpdateService.resourceModel, "serializePlaintextDto");
      jest.spyOn(resourceUpdateService, "update");
      let resourceUpdated, resourceLocalStorageExpected;
      jest
        .spyOn(resourceUpdateService.resourceService, "update")
        .mockImplementation((resourceIdToUpdate, resourceDtoToUpdate) => {
          resourceUpdated = resourceDtoToUpdate;
          const resourceEntity = new ResourceEntity(resourceDto);
          resourceEntity.secrets = new ResourceSecretsCollection([resourceDtoToUpdate.secrets[0]]);
          resourceLocalStorageExpected = resourceEntity.toV4Dto(ResourceLocalStorage.DEFAULT_CONTAIN);
          return resourceLocalStorageExpected;
        });
      jest.spyOn(ResourceLocalStorage, "updateResource");

      await resourceUpdateService.exec(resourceDto, plaintextDto, passphrase);

      // Get secrets from the resource updated sent to the API
      const secretAda = resourceUpdated.secrets[0];
      const secretAdaDecrypted = await decryptSecret(
        secretAda.data,
        account.userPrivateArmoredKey,
        passphrase,
        resourceUpdated.resource_type_id,
      );
      const secretAdmin = resourceUpdated.secrets[1];
      const secretAdminDecrypted = await decryptSecret(
        secretAdmin.data,
        pgpKeys.admin.private,
        pgpKeys.admin.passphrase,
        resourceUpdated.resource_type_id,
      );
      const secretBetty = resourceUpdated.secrets[2];
      const secretBettyDecrypted = await decryptSecret(
        secretBetty.data,
        pgpKeys.betty.private,
        pgpKeys.betty.passphrase,
        resourceUpdated.resource_type_id,
      );

      expect(resourceUpdated.secrets.length).toEqual(3);
      expect(secretAda.user_id).toEqual(account.userId);
      expect(secretAdaDecrypted).toEqual(plaintextDto);
      expect(secretAdmin.user_id).toEqual(pgpKeys.admin.userId);
      expect(secretAdminDecrypted).toEqual(plaintextDto);
      expect(secretBetty.user_id).toEqual(pgpKeys.betty.userId);
      expect(secretBettyDecrypted).toEqual(plaintextDto);
      expect(resourceUpdateService.resourceModel.serializePlaintextDto).toHaveBeenCalledTimes(1);
      expect(resourceUpdateService.resourceModel.serializePlaintextDto).toHaveBeenCalledWith(
        entity.resourceTypeId,
        plaintextDto,
      );
      expect(EncryptMessageService.encrypt).toHaveBeenCalledTimes(3);
      expect(resourceUpdateService.update).toHaveBeenCalledTimes(1);
      expect(resourceUpdateService.update).toHaveBeenCalledWith(
        expect.objectContaining(entity),
        resourceTypeEntity,
        entity.metadata,
      );
      expect(resourceUpdateService.resourceService.update).toHaveBeenCalledWith(
        entity.id,
        resourceUpdated,
        ResourceLocalStorage.DEFAULT_CONTAIN,
      );
      expect(ResourceLocalStorage.updateResource).toHaveBeenCalledWith(
        new ResourceEntity(resourceLocalStorageExpected),
      );
    });

    it("Should Update the resource with encrypted secrets (password, description and totp) and dto", async () => {
      expect.assertions(14);

      const resourceDto = resourceWithTotpDto();
      const resourceTypeDto = resourceTypePasswordDescriptionTotpDto();
      const plaintextDto = plaintextSecretPasswordDescriptionTotpDto();
      const passphrase = pgpKeys.ada.passphrase;
      const entity = new ResourceEntity(resourceDto);
      const resourceTypeEntity = new ResourceTypeEntity(resourceTypeDto);
      await ResourceLocalStorage.addResource(entity);

      jest.spyOn(EncryptMessageService, "encrypt");
      jest.spyOn(resourceUpdateService.resourceModel, "serializePlaintextDto");
      jest.spyOn(resourceUpdateService, "update");
      let resourceUpdated, resourceLocalStorageExpected;
      jest
        .spyOn(resourceUpdateService.resourceService, "update")
        .mockImplementation((resourceIdToUpdate, resourceDtoToUpdate) => {
          resourceUpdated = resourceDtoToUpdate;
          const resourceEntity = new ResourceEntity(resourceDto);
          resourceEntity.secrets = new ResourceSecretsCollection([resourceDtoToUpdate.secrets[0]]);
          resourceLocalStorageExpected = resourceEntity.toV4Dto(ResourceLocalStorage.DEFAULT_CONTAIN);
          return resourceLocalStorageExpected;
        });
      jest.spyOn(ResourceLocalStorage, "updateResource");

      await resourceUpdateService.exec(resourceDto, plaintextDto, passphrase);

      // Get secrets from the resource updated sent to the API
      const secretAda = resourceUpdated.secrets[0];
      const secretAdaDecrypted = await decryptSecret(
        secretAda.data,
        account.userPrivateArmoredKey,
        passphrase,
        resourceUpdated.resource_type_id,
      );
      const secretAdmin = resourceUpdated.secrets[1];
      const secretAdminDecrypted = await decryptSecret(
        secretAdmin.data,
        pgpKeys.admin.private,
        pgpKeys.admin.passphrase,
        resourceUpdated.resource_type_id,
      );
      const secretBetty = resourceUpdated.secrets[2];
      const secretBettyDecrypted = await decryptSecret(
        secretBetty.data,
        pgpKeys.betty.private,
        pgpKeys.betty.passphrase,
        resourceUpdated.resource_type_id,
      );

      expect(resourceUpdated.secrets.length).toEqual(3);
      expect(secretAda.user_id).toEqual(account.userId);
      expect(JSON.parse(secretAdaDecrypted)).toEqual(plaintextDto);
      expect(secretAdmin.user_id).toEqual(pgpKeys.admin.userId);
      expect(JSON.parse(secretAdminDecrypted)).toEqual(plaintextDto);
      expect(secretBetty.user_id).toEqual(pgpKeys.betty.userId);
      expect(JSON.parse(secretBettyDecrypted)).toEqual(plaintextDto);
      expect(resourceUpdateService.resourceModel.serializePlaintextDto).toHaveBeenCalledTimes(1);
      expect(resourceUpdateService.resourceModel.serializePlaintextDto).toHaveBeenCalledWith(
        entity.resourceTypeId,
        plaintextDto,
      );
      expect(EncryptMessageService.encrypt).toHaveBeenCalledTimes(3);
      expect(resourceUpdateService.update).toHaveBeenCalledTimes(1);
      expect(resourceUpdateService.update).toHaveBeenCalledWith(
        expect.objectContaining(entity),
        resourceTypeEntity,
        entity.metadata,
      );
      expect(resourceUpdateService.resourceService.update).toHaveBeenCalledWith(
        entity.id,
        resourceUpdated,
        ResourceLocalStorage.DEFAULT_CONTAIN,
      );
      expect(ResourceLocalStorage.updateResource).toHaveBeenCalledWith(
        new ResourceEntity(resourceLocalStorageExpected),
      );
    });

    it("Should Update the resource with encrypted secrets (totp) and dto", async () => {
      expect.assertions(14);

      const resourceDto = resourceStandaloneTotpDto();
      const resourceTypeDto = resourceTypeTotpDto();
      const plaintextDto = plaintextSecretTotpDto();
      const passphrase = pgpKeys.ada.passphrase;
      const entity = new ResourceEntity(resourceDto);
      const resourceTypeEntity = new ResourceTypeEntity(resourceTypeDto);
      await ResourceLocalStorage.addResource(entity);

      jest.spyOn(EncryptMessageService, "encrypt");
      jest.spyOn(resourceUpdateService.resourceModel, "serializePlaintextDto");
      jest.spyOn(resourceUpdateService, "update");
      let resourceUpdated, resourceLocalStorageExpected;
      jest
        .spyOn(resourceUpdateService.resourceService, "update")
        .mockImplementation((resourceIdToUpdate, resourceDtoToUpdate) => {
          resourceUpdated = resourceDtoToUpdate;
          const resourceEntity = new ResourceEntity(resourceDto);
          resourceEntity.secrets = new ResourceSecretsCollection([resourceDtoToUpdate.secrets[0]]);
          resourceLocalStorageExpected = resourceEntity.toV4Dto(ResourceLocalStorage.DEFAULT_CONTAIN);
          return resourceLocalStorageExpected;
        });
      jest.spyOn(ResourceLocalStorage, "updateResource");

      await resourceUpdateService.exec(resourceDto, plaintextDto, passphrase);

      // Get secrets from the resource updated sent to the API
      const secretAda = resourceUpdated.secrets[0];
      const secretAdaDecrypted = await decryptSecret(
        secretAda.data,
        account.userPrivateArmoredKey,
        passphrase,
        resourceUpdated.resource_type_id,
      );
      const secretAdmin = resourceUpdated.secrets[1];
      const secretAdminDecrypted = await decryptSecret(
        secretAdmin.data,
        pgpKeys.admin.private,
        pgpKeys.admin.passphrase,
        resourceUpdated.resource_type_id,
      );
      const secretBetty = resourceUpdated.secrets[2];
      const secretBettyDecrypted = await decryptSecret(
        secretBetty.data,
        pgpKeys.betty.private,
        pgpKeys.betty.passphrase,
        resourceUpdated.resource_type_id,
      );

      expect(resourceUpdated.secrets.length).toEqual(3);
      expect(secretAda.user_id).toEqual(account.userId);
      expect(JSON.parse(secretAdaDecrypted)).toEqual(plaintextDto);
      expect(secretAdmin.user_id).toEqual(pgpKeys.admin.userId);
      expect(JSON.parse(secretAdminDecrypted)).toEqual(plaintextDto);
      expect(secretBetty.user_id).toEqual(pgpKeys.betty.userId);
      expect(JSON.parse(secretBettyDecrypted)).toEqual(plaintextDto);
      expect(resourceUpdateService.resourceModel.serializePlaintextDto).toHaveBeenCalledTimes(1);
      expect(resourceUpdateService.resourceModel.serializePlaintextDto).toHaveBeenCalledWith(
        entity.resourceTypeId,
        plaintextDto,
      );
      expect(EncryptMessageService.encrypt).toHaveBeenCalledTimes(3);
      expect(resourceUpdateService.update).toHaveBeenCalledTimes(1);
      expect(resourceUpdateService.update).toHaveBeenCalledWith(
        expect.objectContaining(entity),
        resourceTypeEntity,
        entity.metadata,
      );
      expect(resourceUpdateService.resourceService.update).toHaveBeenCalledWith(
        entity.id,
        resourceUpdated,
        ResourceLocalStorage.DEFAULT_CONTAIN,
      );
      expect(ResourceLocalStorage.updateResource).toHaveBeenCalledWith(
        new ResourceEntity(resourceLocalStorageExpected),
      );
    });

    it("Should Update the resource with encrypted secrets (v5 default) and dto", async () => {
      expect.assertions(16);

      const resourceDto = defaultResourceDto({ resource_type_id: TEST_RESOURCE_TYPE_V5_DEFAULT });
      const resourceTypeDto = resourceTypeV5DefaultDto();
      const plaintextDto = plaintextSecretPasswordAndDescriptionDto();
      const metadataKeysDtos = defaultDecryptedSharedMetadataKeysDtos({ armored_key: pgpKeys.metadataKey.public });
      const decryptMetadataService = new DecryptMetadataService(apiClientOptions, account);
      const metadataKeys = new MetadataKeysCollection(metadataKeysDtos);
      const passphrase = pgpKeys.ada.passphrase;
      const entity = new ResourceEntity(resourceDto);
      const resourceTypeEntity = new ResourceTypeEntity(resourceTypeDto);
      await ResourceLocalStorage.addResource(entity);

      jest.spyOn(EncryptMessageService, "encrypt");
      jest.spyOn(resourceUpdateService.resourceModel, "serializePlaintextDto");
      jest.spyOn(resourceUpdateService, "update");
      jest
        .spyOn(resourceUpdateService.encryptMetadataKeysService.getOrFindMetadataKeysService, "getOrFindAll")
        .mockImplementation(() => metadataKeys);
      jest
        .spyOn(decryptMetadataService.getOrFindMetadataKeysService, "getOrFindAll")
        .mockImplementation(() => metadataKeys);
      let resourceUpdated, resourceLocalStorageExpected;
      jest
        .spyOn(resourceUpdateService.resourceService, "update")
        .mockImplementation((resourceIdToUpdate, resourceDtoToUpdate) => {
          resourceUpdated = resourceDtoToUpdate;
          const resourceEntity = new ResourceEntity(resourceDto);
          resourceEntity.secrets = new ResourceSecretsCollection([resourceDtoToUpdate.secrets[0]]);
          resourceEntity.metadataKeyId = resourceDtoToUpdate.metadata_key_id;
          resourceEntity.metadataKeyType = resourceDtoToUpdate.metadata_key_type;
          resourceLocalStorageExpected = resourceEntity.toDto(ResourceLocalStorage.DEFAULT_CONTAIN);
          resourceEntity.metadata = resourceDtoToUpdate.metadata;
          return resourceEntity.toDto(ResourceLocalStorage.DEFAULT_CONTAIN);
        });
      jest.spyOn(ResourceLocalStorage, "updateResource");

      await resourceUpdateService.exec(resourceDto, plaintextDto, passphrase);

      // Get secrets from the resource updated sent to the API
      const secretAda = resourceUpdated.secrets[0];
      const secretAdaDecrypted = await decryptSecret(
        secretAda.data,
        account.userPrivateArmoredKey,
        passphrase,
        resourceUpdated.resource_type_id,
      );
      const secretAdmin = resourceUpdated.secrets[1];
      const secretAdminDecrypted = await decryptSecret(
        secretAdmin.data,
        pgpKeys.admin.private,
        pgpKeys.admin.passphrase,
        resourceUpdated.resource_type_id,
      );
      const secretBetty = resourceUpdated.secrets[2];
      const secretBettyDecrypted = await decryptSecret(
        secretBetty.data,
        pgpKeys.betty.private,
        pgpKeys.betty.passphrase,
        resourceUpdated.resource_type_id,
      );
      // Decrypt metadata
      const resourceEntityUpdated = new ResourceEntity(resourceUpdated);
      expect(resourceEntityUpdated.isMetadataDecrypted()).toBeFalsy();
      expect(resourceUpdateService.update).toHaveBeenCalledWith(
        expect.objectContaining(resourceEntityUpdated),
        resourceTypeEntity,
        entity.metadata,
      );
      await decryptMetadataService.decryptOneWithSharedKey(resourceEntityUpdated);

      expect(resourceUpdated.secrets.length).toEqual(3);
      expect(secretAda.user_id).toEqual(account.userId);
      expect(JSON.parse(secretAdaDecrypted)).toEqual(plaintextDto);
      expect(secretAdmin.user_id).toEqual(pgpKeys.admin.userId);
      expect(JSON.parse(secretAdminDecrypted)).toEqual(plaintextDto);
      expect(secretBetty.user_id).toEqual(pgpKeys.betty.userId);
      expect(JSON.parse(secretBettyDecrypted)).toEqual(plaintextDto);
      expect(resourceEntityUpdated.metadata).toEqual(entity.metadata);
      expect(resourceUpdateService.resourceModel.serializePlaintextDto).toHaveBeenCalledTimes(1);
      expect(resourceUpdateService.resourceModel.serializePlaintextDto).toHaveBeenCalledWith(
        entity.resourceTypeId,
        plaintextDto,
      );
      expect(EncryptMessageService.encrypt).toHaveBeenCalledTimes(4);
      expect(resourceUpdateService.update).toHaveBeenCalledTimes(1);
      expect(resourceUpdateService.resourceService.update).toHaveBeenCalledWith(
        entity.id,
        resourceUpdated,
        ResourceLocalStorage.DEFAULT_CONTAIN,
      );
      expect(ResourceLocalStorage.updateResource).toHaveBeenCalledWith(
        new ResourceEntity(resourceLocalStorageExpected),
      );
    });

    it("Should Update the resource with encrypted secrets (v5 default totp) and dto", async () => {
      expect.assertions(16);

      const resourceDto = resourceWithTotpDto({ resource_type_id: TEST_RESOURCE_TYPE_V5_DEFAULT_TOTP });
      const resourceTypeDto = resourceTypeV5DefaultTotpDto();
      const plaintextDto = plaintextSecretPasswordDescriptionTotpDto();
      const metadataKeysDtos = defaultDecryptedSharedMetadataKeysDtos({ armored_key: pgpKeys.metadataKey.public });
      const decryptMetadataService = new DecryptMetadataService(apiClientOptions, account);
      const metadataKeys = new MetadataKeysCollection(metadataKeysDtos);
      const passphrase = pgpKeys.ada.passphrase;
      const entity = new ResourceEntity(resourceDto);
      const resourceTypeEntity = new ResourceTypeEntity(resourceTypeDto);
      await ResourceLocalStorage.addResource(entity);

      jest.spyOn(EncryptMessageService, "encrypt");
      jest.spyOn(resourceUpdateService.resourceModel, "serializePlaintextDto");
      jest.spyOn(resourceUpdateService, "update");
      jest
        .spyOn(resourceUpdateService.encryptMetadataKeysService.getOrFindMetadataKeysService, "getOrFindAll")
        .mockImplementation(() => metadataKeys);
      jest
        .spyOn(decryptMetadataService.getOrFindMetadataKeysService, "getOrFindAll")
        .mockImplementation(() => metadataKeys);
      let resourceUpdated, resourceLocalStorageExpected;
      jest
        .spyOn(resourceUpdateService.resourceService, "update")
        .mockImplementation((resourceIdToUpdate, resourceDtoToUpdate) => {
          resourceUpdated = resourceDtoToUpdate;
          const resourceEntity = new ResourceEntity(resourceDto);
          resourceEntity.secrets = new ResourceSecretsCollection([resourceDtoToUpdate.secrets[0]]);
          resourceEntity.metadataKeyId = resourceDtoToUpdate.metadata_key_id;
          resourceEntity.metadataKeyType = resourceDtoToUpdate.metadata_key_type;
          resourceLocalStorageExpected = resourceEntity.toDto(ResourceLocalStorage.DEFAULT_CONTAIN);
          resourceEntity.metadata = resourceDtoToUpdate.metadata;
          return resourceEntity.toDto(ResourceLocalStorage.DEFAULT_CONTAIN);
        });
      jest.spyOn(ResourceLocalStorage, "updateResource");

      await resourceUpdateService.exec(resourceDto, plaintextDto, passphrase);

      // Get secrets from the resource updated sent to the API
      const secretAda = resourceUpdated.secrets[0];
      const secretAdaDecrypted = await decryptSecret(
        secretAda.data,
        account.userPrivateArmoredKey,
        passphrase,
        resourceUpdated.resource_type_id,
      );
      const secretAdmin = resourceUpdated.secrets[1];
      const secretAdminDecrypted = await decryptSecret(
        secretAdmin.data,
        pgpKeys.admin.private,
        pgpKeys.admin.passphrase,
        resourceUpdated.resource_type_id,
      );
      const secretBetty = resourceUpdated.secrets[2];
      const secretBettyDecrypted = await decryptSecret(
        secretBetty.data,
        pgpKeys.betty.private,
        pgpKeys.betty.passphrase,
        resourceUpdated.resource_type_id,
      );
      // Decrypt metadata
      const resourceEntityUpdated = new ResourceEntity(resourceUpdated);
      expect(resourceEntityUpdated.isMetadataDecrypted()).toBeFalsy();
      expect(resourceUpdateService.update).toHaveBeenCalledWith(
        expect.objectContaining(resourceEntityUpdated),
        resourceTypeEntity,
        entity.metadata,
      );
      await decryptMetadataService.decryptOneWithSharedKey(resourceEntityUpdated);

      expect(resourceUpdated.secrets.length).toEqual(3);
      expect(secretAda.user_id).toEqual(account.userId);
      expect(JSON.parse(secretAdaDecrypted)).toEqual(plaintextDto);
      expect(secretAdmin.user_id).toEqual(pgpKeys.admin.userId);
      expect(JSON.parse(secretAdminDecrypted)).toEqual(plaintextDto);
      expect(secretBetty.user_id).toEqual(pgpKeys.betty.userId);
      expect(JSON.parse(secretBettyDecrypted)).toEqual(plaintextDto);
      expect(resourceEntityUpdated.metadata).toEqual(entity.metadata);
      expect(resourceUpdateService.resourceModel.serializePlaintextDto).toHaveBeenCalledTimes(1);
      expect(resourceUpdateService.resourceModel.serializePlaintextDto).toHaveBeenCalledWith(
        entity.resourceTypeId,
        plaintextDto,
      );
      expect(EncryptMessageService.encrypt).toHaveBeenCalledTimes(4);
      expect(resourceUpdateService.update).toHaveBeenCalledTimes(1);
      expect(resourceUpdateService.resourceService.update).toHaveBeenCalledWith(
        entity.id,
        resourceUpdated,
        ResourceLocalStorage.DEFAULT_CONTAIN,
      );
      expect(ResourceLocalStorage.updateResource).toHaveBeenCalledWith(
        new ResourceEntity(resourceLocalStorageExpected),
      );
    });

    it("Should Update the resource with encrypted secrets (v5 standalone totp) and dto", async () => {
      expect.assertions(16);

      const resourceDto = resourceStandaloneTotpDto({
        resource_type_id: TEST_RESOURCE_TYPE_V5_TOTP,
        metadata: defaultResourceMetadataDto({ resource_type_id: TEST_RESOURCE_TYPE_V5_TOTP, username: null }),
      });
      const resourceTypeDto = resourceTypeV5TotpDto();
      const plaintextDto = plaintextSecretTotpDto();
      const metadataKeysDtos = defaultDecryptedSharedMetadataKeysDtos({ armored_key: pgpKeys.metadataKey.public });
      const decryptMetadataService = new DecryptMetadataService(apiClientOptions, account);
      const metadataKeys = new MetadataKeysCollection(metadataKeysDtos);
      const passphrase = pgpKeys.ada.passphrase;
      const entity = new ResourceEntity(resourceDto);
      const resourceTypeEntity = new ResourceTypeEntity(resourceTypeDto);
      await ResourceLocalStorage.addResource(entity);

      jest.spyOn(EncryptMessageService, "encrypt");
      jest.spyOn(resourceUpdateService.resourceModel, "serializePlaintextDto");
      jest.spyOn(resourceUpdateService, "update");
      jest
        .spyOn(resourceUpdateService.encryptMetadataKeysService.getOrFindMetadataKeysService, "getOrFindAll")
        .mockImplementation(() => metadataKeys);
      jest
        .spyOn(decryptMetadataService.getOrFindMetadataKeysService, "getOrFindAll")
        .mockImplementation(() => metadataKeys);
      let resourceUpdated, resourceLocalStorageExpected;
      jest
        .spyOn(resourceUpdateService.resourceService, "update")
        .mockImplementation((resourceIdToUpdate, resourceDtoToUpdate) => {
          resourceUpdated = resourceDtoToUpdate;
          const resourceEntity = new ResourceEntity(resourceDto);
          resourceEntity.secrets = new ResourceSecretsCollection([resourceDtoToUpdate.secrets[0]]);
          resourceEntity.metadataKeyId = resourceDtoToUpdate.metadata_key_id;
          resourceEntity.metadataKeyType = resourceDtoToUpdate.metadata_key_type;
          resourceLocalStorageExpected = resourceEntity.toDto(ResourceLocalStorage.DEFAULT_CONTAIN);
          resourceEntity.metadata = resourceDtoToUpdate.metadata;
          return resourceEntity.toDto(ResourceLocalStorage.DEFAULT_CONTAIN);
        });
      jest.spyOn(ResourceLocalStorage, "updateResource");

      await resourceUpdateService.exec(resourceDto, plaintextDto, passphrase);

      // Get secrets from the resource updated sent to the API
      const secretAda = resourceUpdated.secrets[0];
      const secretAdaDecrypted = await decryptSecret(
        secretAda.data,
        account.userPrivateArmoredKey,
        passphrase,
        resourceUpdated.resource_type_id,
      );
      const secretAdmin = resourceUpdated.secrets[1];
      const secretAdminDecrypted = await decryptSecret(
        secretAdmin.data,
        pgpKeys.admin.private,
        pgpKeys.admin.passphrase,
        resourceUpdated.resource_type_id,
      );
      const secretBetty = resourceUpdated.secrets[2];
      const secretBettyDecrypted = await decryptSecret(
        secretBetty.data,
        pgpKeys.betty.private,
        pgpKeys.betty.passphrase,
        resourceUpdated.resource_type_id,
      );
      // Decrypt metadata
      const resourceEntityUpdated = new ResourceEntity(resourceUpdated);
      expect(resourceEntityUpdated.isMetadataDecrypted()).toBeFalsy();
      expect(resourceUpdateService.update).toHaveBeenCalledWith(
        expect.objectContaining(resourceEntityUpdated),
        resourceTypeEntity,
        entity.metadata,
      );
      await decryptMetadataService.decryptOneWithSharedKey(resourceEntityUpdated);

      expect(resourceUpdated.secrets.length).toEqual(3);
      expect(secretAda.user_id).toEqual(account.userId);
      expect(JSON.parse(secretAdaDecrypted)).toEqual(plaintextDto);
      expect(secretAdmin.user_id).toEqual(pgpKeys.admin.userId);
      expect(JSON.parse(secretAdminDecrypted)).toEqual(plaintextDto);
      expect(secretBetty.user_id).toEqual(pgpKeys.betty.userId);
      expect(JSON.parse(secretBettyDecrypted)).toEqual(plaintextDto);
      expect(resourceEntityUpdated.metadata).toEqual(entity.metadata);
      expect(resourceUpdateService.resourceModel.serializePlaintextDto).toHaveBeenCalledTimes(1);
      expect(resourceUpdateService.resourceModel.serializePlaintextDto).toHaveBeenCalledWith(
        entity.resourceTypeId,
        plaintextDto,
      );
      expect(EncryptMessageService.encrypt).toHaveBeenCalledTimes(4);
      expect(resourceUpdateService.update).toHaveBeenCalledTimes(1);
      expect(resourceUpdateService.resourceService.update).toHaveBeenCalledWith(
        entity.id,
        resourceUpdated,
        ResourceLocalStorage.DEFAULT_CONTAIN,
      );
      expect(ResourceLocalStorage.updateResource).toHaveBeenCalledWith(
        new ResourceEntity(resourceLocalStorageExpected),
      );
    });

    it("Should Update the resource with encrypted secrets (v5 password string) and dto", async () => {
      expect.assertions(16);

      const resourceDto = defaultResourceDto({ resource_type_id: TEST_RESOURCE_TYPE_V5_PASSWORD_STRING });
      const resourceTypeDto = resourceTypeV5PasswordStringDto();
      const plaintextDto = plaintextSecretPasswordStringDto().password;
      const metadataKeysDtos = defaultDecryptedSharedMetadataKeysDtos({ armored_key: pgpKeys.metadataKey.public });
      const decryptMetadataService = new DecryptMetadataService(apiClientOptions, account);
      const metadataKeys = new MetadataKeysCollection(metadataKeysDtos);
      const passphrase = pgpKeys.ada.passphrase;
      const entity = new ResourceEntity(resourceDto);
      const resourceTypeEntity = new ResourceTypeEntity(resourceTypeDto);
      await ResourceLocalStorage.addResource(entity);

      jest.spyOn(EncryptMessageService, "encrypt");
      jest.spyOn(resourceUpdateService.resourceModel, "serializePlaintextDto");
      jest.spyOn(resourceUpdateService, "update");
      jest
        .spyOn(resourceUpdateService.encryptMetadataKeysService.getOrFindMetadataKeysService, "getOrFindAll")
        .mockImplementation(() => metadataKeys);
      jest
        .spyOn(decryptMetadataService.getOrFindMetadataKeysService, "getOrFindAll")
        .mockImplementation(() => metadataKeys);
      let resourceUpdated, resourceLocalStorageExpected;
      jest
        .spyOn(resourceUpdateService.resourceService, "update")
        .mockImplementation((resourceIdToUpdate, resourceDtoToUpdate) => {
          resourceUpdated = resourceDtoToUpdate;
          const resourceEntity = new ResourceEntity(resourceDto);
          resourceEntity.secrets = new ResourceSecretsCollection([resourceDtoToUpdate.secrets[0]]);
          resourceEntity.metadataKeyId = resourceDtoToUpdate.metadata_key_id;
          resourceEntity.metadataKeyType = resourceDtoToUpdate.metadata_key_type;
          resourceLocalStorageExpected = resourceEntity.toDto(ResourceLocalStorage.DEFAULT_CONTAIN);
          resourceEntity.metadata = resourceDtoToUpdate.metadata;
          return resourceEntity.toDto(ResourceLocalStorage.DEFAULT_CONTAIN);
        });
      jest.spyOn(ResourceLocalStorage, "updateResource");

      await resourceUpdateService.exec(resourceDto, plaintextDto, passphrase);

      // Get secrets from the resource updated sent to the API
      const secretAda = resourceUpdated.secrets[0];
      const secretAdaDecrypted = await decryptSecret(
        secretAda.data,
        account.userPrivateArmoredKey,
        passphrase,
        resourceUpdated.resource_type_id,
      );
      const secretAdmin = resourceUpdated.secrets[1];
      const secretAdminDecrypted = await decryptSecret(
        secretAdmin.data,
        pgpKeys.admin.private,
        pgpKeys.admin.passphrase,
        resourceUpdated.resource_type_id,
      );
      const secretBetty = resourceUpdated.secrets[2];
      const secretBettyDecrypted = await decryptSecret(
        secretBetty.data,
        pgpKeys.betty.private,
        pgpKeys.betty.passphrase,
        resourceUpdated.resource_type_id,
      );
      // Decrypt metadata
      const resourceEntityUpdated = new ResourceEntity(resourceUpdated);
      expect(resourceEntityUpdated.isMetadataDecrypted()).toBeFalsy();
      expect(resourceUpdateService.update).toHaveBeenCalledWith(
        expect.objectContaining(resourceEntityUpdated),
        resourceTypeEntity,
        entity.metadata,
      );
      await decryptMetadataService.decryptOneWithSharedKey(resourceEntityUpdated);

      expect(resourceUpdated.secrets.length).toEqual(3);
      expect(secretAda.user_id).toEqual(account.userId);
      expect(secretAdaDecrypted).toEqual(plaintextDto);
      expect(secretAdmin.user_id).toEqual(pgpKeys.admin.userId);
      expect(secretAdminDecrypted).toEqual(plaintextDto);
      expect(secretBetty.user_id).toEqual(pgpKeys.betty.userId);
      expect(secretBettyDecrypted).toEqual(plaintextDto);
      expect(resourceEntityUpdated.metadata).toEqual(entity.metadata);
      expect(resourceUpdateService.resourceModel.serializePlaintextDto).toHaveBeenCalledTimes(1);
      expect(resourceUpdateService.resourceModel.serializePlaintextDto).toHaveBeenCalledWith(
        entity.resourceTypeId,
        plaintextDto,
      );
      expect(EncryptMessageService.encrypt).toHaveBeenCalledTimes(4);
      expect(resourceUpdateService.update).toHaveBeenCalledTimes(1);
      expect(resourceUpdateService.resourceService.update).toHaveBeenCalledWith(
        entity.id,
        resourceUpdated,
        ResourceLocalStorage.DEFAULT_CONTAIN,
      );
      expect(ResourceLocalStorage.updateResource).toHaveBeenCalledWith(
        new ResourceEntity(resourceLocalStorageExpected),
      );
    });

    it("Should Update the resource without secret", async () => {
      expect.assertions(2);

      const resourceDto = defaultResourceDto();
      const entity = new ResourceEntity(resourceDto);
      await ResourceLocalStorage.addResource(entity);

      let resourceLocalStorageExpected;
      jest.spyOn(resourceUpdateService.resourceService, "update").mockImplementation(() => {
        const resourceEntity = new ResourceEntity(resourceDto);
        resourceLocalStorageExpected = resourceEntity.toV4Dto(ResourceLocalStorage.DEFAULT_CONTAIN);
        return resourceLocalStorageExpected;
      });
      jest.spyOn(ResourceLocalStorage, "updateResource");

      await resourceUpdateService.exec(resourceDto, null, pgpKeys.ada.passphrase);

      expect(resourceUpdateService.resourceService.update).toHaveBeenCalledWith(
        entity.id,
        entity.toV4Dto({ secrets: true }),
        ResourceLocalStorage.DEFAULT_CONTAIN,
      );
      expect(ResourceLocalStorage.updateResource).toHaveBeenCalledWith(
        new ResourceEntity(resourceLocalStorageExpected),
      );
    });

    it("Should fail to updating the resource if one user have key expired", async () => {
      expect.assertions(1);

      const resourceDto = defaultResourceDto();
      const plaintextDto = { password: "secret", description: "description" };
      jest
        .spyOn(resourceUpdateService.keyring, "findPublic")
        .mockImplementationOnce(() => ({ armoredKey: pgpKeys.expired.public }));

      try {
        await resourceUpdateService.exec(resourceDto, plaintextDto, pgpKeys.ada.passphrase);
      } catch (error) {
        expect(error.message).toEqual("Error encrypting message: Primary key is expired");
      }
    });

    it("Should set personal to false when resource has 1 user but is shared with groups", async () => {
      expect.assertions(1);

      const resourceDto = defaultResourceDto();
      const entity = new ResourceEntity(resourceDto);
      await ResourceLocalStorage.addResource(entity);

      const groupPermission = ownerGroupPermissionDto({
        aco_foreign_key: resourceDto.id,
      });
      jest
        .spyOn(resourceUpdateService.userModel, "findAllIdsForResourceUpdate")
        .mockImplementationOnce(() => [pgpKeys.ada.userId]);
      jest.spyOn(PermissionService.prototype, "findAllByAcoForeignKey").mockImplementationOnce(() => [groupPermission]);

      let resourceUpdated;
      jest
        .spyOn(resourceUpdateService.resourceService, "update")
        .mockImplementation((resourceIdToUpdate, resourceDtoToUpdate) => {
          resourceUpdated = resourceDtoToUpdate;
          const resourceEntity = new ResourceEntity(resourceDto);
          return resourceEntity.toV4Dto(ResourceLocalStorage.DEFAULT_CONTAIN);
        });

      await resourceUpdateService.exec(resourceDto, null, pgpKeys.ada.passphrase);

      expect(resourceUpdated.personal).toBe(false);
    });
  });

  describe("ResourceUpdateService::updateOfflineStorage", () => {
    /**
     * Build a v5 (encrypted metadata) resource carrying an offline association and a secret.
     * @returns {ResourceEntity}
     */
    const buildOfflineResource = () => {
      const dto = resourceMetadataEncryptedDto({}, { withOffline: true });
      const secretDto = readSecret({ resource_id: dto.id });
      return new ResourceEntity({ ...dto, secrets: [secretDto] });
    };

    it("does not refresh the offline storage when the resource is not cached offline", async () => {
      expect.assertions(1);
      const resourceTypeEntity = new ResourceTypeEntity(resourceTypePasswordAndDescriptionDto());
      const resourceDto = defaultResourceDto();
      const resourceEntity = new ResourceEntity({
        ...resourceDto,
        secrets: [readSecret({ resource_id: resourceDto.id })],
      });
      const metadataDecrypted = resourceEntity.metadata;

      jest
        .spyOn(resourceUpdateService.resourceService, "update")
        .mockImplementation(() =>
          new ResourceEntity(defaultResourceDto({ id: resourceDto.id })).toV4Dto(ResourceLocalStorage.DEFAULT_CONTAIN),
        );
      const offlineSpy = jest.spyOn(resourceUpdateService, "updateOfflineStorage").mockResolvedValue();
      jest.spyOn(ResourceLocalStorage, "updateResource").mockResolvedValue();

      await resourceUpdateService.update(resourceEntity, resourceTypeEntity, metadataDecrypted);

      expect(offlineSpy).not.toHaveBeenCalled();
    });

    it("updates the offline resource even when the entity carries no offline association", async () => {
      expect.assertions(3);
      const dto = resourceMetadataEncryptedDto();
      const entity = new ResourceEntity({ ...dto, secrets: [readSecret({ resource_id: dto.id })] });
      expect(entity.hasOfflineAccess()).toBe(false);
      const updateResourceSpy = jest
        .spyOn(resourceUpdateService.offlineResourcesOPFSStorage, "updateResource")
        .mockResolvedValue();
      const updateSecretSpy = jest
        .spyOn(resourceUpdateService.offlineSecretsOPFSStorage, "updateSecret")
        .mockResolvedValue();

      await resourceUpdateService.updateOfflineStorage(entity, true);

      expect(updateResourceSpy).toHaveBeenCalledWith(entity);
      expect(updateSecretSpy).toHaveBeenCalledWith(entity.secret);
    });

    it("does not touch the OPFS storage for a v4 resource even when it is tagged offline", async () => {
      expect.assertions(3);
      // v4 resources are normalized to decrypted metadata, which the OPFS store rejects.
      const entity = new ResourceEntity(defaultResourceDto({}, { withOffline: true }));
      expect(entity.isMetadataDecrypted()).toBe(true);
      const updateResourceSpy = jest
        .spyOn(resourceUpdateService.offlineResourcesOPFSStorage, "updateResource")
        .mockResolvedValue();
      const updateSecretSpy = jest
        .spyOn(resourceUpdateService.offlineSecretsOPFSStorage, "updateSecret")
        .mockResolvedValue();

      await resourceUpdateService.updateOfflineStorage(entity, true);

      expect(updateResourceSpy).not.toHaveBeenCalled();
      expect(updateSecretSpy).not.toHaveBeenCalled();
    });

    it("updates the offline resource but leaves the secret store untouched when the secret was not updated", async () => {
      expect.assertions(2);
      const entity = buildOfflineResource();
      const updateResourceSpy = jest
        .spyOn(resourceUpdateService.offlineResourcesOPFSStorage, "updateResource")
        .mockResolvedValue();
      const updateSecretSpy = jest
        .spyOn(resourceUpdateService.offlineSecretsOPFSStorage, "updateSecret")
        .mockResolvedValue();

      await resourceUpdateService.updateOfflineStorage(entity, false);

      expect(updateResourceSpy).toHaveBeenCalledWith(entity);
      expect(updateSecretSpy).not.toHaveBeenCalled();
    });

    it("updates the offline resource and secret when the secret was updated", async () => {
      expect.assertions(2);
      const entity = buildOfflineResource();
      const updateResourceSpy = jest
        .spyOn(resourceUpdateService.offlineResourcesOPFSStorage, "updateResource")
        .mockResolvedValue();
      const updateSecretSpy = jest
        .spyOn(resourceUpdateService.offlineSecretsOPFSStorage, "updateSecret")
        .mockResolvedValue();

      await resourceUpdateService.updateOfflineStorage(entity, true);

      expect(updateResourceSpy).toHaveBeenCalledWith(entity);
      expect(updateSecretSpy).toHaveBeenCalledWith(entity.secret);
    });
  });

  describe("ResourceUpdateService::update - offline storage wiring", () => {
    it("refreshes the offline storage flagging the secret as updated, before the metadata is decrypted", async () => {
      expect.assertions(5);
      const resourceTypeEntity = new ResourceTypeEntity(resourceTypePasswordAndDescriptionDto());
      const resourceDto = defaultResourceDto({}, { withOffline: true });
      // A secret is set (via the constructor so it validates), so `data` carries secrets and the
      // update counts as a secret update.
      const resourceEntity = new ResourceEntity({
        ...resourceDto,
        secrets: [readSecret({ resource_id: resourceDto.id })],
      });
      const metadataDecrypted = resourceEntity.metadata;

      jest
        .spyOn(resourceUpdateService.resourceService, "update")
        .mockImplementation(() =>
          new ResourceEntity(defaultResourceDto({ id: resourceDto.id })).toV4Dto(ResourceLocalStorage.DEFAULT_CONTAIN),
        );
      const offlineSpy = jest.spyOn(resourceUpdateService, "updateOfflineStorage").mockResolvedValue();
      jest.spyOn(ResourceLocalStorage, "updateResource").mockResolvedValue();

      await resourceUpdateService.update(resourceEntity, resourceTypeEntity, metadataDecrypted);

      expect(offlineSpy).toHaveBeenCalledTimes(1);
      const [passedEntity, secretUpdated] = offlineSpy.mock.calls[0];
      expect(passedEntity).toBeInstanceOf(ResourceEntity);
      expect(secretUpdated).toBe(true);

      // carries the offline associations that is not returned by the API on update to OPFS
      expect(passedEntity.hasOfflineAccess()).toBe(true);
      expect(passedEntity.offline.toDto()).toEqual(resourceEntity.offline.toDto());
    });
  });
});
