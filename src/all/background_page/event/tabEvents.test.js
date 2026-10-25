/**
 * Passly ~ Open source password manager for teams
 * Copyright (c) 2026 Svaroh
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) Svaroh
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://passly.svaroh.net Passly
 * @since         6.1.1
 */

import { TabEvents } from "./tabEvents";
import OpenVaultPageTabController from "../controller/tab/openVaultPageTabController";
import OpenTrustedDomainTabController from "../controller/tab/openTrustedDomainTabController";

describe("TabEvents", () => {
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
    };
    TabEvents.listen(worker);
  });

  describe("passbolt.tabs.open-vault-page", () => {
    it("Should call OpenVaultPageTabController._exec with the given page data", async () => {
      expect.assertions(2);
      const execSpy = jest.spyOn(OpenVaultPageTabController.prototype, "_exec").mockResolvedValue();

      const pageData = { pathname: "/app/passwords/view/res-123", action: "edit" };
      await listeners["passbolt.tabs.open-vault-page"]("req-1", pageData);

      expect(execSpy).toHaveBeenCalledWith(pageData);
      expect(execSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("passbolt.tabs.open-trusted-domain", () => {
    it("Should call OpenTrustedDomainTabController._exec", async () => {
      expect.assertions(1);
      const execSpy = jest.spyOn(OpenTrustedDomainTabController.prototype, "_exec").mockResolvedValue();

      await listeners["passbolt.tabs.open-trusted-domain"]("req-2");

      expect(execSpy).toHaveBeenCalledTimes(1);
    });
  });
});
