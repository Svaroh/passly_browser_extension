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
import BootstrapStrategy from "./bootstrapStrategy";

describe("BootstrapStrategy", () => {
  let syncApiService;
  let changesApplier;
  let syncStateLocalStorage;
  let strategy;

  beforeEach(() => {
    syncApiService = {
      getMeta: jest.fn().mockResolvedValue({ body: { epoch: "test-epoch-uuid" } }),
      getBootstrap: jest.fn(),
    };
    changesApplier = {
      apply: jest.fn().mockResolvedValue(),
    };
    syncStateLocalStorage = {
      updateCursor: jest.fn().mockResolvedValue(),
    };

    strategy = new BootstrapStrategy(syncApiService, changesApplier, syncStateLocalStorage);
  });

  describe("::bootstrap", () => {
    it("should fetch meta and single bootstrap page, pinning cursor", async () => {
      syncApiService.getBootstrap.mockResolvedValue({
        body: {
          cursor: 5000,
          has_more: false,
          upserts: { resources: [{ id: "res-1" }] },
        },
      });

      const result = await strategy.bootstrap("passphrase-xyz");

      expect(syncApiService.getMeta).toHaveBeenCalledTimes(1);
      expect(syncApiService.getBootstrap).toHaveBeenCalledWith(1, 500, null);
      expect(changesApplier.apply).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: 5000 }),
        "passphrase-xyz",
        "test-epoch-uuid",
      );
      expect(result).toEqual({
        success: true,
        cursor: 5000,
        epoch: "test-epoch-uuid",
      });
    });

    it("should paginate across multiple pages, preserving pinned cursor from page 1", async () => {
      syncApiService.getBootstrap
        .mockResolvedValueOnce({
          body: {
            cursor: 7777,
            has_more: true,
            upserts: { resources: [{ id: "res-1" }] },
          },
        })
        .mockResolvedValueOnce({
          body: {
            cursor: 8888, // concurrent changes on server might bump this, but client must pin
            has_more: false,
            upserts: { resources: [{ id: "res-2" }] },
          },
        });

      const result = await strategy.bootstrap();

      expect(syncApiService.getBootstrap).toHaveBeenCalledTimes(2);
      expect(syncApiService.getBootstrap).toHaveBeenNthCalledWith(1, 1, 500, null);
      expect(syncApiService.getBootstrap).toHaveBeenNthCalledWith(2, 2, 500, 7777);

      expect(changesApplier.apply).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ cursor: null }),
        null,
        "test-epoch-uuid",
      );
      expect(changesApplier.apply).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ cursor: 7777 }),
        null,
        "test-epoch-uuid",
      );

      expect(syncStateLocalStorage.updateCursor).toHaveBeenCalledWith(7777, "test-epoch-uuid");
      expect(result.cursor).toBe(7777);
    });
  });
});
