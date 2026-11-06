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
import SyncApiService from "./syncApiService";

describe("SyncApiService", () => {
  let apiClientOptions;
  let service;

  beforeEach(() => {
    apiClientOptions = defaultApiClientOptions();
    service = new SyncApiService(apiClientOptions);
  });

  describe("::getMeta", () => {
    it("should request GET /sync/meta.json", async () => {
      const mockMetaResponse = {
        header: { status: "success" },
        body: {
          protocol: "sync/1",
          epoch: "test-epoch-uuid",
          min_client: "6.0.0",
          max_page_size: 500,
          retention_days: 90,
        },
      };

      jest.spyOn(service.apiClient, "fetchAndHandleResponse").mockResolvedValue(mockMetaResponse);

      const result = await service.getMeta();
      expect(service.apiClient.fetchAndHandleResponse).toHaveBeenCalledTimes(1);
      const call = service.apiClient.fetchAndHandleResponse.mock.calls[0];
      expect(call[0]).toBe("GET");
      expect(call[1].pathname).toBe("/sync/meta.json");
      expect(result).toEqual(mockMetaResponse);
    });
  });

  describe("::getChanges", () => {
    it("should request GET /sync/changes.json with since and limit parameters", async () => {
      const mockChangesResponse = {
        header: { status: "success" },
        body: {
          cursor: 105,
          has_more: false,
          upserts: { resources: [] },
          deletions: { resources: [] },
        },
      };

      jest.spyOn(service.apiClient, "fetchAndHandleResponse").mockResolvedValue(mockChangesResponse);

      const result = await service.getChanges(42, 200);
      expect(service.apiClient.fetchAndHandleResponse).toHaveBeenCalledTimes(1);
      const call = service.apiClient.fetchAndHandleResponse.mock.calls[0];
      expect(call[0]).toBe("GET");
      expect(call[1].pathname).toBe("/sync/changes.json");
      expect(call[1].searchParams.get("since")).toBe("42");
      expect(call[1].searchParams.get("limit")).toBe("200");
      expect(result).toEqual(mockChangesResponse);
    });

    it("should use default parameter values", async () => {
      jest.spyOn(service.apiClient, "fetchAndHandleResponse").mockResolvedValue({ body: {} });

      await service.getChanges();
      const call = service.apiClient.fetchAndHandleResponse.mock.calls[0];
      expect(call[1].searchParams.get("since")).toBe("0");
      expect(call[1].searchParams.get("limit")).toBe("500");
    });
  });

  describe("::getBootstrap", () => {
    it("should request GET /sync/bootstrap.json with page, limit, and pinned cursor", async () => {
      const mockBootstrapResponse = {
        header: { status: "success" },
        body: {
          cursor: 500,
          has_more: true,
          upserts: { resources: [{ id: "res-1" }] },
        },
      };

      jest.spyOn(service.apiClient, "fetchAndHandleResponse").mockResolvedValue(mockBootstrapResponse);

      const result = await service.getBootstrap(2, 250, 500);
      expect(service.apiClient.fetchAndHandleResponse).toHaveBeenCalledTimes(1);
      const call = service.apiClient.fetchAndHandleResponse.mock.calls[0];
      expect(call[0]).toBe("GET");
      expect(call[1].pathname).toBe("/sync/bootstrap.json");
      expect(call[1].searchParams.get("page")).toBe("2");
      expect(call[1].searchParams.get("limit")).toBe("250");
      expect(call[1].searchParams.get("cursor")).toBe("500");
      expect(result).toEqual(mockBootstrapResponse);
    });

    it("should omit cursor if not specified on page 1", async () => {
      jest.spyOn(service.apiClient, "fetchAndHandleResponse").mockResolvedValue({ body: {} });

      await service.getBootstrap(1, 500, null);
      const call = service.apiClient.fetchAndHandleResponse.mock.calls[0];
      expect(call[1].searchParams.get("page")).toBe("1");
      expect(call[1].searchParams.get("limit")).toBe("500");
      expect(call[1].searchParams.has("cursor")).toBe(false);
    });
  });

  describe("::getManifest", () => {
    it("should request GET /sync/manifest.json with type parameter", async () => {
      const mockManifestResponse = {
        header: { status: "success" },
        body: [{ id: "uuid-1", modified: "2026-11-01T00:00:00Z" }],
      };

      jest.spyOn(service.apiClient, "fetchAndHandleResponse").mockResolvedValue(mockManifestResponse);

      const result = await service.getManifest("resources");
      expect(service.apiClient.fetchAndHandleResponse).toHaveBeenCalledTimes(1);
      const call = service.apiClient.fetchAndHandleResponse.mock.calls[0];
      expect(call[0]).toBe("GET");
      expect(call[1].pathname).toBe("/sync/manifest.json");
      expect(call[1].searchParams.get("type")).toBe("resources");
      expect(result).toEqual(mockManifestResponse);
    });
  });
});
