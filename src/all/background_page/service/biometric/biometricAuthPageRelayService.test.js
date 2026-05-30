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
 */

import BiometricAuthPageRelayService from "./biometricAuthPageRelayService";
import WorkerService from "../worker/workerService";
import BrowserTabService from "../ui/browserTab.service";
import WorkersSessionStorage from "../sessionStorage/workersSessionStorage";
import { Config } from "../../model/config";

describe("BiometricAuthPageRelayService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(BiometricAuthPageRelayService, "sleep").mockImplementation(() => Promise.resolve());
    jest.spyOn(BrowserTabService, "getCurrent").mockResolvedValue({ id: 27 });
    jest.spyOn(WorkersSessionStorage, "getWorkersByNames").mockResolvedValue([]);
    Config.write("user.settings.trustedDomain", "https://passbolt.dev");
  });

  describe("::getPageWorker", () => {
    it("Should wait for the current login tab bootstrap worker instead of opening a new tab.", async () => {
      expect.assertions(3);

      const pageWorker = { port: { request: jest.fn() }, tab: { id: 27 } };
      let calls = 0;
      jest.spyOn(WorkerService, "get").mockImplementation(async (workerName) => {
        calls++;
        if (calls > 4 && workerName === "AuthBootstrap") {
          return pageWorker;
        }
        throw new Error(`Could not find worker ${workerName}.`);
      });
      jest.spyOn(browser.tabs, "create").mockImplementation(jest.fn());

      const result = await BiometricAuthPageRelayService.getPageWorker({ name: "Auth", tab: { id: 27 } });

      expect(result).toStrictEqual(pageWorker);
      expect(browser.tabs.create).not.toHaveBeenCalled();
      expect(WorkerService.get).toHaveBeenCalledWith("AuthBootstrap", 27);
    });

    it("Should open a trusted-domain tab for a non login-family requester if no page worker exists.", async () => {
      expect.assertions(4);

      const pageWorker = { port: { request: jest.fn() }, tab: { id: 99 } };
      let openedTabProbeCount = 0;
      jest.spyOn(WorkerService, "get").mockImplementation(async (workerName, tabId) => {
        if (tabId === 99 && workerName === "AuthBootstrap" && openedTabProbeCount++ > 0) {
          return pageWorker;
        }
        throw new Error(`Could not find worker ${workerName}.`);
      });
      jest.spyOn(browser.tabs, "create").mockResolvedValue({ id: 99 });

      const result = await BiometricAuthPageRelayService.getPageWorker({ name: "QuickAccess", tab: { id: 10 } });

      expect(result).toStrictEqual(pageWorker);
      expect(browser.tabs.create).toHaveBeenCalledWith({ url: "https://passbolt.dev", active: true });
      expect(WorkerService.get).toHaveBeenCalledWith("AuthBootstrap", 99);
      expect(browser.tabs.create.mock.invocationCallOrder[0]).toBeLessThan(
        BiometricAuthPageRelayService.sleep.mock.invocationCallOrder[0],
      );
    });
  });
});
