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
 * @since         6.0.0
 */

import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import PassboltResponseEntity from "passbolt-styleguide/src/shared/models/entity/apiService/PassboltResponseEntity";
import FindServerStatusService from "./findServerStatusService";

describe("FindServerStatusService", () => {
  describe("::find", () => {
    it("should call the api service and return a boolean", async () => {
      expect.assertions(1);

      const apiClientOptions = defaultApiClientOptions();
      const mockPassboltResponse = new PassboltResponseEntity({ header: {}, body: "Ok" });

      const service = new FindServerStatusService(apiClientOptions);
      jest.spyOn(service.serverStatusApiService, "find").mockReturnValue(mockPassboltResponse);
      const result = await service.find();

      expect(result).toBeTruthy();
    });

    it("should call the api service and return false if the API throw an error", async () => {
      expect.assertions(1);

      const apiClientOptions = defaultApiClientOptions();

      const service = new FindServerStatusService(apiClientOptions);
      jest.spyOn(service.serverStatusApiService, "find").mockImplementation(() => {
        throw new Error();
      });
      const result = await service.find();

      expect(result).toBeFalsy();
    });
  });
});
