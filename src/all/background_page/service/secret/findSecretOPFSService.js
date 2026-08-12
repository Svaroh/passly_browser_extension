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
import SecretEntity from "passbolt-styleguide/src/shared/models/entity/secret/secretEntity";
import { assertUuid } from "../../utils/assertions";
import GetSecretSchemaResourceTypeService from "../resourceType/getSecretSchemaResourceTypeService";
import GetPassphraseService from "../passphrase/getPassphraseService";
import GetDecryptedUserPrivateKeyService from "../account/getDecryptedUserPrivateKeyService";
import ResourceLocalStorage from "../local_storage/resourceLocalStorage";
import ResourceEntity from "../../model/entity/resource/resourceEntity";
import OfflineSecretsOPFSStorage from "../opfsStorage/offlineSecretsOPFSStorage";
import DecryptAndParseResourceSecretService from "./decryptAndParseResourceSecretService";

/**
 * The service aims to find and decrypt a resource secret from the OPFS store for offline mode.
 */
class FindSecretOPFSService {
  /**
   * @constructor
   * @param {AccountEntity} account The user account
   * @param {ApiClientOptions} apiClientOptions The api client options
   * @param {Worker} worker The worker from which the request comes from, used to prompt the user passphrase
   * whenever it is not in the session storage.
   */
  constructor(account, apiClientOptions, worker) {
    this.account = account;
    this.worker = worker;
    this.getSecretSchemaResourceTypeService = new GetSecretSchemaResourceTypeService(account, apiClientOptions);
    this.getPassphraseService = new GetPassphraseService(account);
    this.offlineSecretsOPFSStorage = new OfflineSecretsOPFSStorage(account);
  }

  /**
   * Find a secret by its resource id in the OPFS store and return the decrypted secret.
   *
   * @param {string} resourceId The resource uuid
   * @returns {Promise<PlaintextEntity>}
   * @throws {Error} if the resource id is not a valid uuid
   * @throws {Error} if the secret cannot be found in the OPFS store
   * @throws {Error} if the resource cannot be found in the local storage
   * @throws {Error} if the secret cannot be decrypted or parsed
   */
  async findByResourceId(resourceId) {
    assertUuid(resourceId, "The resource id should be a valid UUID");

    const secretDto = await this.offlineSecretsOPFSStorage.getOfflineSecretByResourceId(resourceId);
    if (!secretDto) {
      throw new Error("The secret could not be found in the OPFS storage.");
    }
    const secret = new SecretEntity(secretDto);
    const resourceDto = await ResourceLocalStorage.getResourceById(resourceId);
    if (!resourceDto) {
      throw new Error("The resource could not be found in the local storage.");
    }
    const resource = new ResourceEntity(resourceDto);
    const secretSchema = await this.getSecretSchemaResourceTypeService.getByResourceTypeId(resource.resourceTypeId);

    const passphrase = await this.getPassphraseService.getPassphrase(this.worker);
    const decryptedPrivateKey = await GetDecryptedUserPrivateKeyService.getKey(passphrase);

    return DecryptAndParseResourceSecretService.decryptAndParse(secret, secretSchema, decryptedPrivateKey);
  }
}

export default FindSecretOPFSService;
