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
import {
  createRequestPassphraseClosingPort,
  ensureQuickAccessConfigured,
  openPassboltLoginPageForPasskey,
  shouldOpenPassboltPageForQuickAccessPasskey,
} from "./QuickAccess";
import BiometricAuthFormService from "../service/biometricAuthFormService";

describe("QuickAccess", () => {
  describe("ensureQuickAccessConfigured", () => {
    it("Should continue rendering when the extension has an active account.", async () => {
      expect.assertions(2);
      const port = {
        request: jest.fn().mockResolvedValue(true),
      };

      const isConfigured = await ensureQuickAccessConfigured(port);

      expect(isConfigured).toBe(true);
      expect(port.request).toHaveBeenCalledWith("passbolt.addon.is-configured");
    });

    it("Should open the local setup entrypoint and close the popup when no active account is configured.", async () => {
      expect.assertions(4);
      const closeWindow = jest.fn();
      const port = {
        request: jest.fn((message) => (message === "passbolt.addon.is-configured" ? false : undefined)),
      };

      const isConfigured = await ensureQuickAccessConfigured(port, { closeWindow });

      expect(isConfigured).toBe(false);
      expect(port.request).toHaveBeenCalledWith("passbolt.addon.is-configured");
      expect(port.request).toHaveBeenCalledWith("passbolt.tabs.open-website-getting-started-page");
      expect(closeWindow).toHaveBeenCalledTimes(1);
    });

    it("Should open the local setup entrypoint and close the detached quickaccess tab.", async () => {
      expect.assertions(4);
      const port = {
        request: jest.fn((message) => (message === "passbolt.addon.is-configured" ? false : undefined)),
      };

      const isConfigured = await ensureQuickAccessConfigured(port, { detached: true });

      expect(isConfigured).toBe(false);
      expect(port.request).toHaveBeenCalledWith("passbolt.addon.is-configured");
      expect(port.request).toHaveBeenCalledWith("passbolt.tabs.open-website-getting-started-page");
      expect(port.request).toHaveBeenCalledWith("passbolt.active-tab.close");
    });
  });

  describe("shouldOpenPassboltPageForQuickAccessPasskey", () => {
    it("Should require the HTTPS Passbolt page for Firefox extension pages.", () => {
      expect.assertions(1);
      delete global.location;
      global.location = new URL("moz-extension://extension-id/webAccessibleResources/quickaccess.html");

      expect(shouldOpenPassboltPageForQuickAccessPasskey()).toBe(true);
    });

    it("Should keep the current flow outside Firefox extension pages.", () => {
      expect.assertions(1);
      delete global.location;
      global.location = new URL("chrome-extension://extension-id/webAccessibleResources/quickaccess.html");

      expect(shouldOpenPassboltPageForQuickAccessPasskey()).toBe(false);
    });
  });

  describe("openPassboltLoginPageForPasskey", () => {
    it("Should open the Passbolt HTTPS login page with locale and PassKey auto-login token.", async () => {
      expect.assertions(5);
      const closeWindow = jest.fn();
      const port = {
        request: jest.fn((message) => {
          if (message === "passbolt.addon.get-domain") {
            return "https://passbolt.test";
          }
          if (message === "passbolt.locale.get") {
            return { locale: "uk-UA" };
          }
        }),
      };
      jest.spyOn(BiometricAuthFormService, "generatePasskeyAutoLoginToken").mockReturnValue("auto-login-token");
      jest.spyOn(browser.tabs, "create").mockImplementation(jest.fn());

      await openPassboltLoginPageForPasskey(port, { closeWindow });

      expect(port.request).toHaveBeenCalledWith("passbolt.addon.get-domain");
      expect(port.request).toHaveBeenCalledWith("passbolt.locale.get");
      expect(browser.tabs.create).toHaveBeenCalledWith({
        url: "https://passbolt.test/auth/login?redirect=%2F&locale=uk-UA&passbolt_auto_passkey=auto-login-token",
        active: true,
      });
      await expect(browser.storage.local.get("passbolt.quickaccess.passkeyAutoLogin")).resolves.toEqual({
        "passbolt.quickaccess.passkeyAutoLogin": {
          token: "auto-login-token",
          origin: "https://passbolt.test",
          created: expect.any(Number),
        },
      });
      expect(closeWindow).toHaveBeenCalledTimes(1);
    });
  });

  describe("createRequestPassphraseClosingPort", () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it("Should close the attached popup after the bootstrap passphrase response is emitted.", () => {
      expect.assertions(6);
      jest.useFakeTimers();
      const closeWindow = jest.fn();
      const port = {
        emit: jest.fn(() => "sent"),
      };

      const wrappedPort = createRequestPassphraseClosingPort(port, {
        bootstrapFeature: "request-passphrase",
        bootstrapRequestId: "request-id",
        closeWindow,
      });

      expect(wrappedPort.emit("other-request-id", "SUCCESS")).toBe("sent");
      expect(closeWindow).not.toHaveBeenCalled();

      expect(wrappedPort.emit("request-id", "SUCCESS", { passphrase: "passphrase" })).toBe("sent");
      expect(port.emit).toHaveBeenCalledWith("request-id", "SUCCESS", { passphrase: "passphrase" });

      jest.advanceTimersByTime(99);
      expect(closeWindow).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(closeWindow).toHaveBeenCalledTimes(1);
    });

    it("Should keep detached request-passphrase ports unchanged.", () => {
      expect.assertions(1);
      const port = {
        emit: jest.fn(),
      };

      const wrappedPort = createRequestPassphraseClosingPort(port, {
        bootstrapFeature: "request-passphrase",
        bootstrapRequestId: "request-id",
        detached: true,
      });

      expect(wrappedPort).toBe(port);
    });

    it("Should complete the bootstrap passphrase request and close the attached popup after login succeeds without MFA.", async () => {
      expect.assertions(7);
      jest.useFakeTimers();
      const closeWindow = jest.fn();
      const port = {
        request: jest.fn((message) => {
          if (message === "passbolt.auth.login") {
            return Promise.resolve();
          }
          if (message === "passbolt.auth.is-mfa-required") {
            return Promise.resolve(false);
          }
        }),
        emit: jest.fn(() => Promise.resolve()),
      };

      const wrappedPort = createRequestPassphraseClosingPort(port, {
        bootstrapFeature: "request-passphrase",
        bootstrapRequestId: "request-id",
        closeWindow,
      });

      await wrappedPort.request("passbolt.auth.login", "passphrase", false);
      await wrappedPort.request("passbolt.auth.is-mfa-required");

      expect(port.request).toHaveBeenCalledWith("passbolt.auth.login", "passphrase", false);
      expect(port.request).toHaveBeenCalledWith("passbolt.auth.is-mfa-required");
      expect(port.emit).toHaveBeenCalledWith("request-id", "SUCCESS", {
        passphrase: "passphrase",
        rememberMe: false,
      });
      expect(closeWindow).not.toHaveBeenCalled();

      jest.advanceTimersByTime(99);
      expect(closeWindow).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(closeWindow).toHaveBeenCalledTimes(1);
      expect(port.emit).toHaveBeenCalledTimes(1);
    });

    it("Should keep the attached popup open when login still requires MFA.", async () => {
      expect.assertions(4);
      jest.useFakeTimers();
      const closeWindow = jest.fn();
      const port = {
        request: jest.fn((message) => {
          if (message === "passbolt.auth.login") {
            return Promise.resolve();
          }
          if (message === "passbolt.auth.is-mfa-required") {
            return Promise.resolve(true);
          }
        }),
        emit: jest.fn(() => Promise.resolve()),
      };

      const wrappedPort = createRequestPassphraseClosingPort(port, {
        bootstrapFeature: "request-passphrase",
        bootstrapRequestId: "request-id",
        closeWindow,
      });

      await wrappedPort.request("passbolt.auth.login", "passphrase", false);
      await wrappedPort.request("passbolt.auth.is-mfa-required");
      jest.runOnlyPendingTimers();

      expect(port.request).toHaveBeenCalledWith("passbolt.auth.login", "passphrase", false);
      expect(port.request).toHaveBeenCalledWith("passbolt.auth.is-mfa-required");
      expect(port.emit).not.toHaveBeenCalled();
      expect(closeWindow).not.toHaveBeenCalled();
    });
  });
});
