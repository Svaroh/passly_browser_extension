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
import Lock from "../../utils/lock";
import Log from "../../model/log";
import ResourceLocalStorage from "../local_storage/resourceLocalStorage";
import SyncApiService from "../api/sync/syncApiService";
import SyncStateLocalStorage from "../local_storage/syncStateLocalStorage";
import ChangesApplier from "./changesApplier";
import DeltaSyncStrategy from "./deltaSyncStrategy";
import BootstrapStrategy from "./bootstrapStrategy";
import ManifestReconciler from "./manifestReconciler";

export const SyncTrigger = {
  MANUAL: "MANUAL",
  UNLOCK: "UNLOCK",
  AUTO: "AUTO",
  BACKGROUND: "BACKGROUND",
};

export const SyncResult = {
  SUCCESS: "SUCCESS",
  SKIPPED: "SKIPPED",
  FAILURE: "FAILURE",
};

const RECONCILIATION_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export default class SyncEngine {
  /**
   * @param {AccountEntity} account
   * @param {ApiClientOptions} apiClientOptions
   * @param {Object} [dependencies={}] Optional dependency overrides for testing
   */
  constructor(account, apiClientOptions, dependencies = {}) {
    this.account = account;
    this.apiClientOptions = apiClientOptions;
    this.lock = dependencies.lock || new Lock();

    this.syncApiService = dependencies.syncApiService || new SyncApiService(apiClientOptions);
    this.syncStateLocalStorage = dependencies.syncStateLocalStorage || new SyncStateLocalStorage(account);
    this.changesApplier =
      dependencies.changesApplier || new ChangesApplier(account, apiClientOptions, this.syncStateLocalStorage);
    this.deltaSyncStrategy =
      dependencies.deltaSyncStrategy ||
      new DeltaSyncStrategy(this.syncApiService, this.changesApplier, this.syncStateLocalStorage);
    this.bootstrapStrategy =
      dependencies.bootstrapStrategy ||
      new BootstrapStrategy(this.syncApiService, this.changesApplier, this.syncStateLocalStorage);
    this.manifestReconciler =
      dependencies.manifestReconciler ||
      new ManifestReconciler(account, apiClientOptions, this.syncApiService, this.syncStateLocalStorage);
  }

  /**
   * Main synchronization entry point.
   *
   * Invariant: Full synchronization (bootstrap) is ONLY executed when local replica data is completely absent.
   * When local data is present, fast incremental delta sync is executed.
   *
   * @param {string} [trigger=SyncTrigger.AUTO] The sync trigger
   * @param {string|null} [passphrase=null]
   * @param {Object} [options={}]
   * @returns {Promise<{status: string, reason?: string, details?: Object}>}
   */
  async sync(trigger = SyncTrigger.AUTO, passphrase = null, options = {}) {
    // 1. Connectivity check
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      Log.write({ level: "debug", message: "Sync skipped: device is offline." });
      return { status: SyncResult.SKIPPED, reason: "NO_NETWORK" };
    }

    // 2. Mutual exclusion lock to prevent concurrent sync executions
    await this.lock.acquire();
    try {
      Log.write({ level: "debug", message: `Sync execution started (trigger=${trigger}).` });

      const localResources = await ResourceLocalStorage.get();
      const hasLocalData = Array.isArray(localResources) && localResources.length > 0;
      const syncState = await this.syncStateLocalStorage.get();

      // 3. Strict Rule: Full bootstrap is ONLY executed when local replica data is completely absent
      if (!hasLocalData) {
        Log.write({
          level: "info",
          message: "No local data found: performing initial full bootstrap snapshot.",
        });
        const bootstrapResult = await this.bootstrapStrategy.bootstrap(passphrase, options);
        return {
          status: SyncResult.SUCCESS,
          details: { type: "BOOTSTRAP", ...bootstrapResult },
        };
      }

      // 4. Local data is present: perform fast incremental delta sync
      Log.write({
        level: "debug",
        message: "Local data present: performing fast incremental delta sync.",
      });

      const hasCursor = syncState.cursor !== null && syncState.cursor !== undefined;

      if (!hasCursor) {
        // Upgrade from legacy store or uninitialized cursor: establish baseline without re-downloading all data
        try {
          const metaResponse = await this.syncApiService.getMeta();
          const epoch = metaResponse.body?.epoch ?? null;
          await this.manifestReconciler.reconcile();
          await this.syncStateLocalStorage.updateCursor(0, epoch);
        } catch (error) {
          Log.write({
            level: "warn",
            message: `Baseline establishment failed: ${error?.message}`,
          });
        }
      }

      const deltaResult = await this.deltaSyncStrategy.sync(passphrase, options);

      // Handle 410 Gone / epoch reset: transparent recovery bootstrap over existing local store
      if (deltaResult.isGone) {
        Log.write({
          level: "warn",
          message: "Cursor expired on server (410 Gone); performing recovery bootstrap over local store.",
        });
        const recoveryResult = await this.bootstrapStrategy.bootstrap(passphrase, options);
        return {
          status: SyncResult.SUCCESS,
          details: { type: "RECOVERY_BOOTSTRAP", ...recoveryResult },
        };
      }

      // 5. Manifest reconciliation: on MANUAL trigger or when overdue (>1 hour)
      const now = Date.now();
      const isReconcileOverdue =
        !syncState.lastReconcileTimestamp || now - syncState.lastReconcileTimestamp > RECONCILIATION_INTERVAL_MS;

      if (trigger === SyncTrigger.MANUAL || isReconcileOverdue) {
        Log.write({
          level: "debug",
          message: `Executing manifest reconciliation (trigger=${trigger}, overdue=${isReconcileOverdue}).`,
        });
        await this.manifestReconciler.reconcile();
      }

      return {
        status: SyncResult.SUCCESS,
        details: { type: "DELTA", ...deltaResult },
      };
    } catch (error) {
      Log.write({ level: "error", message: `Sync execution failed: ${error?.message}` });
      await this.syncStateLocalStorage.incrementFailureCount();
      return {
        status: SyncResult.FAILURE,
        reason: error?.message || "Unknown sync error",
      };
    } finally {
      this.lock.release();
    }
  }
}
