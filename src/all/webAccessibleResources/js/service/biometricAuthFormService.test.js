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
  beforeEach(async () => {
    jest.clearAllMocks();
    await browser.storage.local.clear();
    BiometricAuthRuntimeService.createConfiguration.mockResolvedValue({ credentialId: "credential-id" });
    BiometricAuthRuntimeService.isUnavailableError.mockReturnValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

  describe("BiometricAuthFormService::preparePasskeyAutoLoginUrl", () => {
    it("Should store a one-time token and add it to the login URL.", async () => {
      expect.assertions(2);
      jest.spyOn(Date, "now").mockReturnValue(1000);
      jest.spyOn(BiometricAuthFormService, "generatePasskeyAutoLoginToken").mockReturnValue("token");
      const url = new URL("https://passbolt.test/auth/login?redirect=%2F&locale=uk-UA");

      await BiometricAuthFormService.preparePasskeyAutoLoginUrl(browser.storage, url);

      expect(url.toString()).toBe(
        "https://passbolt.test/auth/login?redirect=%2F&locale=uk-UA&passbolt_auto_passkey=token",
      );
      await expect(browser.storage.local.get("passbolt.quickaccess.passkeyAutoLogin")).resolves.toEqual({
        "passbolt.quickaccess.passkeyAutoLogin": {
          token: "token",
          origin: "https://passbolt.test",
          created: 1000,
        },
      });
    });
  });

  describe("BiometricAuthFormService::consumePasskeyAutoLoginRequest", () => {
    it("Should consume a valid one-time token.", async () => {
      expect.assertions(2);
      jest.spyOn(Date, "now").mockReturnValue(2000);
      await browser.storage.local.set({
        "passbolt.quickaccess.passkeyAutoLogin": {
          token: "token",
          origin: "https://passbolt.test",
          created: 1000,
        },
      });
      const location = new URL("https://passbolt.test/auth/login?passbolt_auto_passkey=token");

      await expect(BiometricAuthFormService.consumePasskeyAutoLoginRequest(browser.storage, location)).resolves.toBe(
        true,
      );
      await expect(browser.storage.local.get("passbolt.quickaccess.passkeyAutoLogin")).resolves.toEqual({});
    });

    it("Should reject a token that does not match the stored request.", async () => {
      expect.assertions(2);
      jest.spyOn(Date, "now").mockReturnValue(2000);
      await browser.storage.local.set({
        "passbolt.quickaccess.passkeyAutoLogin": {
          token: "token",
          origin: "https://passbolt.test",
          created: 1000,
        },
      });
      const location = new URL("https://passbolt.test/auth/login?passbolt_auto_passkey=wrong-token");

      await expect(BiometricAuthFormService.consumePasskeyAutoLoginRequest(browser.storage, location)).resolves.toBe(
        false,
      );
      await expect(browser.storage.local.get("passbolt.quickaccess.passkeyAutoLogin")).resolves.toEqual({
        "passbolt.quickaccess.passkeyAutoLogin": {
          token: "token",
          origin: "https://passbolt.test",
          created: 1000,
        },
      });
    });

    it("Should reject pending requests without a URL token by default.", async () => {
      expect.assertions(2);
      jest.spyOn(Date, "now").mockReturnValue(2000);
      await browser.storage.local.set({
        "passbolt.quickaccess.passkeyAutoLogin": {
          token: "token",
          origin: "https://passbolt.test",
          created: 1000,
        },
      });
      const location = new URL("moz-extension://extension-id/webAccessibleResources/passbolt-iframe-login.html");

      await expect(BiometricAuthFormService.consumePasskeyAutoLoginRequest(browser.storage, location)).resolves.toBe(
        false,
      );
      await expect(browser.storage.local.get("passbolt.quickaccess.passkeyAutoLogin")).resolves.toEqual({
        "passbolt.quickaccess.passkeyAutoLogin": {
          token: "token",
          origin: "https://passbolt.test",
          created: 1000,
        },
      });
    });

    it("Should consume a pending request without a URL token when the expected Passbolt origin matches.", async () => {
      expect.assertions(2);
      jest.spyOn(Date, "now").mockReturnValue(2000);
      await browser.storage.local.set({
        "passbolt.quickaccess.passkeyAutoLogin": {
          token: "token",
          origin: "https://passbolt.test",
          created: 1000,
        },
      });
      const location = new URL("moz-extension://extension-id/webAccessibleResources/passbolt-iframe-login.html");

      await expect(
        BiometricAuthFormService.consumePasskeyAutoLoginRequest(browser.storage, location, {
          allowPendingRequestWithoutUrlToken: true,
          expectedOrigin: "https://passbolt.test/auth/login",
        }),
      ).resolves.toBe(true);
      await expect(browser.storage.local.get("passbolt.quickaccess.passkeyAutoLogin")).resolves.toEqual({});
    });

    it("Should reject a pending request without a URL token when the expected Passbolt origin differs.", async () => {
      expect.assertions(2);
      jest.spyOn(Date, "now").mockReturnValue(2000);
      await browser.storage.local.set({
        "passbolt.quickaccess.passkeyAutoLogin": {
          token: "token",
          origin: "https://passbolt.test",
          created: 1000,
        },
      });
      const location = new URL("moz-extension://extension-id/webAccessibleResources/passbolt-iframe-login.html");

      await expect(
        BiometricAuthFormService.consumePasskeyAutoLoginRequest(browser.storage, location, {
          allowPendingRequestWithoutUrlToken: true,
          expectedOrigin: "https://attacker.test",
        }),
      ).resolves.toBe(false);
      await expect(browser.storage.local.get("passbolt.quickaccess.passkeyAutoLogin")).resolves.toEqual({
        "passbolt.quickaccess.passkeyAutoLogin": {
          token: "token",
          origin: "https://passbolt.test",
          created: 1000,
        },
      });
    });

    it("Should reject and clear an expired token.", async () => {
      expect.assertions(2);
      jest.spyOn(Date, "now").mockReturnValue(121001);
      await browser.storage.local.set({
        "passbolt.quickaccess.passkeyAutoLogin": {
          token: "token",
          origin: "https://passbolt.test",
          created: 1000,
        },
      });
      const location = new URL("https://passbolt.test/auth/login?passbolt_auto_passkey=token");

      await expect(BiometricAuthFormService.consumePasskeyAutoLoginRequest(browser.storage, location)).resolves.toBe(
        false,
      );
      await expect(browser.storage.local.get("passbolt.quickaccess.passkeyAutoLogin")).resolves.toEqual({});
    });
  });

  describe("BiometricAuthFormService::getRememberMeChoice", () => {
    const originalDocument = globalThis.document;

    afterEach(() => {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: originalDocument,
      });
    });

    it("Should return true when the login remember-me checkbox is checked.", () => {
      const form = {
        querySelector: jest.fn(() => ({ checked: true })),
      };
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: {
          querySelector: jest.fn(() => form),
        },
      });

      expect(BiometricAuthFormService.getRememberMeChoice()).toBe(true);
      expect(globalThis.document.querySelector).toHaveBeenCalledWith("#container .login .enter-passphrase");
      expect(form.querySelector).toHaveBeenCalledWith(
        "#remember-me, input[name='remember-me'], input[name='rememberMe']",
      );
    });

    it("Should return false when the login remember-me checkbox is not checked.", () => {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: {
          querySelector: jest.fn(() => ({
            querySelector: jest.fn(() => ({ checked: false })),
          })),
        },
      });

      expect(BiometricAuthFormService.getRememberMeChoice()).toBe(false);
    });
  });
});
