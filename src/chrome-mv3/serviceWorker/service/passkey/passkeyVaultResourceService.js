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
import SecretEntity from "passbolt-styleguide/src/shared/models/entity/secret/secretEntity";
import BuildApiClientOptionsService from "../../../../all/background_page/service/account/buildApiClientOptionsService";
import DecryptAndParseResourceSecretService from "../../../../all/background_page/service/secret/decryptAndParseResourceSecretService";
import FindAndUpdateResourcesLocalStorage from "../../../../all/background_page/service/resource/findAndUpdateResourcesLocalStorageService";
import FindSecretService from "../../../../all/background_page/service/secret/findSecretService";
import GetActiveAccountService from "../../../../all/background_page/service/account/getActiveAccountService";
import GetDecryptedUserPrivateKeyService from "../../../../all/background_page/service/account/getDecryptedUserPrivateKeyService";
import GetPassphraseService from "../../../../all/background_page/service/passphrase/getPassphraseService";
import ResourceCreateService from "../../../../all/background_page/service/resource/create/resourceCreateService";
import ResourceLocalStorage from "../../../../all/background_page/service/local_storage/resourceLocalStorage";
import GetOrFindResourceTypesService from "../../../../all/background_page/service/resourceType/getOrFindResourceTypesService";
import OfflineSecretsOPFSStorage from "../../../../all/background_page/service/opfsStorage/offlineSecretsOPFSStorage";
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
    const resourceType = await this.getPasskeyResourceType(context.getOrFindResourceTypesService);
    const resourceDto = this.buildResourceDto(requestDetails, secretDto, resourceType);
    const resourceCreateService = new ResourceCreateService(
      context.account,
      context.apiClientOptions,
      NOOP_PROGRESS_SERVICE,
    );

    const created = await resourceCreateService.create(resourceDto, secretDto, passphrase);

    try {
      const createdResourceDto = created?.toDto ? created.toDto() : created;
      createdResourceDto.secret = secretDto;
      await ResourceLocalStorage.updateResource(createdResourceDto);
    } catch (cacheError) {
      console.warn("Unable to cache created passkey secret locally.", cacheError);
    }

    try {
      if (created.secrets?.items?.[0]) {
        const offlineSecretsStorage = new OfflineSecretsOPFSStorage(context.account);
        await offlineSecretsStorage.addSecret(created.secrets.items[0]);
      }
    } catch (opfsError) {
      console.warn("Unable to persist passkey secret to OPFS storage.", opfsError);
    }

    return created;
  }

  /**
   * Find and decrypt the best matching passkey secret for a WebAuthn get request.
   * @param {object|string} requestDetails WebAuthn get request details.
   * @returns {Promise<object>}
   */
  static async findSecretForAssertion(requestDetails) {
    const context = await this.getContext();
    const passphrase = await this.requestUserPassphrase(context.account);
    const resourceType = await this.getPasskeyResourceType(context.getOrFindResourceTypesService);
    let resources = await this.getPasskeyResources(context, resourceType, passphrase);
    const options = PasskeyWebauthnService.parseRequestDetails(requestDetails);
    const origin = PasskeyWebauthnService.getOrigin(options);
    const rpId = PasskeyWebauthnService.getRequestRpId(options, origin);
    const decryptedPrivateKey = await GetDecryptedUserPrivateKeyService.getKey(passphrase);
    const findSecretService = new FindSecretService(context.account, context.apiClientOptions);

    const candidateDiagnostics = [];
    let candidateResources = resources.filter((resourceDto) =>
      this.isResourceCandidateForRp(resourceDto, rpId, origin),
    );
    let matchedSecret = await this.matchSecretInResources(
      candidateResources,
      resourceType,
      decryptedPrivateKey,
      findSecretService,
      options,
      rpId,
      origin,
      candidateDiagnostics,
      context.account,
    );

    if (matchedSecret) {
      return matchedSecret;
    }

    // Only refresh from API if there are NO local candidates for this RP (e.g. key added on another device)
    if (candidateResources.length === 0) {
      try {
        const updater = new FindAndUpdateResourcesLocalStorage(context.account, context.apiClientOptions);
        const refreshedResourcesCollection = await updater.findAndUpdateAll({}, passphrase);
        const refreshedResources = refreshedResourcesCollection?.toDto
          ? refreshedResourcesCollection.toDto()
          : await ResourceLocalStorage.get();
        resources = (refreshedResources || []).filter(
          (resourceDto) => resourceDto.resource_type_id === resourceType.id,
        );
        candidateResources = resources.filter((resourceDto) =>
          this.isResourceCandidateForRp(resourceDto, rpId, origin),
        );

        candidateDiagnostics.length = 0;
        matchedSecret = await this.matchSecretInResources(
          candidateResources,
          resourceType,
          decryptedPrivateKey,
          findSecretService,
          options,
          rpId,
          origin,
          candidateDiagnostics,
          context.account,
        );

        if (matchedSecret) {
          return matchedSecret;
        }
      } catch (refreshError) {
        console.warn("Unable to refresh passkey resources from Passly API.", refreshError);
      }
    }

    console.warn("[Passly Passkey] Assertion lookup failed.", {
      rpId,
      origin,
      allowCredentials: options.allowCredentials,
      candidatesCount: candidateResources.length,
      candidates: candidateDiagnostics,
    });

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
      getOrFindResourceTypesService: new GetOrFindResourceTypesService(account, apiClientOptions),
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
   * Iterate through resources and find the first matching decrypted passkey secret.
   * @param {Array<object>} resources
   * @param {ResourceTypeEntity} resourceType
   * @param {openpgp.PrivateKey} decryptedPrivateKey
   * @param {FindSecretService} findSecretService
   * @param {object} options
   * @param {string} rpId
   * @param {string} origin
   * @returns {Promise<object|null>}
   */
  static async matchSecretInResources(
    resources,
    resourceType,
    decryptedPrivateKey,
    findSecretService,
    options,
    rpId,
    origin,
    candidateDiagnostics = null,
    account = null,
  ) {
    for (const [index, resourceDto] of resources.entries()) {
      const secretDto = await this.tryDecryptPasskeySecret(
        resourceDto,
        resourceType.definition?.secret,
        decryptedPrivateKey,
        findSecretService,
        account,
      );

      if (!secretDto) {
        if (candidateDiagnostics) {
          candidateDiagnostics.push({
            index,
            id: resourceDto?.id,
            name: resourceDto?.metadata?.name || resourceDto?.name || null,
            decrypted: false,
          });
        }
        console.warn(`[Passly Passkey] Resource [${index}] ${resourceDto?.id}: unable to decrypt secret.`);
        continue;
      }

      const rpMatches = PasskeyWebauthnService.isRpIdMatching(secretDto.rp_id, rpId, origin, secretDto.origin);
      const credAllowed = PasskeyWebauthnService.isCredentialAllowed(options.allowCredentials, secretDto.credential_id);

      if (candidateDiagnostics) {
        candidateDiagnostics.push({
          index,
          id: resourceDto?.id,
          name: resourceDto?.metadata?.name || resourceDto?.name || null,
          storedRpId: secretDto.rp_id,
          storedOrigin: secretDto.origin || null,
          storedCredentialId: secretDto.credential_id,
          rpMatches,
          credAllowed,
        });
      }

      if (rpMatches && credAllowed) {
        return secretDto;
      }
    }

    return null;
  }

  /**
   * @param {object} resourceDto
   * @param {object} secretSchema
   * @param {openpgp.PrivateKey} decryptedPrivateKey
   * @param {FindSecretService} findSecretService
   * @param {AccountEntity|null} account
   * @returns {Promise<object|null>}
   */
  static async tryDecryptPasskeySecret(
    resourceDto,
    secretSchema,
    decryptedPrivateKey,
    findSecretService,
    account = null,
  ) {
    try {
      if (resourceDto?.secret && typeof resourceDto.secret === "object") {
        if (resourceDto.secret.credential_id && resourceDto.secret.private_key_pkcs8) {
          return resourceDto.secret;
        }
      }

      let secret = null;
      if (account) {
        try {
          const offlineSecretsStorage = new OfflineSecretsOPFSStorage(account);
          const offlineSecretDto = await offlineSecretsStorage.getOfflineSecretByResourceId(resourceDto.id);
          if (offlineSecretDto && offlineSecretDto.data) {
            secret = new SecretEntity(offlineSecretDto);
          }
        } catch {
          // OPFS storage unavailable, fallback to network
        }
      }

      if (!secret && findSecretService) {
        try {
          secret = await findSecretService.findByResourceId(resourceDto.id);
        } catch {
          // Network unavailable or offline
        }
      }

      if (!secret || !secret.data) {
        return null;
      }

      const plaintext = await DecryptAndParseResourceSecretService.decryptAndParse(
        secret,
        secretSchema,
        decryptedPrivateKey,
      );
      return plaintext.toDto();
    } catch (error) {
      console.warn(`[Passly Passkey] Unable to decrypt passkey resource ${resourceDto?.id}.`, error);
      return null;
    }
  }

  /**
   * Determine if a resource is a plausible candidate for the requested Relying Party
   * based on unencrypted metadata (URIs or name) without decrypting its secret.
   * @param {object} resourceDto
   * @param {string} rpId
   * @param {string} origin
   * @returns {boolean}
   */
  static isResourceCandidateForRp(resourceDto, rpId, origin) {
    const uris = resourceDto?.metadata?.uris || resourceDto?.uris;
    if (Array.isArray(uris) && uris.length > 0) {
      return uris.some((uri) => this.doesUriMatchRp(uri, rpId, origin));
    }

    if (resourceDto?.secret?.rp_id) {
      return PasskeyWebauthnService.isRpIdMatching(resourceDto.secret.rp_id, rpId, origin, resourceDto.secret.origin);
    }

    const name = resourceDto?.metadata?.name || resourceDto?.name || "";
    if (name && rpId && this.doesNameMatchRp(name, rpId)) {
      return true;
    }

    if (!uris && !name) {
      return true;
    }

    return false;
  }

  /**
   * @param {string} uri
   * @param {string} rpId
   * @param {string} origin
   * @returns {boolean}
   */
  static doesUriMatchRp(uri, rpId, origin) {
    if (!uri || typeof uri !== "string") {
      return false;
    }
    const cleanRpId = PasskeyWebauthnService.normalizeDomain(rpId);
    const cleanOrigin = PasskeyWebauthnService.normalizeDomain(origin);
    const cleanUri = PasskeyWebauthnService.normalizeDomain(uri);

    if (cleanRpId && PasskeyWebauthnService.isDomainRelated(cleanUri, cleanRpId)) {
      return true;
    }
    if (cleanOrigin && PasskeyWebauthnService.isDomainRelated(cleanUri, cleanOrigin)) {
      return true;
    }
    return false;
  }

  /**
   * @param {string} name
   * @param {string} rpId
   * @returns {boolean}
   */
  static doesNameMatchRp(name, rpId) {
    if (!name || !rpId) {
      return false;
    }
    const cleanRpId = PasskeyWebauthnService.normalizeDomain(rpId);
    if (!cleanRpId) {
      return false;
    }
    const lowerName = name.toLowerCase();
    const lowerRp = cleanRpId.toLowerCase();
    if (lowerName.includes(lowerRp)) {
      return true;
    }

    const strippedName = lowerName.replace(/[\s._-]+/g, "");
    const labels = lowerRp.split(".").filter((label) => label.length > 3);
    for (const label of labels) {
      if (lowerName.includes(label) || strippedName.includes(label)) {
        return true;
      }
    }

    const rpWithoutTld = lowerRp.includes(".") ? lowerRp.slice(0, lowerRp.lastIndexOf(".")) : lowerRp;
    const strippedRpNoTld = rpWithoutTld.replace(/[\s._-]+/g, "");
    if (strippedRpNoTld.length > 3 && strippedName.includes(strippedRpNoTld)) {
      return true;
    }

    return false;
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
