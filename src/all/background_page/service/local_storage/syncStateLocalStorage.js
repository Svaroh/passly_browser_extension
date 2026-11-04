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

const lock = new Lock();
export const SYNC_STATE_LOCAL_STORAGE_PREFIX = "sync_state";

export const DEFAULT_SYNC_STATE = {
  cursor: null,
  epoch: null,
  lastSyncTimestamp: null,
  lastReconcileTimestamp: null,
  failureCount: 0,
};

export default class SyncStateLocalStorage {
  /**
   * Runtime cached sync state mapped by account id.
   * @type {Object<string, Object>}
   * @private
   */
  static _runtimeCachedState = {};

  /**
   * @param {AccountEntity|Object} account The user account
   */
  constructor(account) {
    if (!account || !account.id) {
      throw new TypeError("SyncStateLocalStorage requires an account with an id");
    }
    this.account = account;
    this.storageKey = `${SYNC_STATE_LOCAL_STORAGE_PREFIX}-${account.id}`;
  }

  /**
   * Check if runtime cache is available.
   * @returns {boolean}
   */
  hasCachedData() {
    return Boolean(SyncStateLocalStorage._runtimeCachedState[this.account.id]);
  }

  /**
   * Retrieve the sync state.
   * @returns {Promise<Object>}
   */
  async get() {
    if (SyncStateLocalStorage._runtimeCachedState[this.account.id]) {
      return { ...SyncStateLocalStorage._runtimeCachedState[this.account.id] };
    }

    const result = await browser.storage.local.get([this.storageKey]);
    const storedState = result[this.storageKey];

    const state = storedState ? { ...DEFAULT_SYNC_STATE, ...storedState } : { ...DEFAULT_SYNC_STATE };

    SyncStateLocalStorage._runtimeCachedState[this.account.id] = state;
    return { ...state };
  }

  /**
   * Save the sync state.
   * @param {Object} state
   * @returns {Promise<void>}
   */
  async set(state) {
    await lock.acquire();
    try {
      const merged = { ...DEFAULT_SYNC_STATE, ...state };
      await browser.storage.local.set({ [this.storageKey]: merged });
      SyncStateLocalStorage._runtimeCachedState[this.account.id] = merged;
    } finally {
      lock.release();
    }
  }

  /**
   * Update the cursor and epoch upon successful sync page commit.
   * Resets failureCount and records lastSyncTimestamp.
   * @param {number|string} cursor
   * @param {string|null} [epoch=null]
   * @returns {Promise<Object>} The updated state
   */
  async updateCursor(cursor, epoch = null) {
    await lock.acquire();
    try {
      const current = await this.get();
      const updated = {
        ...current,
        cursor: Number(cursor),
        epoch: epoch !== null && epoch !== undefined ? String(epoch) : current.epoch,
        lastSyncTimestamp: Date.now(),
        failureCount: 0,
      };
      await browser.storage.local.set({ [this.storageKey]: updated });
      SyncStateLocalStorage._runtimeCachedState[this.account.id] = updated;
      return { ...updated };
    } finally {
      lock.release();
    }
  }

  /**
   * Record a successful manifest reconciliation timestamp.
   * @returns {Promise<Object>} The updated state
   */
  async recordReconciliation() {
    await lock.acquire();
    try {
      const current = await this.get();
      const updated = {
        ...current,
        lastReconcileTimestamp: Date.now(),
      };
      await browser.storage.local.set({ [this.storageKey]: updated });
      SyncStateLocalStorage._runtimeCachedState[this.account.id] = updated;
      return { ...updated };
    } finally {
      lock.release();
    }
  }

  /**
   * Increment failure count on sync failure.
   * @returns {Promise<number>} Updated failure count
   */
  async incrementFailureCount() {
    await lock.acquire();
    try {
      const current = await this.get();
      const updated = {
        ...current,
        failureCount: (current.failureCount || 0) + 1,
      };
      await browser.storage.local.set({ [this.storageKey]: updated });
      SyncStateLocalStorage._runtimeCachedState[this.account.id] = updated;
      return updated.failureCount;
    } finally {
      lock.release();
    }
  }

  /**
   * Reset failure count to 0.
   * @returns {Promise<void>}
   */
  async resetFailureCount() {
    await lock.acquire();
    try {
      const current = await this.get();
      const updated = {
        ...current,
        failureCount: 0,
      };
      await browser.storage.local.set({ [this.storageKey]: updated });
      SyncStateLocalStorage._runtimeCachedState[this.account.id] = updated;
    } finally {
      lock.release();
    }
  }

  /**
   * Flush sync state from local storage.
   * @returns {Promise<void>}
   */
  async flush() {
    await lock.acquire();
    try {
      delete SyncStateLocalStorage._runtimeCachedState[this.account.id];
      await browser.storage.local.remove(this.storageKey);
      Log.write({ level: "debug", message: `SyncStateLocalStorage flushed for ${this.account.id}` });
    } finally {
      lock.release();
    }
  }
}
