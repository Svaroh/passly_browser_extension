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
 * @since         5.10.0
 */
import OpenWebsiteGettingStartedPageService from "./openWebsiteGettingStartedPageService";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("OpenWebsiteGettingStartedPageService", () => {
  describe("::openTab", () => {
    it("Should open a new tab with the local setup/recover entrypoint URL", async () => {
      expect.assertions(2);
      // mock functions
      jest.spyOn(browser.runtime, "getURL");
      jest.spyOn(browser.tabs, "create").mockImplementation(() => {});
      // process
      const service = new OpenWebsiteGettingStartedPageService();
      await service.openTab();
      // expectations
      expect(browser.runtime.getURL).toHaveBeenCalledWith(
        "webAccessibleResources/mobile-transfer-entrypoint.html?passbolt=mobile-transfer-entrypoint",
      );
      expect(browser.tabs.create).toHaveBeenCalledWith({
        url: "chrome-extension://didegimhafipceonhjepacocaffmoppf/webAccessibleResources/mobile-transfer-entrypoint.html?passbolt=mobile-transfer-entrypoint",
      });
    });

    it("Should propagate errors from tabs.create", async () => {
      expect.assertions(1);
      // mock data
      const error = new Error("Cannot open tab due to an invalid URL");
      // mock functions
      jest.spyOn(browser.tabs, "create").mockRejectedValue(error);
      // process
      const service = new OpenWebsiteGettingStartedPageService();
      // expectations
      await expect(service.openTab()).rejects.toThrow(error.message);
    });
  });
});
