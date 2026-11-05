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
  FORCE_BOOTSTRAP: "FORCE_BOOTSTRAP",
  RECONCILE: "RECONCILE",
};

export const SyncResult = {
  SUCCESS: "SUCCESS",
  SKIPPED: "SKIPPED",
  FAILURE: "FAILURE",
};

const RECONCILIATION_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export const BACKOFF_SCHEDULE_MS = [
  30 * 1000, // 30s
  60 * 1000, // 1m
  5 * 60 * 1000, // 5m
  15 * 60 * 1000, // 15m
  60 * 60 * 1000, // 1h
  6 * 60 * 60 * 1000, // 6h
];

/**
 * Compute exponential backoff delay based on failure count (Spec §6).
 * @param {number} failureCount
 * @returns {number} Delay in milliseconds
 */
export function getBackoffDelayMs(failureCount) {
  if (!failureCount || failureCount <= 0) {
    return 0;
  }
  const index = Math.min(failureCount - 1, BACKOFF_SCHEDULE_MS.length - 1);
  return BACKOFF_SCHEDULE_MS[index];
}

export default class SyncEngine {
  /**
   * Static account-level lock map to guarantee mutual exclusion across instances.
   * @type {Map<string, Lock>}
   */
  static locks = new Map();

  /**
   * Get or create a shared lock for the specified account ID.
   * @param {string} accountId
   * @returns {Lock}
   */
  static getLock(accountId) {
    if (!SyncEngine.locks.has(accountId)) {
      SyncEngine.locks.set(accountId, new Lock());
    }
    return SyncEngine.locks.get(accountId);
  }

  /**
   * @param {AccountEntity} account
   * @param {ApiClientOptions} apiClientOptions
   * @param {Object} [dependencies={}] Optional dependency overrides for testing
   */
  constructor(account, apiClientOptions, dependencies = {}) {
    this.account = account;
    this.apiClientOptions = apiClientOptions;
    this.lock = dependencies.lock || (account?.id ? SyncEngine.getLock(account.id) : new Lock());

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
   * Invariant: Full synchronization (bootstrap) is ONLY executed when local replica data is completely absent
   * or when explicitly triggered via FORCE_BOOTSTRAP.
   * When local data is present, fast incremental delta sync is executed.
   *
   * @param {string} [trigger=SyncTrigger.AUTO] The sync trigger
   * @param {string|null} [passphrase=null]
   * @param {Object} [options={}]
   * @returns {Promise<{status: string, reason?: string, details?: Object, error?: Error}>}
   */
  async sync(trigger = SyncTrigger.AUTO, passphrase = null, options = {}) {
    // 1. Connectivity check
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      Log.write({ level: "debug", message: "Sync skipped: device is offline." });
      return { status: SyncResult.SKIPPED, reason: "NO_NETWORK" };
    }

    // 2. Exponential backoff check (Spec §6) - bypass on manual / force-bootstrap actions
    const syncStateBefore = await this.syncStateLocalStorage.get();
    const isManualTrigger = trigger === SyncTrigger.MANUAL || trigger === SyncTrigger.FORCE_BOOTSTRAP;

    if (!isManualTrigger && syncStateBefore.failureCount > 0 && syncStateBefore.lastFailureTimestamp) {
      const backoffDelay = getBackoffDelayMs(syncStateBefore.failureCount);
      const elapsedSinceFailure = Date.now() - syncStateBefore.lastFailureTimestamp;
      if (elapsedSinceFailure < backoffDelay) {
        const remainingMs = backoffDelay - elapsedSinceFailure;
        Log.write({
          level: "debug",
          message: `Sync skipped due to active exponential backoff (${syncStateBefore.failureCount} failures, wait ${remainingMs}ms).`,
        });
        return {
          status: SyncResult.SKIPPED,
          reason: "BACKOFF",
          details: { failureCount: syncStateBefore.failureCount, remainingMs },
        };
      }
    }

    // 3. Mutual exclusion lock to prevent concurrent sync executions
    await this.lock.acquire();
    try {
      Log.write({ level: "debug", message: `Sync execution started (trigger=${trigger}).` });

      // Direct trigger shortcuts
      if (trigger === SyncTrigger.RECONCILE) {
        const reconResult = await this.manifestReconciler.reconcile(passphrase);
        await this.syncStateLocalStorage.resetFailureCount();
        return {
          status: SyncResult.SUCCESS,
          details: { type: "RECONCILE", ...reconResult },
        };
      }

      const localResources = await ResourceLocalStorage.get();
      const hasLocalData = Array.isArray(localResources) && localResources.length > 0;
      const syncState = await this.syncStateLocalStorage.get();

      // 4. Strict Rule: Full bootstrap is executed when local data is absent OR trigger is FORCE_BOOTSTRAP
      if (trigger === SyncTrigger.FORCE_BOOTSTRAP || !hasLocalData) {
        Log.write({
          level: "info",
          message: `Executing full bootstrap snapshot (trigger=${trigger}, hasLocalData=${hasLocalData}).`,
        });
        const bootstrapResult = await this.bootstrapStrategy.bootstrap(passphrase, options);
        await this.syncStateLocalStorage.resetFailureCount();
        return {
          status: SyncResult.SUCCESS,
          details: { type: "BOOTSTRAP", ...bootstrapResult },
        };
      }

      // 5. Server epoch change check (Spec §2 & §5)
      let serverEpoch = null;
      try {
        const metaResponse = await this.syncApiService.getMeta();
        serverEpoch = metaResponse.body?.epoch ?? null;
      } catch (error) {
        Log.write({
          level: "warn",
          message: `Failed to fetch sync meta for epoch validation: ${error?.message}`,
        });
      }

      if (serverEpoch && syncState.epoch && serverEpoch !== syncState.epoch) {
        Log.write({
          level: "warn",
          message: `Server epoch changed (${syncState.epoch} -> ${serverEpoch}). Forcing recovery bootstrap.`,
        });
        const recoveryResult = await this.bootstrapStrategy.bootstrap(passphrase, options);
        await this.syncStateLocalStorage.resetFailureCount();
        return {
          status: SyncResult.SUCCESS,
          details: { type: "EPOCH_RECOVERY_BOOTSTRAP", ...recoveryResult },
        };
      }

      // 6. Local data is present: perform fast incremental delta sync
      Log.write({
        level: "debug",
        message: "Local data present: performing fast incremental delta sync.",
      });

      let didReconcile = false;
      const hasCursor = syncState.cursor !== null && syncState.cursor !== undefined;

      if (!hasCursor) {
        // Upgrade from legacy store or uninitialized cursor: seed baseline from current head watermark
        try {
          const bootstrapProbe = await this.syncApiService.getBootstrap(1, 1);
          const baselineCursor = bootstrapProbe.body?.cursor ?? 0;
          const epoch = bootstrapProbe.body?.epoch ?? serverEpoch;
          await this.syncStateLocalStorage.updateCursor(baselineCursor, epoch);
          await this.manifestReconciler.reconcile(passphrase);
          didReconcile = true;
        } catch (error) {
          Log.write({
            level: "warn",
            message: `Baseline watermark seeding failed: ${error?.message}`,
          });
        }
      }

      const deltaResult = await this.deltaSyncStrategy.sync(passphrase, options);

      // Handle 410 Gone: transparent recovery bootstrap over existing local store
      if (deltaResult.isGone) {
        Log.write({
          level: "warn",
          message: "Cursor expired on server (410 Gone); performing recovery bootstrap over local store.",
        });
        const recoveryResult = await this.bootstrapStrategy.bootstrap(passphrase, options);
        await this.syncStateLocalStorage.resetFailureCount();
        return {
          status: SyncResult.SUCCESS,
          details: { type: "RECOVERY_BOOTSTRAP", ...recoveryResult },
        };
      }

      // 7. Manifest reconciliation: on MANUAL trigger or when overdue (>1 hour), avoiding duplicate baseline run
      const now = Date.now();
      const updatedSyncState = await this.syncStateLocalStorage.get();
      const isReconcileOverdue =
        !updatedSyncState.lastReconcileTimestamp ||
        now - updatedSyncState.lastReconcileTimestamp > RECONCILIATION_INTERVAL_MS;

      if (!didReconcile && (trigger === SyncTrigger.MANUAL || isReconcileOverdue)) {
        Log.write({
          level: "debug",
          message: `Executing manifest reconciliation (trigger=${trigger}, overdue=${isReconcileOverdue}).`,
        });
        await this.manifestReconciler.reconcile(passphrase);
      }

      // Reset failure telemetry on complete success
      await this.syncStateLocalStorage.resetFailureCount();

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
        error,
      };
    } finally {
      this.lock.release();
    }
  }
}
