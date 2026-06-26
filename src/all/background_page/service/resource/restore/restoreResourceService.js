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
 * @since         6.0.1
 */
import ResourceService from "../../api/resource/resourceService";
import ResourceLocalStorage from "../../local_storage/resourceLocalStorage";
import ResourcesCollection from "../../../model/entity/resource/resourcesCollection";
import i18n from "../../../sdk/i18n";
import { assertArrayUUID } from "../../../utils/assertions";
import ExecuteConcurrentlyService from "../../execute/executeConcurrentlyService";
import DecryptMetadataService from "../../metadata/decryptMetadataService";

class RestoreResourceService {
  /**
   * Constructor
   * @param {AccountEntity} account The user account
   * @param {ApiClientOptions} apiClientOptions The api client options
   * @param {ProgressService} progressService
   */
  constructor(account, apiClientOptions, progressService) {
    this.account = account;
    this.resourceService = new ResourceService(apiClientOptions);
    this.progressService = progressService;
    this.decryptMetadataService = new DecryptMetadataService(apiClientOptions, account);
  }

  /**
   * Restore a bulk of resources
   * @param {Array<string>} resourceIds The resourceIds
   * @returns {Promise<Array<object>>}
   */
  async restoreResources(resourceIds) {
    assertArrayUUID(resourceIds);
    /**
     * 1. Restore the Resources
     * 2. Update the local storage
     */
    this.progressService.finishStep(i18n.t("Restoring Resource(s)"), true);
    let restoreCounter = 0;
    const restoredResources = [];
    const restoreCallBacks = async (resourceId) => {
      this.progressService.updateStepMessage(
        i18n.t("Restoring resource(s) {{counter}}/{{total}}", {
          counter: ++restoreCounter,
          total: resourceIds.length,
        }),
      );
      const restoredResource = await this.resourceService.restore(resourceId);
      restoredResources.push(restoredResource);

      return restoredResource;
    };

    const callbacks = resourceIds.map((resourceId) => () => restoreCallBacks(resourceId));
    const executeConcurrentlyService = new ExecuteConcurrentlyService();
    await executeConcurrentlyService.execute(callbacks, 5);

    this.progressService.finishStep(i18n.t("Updating resources local storage"), true);
    const restoredResourcesCollection = new ResourcesCollection(restoredResources);
    await this.prepareRestoredResourcesForLocalStorage(restoredResourcesCollection);
    await ResourceLocalStorage.addOrReplaceResourcesCollection(restoredResourcesCollection);

    return restoredResources;
  }

  /**
   * Prepare restored resources before storing them locally.
   *
   * Restoring a resource changes the modified date but not the encrypted metadata payload. Reuse the decrypted
   * metadata already cached for the deleted resource before falling back to regular metadata decryption.
   *
   * @param {ResourcesCollection} restoredResourcesCollection The restored resources.
   * @returns {Promise<void>}
   * @private
   */
  async prepareRestoredResourcesForLocalStorage(restoredResourcesCollection) {
    const localStorageResourcesCollection = new ResourcesCollection((await ResourceLocalStorage.get()) || [], {
      validate: false,
    });

    restoredResourcesCollection.setDecryptedMetadataFromCollectionById(localStorageResourcesCollection);

    try {
      await this.decryptMetadataService.decryptAllFromForeignModels(restoredResourcesCollection, null, {
        ignoreDecryptionError: true,
        updateSessionKeys: true,
      });
    } catch {
      // Restore already succeeded remotely. Keep only resources safe for local storage; the next sync can recover.
    }

    restoredResourcesCollection.filterOutMetadataEncrypted();
  }
}

export default RestoreResourceService;
