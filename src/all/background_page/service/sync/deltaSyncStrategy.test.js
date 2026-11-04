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
import DeltaSyncStrategy from "./deltaSyncStrategy";

describe("DeltaSyncStrategy", () => {
  let syncApiService;
  let changesApplier;
  let syncStateLocalStorage;
  let strategy;

  beforeEach(() => {
    syncApiService = {
      getChanges: jest.fn(),
    };
    changesApplier = {
      apply: jest.fn().mockResolvedValue(),
    };
    syncStateLocalStorage = {
      get: jest.fn().mockResolvedValue({ cursor: 100, epoch: "epoch-1" }),
    };

    strategy = new DeltaSyncStrategy(syncApiService, changesApplier, syncStateLocalStorage);
  });

  describe("::sync", () => {
    it("should process a single page of changes when has_more is false", async () => {
      syncApiService.getChanges.mockResolvedValue({
        body: {
          cursor: 105,
          has_more: false,
          upserts: { resources: [{ id: "res-1" }] },
          deletions: { resources: ["res-2"] },
        },
      });

      const result = await strategy.sync("passphrase-123");

      expect(syncApiService.getChanges).toHaveBeenCalledWith(100, 500);
      expect(changesApplier.apply).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: 105 }),
        "passphrase-123",
        "epoch-1",
      );
      expect(result).toEqual({
        success: true,
        cursor: 105,
        totalUpserts: 1,
        totalDeletions: 1,
      });
    });

    it("should iterate across multiple pages until has_more is false", async () => {
      syncApiService.getChanges
        .mockResolvedValueOnce({
          body: {
            cursor: 200,
            has_more: true,
            upserts: { resources: [{ id: "res-1" }] },
          },
        })
        .mockResolvedValueOnce({
          body: {
            cursor: 300,
            has_more: false,
            upserts: { resources: [{ id: "res-2" }] },
          },
        });

      const result = await strategy.sync();

      expect(syncApiService.getChanges).toHaveBeenCalledTimes(2);
      expect(syncApiService.getChanges).toHaveBeenNthCalledWith(1, 100, 500);
      expect(syncApiService.getChanges).toHaveBeenNthCalledWith(2, 200, 500);
      expect(result.cursor).toBe(300);
      expect(result.totalUpserts).toBe(2);
    });

    it("should catch 410 Gone and return isGone: true for recovery", async () => {
      const goneError = new Error("Cursor expired");
      goneError.code = 410;

      syncApiService.getChanges.mockRejectedValue(goneError);

      const result = await strategy.sync();

      expect(result).toEqual({
        success: false,
        isGone: true,
      });
      expect(changesApplier.apply).not.toHaveBeenCalled();
    });

    it("should re-throw non-410 errors", async () => {
      const serverError = new Error("Internal Server Error");
      serverError.code = 500;

      syncApiService.getChanges.mockRejectedValue(serverError);

      await expect(strategy.sync()).rejects.toThrow("Internal Server Error");
    });
  });
});
