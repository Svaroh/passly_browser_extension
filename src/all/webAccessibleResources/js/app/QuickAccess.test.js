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
import { ensureQuickAccessConfigured } from "./QuickAccess";

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
});
