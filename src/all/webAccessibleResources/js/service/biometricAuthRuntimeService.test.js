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

import BiometricAuthRuntimeService from "./biometricAuthRuntimeService";
import BiometricAuthClientService from "./biometricAuthClientService";
import { PASSKEY_PROVIDER_MESSAGES } from "../../../passkey/passkeyProviderConstants";

describe("BiometricAuthRuntimeService", () => {
  const originalLocation = globalThis.location;
  const passkeyProviderSuspendMessage = PASSKEY_PROVIDER_MESSAGES.SUSPEND;
  const passkeyProviderResumeMessage = PASSKEY_PROVIDER_MESSAGES.RESUME;

  beforeEach(() => {
    browser.runtime.sendMessage.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete chrome.webAuthenticationProxy;
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  const mockLocation = (location) => {
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: location,
    });
  };

  describe("::usePassboltPageOrigin", () => {
    it("Should use Chrome extension pages directly.", () => {
      mockLocation({ protocol: "chrome-extension:" });

      expect(BiometricAuthRuntimeService.usePassboltPageOrigin()).toBe(false);
    });

    it("Should delegate WebAuthn from Firefox extension pages to the Passbolt HTTPS origin.", () => {
      mockLocation({ protocol: "moz-extension:" });

      expect(BiometricAuthRuntimeService.usePassboltPageOrigin()).toBe(true);
    });

    it("Should use the current HTTPS page origin directly.", () => {
      mockLocation({ protocol: "https:", hostname: "pass.66ton99.org.ua" });

      expect(BiometricAuthRuntimeService.usePassboltPageOrigin()).toBe(false);
    });
  });

  describe("::getRpId", () => {
    it("Should use the active Passbolt hostname on HTTPS pages.", async () => {
      mockLocation({ protocol: "https:", hostname: "pass.66ton99.org.ua" });

      await expect(BiometricAuthRuntimeService.getRpId({ request: jest.fn() })).resolves.toBe("pass.66ton99.org.ua");
    });

    it("Should use the extension origin default from Chrome extension pages.", async () => {
      mockLocation({ protocol: "chrome-extension:" });
      const port = {
        request: jest.fn().mockResolvedValue("https://pass.66ton99.org.ua/"),
      };

      await expect(BiometricAuthRuntimeService.getRpId(port)).resolves.toBeNull();
      expect(port.request).not.toHaveBeenCalled();
    });

    it("Should use the configured trusted domain from Firefox extension pages.", async () => {
      mockLocation({ protocol: "moz-extension:" });
      const port = {
        request: jest.fn().mockResolvedValue("https://pass.66ton99.org.ua/"),
      };

      await expect(BiometricAuthRuntimeService.getRpId(port)).resolves.toBe("pass.66ton99.org.ua");
      expect(port.request).toHaveBeenCalledWith("passbolt.addon.get-domain");
    });
  });

  describe("::getCompatibleConfiguration", () => {
    it("Should return extension-origin configurations on Chrome extension pages.", async () => {
      mockLocation({ protocol: "chrome-extension:" });
      const configuration = { credential_id: "credential", rp_id: null };

      await expect(
        BiometricAuthRuntimeService.getCompatibleConfiguration({ request: jest.fn() }, configuration),
      ).resolves.toBe(configuration);
    });

    it("Should reject HTTPS-origin configurations on Chrome extension pages.", async () => {
      mockLocation({ protocol: "chrome-extension:" });
      const configuration = { credential_id: "credential", rp_id: "pass.66ton99.org.ua" };

      await expect(
        BiometricAuthRuntimeService.getCompatibleConfiguration({ request: jest.fn() }, configuration),
      ).resolves.toBeNull();
    });

    it("Should reject legacy extension-origin configurations without rp_id.", async () => {
      mockLocation({ protocol: "https:", hostname: "pass.66ton99.org.ua" });
      const configuration = { credential_id: "legacy" };

      await expect(
        BiometricAuthRuntimeService.getCompatibleConfiguration({ request: jest.fn() }, configuration),
      ).resolves.toBeNull();
    });

    it("Should return configurations created for the current Passbolt domain.", async () => {
      mockLocation({ protocol: "https:", hostname: "pass.66ton99.org.ua" });
      const configuration = { credential_id: "credential", rp_id: "pass.66ton99.org.ua" };

      await expect(
        BiometricAuthRuntimeService.getCompatibleConfiguration({ request: jest.fn() }, configuration),
      ).resolves.toBe(configuration);
    });
  });

  describe("::unlock", () => {
    it("Should suspend the MV3 passkey provider while running the local biometric WebAuthn unlock.", async () => {
      mockLocation({ protocol: "chrome-extension:" });
      const port = { request: jest.fn() };
      const configuration = { credential_id: "credential", rp_id: null };
      jest.spyOn(browser.runtime, "sendMessage").mockResolvedValue({ ok: true });
      jest.spyOn(BiometricAuthClientService, "unlock").mockImplementation(async () => {
        expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(1);
        expect(browser.runtime.sendMessage).toHaveBeenNthCalledWith(1, { name: passkeyProviderSuspendMessage });
        return "passphrase";
      });

      await expect(BiometricAuthRuntimeService.unlock(port, configuration)).resolves.toBe("passphrase");

      expect(BiometricAuthClientService.unlock).toHaveBeenCalledWith(configuration, null);
      expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(2);
      expect(browser.runtime.sendMessage).toHaveBeenNthCalledWith(2, { name: passkeyProviderResumeMessage });
    });

    it("Should resume the MV3 passkey provider when the local biometric WebAuthn unlock fails.", async () => {
      mockLocation({ protocol: "chrome-extension:" });
      const port = { request: jest.fn() };
      const configuration = { credential_id: "credential", rp_id: null };
      const error = new Error("Biometric unlock failed.");
      jest.spyOn(browser.runtime, "sendMessage").mockResolvedValue({ ok: true });
      jest.spyOn(BiometricAuthClientService, "unlock").mockRejectedValue(error);

      await expect(BiometricAuthRuntimeService.unlock(port, configuration)).rejects.toThrow(error);

      expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(2);
      expect(browser.runtime.sendMessage).toHaveBeenNthCalledWith(1, { name: passkeyProviderSuspendMessage });
      expect(browser.runtime.sendMessage).toHaveBeenNthCalledWith(2, { name: passkeyProviderResumeMessage });
    });

    it("Should directly detach and re-attach the MV3 passkey provider if the runtime message is not acknowledged.", async () => {
      mockLocation({ protocol: "chrome-extension:" });
      const port = { request: jest.fn() };
      const configuration = { credential_id: "credential", rp_id: null };
      chrome.webAuthenticationProxy = {
        attach: jest.fn().mockResolvedValue(),
        detach: jest.fn().mockResolvedValue(),
      };
      jest.spyOn(browser.runtime, "sendMessage").mockResolvedValue({ ok: false });
      jest.spyOn(BiometricAuthClientService, "unlock").mockImplementation(async () => {
        expect(chrome.webAuthenticationProxy.detach).toHaveBeenCalledTimes(1);
        return "passphrase";
      });

      await expect(BiometricAuthRuntimeService.unlock(port, configuration)).resolves.toBe("passphrase");

      expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(2);
      expect(browser.runtime.sendMessage).toHaveBeenNthCalledWith(1, { name: passkeyProviderSuspendMessage });
      expect(browser.runtime.sendMessage).toHaveBeenNthCalledWith(2, { name: passkeyProviderResumeMessage });
      expect(chrome.webAuthenticationProxy.attach).toHaveBeenCalledTimes(1);
    });

    it("Should let the service worker re-attach after a direct detach when runtime resume recovers.", async () => {
      mockLocation({ protocol: "chrome-extension:" });
      const port = { request: jest.fn() };
      const configuration = { credential_id: "credential", rp_id: null };
      chrome.webAuthenticationProxy = {
        attach: jest.fn().mockResolvedValue(),
        detach: jest.fn().mockResolvedValue(),
      };
      jest
        .spyOn(browser.runtime, "sendMessage")
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: true });
      jest.spyOn(BiometricAuthClientService, "unlock").mockImplementation(async () => {
        expect(chrome.webAuthenticationProxy.detach).toHaveBeenCalledTimes(1);
        return "passphrase";
      });

      await expect(BiometricAuthRuntimeService.unlock(port, configuration)).resolves.toBe("passphrase");

      expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(2);
      expect(browser.runtime.sendMessage).toHaveBeenNthCalledWith(1, { name: passkeyProviderSuspendMessage });
      expect(browser.runtime.sendMessage).toHaveBeenNthCalledWith(2, { name: passkeyProviderResumeMessage });
      expect(chrome.webAuthenticationProxy.attach).not.toHaveBeenCalled();
    });
  });
});
