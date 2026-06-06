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
 * @since         5.12.94
 */

import ResourceMetadataEntity from "passbolt-styleguide/src/shared/models/entity/resource/metadata/resourceMetadataEntity";
import BuildApiClientOptionsService from "../../../../all/background_page/service/account/buildApiClientOptionsService";
import DecryptAndParseResourceSecretService from "../../../../all/background_page/service/secret/decryptAndParseResourceSecretService";
import FindAndUpdateResourcesLocalStorage from "../../../../all/background_page/service/resource/findAndUpdateResourcesLocalStorageService";
import FindSecretService from "../../../../all/background_page/service/secret/findSecretService";
import GetActiveAccountService from "../../../../all/background_page/service/account/getActiveAccountService";
import GetDecryptedUserPrivateKeyService from "../../../../all/background_page/service/account/getDecryptedUserPrivateKeyService";
import GetPassphraseService from "../../../../all/background_page/service/passphrase/getPassphraseService";
import ResourceCreateService from "../../../../all/background_page/service/resource/create/resourceCreateService";
import ResourceLocalStorage from "../../../../all/background_page/service/local_storage/resourceLocalStorage";
import ResourceTypeModel from "../../../../all/background_page/model/resourceType/resourceTypeModel";
import PassphraseStorageService from "../../../../all/background_page/service/session_storage/passphraseStorageService";
import { PASSKEY_RESOURCE_TYPE_SLUG } from "../../../../all/passkey/passkeyProviderConstants";
import PasskeyWebauthnService from "./passkeyWebauthnService";

const RESOURCE_NAME_MAX_LENGTH = 255;
const RESOURCE_USERNAME_MAX_LENGTH = 255;
const RESOURCE_URI_MAX_LENGTH = 1024;

const NOOP_PROGRESS_SERVICE = {
  updateGoals: () => {},
  finishStep: async () => {},
};

class PasskeyVaultResourceService {
  /**
   * Store a generated passkey secret as an encrypted Passly resource.
   * @param {object|string} requestDetails WebAuthn create request details.
   * @param {object} secretDto Plaintext v5-passkey secret DTO.
   * @returns {Promise<ResourceEntity>}
   */
  static async createResourceForPasskey(requestDetails, secretDto) {
    const context = await this.getContext();
    const passphrase = await this.requestUserPassphrase(context.account);
    const resourceType = await this.getPasskeyResourceType(context.resourceTypeModel);
    const resourceDto = this.buildResourceDto(requestDetails, secretDto, resourceType);
    const resourceCreateService = new ResourceCreateService(
      context.account,
      context.apiClientOptions,
      NOOP_PROGRESS_SERVICE,
    );

    return resourceCreateService.create(resourceDto, secretDto, passphrase);
  }

  /**
   * Find and decrypt the best matching passkey secret for a WebAuthn get request.
   * @param {object|string} requestDetails WebAuthn get request details.
   * @returns {Promise<object>}
   */
  static async findSecretForAssertion(requestDetails) {
    const context = await this.getContext();
    const passphrase = await this.requestUserPassphrase(context.account);
    const resourceType = await this.getPasskeyResourceType(context.resourceTypeModel);
    const resources = await this.getPasskeyResources(context, resourceType, passphrase);
    const options = PasskeyWebauthnService.parseRequestDetails(requestDetails);
    const origin = PasskeyWebauthnService.getOrigin(options);
    const rpId = PasskeyWebauthnService.getRequestRpId(options, origin);
    const decryptedPrivateKey = await GetDecryptedUserPrivateKeyService.getKey(passphrase);
    const findSecretService = new FindSecretService(context.account, context.apiClientOptions);

    for (const resourceDto of resources) {
      const secretDto = await this.tryDecryptPasskeySecret(
        resourceDto,
        resourceType.definition.secret,
        decryptedPrivateKey,
        findSecretService,
      );

      if (
        secretDto?.rp_id === rpId &&
        PasskeyWebauthnService.isCredentialAllowed(options.allowCredentials, secretDto.credential_id)
      ) {
        return secretDto;
      }
    }

    throw PasskeyWebauthnService.buildNotAllowedError("No Passly passkey matches this WebAuthn request.");
  }

  /**
   * @param {object|string} requestDetails
   * @param {object} secretDto
   * @param {ResourceTypeEntity} resourceType
   * @returns {object}
   */
  static buildResourceDto(requestDetails, secretDto, resourceType) {
    const options = PasskeyWebauthnService.parseRequestDetails(requestDetails);
    const origin = PasskeyWebauthnService.getOrigin(options);
    const rpName = options.rp?.name || secretDto.rp_id;

    return {
      resource_type_id: resourceType.id,
      folder_parent_id: null,
      metadata: {
        object_type: ResourceMetadataEntity.METADATA_OBJECT_TYPE,
        resource_type_id: resourceType.id,
        name: this.truncate(`${rpName} passkey`, RESOURCE_NAME_MAX_LENGTH),
        username: this.truncate(secretDto.user_name || null, RESOURCE_USERNAME_MAX_LENGTH),
        uris: [this.truncate(origin, RESOURCE_URI_MAX_LENGTH)],
        description: null,
      },
    };
  }

  /**
   * @returns {Promise<{account: AccountEntity, apiClientOptions: ApiClientOptions, resourceTypeModel: ResourceTypeModel}>}
   */
  static async getContext() {
    const account = await GetActiveAccountService.get();
    const apiClientOptions = BuildApiClientOptionsService.buildFromAccount(account);
    return {
      account,
      apiClientOptions,
      resourceTypeModel: new ResourceTypeModel(apiClientOptions),
    };
  }

  /**
   * @returns {Promise<string>}
   */
  static async requestUserPassphrase(account = null) {
    const passphrase = await PassphraseStorageService.get();
    if (passphrase) {
      return passphrase;
    }

    try {
      const activeAccount = account || (await GetActiveAccountService.get());
      return await new GetPassphraseService(activeAccount).requestPassphraseFromQuickAccess({
        force: true,
        attachedOnly: true,
      });
    } catch (error) {
      throw PasskeyWebauthnService.buildNotAllowedError(
        error?.message || "Unlock Passly before using the passkey provider.",
      );
    }
  }

  /**
   * @param {ResourceTypeModel} resourceTypeModel
   * @returns {Promise<ResourceTypeEntity>}
   */
  static async getPasskeyResourceType(resourceTypeModel) {
    let resourceTypes = await resourceTypeModel.getOrFindAll();
    let resourceType = resourceTypes.getFirstBySlug(PASSKEY_RESOURCE_TYPE_SLUG);
    if (!resourceType) {
      resourceTypes = await resourceTypeModel.updateLocalStorage();
      resourceType = resourceTypes.getFirstBySlug(PASSKEY_RESOURCE_TYPE_SLUG);
    }
    if (!resourceType) {
      throw PasskeyWebauthnService.buildNotSupportedError(
        "The Passly API does not expose the v5-passkey resource type.",
      );
    }

    return resourceType;
  }

  /**
   * @param {object} context
   * @param {ResourceTypeEntity} resourceType
   * @param {string} passphrase
   * @returns {Promise<Array<object>>}
   */
  static async getPasskeyResources(context, resourceType, passphrase) {
    let resources = await ResourceLocalStorage.get();
    if (!resources) {
      const updater = new FindAndUpdateResourcesLocalStorage(context.account, context.apiClientOptions);
      const resourcesCollection = await updater.findAndUpdateAll({}, passphrase);
      resources = resourcesCollection.toDto();
    }

    return (resources || []).filter((resourceDto) => resourceDto.resource_type_id === resourceType.id);
  }

  /**
   * @param {object} resourceDto
   * @param {object} secretSchema
   * @param {openpgp.PrivateKey} decryptedPrivateKey
   * @param {FindSecretService} findSecretService
   * @returns {Promise<object|null>}
   */
  static async tryDecryptPasskeySecret(resourceDto, secretSchema, decryptedPrivateKey, findSecretService) {
    try {
      const secret = await findSecretService.findByResourceId(resourceDto.id);
      const plaintext = await DecryptAndParseResourceSecretService.decryptAndParse(
        secret,
        secretSchema,
        decryptedPrivateKey,
      );
      return plaintext.toDto();
    } catch (error) {
      console.warn("Unable to decrypt Passly passkey resource.", error);
      return null;
    }
  }

  /**
   * @param {string|null} value
   * @param {number} maxLength
   * @returns {string|null}
   */
  static truncate(value, maxLength) {
    if (value === null || typeof value === "undefined") {
      return null;
    }

    return String(value).slice(0, maxLength);
  }
}

export { PASSKEY_RESOURCE_TYPE_SLUG };
export default PasskeyVaultResourceService;
