/**
 * Passbolt ~ Open source password manager for teams
 * Copyright (c) Passbolt SA (https://www.passbolt.com)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) Passbolt SA (https://www.passbolt.com)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://www.passbolt.com Passbolt(tm)
 * @since         5.13.0
 */

import { enableFetchMocks } from "jest-fetch-mock";
import { mockApiResponse, mockApiResponseError } from "passbolt-styleguide/test/mocks/mockApiResponse";
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import PassboltApiFetchError from "passbolt-styleguide/src/shared/lib/Error/PassboltApiFetchError";
import PassboltServiceUnavailableError from "passbolt-styleguide/src/shared/lib/Error/PassboltServiceUnavailableError";
import ResourceEntity from "../../model/entity/resource/resourceEntity";
import { defaultOfflineItemDto } from "passbolt-styleguide/src/shared/models/entity/offline/offlineItemEntity.test.data";
import MarkOfflineResourceService from "./markOfflineResourceService";
import OfflineItemEntity from "passbolt-styleguide/src/shared/models/entity/offline/offlineItemEntity";
import { v4 as uuidv4 } from "uuid";

describe("MarkOfflineResourceService", () => {
  let apiClientOptions;

  beforeEach(async () => {
    enableFetchMocks();
    fetch.resetMocks();
    apiClientOptions = defaultApiClientOptions();
  });

  describe("::create", () => {
    it("successfully mark a resource available offline", async () => {
      expect.assertions(2);
      const resourceId = uuidv4();
      const apiResponse = defaultOfflineItemDto({ foreign_key: resourceId });
      fetch.doMockOnceIf(new RegExp(`/offline/${ResourceEntity.ENTITY_NAME.toLowerCase()}/${resourceId}`), () =>
        mockApiResponse(apiResponse),
      );

      const service = new MarkOfflineResourceService(apiClientOptions);
      const result = await service.create(resourceId);

      expect(result).toBeInstanceOf(OfflineItemEntity);
      expect(result).toEqual(new OfflineItemEntity(apiResponse));
    });

    it("throws an Error if the parameter is not an uuid", async () => {
      expect.assertions(1);
      const service = new MarkOfflineResourceService(apiClientOptions);

      await expect(() => service.create({})).rejects.toThrow("The given parameter is not a valid UUID");
    });

    it("throws service unavailable error if an error occurred but not from the API", async () => {
      expect.assertions(1);
      const resourceId = uuidv4();
      fetch.doMockOnceIf(new RegExp(`/offline/${ResourceEntity.ENTITY_NAME.toLowerCase()}/${resourceId}`), () => {
        throw new Error("Service unavailable");
      });

      const service = new MarkOfflineResourceService(apiClientOptions);

      await expect(() => service.create(resourceId)).rejects.toThrow(PassboltServiceUnavailableError);
    });

    it("throws API error if the API encountered an issue", async () => {
      expect.assertions(1);
      const resourceId = uuidv4();
      fetch.doMockOnceIf(new RegExp(`/offline/${ResourceEntity.ENTITY_NAME.toLowerCase()}/${resourceId}`), () =>
        mockApiResponseError(500, "Something wrong happened!"),
      );

      const service = new MarkOfflineResourceService(apiClientOptions);

      await expect(() => service.create(resourceId)).rejects.toThrow(PassboltApiFetchError);
    });
  });
});
