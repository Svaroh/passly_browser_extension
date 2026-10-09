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
import MetadataKeysSessionStorage from "../session_storage/metadataKeysSessionStorage";
import MetadataKeysCollection from "passbolt-styleguide/src/shared/models/entity/metadata/metadataKeysCollection";
import DecryptMetadataPrivateKeysService from "./decryptMetadataPrivateKeysService";
import MetadataKeyOPFSStorage from "../opfsStorage/metadataKeyOPFSStorage";

const FIND_AND_UPDATE_METADATA_KEYS_SS_FROM_OPFS_LOCK_PREFIX = "FIND_AND_UPDATE_METADATA_KEYS_SS_FROM_OPFS_LOCK-";

/**
 * Offline counterpart of FindAndUpdateMetadataKeysSessionStorageService.
 * The service aims to read the metadata keys from the OPFS storage, decrypt them and store them in the session storage.
 */
export default class FindAndUpdateMetadataKeysSessionStorageFromOPFSService {
  /**
   * @constructor
   * @param {AccountEntity} account The user account
   */
  constructor(account) {
    this.account = account;
    this.metadataKeyOPFSStorage = new MetadataKeyOPFSStorage(account);
    this.decryptMetadataPrivateKeysService = new DecryptMetadataPrivateKeysService(account);
    this.metadataKeysSessionStorage = new MetadataKeysSessionStorage(account);
  }

  /**
   * Retrieve the metadata keys from the OPFS storage and store them in the session storage.
   * @param {string|null} [passphrase = null] The passphrase to use to decrypt the metadata. Marked as optional as it
   * might be available in the passphrase session storage.
   * @returns {Promise<MetadataKeysCollection>}
   * @throws {UserPassphraseRequiredError} If the `passphrase` is not given and cannot be retrieved from the session storage.
   */
  async findAndUpdateAll(passphrase = null) {
    const lockKey = `${FIND_AND_UPDATE_METADATA_KEYS_SS_FROM_OPFS_LOCK_PREFIX}${this.account.id}`;

    // If no update is in progress, refresh the session storage.
    return await navigator.locks.request(lockKey, { ifAvailable: true }, async (lock) => {
      // Lock not granted, an update is already in progress. Wait for its completion and return the value of the session storage.
      if (!lock) {
        return await navigator.locks.request(
          lockKey,
          { mode: "shared" },
          async () => new MetadataKeysCollection(await this.metadataKeysSessionStorage.get()),
        );
      }

      // Lock is granted, read the metadata keys from the OPFS storage and update the session storage.
      const metadataKeys = new MetadataKeysCollection(await this.metadataKeyOPFSStorage.get());
      await this.decryptMetadataPrivateKeysService.decryptAllFromMetadataKeysCollection(metadataKeys, passphrase);
      await this.metadataKeysSessionStorage.set(metadataKeys);
      return metadataKeys;
    });
  }
}
