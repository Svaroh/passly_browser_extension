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

describe("BiometricAuthRuntimeService", () => {
  const originalLocation = globalThis.location;

  afterEach(() => {
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
});
