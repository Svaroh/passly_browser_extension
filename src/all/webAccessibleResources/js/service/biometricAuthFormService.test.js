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

import BiometricAuthFormService from "./biometricAuthFormService";
import BiometricAuthRuntimeService from "./biometricAuthRuntimeService";

jest.mock("./biometricAuthRuntimeService", () => ({
  __esModule: true,
  default: {
    createConfiguration: jest.fn(),
    isUnavailableError: jest.fn(),
  },
}));

describe("BiometricAuthFormService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    BiometricAuthRuntimeService.createConfiguration.mockResolvedValue({ credentialId: "credential-id" });
    BiometricAuthRuntimeService.isUnavailableError.mockReturnValue(false);
  });

  describe("BiometricAuthFormService::createBiometricAwarePort", () => {
    it("Should save a PassKey configuration after a successful matching request.", async () => {
      expect.assertions(4);
      const options = { enableOnLogin: true };
      const port = {
        request: jest.fn((message) => {
          if (message === "passbolt.auth.login") {
            return Promise.resolve("LOGIN_SUCCESS");
          }
          return Promise.resolve();
        }),
      };
      const biometricAwarePort = BiometricAuthFormService.createBiometricAwarePort(port, options, {
        requestMessage: "passbolt.auth.login",
        option: "enableOnLogin",
      });

      const result = await biometricAwarePort.request("passbolt.auth.login", "passphrase", false);

      expect(result).toBe("LOGIN_SUCCESS");
      expect(BiometricAuthRuntimeService.createConfiguration).toHaveBeenCalledWith(port, "passphrase");
      expect(port.request).toHaveBeenCalledWith("passbolt.auth.login", "passphrase", false);
      expect(port.request).toHaveBeenCalledWith("passbolt.biometric-auth.save-configuration", {
        credentialId: "credential-id",
      });
    });

    it("Should support several passphrase request rules.", async () => {
      expect.assertions(3);
      const options = { enableOnLogin: true };
      const port = {
        request: jest.fn(() => Promise.resolve("SUCCESS")),
      };
      const biometricAwarePort = BiometricAuthFormService.createBiometricAwarePort(port, options, [
        {
          requestMessage: "passbolt.auth.login",
          option: "enableOnLogin",
        },
        {
          requestMessage: "passbolt.keyring.private.checkpassphrase",
          option: "enableOnLogin",
        },
      ]);

      await biometricAwarePort.request("passbolt.keyring.private.checkpassphrase", "passphrase");

      expect(BiometricAuthRuntimeService.createConfiguration).toHaveBeenCalledWith(port, "passphrase");
      expect(port.request).toHaveBeenCalledWith("passbolt.keyring.private.checkpassphrase", "passphrase");
      expect(port.request).toHaveBeenCalledWith("passbolt.biometric-auth.save-configuration", {
        credentialId: "credential-id",
      });
    });

    it("Should not save a PassKey configuration if the option is disabled.", async () => {
      expect.assertions(2);
      const options = { enableOnLogin: false };
      const port = {
        request: jest.fn(() => Promise.resolve("SUCCESS")),
      };
      const biometricAwarePort = BiometricAuthFormService.createBiometricAwarePort(port, options, {
        requestMessage: "passbolt.auth.login",
        option: "enableOnLogin",
      });

      await biometricAwarePort.request("passbolt.auth.login", "passphrase", false);

      expect(BiometricAuthRuntimeService.createConfiguration).not.toHaveBeenCalled();
      expect(port.request).toHaveBeenCalledTimes(1);
    });

    it("Should not save a PassKey configuration if the original request fails.", async () => {
      expect.assertions(2);
      const options = { enableOnLogin: true };
      const expectedError = new Error("Invalid passphrase");
      const port = {
        request: jest.fn(() => Promise.reject(expectedError)),
      };
      const biometricAwarePort = BiometricAuthFormService.createBiometricAwarePort(port, options, {
        requestMessage: "passbolt.auth.login",
        option: "enableOnLogin",
      });

      await expect(biometricAwarePort.request("passbolt.auth.login", "passphrase", false)).rejects.toBe(expectedError);
      expect(BiometricAuthRuntimeService.createConfiguration).not.toHaveBeenCalled();
    });
  });
});
