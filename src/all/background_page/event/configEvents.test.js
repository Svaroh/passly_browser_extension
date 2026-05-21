/**
 * Passbolt ~ Open source password manager for teams
 * Copyright (c) 2026 Passbolt SA (https://www.passbolt.com)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) 2026 Passbolt SA (https://www.passbolt.com)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://www.passbolt.com Passbolt(tm)
 */
import { ConfigEvents } from "./configEvents";
import GetActiveAccountService from "../service/account/getActiveAccountService";

describe("ConfigEvents", () => {
  let worker, listeners;

  beforeEach(() => {
    jest.clearAllMocks();
    listeners = {};
    worker = {
      port: {
        emit: jest.fn(),
        on: jest.fn((eventName, listener) => {
          listeners[eventName] = listener;
        }),
      },
      tab: {
        url: "https://pass.66ton99.org.ua",
      },
    };
    ConfigEvents.listen(worker);
  });

  describe("passbolt.addon.is-configured", () => {
    it("Should return true when an active account can be retrieved.", async () => {
      expect.assertions(2);
      jest.spyOn(GetActiveAccountService, "get").mockResolvedValue({});

      await listeners["passbolt.addon.is-configured"]("request-id");

      expect(GetActiveAccountService.get).toHaveBeenCalledTimes(1);
      expect(worker.port.emit).toHaveBeenCalledWith("request-id", "SUCCESS", true);
    });

    it("Should return false when no active account can be retrieved.", async () => {
      expect.assertions(3);
      jest.spyOn(GetActiveAccountService, "get").mockRejectedValue(new Error("The user is not set"));
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(jest.fn());

      await listeners["passbolt.addon.is-configured"]("request-id");

      expect(GetActiveAccountService.get).toHaveBeenCalledTimes(1);
      expect(worker.port.emit).toHaveBeenCalledWith("request-id", "SUCCESS", false);
      expect(console.error).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
