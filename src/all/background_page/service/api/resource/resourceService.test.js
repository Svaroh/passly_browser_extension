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
 * @since         6.0.1
 */

import { enableFetchMocks } from "jest-fetch-mock";
import { mockApiResponse } from "../../../../../../test/mocks/mockApiResponse";
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import { defaultResourceDto } from "passbolt-styleguide/src/shared/models/entity/resource/resourceEntity.test.data";
import ResourceService from "./resourceService";
import { v4 as uuidv4 } from "uuid";

describe("ResourceService", () => {
  beforeEach(async () => {
    enableFetchMocks();
    fetch.resetMocks();
  });

  describe("::findAll", () => {
    it("Should support requesting deleted resources", async () => {
      expect.assertions(2);

      let url, method;
      fetch.doMockIf(/resources/, async (req) => {
        url = new URL(req.url);
        method = req.method;
        return mockApiResponse([]);
      });

      const service = new ResourceService(defaultApiClientOptions());
      await service.findAll(null, { "is-deleted": true });

      expect(method).toStrictEqual("GET");
      expect(url.searchParams.get("filter[is-deleted]")).toStrictEqual("1");
    });
  });

  describe("::delete", () => {
    it("Should request a recoverable delete when requested", async () => {
      expect.assertions(2);

      const resourceId = uuidv4();
      let url, method;
      fetch.doMockIf(/resources/, async (req) => {
        url = new URL(req.url);
        method = req.method;
        return mockApiResponse(null);
      });

      const service = new ResourceService(defaultApiClientOptions());
      await service.delete(resourceId, true);

      expect(method).toStrictEqual("DELETE");
      expect(url.searchParams.get("recoverable")).toStrictEqual("1");
    });
  });

  describe("::restore", () => {
    it("Should request the API to restore the given resource", async () => {
      expect.assertions(3);

      const resourceDto = defaultResourceDto();
      let url, method;
      fetch.doMockIf(/resources/, async (req) => {
        url = new URL(req.url);
        method = req.method;
        return mockApiResponse(resourceDto);
      });

      const service = new ResourceService(defaultApiClientOptions());
      const result = await service.restore(resourceDto.id);

      expect(method).toStrictEqual("POST");
      expect(url.pathname).toContain(`/resources/${resourceDto.id}/restore.json`);
      expect(result).toStrictEqual(resourceDto);
    });
  });
});
