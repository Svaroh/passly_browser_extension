/**
 * Passly - Open source password manager for teams
 * Copyright (c) 2026 Svaroh
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) Svaroh
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://passly.svaroh.net Passly
 * @since         6.0.12
 */
import VaultNavigationFallbackService from "./vaultNavigationFallbackService";
import ServerReachabilityService from "../auth/serverReachabilityService";
import OfflineSessionService from "../auth/offlineSessionService";
import User from "../../model/user";

const domain = "https://passly.local";
const workspaceUrl = "chrome-extension://id/webAccessibleResources/workspace.html?passbolt=workspace";
const signinUrl = "chrome-extension://id/webAccessibleResources/signin.html?passbolt=signin";

beforeEach(() => {
  jest.clearAllMocks();
  VaultNavigationFallbackService.forgetRedirects();
  jest.spyOn(User, "getInstance").mockImplementation(() => ({
    isValid: () => true,
    settings: { getDomain: () => domain },
  }));
  jest.spyOn(ServerReachabilityService, "isReachable").mockImplementation(() => false);
  jest.spyOn(OfflineSessionService, "getWorkspaceUrl").mockImplementation(() => workspaceUrl);
  jest.spyOn(OfflineSessionService, "getSigninUrl").mockImplementation(() => signinUrl);
  jest.spyOn(browser.tabs, "update").mockImplementation(() => {});
});

describe("VaultNavigationFallbackService", () => {
  describe("::exec", () => {
    it("Should send a vault page to the copy carried by the extension when the server cannot be reached", async () => {
      expect.assertions(2);
      // process
      await VaultNavigationFallbackService.exec(
        42,
        { status: "loading" },
        { pendingUrl: `${domain}/app/passwords/view/id?action=edit` },
      );
      // expectations
      expect(OfflineSessionService.getWorkspaceUrl).toHaveBeenCalledWith("/app/passwords/view/id", "edit");
      expect(browser.tabs.update).toHaveBeenCalledWith(42, { url: workspaceUrl });
    });

    it("Should send the sign in page to the one served by the extension", async () => {
      expect.assertions(1);
      // process
      await VaultNavigationFallbackService.exec(42, { url: `${domain}/auth/login` }, {});
      // expectations
      expect(browser.tabs.update).toHaveBeenCalledWith(42, { url: signinUrl });
    });

    it("Should leave the navigation alone when the server answers", async () => {
      expect.assertions(1);
      // mock functions
      jest.spyOn(ServerReachabilityService, "isReachable").mockImplementation(() => true);
      // process
      await VaultNavigationFallbackService.exec(42, { status: "loading" }, { pendingUrl: `${domain}/app/passwords` });
      // expectations
      expect(browser.tabs.update).not.toHaveBeenCalled();
    });

    it("Should leave alone a navigation to another site", async () => {
      expect.assertions(1);
      // process
      await VaultNavigationFallbackService.exec(42, { status: "loading" }, { pendingUrl: "https://example.com/app" });
      // expectations
      expect(browser.tabs.update).not.toHaveBeenCalled();
    });

    it("Should leave alone a page of the server that the extension does not carry", async () => {
      expect.assertions(1);
      // process
      await VaultNavigationFallbackService.exec(42, { status: "loading" }, { pendingUrl: `${domain}/healthcheck` });
      // expectations
      expect(browser.tabs.update).not.toHaveBeenCalled();
    });

    it("Should leave alone an event that carries no navigation", async () => {
      expect.assertions(1);
      // process
      await VaultNavigationFallbackService.exec(42, { status: "complete" }, { url: `${domain}/app/passwords` });
      // expectations
      expect(browser.tabs.update).not.toHaveBeenCalled();
    });

    it("Should send an application route asked of the extension back to the document it boots from", async () => {
      expect.assertions(2);
      // mock data
      const extensionOrigin = browser.runtime.getURL("/");
      // process
      await VaultNavigationFallbackService.exec(
        42,
        { status: "loading" },
        { pendingUrl: new URL("/app/passwords/view/id?action=edit", extensionOrigin).toString() },
      );
      // expectations
      expect(OfflineSessionService.getWorkspaceUrl).toHaveBeenCalledWith("/app/passwords/view/id", "edit");
      expect(browser.tabs.update).toHaveBeenCalledWith(42, { url: workspaceUrl });
    });

    it("Should leave alone the document the application boots from", async () => {
      expect.assertions(1);
      // mock data
      const bootDocument = browser.runtime.getURL("/webAccessibleResources/workspace.html?passbolt=workspace");
      // process
      await VaultNavigationFallbackService.exec(42, { status: "loading" }, { pendingUrl: bootDocument });
      // expectations
      expect(browser.tabs.update).not.toHaveBeenCalled();
    });

    it("Should leave alone a route the application set through the browser history", async () => {
      expect.assertions(1);
      const routeSetByTheApplication = new URL("/app/passwords", browser.runtime.getURL("/")).toString();
      // process
      await VaultNavigationFallbackService.exec(42, { url: routeSetByTheApplication }, {});
      // expectations
      expect(browser.tabs.update).not.toHaveBeenCalled();
    });

    it("Should not send the same tab twice in a row", async () => {
      expect.assertions(1);
      // process
      const navigation = { pendingUrl: `${domain}/app/passwords` };
      await VaultNavigationFallbackService.exec(43, { status: "loading" }, navigation);
      await VaultNavigationFallbackService.exec(43, { status: "loading" }, navigation);
      // expectations
      expect(browser.tabs.update).toHaveBeenCalledTimes(1);
    });

    it("Should leave alone the tab opened for the biometric ceremony", async () => {
      expect.assertions(1);
      await VaultNavigationFallbackService.exec(
        44,
        { status: "loading" },
        { pendingUrl: `${domain}/?passly-biometric-relay=1` },
      );

      expect(browser.tabs.update).not.toHaveBeenCalled();
    });

    it("Should leave the navigation alone when no account is configured", async () => {
      expect.assertions(1);
      // mock functions
      jest.spyOn(User, "getInstance").mockImplementation(() => ({ isValid: () => false }));
      // process
      await VaultNavigationFallbackService.exec(42, { status: "loading" }, { pendingUrl: `${domain}/app/passwords` });
      // expectations
      expect(browser.tabs.update).not.toHaveBeenCalled();
    });
  });

  describe("::handleNavigationError", () => {
    it("Should redirect top-level frame navigation error to offline workspace", async () => {
      expect.assertions(1);
      await VaultNavigationFallbackService.handleNavigationError({
        tabId: 45,
        frameId: 0,
        url: `${domain}/app/passwords`,
        error: "net::ERR_INTERNET_DISCONNECTED",
      });

      expect(browser.tabs.update).toHaveBeenCalledWith(45, { url: workspaceUrl });
    });

    it("Should ignore subframe navigation errors", async () => {
      expect.assertions(1);
      await VaultNavigationFallbackService.handleNavigationError({
        tabId: 46,
        frameId: 1,
        url: `${domain}/app/passwords`,
        error: "net::ERR_INTERNET_DISCONNECTED",
      });

      expect(browser.tabs.update).not.toHaveBeenCalled();
    });
  });
});
