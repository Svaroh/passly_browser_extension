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

import OpenVaultPageTabController from "./openVaultPageTabController";
import OpenTrustedDomainTabService from "../../service/ui/openTrustedDomainTabService";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("OpenVaultPageTabController", () => {
  describe("::exec", () => {
    it("Should call the service to open the tab at path with action", async () => {
      expect.assertions(1);
      jest.spyOn(OpenTrustedDomainTabService.prototype, "openTabAtPath").mockResolvedValue();

      const controller = new OpenVaultPageTabController(null, null);
      await controller.exec({ pathname: "/app/passwords/view/123", action: "edit" });

      expect(OpenTrustedDomainTabService.prototype.openTabAtPath).toHaveBeenCalledWith(
        "/app/passwords/view/123",
        "edit",
      );
    });

    it("Should throw error if pathname does not start with /app/", async () => {
      expect.assertions(1);
      const controller = new OpenVaultPageTabController(null, null);
      await expect(controller.exec({ pathname: "/malicious/route" })).rejects.toThrow(
        "The pathname should be a route of the application.",
      );
    });
  });

  describe("::_exec", () => {
    it("Should emit SUCCESS when exec completes", async () => {
      expect.assertions(1);
      jest.spyOn(OpenTrustedDomainTabService.prototype, "openTabAtPath").mockResolvedValue();
      const worker = {
        port: {
          emit: jest.fn(),
        },
      };

      const controller = new OpenVaultPageTabController(worker, "request-123");
      await controller._exec({ pathname: "/app/passwords/view/123" });

      expect(worker.port.emit).toHaveBeenCalledWith("request-123", "SUCCESS");
    });

    it("Should emit ERROR when exec rejects", async () => {
      expect.assertions(1);
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const worker = {
        port: {
          emit: jest.fn(),
        },
      };

      const controller = new OpenVaultPageTabController(worker, "request-123");
      await controller._exec({ pathname: "/invalid" });

      expect(worker.port.emit).toHaveBeenCalledWith("request-123", "ERROR", expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });
});
