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
import User from "../../model/user";
import hasUrlSameOrigin from "../../utils/url/hasSameOriginUrl";
import OfflineSessionService from "../auth/offlineSessionService";
import ServerReachabilityService from "../auth/serverReachabilityService";
import GetActiveAccountService from "../account/getActiveAccountService";
import ActiveSessionLocalStorage from "../local_storage/activeSessionLocalStorage";

const APP_PATH_PREFIX = "/app";
const LOGIN_PATH_PREFIX = "/auth/login";
const REDIRECT_COOLDOWN_MS = 5000;
const BIOMETRIC_RELAY_MARKER = "passly-biometric-relay";

/**
 * When each tab was last sent to the extension's own copy, so one cannot be sent again and again.
 * @type {Map<number, number>}
 */
const lastRedirectByTab = new Map();

/**
 * Sends a navigation to the vault to the copy carried by the extension when the API cannot serve it.
 *
 * A bookmark, a typed address or a reload points at the API, and a browser meets an unreachable server with its own
 * error page - a dead end in front of a vault this device holds in full. Watching navigations lets that address be
 * answered by the extension instead, so the bookmark people already have keeps working with the server gone.
 */
class VaultNavigationFallbackService {
  /**
   * Handle tabs onUpdated events.
   * @param {number} tabId The tab id
   * @param {object} changeInfo The change info of the tab
   * @param {object} tab The tab
   * @returns {Promise<void>}
   */
  static async exec(tabId, changeInfo, tab) {
    /*
     * A reload carries no url in the change info, and neither does the first event of a fresh navigation, so the url
     * is taken from the tab itself - that is what makes a bookmark opened again, and a page reloaded, both visible.
     */
    if (!changeInfo.url && changeInfo.status !== "loading") {
      return;
    }

    const url = changeInfo.url || tab?.pendingUrl || tab?.url;
    if (!url) {
      return;
    }

    let fallbackUrl;
    if (VaultNavigationFallbackService.isExtensionUrl(url)) {
      /*
       * Only a document actually being loaded counts here. The application routes with the browser history, and each
       * of those changes is reported as an updated tab url with no loading status - taken for a navigation, the very
       * first route the workspace sets sent the tab back to its own document, which routed again: sixteen reloads in
       * three seconds, and a page that never had time to render.
       */
      if (changeInfo.status !== "loading") {
        return;
      }
      fallbackUrl = VaultNavigationFallbackService.getRouteReloadUrl(url);
    } else {
      fallbackUrl = await VaultNavigationFallbackService.getFallbackUrl(url);
    }

    if (!fallbackUrl || VaultNavigationFallbackService.hasJustRedirected(tabId)) {
      return;
    }

    console.debug(`Opening the vault carried by the extension for ${url}`);
    lastRedirectByTab.set(tabId, Date.now());
    await browser.tabs.update(tabId, { url: fallbackUrl });
  }

  /**
   * Handle webNavigation onErrorOccurred events.
   * Catches instantaneous network/DNS disconnects that fail before tabs.onUpdated resolves.
   * @param {object} details WebNavigation details
   * @returns {Promise<void>}
   */
  static async handleNavigationError(details) {
    if (details.frameId !== 0 || !details.url) {
      return;
    }

    const fallbackUrl = await VaultNavigationFallbackService.getFallbackUrl(details.url, true);
    if (!fallbackUrl || VaultNavigationFallbackService.hasJustRedirected(details.tabId)) {
      return;
    }

    console.debug(`Handling navigation error ${details.error} for ${details.url}, opening local vault`);
    lastRedirectByTab.set(details.tabId, Date.now());
    await browser.tabs.update(details.tabId, { url: fallbackUrl });
  }

  /**
   * Forget which tabs were recently sent to the extension's own copy.
   * @returns {void}
   */
  static forgetRedirects() {
    lastRedirectByTab.clear();
  }

  /**
   * Whether this tab was just sent to the extension's own copy.
   *
   * A second opinion on top of the checks above: whatever else may make a redirect look necessary again, a tab that
   * was just redirected is left alone, so a mistake costs one wasted navigation rather than an endless loop.
   * @param {number} tabId the tab to check
   * @returns {boolean}
   */
  static hasJustRedirected(tabId) {
    const lastRedirect = lastRedirectByTab.get(tabId);
    return Boolean(lastRedirect) && Date.now() - lastRedirect < REDIRECT_COOLDOWN_MS;
  }

  /**
   * Whether the address is served by the extension itself.
   * @param {string} url the url the tab is navigating to
   * @returns {boolean}
   */
  static isExtensionUrl(url) {
    try {
      // origins are compared rather than the address, which spares us any surprise in how the base url is spelled
      return new URL(url).origin === new URL(browser.runtime.getURL("/")).origin;
    } catch {
      return false;
    }
  }

  /**
   * The document to load for an application route asked of the extension itself.
   *
   * The application routes with the browser history, so opening a resource turns the address into an application
   * route on the extension origin - and reloading that address makes the browser look for a file that was never
   * there, answering ERR_FILE_NOT_FOUND. Sending it back to the document the application boots from, with the route
   * to resume, makes a reload, a bookmark and a restored tab all land where they should.
   * @param {string} url the url the tab is navigating to
   * @returns {string|null} null when the navigation should be left alone
   */
  static getRouteReloadUrl(url) {
    const target = new URL(url);
    if (!target.pathname.startsWith(`${APP_PATH_PREFIX}/`) && target.pathname !== APP_PATH_PREFIX) {
      return null;
    }

    return OfflineSessionService.getWorkspaceUrl(target.pathname, target.searchParams.get("action"));
  }

  /**
   * Checks whether the current user is authenticated in the current session.
   * @returns {Promise<boolean>}
   */
  static async isUserAuthenticated() {
    if (await OfflineSessionService.isOpen()) {
      return true;
    }
    try {
      const account = await GetActiveAccountService.get();
      if (!account) {
        return false;
      }
      const activeSessionLocalStorage = new ActiveSessionLocalStorage(account);
      const session = await activeSessionLocalStorage.get();
      return Boolean(session?.is_authenticated);
    } catch {
      return false;
    }
  }

  /**
   * The address of the extension's own copy of the page being navigated to, when it should stand in.
   * @param {string} url the url the tab is navigating to
   * @param {boolean} forceOffline whether network probe should be skipped
   * @returns {Promise<string|null>} null when the navigation should be left alone
   */
  static async getFallbackUrl(url, forceOffline = false) {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return null;
    }

    const user = User.getInstance();
    if (!user.isValid()) {
      return null;
    }

    const domain = user.settings.getDomain();
    if (!hasUrlSameOrigin(url, domain)) {
      return null;
    }

    const target = new URL(url);
    if (target.searchParams.has(BIOMETRIC_RELAY_MARKER)) {
      // a tab the extension opened for the biometric ceremony, which has to stay on the server's own page
      return null;
    }

    /*
     * The bare domain counts as the vault: it is what a bookmark usually holds, and it is the server that turns it
     * into /app/passwords - a redirect there is nobody to perform while it cannot be reached.
     */
    const isRoot = target.pathname === "/" || target.pathname === "";
    const isVaultPage = isRoot || target.pathname.startsWith(APP_PATH_PREFIX);
    const isLoginPage = target.pathname.startsWith(LOGIN_PATH_PREFIX);
    if (!isVaultPage && !isLoginPage) {
      return null;
    }

    if (!forceOffline) {
      if (navigator.onLine && (await ServerReachabilityService.isReachable(domain))) {
        return null;
      }
    }

    if (isLoginPage) {
      return OfflineSessionService.getSigninUrl();
    }

    return isRoot
      ? OfflineSessionService.getWorkspaceUrl()
      : OfflineSessionService.getWorkspaceUrl(target.pathname, target.searchParams.get("action"));
  }
}

export default VaultNavigationFallbackService;
export { BIOMETRIC_RELAY_MARKER };
