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
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import SyncEngine, { SyncTrigger, SyncResult } from "./syncEngine";
import ResourceLocalStorage from "../local_storage/resourceLocalStorage";

describe("SyncEngine", () => {
  let account;
  let apiClientOptions;
  let syncApiService;
  let syncStateLocalStorage;
  let changesApplier;
  let deltaSyncStrategy;
  let bootstrapStrategy;
  let manifestReconciler;
  let engine;

  beforeEach(() => {
    account = { id: "test-user-id" };
    apiClientOptions = defaultApiClientOptions();

    syncApiService = {
      getMeta: jest.fn().mockResolvedValue({ body: { epoch: "epoch-1" } }),
    };
    syncStateLocalStorage = {
      get: jest.fn().mockResolvedValue({ cursor: 50, epoch: "epoch-1", lastReconcileTimestamp: Date.now() }),
      updateCursor: jest.fn().mockResolvedValue(),
      incrementFailureCount: jest.fn().mockResolvedValue(),
    };
    changesApplier = {
      apply: jest.fn().mockResolvedValue(),
    };
    deltaSyncStrategy = {
      sync: jest.fn().mockResolvedValue({ success: true, cursor: 55, totalUpserts: 1, totalDeletions: 0 }),
    };
    bootstrapStrategy = {
      bootstrap: jest.fn().mockResolvedValue({ success: true, cursor: 500, epoch: "epoch-1" }),
    };
    manifestReconciler = {
      reconcile: jest.fn().mockResolvedValue({ success: true, revokedCount: 0 }),
    };

    engine = new SyncEngine(account, apiClientOptions, {
      syncApiService,
      syncStateLocalStorage,
      changesApplier,
      deltaSyncStrategy,
      bootstrapStrategy,
      manifestReconciler,
    });
  });

  describe("::sync connectivity check", () => {
    it("should return SKIPPED when navigator.onLine is false", async () => {
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });

      const result = await engine.sync(SyncTrigger.AUTO);

      expect(result).toEqual({ status: SyncResult.SKIPPED, reason: "NO_NETWORK" });
      expect(deltaSyncStrategy.sync).not.toHaveBeenCalled();
      expect(bootstrapStrategy.bootstrap).not.toHaveBeenCalled();

      Object.defineProperty(navigator, "onLine", { value: originalOnLine, configurable: true });
    });
  });

  describe("::sync data absence policy (Strict Rule)", () => {
    it("should execute full bootstrap ONLY when local data is completely absent", async () => {
      jest.spyOn(ResourceLocalStorage, "get").mockResolvedValue([]);

      const result = await engine.sync(SyncTrigger.MANUAL, "passphrase");

      expect(bootstrapStrategy.bootstrap).toHaveBeenCalledWith("passphrase", {});
      expect(deltaSyncStrategy.sync).not.toHaveBeenCalled();
      expect(result.status).toBe(SyncResult.SUCCESS);
      expect(result.details.type).toBe("BOOTSTRAP");
    });

    it("should perform fast delta sync when local data is present", async () => {
      jest.spyOn(ResourceLocalStorage, "get").mockResolvedValue([{ id: "res-1" }]);

      const result = await engine.sync(SyncTrigger.AUTO);

      expect(deltaSyncStrategy.sync).toHaveBeenCalledTimes(1);
      expect(bootstrapStrategy.bootstrap).not.toHaveBeenCalled();
      expect(result.status).toBe(SyncResult.SUCCESS);
      expect(result.details.type).toBe("DELTA");
    });
  });

  describe("::sync 410 Gone recovery", () => {
    it("should execute transparent recovery bootstrap over local store when delta returns isGone", async () => {
      jest.spyOn(ResourceLocalStorage, "get").mockResolvedValue([{ id: "res-1" }]);
      deltaSyncStrategy.sync.mockResolvedValue({ success: false, isGone: true });

      const result = await engine.sync(SyncTrigger.AUTO);

      expect(deltaSyncStrategy.sync).toHaveBeenCalledTimes(1);
      expect(bootstrapStrategy.bootstrap).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(SyncResult.SUCCESS);
      expect(result.details.type).toBe("RECOVERY_BOOTSTRAP");
    });
  });

  describe("::sync reconciliation triggers", () => {
    it("should execute manifest reconciliation on MANUAL trigger", async () => {
      jest.spyOn(ResourceLocalStorage, "get").mockResolvedValue([{ id: "res-1" }]);

      await engine.sync(SyncTrigger.MANUAL);

      expect(manifestReconciler.reconcile).toHaveBeenCalledTimes(1);
    });

    it("should execute manifest reconciliation when last reconciliation is overdue (> 1 hour)", async () => {
      jest.spyOn(ResourceLocalStorage, "get").mockResolvedValue([{ id: "res-1" }]);
      syncStateLocalStorage.get.mockResolvedValue({
        cursor: 100,
        epoch: "epoch-1",
        lastReconcileTimestamp: Date.now() - 3600001, // > 1 hour ago
      });

      await engine.sync(SyncTrigger.AUTO);

      expect(manifestReconciler.reconcile).toHaveBeenCalledTimes(1);
    });
  });

  describe("::sync error handling", () => {
    it("should increment failure count and return FAILURE on unhandled exception", async () => {
      jest.spyOn(ResourceLocalStorage, "get").mockResolvedValue([{ id: "res-1" }]);
      deltaSyncStrategy.sync.mockRejectedValue(new Error("Network timeout"));

      const result = await engine.sync(SyncTrigger.AUTO);

      expect(syncStateLocalStorage.incrementFailureCount).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        status: SyncResult.FAILURE,
        reason: "Network timeout",
      });
    });
  });
});
