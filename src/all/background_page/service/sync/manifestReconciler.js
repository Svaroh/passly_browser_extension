/**
 * Passly ~ Open source password manager for teams
 * Copyright (c) Passly (https://passly.svaroh.net)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) Passly (https://passly.svaroh.net)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://passly.svaroh.net Passly
 */
import ResourceLocalStorage from "../local_storage/resourceLocalStorage";
import CanUseOfflineStorageService from "../offline/canUseOfflineStorageService";
import OfflineResourcesOPFSStorage from "../opfsStorage/offlineResourcesOPFSStorage";
import OfflineSecretsOPFSStorage from "../opfsStorage/offlineSecretsOPFSStorage";
import FindResourcesService from "../resource/findResourcesService";
import DecryptMetadataService from "../metadata/decryptMetadataService";
import ResourceEntity from "../../model/entity/resource/resourceEntity";
import ResourcesCollection from "../../model/entity/resource/resourcesCollection";
import Log from "../../model/log";

export default class ManifestReconciler {
  /**
   * @param {AccountEntity} account
   * @param {ApiClientOptions} apiClientOptions
   * @param {SyncApiService} syncApiService
   * @param {SyncStateLocalStorage} syncStateLocalStorage
   * @param {Object} [dependencies={}] Optional dependency overrides for testing
   */
  constructor(account, apiClientOptions, syncApiService, syncStateLocalStorage, dependencies = {}) {
    this.account = account;
    this.apiClientOptions = apiClientOptions;
    this.syncApiService = syncApiService;
    this.syncStateLocalStorage = syncStateLocalStorage;
    this.canUseOfflineStorageService =
      dependencies.canUseOfflineStorageService || new CanUseOfflineStorageService(account, apiClientOptions);
    this.offlineResourcesOPFSStorage =
      dependencies.offlineResourcesOPFSStorage || new OfflineResourcesOPFSStorage(account);
    this.offlineSecretsOPFSStorage = dependencies.offlineSecretsOPFSStorage || new OfflineSecretsOPFSStorage(account);
    this.findResourcesService =
      dependencies.findResourcesService || new FindResourcesService(account, apiClientOptions);
    this.decryptMetadataService =
      dependencies.decryptMetadataService || new DecryptMetadataService(apiClientOptions, account);
  }

  /**
   * Reconcile local storage resources against server manifest.
   * Purges locally cached items whose visibility was revoked on the server.
   * Fetches missing or divergent resources in targeted batches via filter[has-id][].
   * @param {string|null} [passphrase=null]
   * @returns {Promise<{success: boolean, revokedCount: number, revokedIds: Array<string>, repairedCount: number, repairedIds: Array<string>}>}
   */
  async reconcile(passphrase = null) {
    Log.write({ level: "debug", message: "Starting manifest reconciliation for resources..." });

    const manifestResponse = await this.syncApiService.getManifest("resources");
    const serverItems = manifestResponse.body || [];
    const serverItemMap = new Map(serverItems.map((item) => [item.id, item]));

    const localResources = (await ResourceLocalStorage.get()) || [];
    const localMap = new Map(localResources.map((r) => [r.id, r]));

    // 1. Purge revoked or deleted resources
    const revokedIds = localResources.map((r) => r.id).filter((id) => id && !serverItemMap.has(id));

    if (revokedIds.length > 0) {
      Log.write({
        level: "info",
        message: `Manifest reconciliation found ${revokedIds.length} revoked resources to purge.`,
      });

      await ResourceLocalStorage.deleteResources(revokedIds);

      const canUseOffline = await this.canUseOfflineStorageService.canUseOfflineStorage();
      if (canUseOffline) {
        try {
          await this.offlineResourcesOPFSStorage.deleteResources(revokedIds);
          await this.offlineSecretsOPFSStorage.deleteByResourceIds(revokedIds);
        } catch (error) {
          Log.write({
            level: "warn",
            message: `Manifest reconciliation OPFS purge error: ${error?.message}`,
          });
        }
      }
    }

    // 2. Detect missing, divergent, or pending undecrypted resources
    const syncState = await this.syncStateLocalStorage.get();
    const pendingIds = new Set(syncState.pendingResourceIds || []);
    const missingOrDivergentIds = [];

    for (const [id, serverItem] of serverItemMap.entries()) {
      const local = localMap.get(id);
      if (!local) {
        // Missing from local store
        missingOrDivergentIds.push(id);
      } else if (pendingIds.has(id)) {
        // Previously failed metadata decryption
        missingOrDivergentIds.push(id);
      } else if (serverItem.modified && local.modified && serverItem.modified !== local.modified) {
        // Divergent modified timestamp
        missingOrDivergentIds.push(id);
      }
    }

    let repairedCount = 0;
    if (missingOrDivergentIds.length > 0) {
      Log.write({
        level: "info",
        message: `Manifest reconciliation found ${missingOrDivergentIds.length} missing/divergent resources to repair.`,
      });

      try {
        const repairedCollection = await this.findResourcesService.findAllByIdsForLocalStorage(missingOrDivergentIds);

        if (repairedCollection && repairedCollection.length > 0) {
          // Decrypt if passphrase available
          await this.decryptMetadataService.decryptAllFromForeignModels(repairedCollection, passphrase, {
            ignoreDecryptionError: true,
            updateSessionKeys: true,
          });

          // If offline enabled, save encrypted offline copies
          const canUseOffline = await this.canUseOfflineStorageService.canUseOfflineStorage();
          if (canUseOffline) {
            const offlineTagged = repairedCollection.filterByOffline();
            const baseItems = offlineTagged.length > 0 ? offlineTagged.items : [];
            const clonedEncryptedItems = baseItems
              .filter((r) => r && Boolean(r.permission))
              .map((r) => new ResourceEntity(r.toDto(ResourceEntity.ALL_CONTAIN_OPTIONS), { validate: false }));

            if (clonedEncryptedItems.length > 0) {
              await this.offlineResourcesOPFSStorage.addOrReplaceResourcesCollection(
                new ResourcesCollection(clonedEncryptedItems, { validate: false }),
              );
            }
          }

          repairedCollection.filterOutMetadataEncrypted();
          await ResourceLocalStorage.addOrReplaceResourcesCollection(repairedCollection);

          const repairedIds = Array.from(repairedCollection)
            .map((r) => r.id)
            .filter(Boolean);
          repairedCount = repairedIds.length;
          await this.syncStateLocalStorage.removePendingResourceIds(repairedIds);
        }
      } catch (error) {
        Log.write({
          level: "warn",
          message: `Manifest reconciliation repair fetch error: ${error?.message}`,
        });
      }
    }

    await this.syncStateLocalStorage.recordReconciliation();

    Log.write({ level: "debug", message: "Manifest reconciliation completed successfully." });

    return {
      success: true,
      revokedCount: revokedIds.length,
      revokedIds,
      repairedCount,
      repairedIds: missingOrDivergentIds,
    };
  }
}
