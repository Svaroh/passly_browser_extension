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
import SyncStateLocalStorage, { DEFAULT_SYNC_STATE } from "./syncStateLocalStorage";

describe("SyncStateLocalStorage", () => {
  const account = { id: "test-user-uuid" };
  let service;

  beforeEach(async () => {
    service = new SyncStateLocalStorage(account);
    await service.flush();
  });

  describe("constructor", () => {
    it("should throw if account is invalid or missing id", () => {
      expect(() => new SyncStateLocalStorage()).toThrow(TypeError);
      expect(() => new SyncStateLocalStorage({})).toThrow(TypeError);
    });

    it("should construct valid storage key", () => {
      expect(service.storageKey).toBe("sync_state-test-user-uuid");
    });
  });

  describe("::get and ::set", () => {
    it("should return default state when storage is empty", async () => {
      const state = await service.get();
      expect(state).toEqual(DEFAULT_SYNC_STATE);
    });

    it("should save and retrieve custom state", async () => {
      const customState = {
        cursor: 12345,
        epoch: "test-epoch",
        lastSyncTimestamp: 1700000000,
        lastReconcileTimestamp: 1699990000,
        failureCount: 2,
        lastFailureTimestamp: null,
        pendingResourceIds: [],
      };

      await service.set(customState);
      const retrieved = await service.get();
      expect(retrieved).toEqual(customState);
    });
  });

  describe("::updateCursor", () => {
    it("should update cursor, epoch, reset failureCount, and set lastSyncTimestamp", async () => {
      await service.set({ failureCount: 5 });
      const beforeTime = Date.now();

      const updated = await service.updateCursor(999, "new-epoch");

      expect(updated.cursor).toBe(999);
      expect(updated.epoch).toBe("new-epoch");
      expect(updated.failureCount).toBe(0);
      expect(updated.lastFailureTimestamp).toBeNull();
      expect(updated.lastSyncTimestamp).toBeGreaterThanOrEqual(beforeTime);

      const fromStorage = await service.get();
      expect(fromStorage.cursor).toBe(999);
      expect(fromStorage.failureCount).toBe(0);
    });

    it("should enforce monotonic cursor advancement and not regress", async () => {
      await service.updateCursor(500, "epoch-1");
      const regressed = await service.updateCursor(300, "epoch-1");
      expect(regressed.cursor).toBe(500);

      const fromStorage = await service.get();
      expect(fromStorage.cursor).toBe(500);
    });

    it("should allow a lower cursor when server epoch changes", async () => {
      await service.updateCursor(500, "epoch-old");
      const epochRecovered = await service.updateCursor(10, "epoch-new");
      expect(epochRecovered.cursor).toBe(10);
      expect(epochRecovered.epoch).toBe("epoch-new");

      const fromStorage = await service.get();
      expect(fromStorage.cursor).toBe(10);
      expect(fromStorage.epoch).toBe("epoch-new");
    });

    it("should allow a lower cursor when options.force is true", async () => {
      await service.updateCursor(500, "epoch-1");
      const forced = await service.updateCursor(25, "epoch-1", { force: true });
      expect(forced.cursor).toBe(25);

      const fromStorage = await service.get();
      expect(fromStorage.cursor).toBe(25);
    });

    it("should reject non-finite cursor values to prevent poisoning stored state", async () => {
      await expect(service.updateCursor("invalid-nan")).rejects.toThrow(TypeError);
      await expect(service.updateCursor(NaN)).rejects.toThrow(TypeError);
    });
  });

  describe("::recordPendingResourceIds and ::removePendingResourceIds", () => {
    it("should add and remove pending resource IDs uniquely", async () => {
      await service.recordPendingResourceIds(["res-1", "res-2"]);
      let state = await service.get();
      expect(state.pendingResourceIds).toEqual(["res-1", "res-2"]);

      await service.recordPendingResourceIds(["res-2", "res-3"]);
      state = await service.get();
      expect(state.pendingResourceIds).toEqual(["res-1", "res-2", "res-3"]);

      await service.removePendingResourceIds(["res-2"]);
      state = await service.get();
      expect(state.pendingResourceIds).toEqual(["res-1", "res-3"]);

      await service.removePendingResourceIds();
      state = await service.get();
      expect(state.pendingResourceIds).toEqual([]);
    });
  });

  describe("::recordReconciliation", () => {
    it("should update lastReconcileTimestamp", async () => {
      const beforeTime = Date.now();
      const updated = await service.recordReconciliation();
      expect(updated.lastReconcileTimestamp).toBeGreaterThanOrEqual(beforeTime);
    });
  });

  describe("::incrementFailureCount and ::resetFailureCount", () => {
    it("should increment failure count sequentially", async () => {
      expect(await service.incrementFailureCount()).toBe(1);
      expect(await service.incrementFailureCount()).toBe(2);
      expect(await service.incrementFailureCount()).toBe(3);

      await service.resetFailureCount();
      const state = await service.get();
      expect(state.failureCount).toBe(0);
    });
  });

  describe("::flush", () => {
    it("should remove entry and clear cache", async () => {
      await service.updateCursor(100, "epoch-1");
      expect(service.hasCachedData()).toBe(true);

      await service.flush();
      expect(service.hasCachedData()).toBe(false);

      const state = await service.get();
      expect(state.cursor).toBeNull();
    });
  });
});
