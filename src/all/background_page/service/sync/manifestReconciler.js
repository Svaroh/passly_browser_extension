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
import Log from "../../model/log";

export default class ManifestReconciler {
  /**
   * @param {AccountEntity} account
   * @param {ApiClientOptions} apiClientOptions
   * @param {SyncApiService} syncApiService
   * @param {SyncStateLocalStorage} syncStateLocalStorage
   */
  constructor(account, apiClientOptions, syncApiService, syncStateLocalStorage) {
    this.account = account;
    this.apiClientOptions = apiClientOptions;
    this.syncApiService = syncApiService;
    this.syncStateLocalStorage = syncStateLocalStorage;
    this.canUseOfflineStorageService = new CanUseOfflineStorageService(account, apiClientOptions);
    this.offlineResourcesOPFSStorage = new OfflineResourcesOPFSStorage(account);
    this.offlineSecretsOPFSStorage = new OfflineSecretsOPFSStorage(account);
  }

  /**
   * Reconcile local storage resources against server manifest.
   * Purges locally cached items whose visibility was revoked on the server.
   * @returns {Promise<{success: boolean, revokedCount: number, revokedIds: Array<string>}>}
   */
  async reconcile() {
    Log.write({ level: "debug", message: "Starting manifest reconciliation for resources..." });

    const manifestResponse = await this.syncApiService.getManifest("resources");
    const serverItems = manifestResponse.body || [];
    const serverIdSet = new Set(serverItems.map((item) => item.id));

    const localResources = (await ResourceLocalStorage.get()) || [];
    const localIds = localResources.map((r) => r.id);

    // Any local resource not present on the server is revoked or deleted
    const revokedIds = localIds.filter((id) => id && !serverIdSet.has(id));

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

    await this.syncStateLocalStorage.recordReconciliation();

    Log.write({ level: "debug", message: "Manifest reconciliation completed successfully." });

    return {
      success: true,
      revokedCount: revokedIds.length,
      revokedIds,
    };
  }
}
