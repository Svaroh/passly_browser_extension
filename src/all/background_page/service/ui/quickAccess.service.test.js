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
 * @since         5.12.125
 */
import { QuickAccessService } from "./quickAccess.service";
import { QUICKACCESS_POPUP_URL } from "../toolbar/toolbarService";

describe("QuickAccessService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    browser.action = {
      setIcon: jest.fn(),
    };
    browser.browserAction = {
      setPopup: jest.fn(),
      openPopup: jest.fn(),
    };
    browser.runtime.getURL.mockImplementation((path) => `chrome-extension://didegimhafipceonhjepacocaffmoppf/${path}`);
  });

  describe("isAttachedModeAvailable", () => {
    it("returns true when Chrome MV3 exposes action.openPopup", () => {
      browser.action = {
        setPopup: jest.fn(),
        openPopup: jest.fn(),
      };
      browser.browserAction = undefined;

      expect(QuickAccessService.isAttachedModeAvailable()).toBe(true);
    });

    it("returns false when no attached popup API is exposed", () => {
      browser.action = {
        setIcon: jest.fn(),
      };
      browser.browserAction = undefined;

      expect(QuickAccessService.isAttachedModeAvailable()).toBe(false);
    });
  });

  describe("openInAttachedMode", () => {
    it("opens QuickAccess through the Chrome MV3 toolbar popup", async () => {
      browser.action = {
        setPopup: jest.fn(),
        openPopup: jest.fn(() => Promise.resolve()),
      };
      browser.browserAction = undefined;

      const workerId = await QuickAccessService.openInAttachedMode([{ name: "feature", value: "request-passphrase" }]);

      const openedPopup = browser.action.setPopup.mock.calls[0][0].popup;
      const openedPopupUrl = new URL(openedPopup);

      expect(workerId).toEqual(expect.any(String));
      expect(openedPopupUrl.pathname).toBe("/webAccessibleResources/quickaccess.html");
      expect(openedPopupUrl.searchParams.get("passbolt")).toBe(workerId);
      expect(openedPopupUrl.searchParams.get("feature")).toBe("request-passphrase");
      expect(browser.action.openPopup).toHaveBeenCalledTimes(1);
      expect(browser.action.setPopup).toHaveBeenLastCalledWith({ popup: QUICKACCESS_POPUP_URL });
      expect(browser.windows.create).not.toHaveBeenCalled();
    });

    it("resets the toolbar popup when Chrome rejects opening the attached popup", async () => {
      const expectedError = new Error("openPopup failed");
      browser.action = {
        setPopup: jest.fn(),
        openPopup: jest.fn(() => Promise.reject(expectedError)),
      };
      browser.browserAction = undefined;

      await expect(QuickAccessService.openInAttachedMode()).rejects.toThrow(expectedError);

      expect(browser.action.setPopup).toHaveBeenLastCalledWith({ popup: QUICKACCESS_POPUP_URL });
      expect(browser.windows.create).not.toHaveBeenCalled();
    });
  });
});
