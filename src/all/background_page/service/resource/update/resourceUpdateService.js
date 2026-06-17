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

import ResourceEntity from "../../../model/entity/resource/resourceEntity";
import ResourceService from "../../api/resource/resourceService";
import ResourceLocalStorage from "../../local_storage/resourceLocalStorage";
import i18n from "../../../sdk/i18n";
import ResourceModel from "../../../model/resource/resourceModel";
import DecryptPrivateKeyService from "../../crypto/decryptPrivateKeyService";
import UserModel from "../../../model/user/userModel";
import Keyring from "../../../model/keyring";
import { OpenpgpAssertion } from "../../../utils/openpgp/openpgpAssertions";
import EncryptMessageService from "../../crypto/encryptMessageService";
import ResourceSecretsCollection from "../../../model/entity/secret/resource/resourceSecretsCollection";
import EncryptMetadataKeysService from "../../metadata/encryptMetadataService";
import FindPermissionsService from "../../permission/findPermissionsService";
import GetOrFindResourceTypesService from "../../resourceType/getOrFindResourceTypesService";
import OfflineResourcesOPFSStorage from "../../opfsStorage/offlineResourcesOPFSStorage";
import OfflineSecretsOPFSStorage from "../../opfsStorage/offlineSecretsOPFSStorage";
import PermissionChangesCollection from "../../../model/entity/permission/change/permissionChangesCollection";
import ShareResourceService, { PROGRESS_STEPS_SHARE_RESOURCES_SHARE_ALL } from "../../share/shareResourceService";

/**
 * Total main steps to update a resource (without updating permissions)
 *  - Encrypting Metadata
 *  - Encrypting Secret
 *  - Saving resource
 */
const PROGRESS_STEPS_UPDATE_RESOURCES_V4 = 2;
const PROGRESS_STEPS_UPDATE_RESOURCES_V5 = 3;

class ResourceUpdateService {
  /**
   *
   * @param {AccountEntity} account The user account
   * @param {ApiClientOptions} apiClientOptions The api client options
   * @param {ProgressService} progressService The progress service
   */
  constructor(account, apiClientOptions, progressService) {
    this.account = account;
    this.resourceService = new ResourceService(apiClientOptions);
    this.getOrFindResourcetypesService = new GetOrFindResourceTypesService(account, apiClientOptions);
    this.progressService = progressService;
    this.findPermissionsService = new FindPermissionsService(account, apiClientOptions);
    this.resourceModel = new ResourceModel(apiClientOptions, account);
    this.encryptMetadataKeysService = new EncryptMetadataKeysService(apiClientOptions, this.account);
    this.userModel = new UserModel(apiClientOptions);
    this.keyring = new Keyring();
    this.offlineResourcesOPFSStorage = new OfflineResourcesOPFSStorage(account);
    this.offlineSecretsOPFSStorage = new OfflineSecretsOPFSStorage(account);
    this.shareResourceService = new ShareResourceService(apiClientOptions, account, progressService);
  }

  /**
   * Update a resource.
   *
   * @param {object} resourceDto The resource data
   * @param {string|object|null} plaintextDto The secret to encrypt, or null to keep the existing secret
   * @param {string} passphrase The user passphrase
   * @param {Array<object>} [permissionChanges] Optional permission changes applied after the update.
   * @return {Promise<ResourceEntity>} resourceEntity
   */
  async exec(resourceDto, plaintextDto, passphrase, permissionChanges) {
    const resourceEntity = new ResourceEntity(resourceDto);
    permissionChanges = permissionChanges ?? [];

    const resourceTypesCollection = await this.getOrFindResourcetypesService.getOrFindAll();
    const resourceTypeEntity = resourceTypesCollection.getFirstById(resourceEntity.resourceTypeId);

    const isResourceTypeV5 = resourceTypeEntity.isV5();

    const shouldUpdatePermission = permissionChanges.length > 0;
    let progressStepCount = isResourceTypeV5 ? PROGRESS_STEPS_UPDATE_RESOURCES_V5 : PROGRESS_STEPS_UPDATE_RESOURCES_V4;

    if (shouldUpdatePermission) {
      progressStepCount += PROGRESS_STEPS_SHARE_RESOURCES_SHARE_ALL;
    }

    this.progressService.updateGoals(progressStepCount);

    // Apply the operator-confirmed permission changes (re-share) in the spec-mandated safe order.
    if (shouldUpdatePermission) {
      // The styleguide emits deltas with aco_foreign_key unset (or null); stamp the resource id
      // before handing them to the share orchestration.
      const stampedChanges = permissionChanges.map((change) => ({
        ...change,
        aco_foreign_key: resourceEntity.id,
      }));
      await this.shareResourceService.shareAll(
        [resourceEntity.id],
        new PermissionChangesCollection(stampedChanges),
        passphrase,
      );
    }

    // Get users ids of those who have access to the resource
    const usersIds = await this.userModel.findAllIdsForResourceUpdate(resourceEntity.id);

    // Keep metadata decrypted to update it in the local storage
    const metadataDecrypted = resourceEntity.metadata;
    if (isResourceTypeV5) {
      // Encrypt metadata
      await this.progressService.finishStep(i18n.t("Encrypting Metadata"), true);
      await this.encryptMetadataKeysService.encryptOneForForeignModel(resourceEntity, passphrase);
    }

    if (plaintextDto !== null) {
      // Update secret
      await this.updateSecret(resourceEntity, plaintextDto, passphrase, usersIds);
    }

    // Update resource
    return await this.update(resourceEntity, resourceTypeEntity, metadataDecrypted);
  }

  /**
   * Update associated secret
   *
   * @param {ResourceEntity} resourceEntity
   * @param {string|object} plaintextDto
   * @param {string} passphrase The user passphrase
   * @param {Array<string>} usersIds The users ids
   * @returns {Promise<Object>} updated resource
   */
  async updateSecret(resourceEntity, plaintextDto, passphrase, usersIds) {
    // Get the passphrase if needed and decrypt secret key
    const privateKey = await DecryptPrivateKeyService.decryptArmoredKey(this.account.userPrivateArmoredKey, passphrase);

    // Encrypt
    const plaintext = await this.resourceModel.serializePlaintextDto(resourceEntity.resourceTypeId, plaintextDto);
    resourceEntity.secrets = await this.encryptSecrets(plaintext, usersIds, privateKey);
  }

  /**
   * Update a resource using Passbolt API and add result to local storage
   *
   * @param {ResourceEntity} resourceEntity
   * @param {ResourceTypeEntity} resourceTypeEntity The resource type
   * @param {ResourceMetadataEntity} metadataDecrypted The metadata decrypted
   * @returns {Promise<ResourceEntity>}
   * @private
   */
  async update(resourceEntity, resourceTypeEntity, metadataDecrypted) {
    // Post data & wrap up
    await this.progressService.finishStep(i18n.t("Saving resource"), true);
    const data = resourceTypeEntity.isV5()
      ? resourceEntity.toDto({ secrets: true })
      : resourceEntity.toV4Dto({ secrets: true });
    const resourceDto = await this.resourceService.update(
      resourceEntity.id,
      data,
      ResourceLocalStorage.DEFAULT_CONTAIN,
    );

    const updatedResourceEntity = new ResourceEntity(resourceDto);
    // Refresh the offline storage: the OPFS store only accepts
    // resources whose metadata is still encrypted.
    await this.updateOfflineStorage(updatedResourceEntity, Boolean(data.secrets));

    // If resource v5, metadata will be returned encrypted, replace it with the original decrypted copy.
    if (!updatedResourceEntity.isMetadataDecrypted()) {
      updatedResourceEntity.metadata = metadataDecrypted;
    }
    await ResourceLocalStorage.updateResource(updatedResourceEntity);

    return updatedResourceEntity;
  }

  /**
   * Refresh the offline OPFS stores after a resource update.
   *
   * Offline caching is opt-in per resource and v5-only, so this is a no-op unless the updated
   * resource carries an offline association and still holds encrypted metadata.
   * v4 resources are normalized to decrypted metadata, which the OPFS store rejects, so they are
   * skipped here. It must run before the metadata is decrypted back for the local storage.
   *
   * @param {ResourceEntity} updatedResourceEntity The resource built from the update API response.
   * @param {boolean} secretUpdated Whether the secret was re-encrypted by this update.
   * @returns {Promise<void>}
   * @private
   */
  async updateOfflineStorage(updatedResourceEntity, secretUpdated) {
    // OPFS only caches v5 resources (encrypted metadata). A v4 resource is normalized to a decrypted
    // metadata shape the OPFS store rejects, so skip it even if it is tagged offline.
    if (!updatedResourceEntity.hasOfflineAccess() || updatedResourceEntity.isMetadataDecrypted()) {
      return;
    }
    await this.offlineResourcesOPFSStorage.updateResource(updatedResourceEntity);

    const secretEntity = updatedResourceEntity.secret;
    if (!secretUpdated || !secretEntity) {
      return;
    }
    await this.offlineSecretsOPFSStorage.updateSecret(secretEntity);
  }

  /**
   * Encrypt and sign plaintext data for the given users
   *
   * @param {string|Object} plaintextDto
   * @param {array} usersIds
   * @param {openpgp.PrivateKey} privateKey
   * @returns {Promise<ResourceSecretsCollection>}
   */
  async encryptSecrets(plaintextDto, usersIds, privateKey) {
    const secrets = [];
    await this.progressService.finishStep(i18n.t("Encrypting Secret"), true);
    for (let i = 0; i < usersIds.length; i++) {
      if (Object.prototype.hasOwnProperty.call(usersIds, i)) {
        const userId = usersIds[i];
        const userPublicArmoredKey = this.keyring.findPublic(userId).armoredKey;
        const userPublicKey = await OpenpgpAssertion.readKeyOrFail(userPublicArmoredKey);
        const data = await EncryptMessageService.encrypt(plaintextDto, userPublicKey, [privateKey]);
        secrets.push({ user_id: userId, data: data });
        await this.progressService.updateStepMessage(
          i18n.t("Encrypting secrets {{count}}/{{total}}", {
            count: i + 1,
            total: usersIds.length,
          }),
        );
      }
    }
    return new ResourceSecretsCollection(secrets);
  }
}

export default ResourceUpdateService;
