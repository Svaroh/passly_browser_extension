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
      getBootstrap: jest.fn().mockResolvedValue({ body: { cursor: 1234, epoch: "epoch-1" } }),
    };
    syncStateLocalStorage = {
      get: jest.fn().mockResolvedValue({ cursor: 50, epoch: "epoch-1", lastReconcileTimestamp: Date.now() }),
      updateCursor: jest.fn().mockResolvedValue(),
      incrementFailureCount: jest.fn().mockResolvedValue(),
      resetFailureCount: jest.fn().mockResolvedValue(),
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
      const networkError = new Error("Network timeout");
      deltaSyncStrategy.sync.mockRejectedValue(networkError);

      const result = await engine.sync(SyncTrigger.AUTO);

      expect(syncStateLocalStorage.incrementFailureCount).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        status: SyncResult.FAILURE,
        reason: "Network timeout",
        error: networkError,
      });
    });

    it("should skip execution on active exponential backoff for AUTO triggers", async () => {
      syncStateLocalStorage.get.mockResolvedValue({
        cursor: 50,
        epoch: "epoch-1",
        failureCount: 2,
        lastFailureTimestamp: Date.now() - 10000, // 10s ago, but backoff for failureCount=2 is 60s
      });

      const result = await engine.sync(SyncTrigger.AUTO);

      expect(result.status).toBe(SyncResult.SKIPPED);
      expect(result.reason).toBe("BACKOFF");
      expect(deltaSyncStrategy.sync).not.toHaveBeenCalled();
    });

    it("should bypass active backoff when trigger is MANUAL", async () => {
      jest.spyOn(ResourceLocalStorage, "get").mockResolvedValue([{ id: "res-1" }]);
      syncStateLocalStorage.get.mockResolvedValue({
        cursor: 50,
        epoch: "epoch-1",
        failureCount: 3,
        lastFailureTimestamp: Date.now() - 10000,
        lastReconcileTimestamp: Date.now(),
      });

      const result = await engine.sync(SyncTrigger.MANUAL);

      expect(result.status).toBe(SyncResult.SUCCESS);
      expect(deltaSyncStrategy.sync).toHaveBeenCalledTimes(1);
      expect(syncStateLocalStorage.resetFailureCount).toHaveBeenCalled();
    });
  });

  describe("::sync server epoch change", () => {
    it("should trigger recovery bootstrap when server epoch changes", async () => {
      jest.spyOn(ResourceLocalStorage, "get").mockResolvedValue([{ id: "res-1" }]);
      syncStateLocalStorage.get.mockResolvedValue({
        cursor: 50,
        epoch: "epoch-1",
        lastReconcileTimestamp: Date.now(),
      });
      syncApiService.getMeta.mockResolvedValue({ body: { epoch: "epoch-NEW-RESTORED" } });

      const result = await engine.sync(SyncTrigger.AUTO);

      expect(bootstrapStrategy.bootstrap).toHaveBeenCalledTimes(1);
      expect(deltaSyncStrategy.sync).not.toHaveBeenCalled();
      expect(result.status).toBe(SyncResult.SUCCESS);
      expect(result.details.type).toBe("EPOCH_RECOVERY_BOOTSTRAP");
    });
  });

  describe("::sync baseline establishment", () => {
    it("should seed baseline cursor from current head watermark probe and avoid double reconcile", async () => {
      jest.spyOn(ResourceLocalStorage, "get").mockResolvedValue([{ id: "res-1" }]);
      syncStateLocalStorage.get.mockResolvedValue({
        cursor: null, // missing cursor
        epoch: null,
        lastReconcileTimestamp: null,
      });

      const result = await engine.sync(SyncTrigger.MANUAL);

      expect(syncApiService.getBootstrap).toHaveBeenCalledWith(1, 1);
      expect(syncStateLocalStorage.updateCursor).toHaveBeenCalledWith(1234, "epoch-1");
      expect(manifestReconciler.reconcile).toHaveBeenCalledTimes(1); // exactly once, not twice!
      expect(deltaSyncStrategy.sync).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(SyncResult.SUCCESS);
    });
  });

  describe("::sync FORCE_BOOTSTRAP trigger", () => {
    it("should execute full bootstrap even when local data exists", async () => {
      jest.spyOn(ResourceLocalStorage, "get").mockResolvedValue([{ id: "res-1" }, { id: "res-2" }]);

      const result = await engine.sync(SyncTrigger.FORCE_BOOTSTRAP);

      expect(bootstrapStrategy.bootstrap).toHaveBeenCalledTimes(1);
      expect(deltaSyncStrategy.sync).not.toHaveBeenCalled();
      expect(result.status).toBe(SyncResult.SUCCESS);
      expect(result.details.type).toBe("BOOTSTRAP");
    });
  });
});
