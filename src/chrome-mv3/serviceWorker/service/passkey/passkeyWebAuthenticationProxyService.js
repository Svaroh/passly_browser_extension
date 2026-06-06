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
 * @since         5.12.94
 */

import PasskeyVaultResourceService from "./passkeyVaultResourceService";
import PasskeyWebauthnService from "./passkeyWebauthnService";
import PasskeyKeepAliveService from "./passkeyKeepAliveService";
import PasskeyContentScriptInjectionService from "./passkeyContentScriptInjectionService";
import PasskeyContentFallbackService from "./passkeyContentFallbackService";
import {
  PASSKEY_PROVIDER_DEFAULT_ENABLED,
  PASSKEY_PROVIDER_ENABLED_STORAGE_KEY,
  PASSKEY_PROVIDER_MESSAGES,
  PASSKEY_PROVIDER_PORT_NAME,
  PASSKEY_PROVIDER_RUNTIME_MESSAGES,
} from "../../../../all/passkey/passkeyProviderConstants";

const PASSKEY_PROVIDER_UNAVAILABLE_ERROR = {
  name: "NotSupportedError",
  message: "Passly passkey provider is not ready yet.",
};

class PasskeyWebAuthenticationProxyService {
  /**
   * Hidden MV3 kill switch. The proxy is enabled by default for Chrome MV3 passkey support.
   * @type {string}
   */
  static STORAGE_KEY_ENABLED = PASSKEY_PROVIDER_ENABLED_STORAGE_KEY;

  /**
   * Runtime message used by trusted extension UIs before running Passly's own
   * biometric WebAuthn flow.
   * @type {string}
   */
  static MESSAGE_SUSPEND = PASSKEY_PROVIDER_MESSAGES.SUSPEND;

  /**
   * Runtime message used by trusted extension UIs after Passly's own biometric
   * WebAuthn flow completes.
   * @type {string}
   */
  static MESSAGE_RESUME = PASSKEY_PROVIDER_MESSAGES.RESUME;

  /**
   * Runtime message sent by the offscreen document to keep Chrome's MV3
   * WebAuthn proxy attached while the service worker would otherwise unload.
   * @type {string}
   */
  static MESSAGE_KEEPALIVE = PASSKEY_PROVIDER_MESSAGES.KEEPALIVE;

  /**
   * Runtime message used by the MV3 page-level fallback for
   * navigator.credentials.create().
   * @type {string}
   */
  static MESSAGE_CONTENT_CREATE = PASSKEY_PROVIDER_MESSAGES.CONTENT_CREATE;

  /**
   * Runtime message used by the MV3 page-level fallback for
   * navigator.credentials.get().
   * @type {string}
   */
  static MESSAGE_CONTENT_GET = PASSKEY_PROVIDER_MESSAGES.CONTENT_GET;

  /**
   * Runtime message used by the MV3 page-level fallback for UVPAA checks.
   * @type {string}
   */
  static MESSAGE_CONTENT_UVPAA = PASSKEY_PROVIDER_MESSAGES.CONTENT_UVPAA;

  /**
   * Dedicated runtime port used by the document_start content fallback.
   * @type {string}
   */
  static PORT_NAME = PASSKEY_PROVIDER_PORT_NAME;

  /**
   * @type {boolean}
   */
  static DEFAULT_ENABLED = PASSKEY_PROVIDER_DEFAULT_ENABLED;

  /**
   * @type {boolean}
   * @private
   */
  static _listenersRegistered = false;

  /**
   * @type {boolean}
   * @private
   */
  static _storageChangeListenerRegistered = false;

  /**
   * @type {boolean}
   * @private
   */
  static _runtimeMessageListenerRegistered = false;

  /**
   * @type {boolean}
   * @private
   */
  static _runtimePortListenerRegistered = false;

  /**
   * @type {boolean}
   * @private
   */
  static _attached = false;

  /**
   * @type {number}
   * @private
   */
  static _suspendCount = 0;

  /**
   * @type {Set<number>}
   * @private
   */
  static _canceledRequestIds = new Set();

  /**
   * Initialize WebAuthn proxy wiring for Chrome MV3.
   * @returns {Promise<boolean>} true if the proxy was attached.
   */
  static async initialize() {
    this.registerStorageChangeListener();
    this.registerRuntimePortListener();
    this.registerRuntimeMessageListener();
    await this.injectFallbackIntoExistingTabs();

    if (!this.isSupported()) {
      return false;
    }

    this.registerListeners();
    const attached = await this.attachIfEnabled();
    await this.startKeepAliveIfEnabled();

    return attached;
  }

  /**
   * Register listeners synchronously from the service worker entrypoint.
   * @returns {boolean} true when listeners are available.
   */
  static registerListeners() {
    const webAuthenticationProxy = this.getWebAuthenticationProxy();
    if (!webAuthenticationProxy || this._listenersRegistered) {
      return false;
    }

    webAuthenticationProxy.onCreateRequest.addListener(this.handleCreateRequest);
    webAuthenticationProxy.onGetRequest.addListener(this.handleGetRequest);
    webAuthenticationProxy.onIsUvpaaRequest.addListener(this.handleIsUvpaaRequest);
    webAuthenticationProxy.onRequestCanceled.addListener(this.handleRequestCanceled);
    this._listenersRegistered = true;

    return true;
  }

  /**
   * Register storage change listener so the provider can be toggled without waiting
   * for a service worker restart.
   * @returns {boolean} true when the listener was registered.
   */
  static registerStorageChangeListener() {
    const storage = this.getChromeStorage();
    if (!storage?.onChanged || this._storageChangeListenerRegistered) {
      return false;
    }

    storage.onChanged.addListener(this.handleStorageChanged);
    this._storageChangeListenerRegistered = true;

    return true;
  }

  /**
   * Register runtime messages used to temporarily suspend the passkey proxy
   * while Passly runs its own biometric WebAuthn request.
   * @returns {boolean} true when the listener was registered.
   */
  static registerRuntimeMessageListener() {
    const runtime = this.getChromeRuntime();
    if (!runtime?.onMessage || this._runtimeMessageListenerRegistered) {
      return false;
    }

    runtime.onMessage.addListener(this.handleRuntimeMessage);
    this._runtimeMessageListenerRegistered = true;

    return true;
  }

  /**
   * Register the dedicated runtime port used by the page-level fallback.
   * @returns {boolean} true when the listener was registered.
   */
  static registerRuntimePortListener() {
    const runtime = this.getChromeRuntime();
    if (!runtime?.onConnect || this._runtimePortListenerRegistered) {
      return false;
    }

    runtime.onConnect.addListener(this.handleRuntimePort);
    this._runtimePortListenerRegistered = true;

    return true;
  }

  /**
   * Attach Chrome's WebAuthn proxy unless the hidden kill switch is disabled.
   * @param {boolean} force Set to true to force a real Chrome attach call even
   * if the service worker local state still says it is attached.
   * @returns {Promise<boolean>} true if the proxy was attached.
   */
  static async attachIfEnabled(force = false) {
    if (this._suspendCount > 0) {
      return false;
    }

    if (!(await this.isEnabled())) {
      return false;
    }

    return this.attach(force);
  }

  /**
   * @returns {Promise<boolean>}
   */
  static async isEnabled() {
    const storage = this.getChromeStorage();
    if (!storage) {
      return false;
    }

    const settings = await storage.local.get(this.STORAGE_KEY_ENABLED);
    return settings[this.STORAGE_KEY_ENABLED] ?? this.DEFAULT_ENABLED;
  }

  /**
   * Start the offscreen keepalive when the passkey provider is enabled.
   * @returns {Promise<boolean>}
   */
  static async startKeepAliveIfEnabled() {
    if (!(await this.isEnabled())) {
      return false;
    }

    try {
      await PasskeyKeepAliveService.start();
      return true;
    } catch (error) {
      console.warn("Passly passkey WebAuthn proxy keepalive could not start.", error);
      return false;
    }
  }

  /**
   * Stop the offscreen keepalive.
   * @returns {Promise<boolean>}
   */
  static async stopKeepAlive() {
    try {
      await PasskeyKeepAliveService.stop();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Inject page-level passkey fallback into existing tabs after extension
   * reload/update.
   * @returns {Promise<boolean>}
   */
  static async injectFallbackIntoExistingTabs() {
    try {
      await PasskeyContentScriptInjectionService.injectIntoExistingTabs();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Attach this extension as the active WebAuthn proxy.
   * @param {boolean} force Set to true to resync Chrome's proxy state.
   * @returns {Promise<boolean>} true if the proxy was attached.
   */
  static async attach(force = false) {
    const webAuthenticationProxy = this.getWebAuthenticationProxy();
    if (!webAuthenticationProxy) {
      return false;
    }
    if (this._suspendCount > 0) {
      return false;
    }
    if (this._attached && !force) {
      return true;
    }
    try {
      await webAuthenticationProxy.attach();
      this._attached = true;

      return true;
    } catch (error) {
      this._attached = false;
      console.warn("Passly passkey WebAuthn proxy could not attach.", error);

      return false;
    }
  }

  /**
   * Detach this extension from Chrome's WebAuthn proxy.
   * @returns {Promise<boolean>} true if the proxy was detached.
   */
  static async detach() {
    const webAuthenticationProxy = this.getWebAuthenticationProxy();
    if (!webAuthenticationProxy) {
      return false;
    }

    const wasAttached = this._attached;
    try {
      /*
       * Do not trust _attached as the source of truth. MV3 can restart the
       * service worker while Chrome still has this extension registered as the
       * active WebAuthn proxy, and biometric auth must force a real detach.
       */
      await webAuthenticationProxy.detach();
      this._attached = false;
      this._canceledRequestIds.clear();
    } catch (error) {
      this._attached = false;
      this._canceledRequestIds.clear();
      if (wasAttached) {
        console.warn("Passly passkey WebAuthn proxy could not detach.", error);
      }

      return false;
    }

    return true;
  }

  /**
   * Temporarily detach this extension as WebAuthn proxy.
   * @returns {Promise<boolean>}
   */
  static async suspend() {
    this._suspendCount++;
    await this.detach();

    return true;
  }

  /**
   * Resume this extension as WebAuthn proxy once all temporary suspensions end.
   * @returns {Promise<boolean>}
   */
  static async resume() {
    this._suspendCount = Math.max(0, this._suspendCount - 1);
    if (this._suspendCount > 0) {
      return false;
    }

    return this.attachIfEnabled(true);
  }

  /**
   * Keep the MV3 service worker alive and re-attach if Chrome unloaded it.
   * @returns {Promise<boolean>}
   */
  static async keepAlive() {
    if (this._suspendCount > 0) {
      return false;
    }

    /*
     * Do not trust _attached as Chrome's source of truth. Chrome can detach the
     * WebAuthn proxy outside this class, while the MV3 worker still has stale
     * local state. A repeated attach is accepted by Chrome and keeps this
     * extension registered as the active proxy.
     */
    return this.attachIfEnabled(true);
  }

  /**
   * Handle internal runtime messages.
   * @param {object} message
   * @param {object} sender
   * @param {Function} sendResponse
   * @returns {boolean} true when the response is asynchronous.
   */
  static handleRuntimeMessage(message, sender, sendResponse) {
    const name = message?.name;
    if (!PASSKEY_PROVIDER_RUNTIME_MESSAGES.includes(name)) {
      return false;
    }

    const action = PasskeyWebAuthenticationProxyService.handleInternalAction(name, message, sender);

    action
      .then((result) => sendResponse?.({ ok: true, result }))
      .catch((error) =>
        sendResponse?.({
          ok: false,
          error: PasskeyWebAuthenticationProxyService.toWebAuthnError(error),
        }),
      );

    return true;
  }

  /**
   * Handle the dedicated content-script fallback runtime port.
   * @param {chrome.runtime.Port} port The runtime port.
   * @returns {boolean} true when the port is owned by the passkey provider.
   */
  static handleRuntimePort(port) {
    if (port?.name !== PasskeyWebAuthenticationProxyService.PORT_NAME) {
      return false;
    }

    port.onMessage.addListener((message) =>
      PasskeyWebAuthenticationProxyService.handleRuntimePortMessage(port, message),
    );

    return true;
  }

  /**
   * @param {chrome.runtime.Port} port The runtime port.
   * @param {object} message The request message.
   * @returns {Promise<void>}
   */
  static async handleRuntimePortMessage(port, message) {
    const requestId = message?.requestId;
    if (typeof requestId !== "string" || !requestId) {
      return;
    }

    try {
      const result = await PasskeyWebAuthenticationProxyService.handleInternalAction(
        message?.name,
        message,
        port.sender,
      );
      PasskeyWebAuthenticationProxyService.postRuntimePortResponse(port, requestId, { ok: true, result });
    } catch (error) {
      PasskeyWebAuthenticationProxyService.postRuntimePortResponse(port, requestId, {
        ok: false,
        error: PasskeyWebAuthenticationProxyService.toWebAuthnError(error),
      });
    }
  }

  /**
   * @param {chrome.runtime.Port} port The runtime port.
   * @param {string} requestId The request identifier.
   * @param {object} response The WebAuthn response.
   * @returns {void}
   */
  static postRuntimePortResponse(port, requestId, response) {
    try {
      port.postMessage({ requestId, response });
    } catch {
      // The page may have navigated away before the response could be posted.
    }
  }

  /**
   * @param {string} name
   * @param {object} message
   * @param {object} sender
   * @returns {Promise<boolean|object>}
   */
  static handleInternalAction(name, message = {}, sender = {}) {
    switch (name) {
      case PasskeyWebAuthenticationProxyService.MESSAGE_SUSPEND:
        return PasskeyWebAuthenticationProxyService.suspend();
      case PasskeyWebAuthenticationProxyService.MESSAGE_RESUME:
        return PasskeyWebAuthenticationProxyService.resume();
      case PasskeyWebAuthenticationProxyService.MESSAGE_KEEPALIVE:
        return PasskeyWebAuthenticationProxyService.keepAlive();
      case PasskeyWebAuthenticationProxyService.MESSAGE_CONTENT_CREATE:
        return PasskeyWebAuthenticationProxyService.handleContentCreateRequest(message, sender);
      case PasskeyWebAuthenticationProxyService.MESSAGE_CONTENT_GET:
        return PasskeyWebAuthenticationProxyService.handleContentGetRequest(message, sender);
      case PasskeyWebAuthenticationProxyService.MESSAGE_CONTENT_UVPAA:
        return PasskeyWebAuthenticationProxyService.handleContentUvpaaRequest(message, sender);
      default:
        return Promise.resolve(false);
    }
  }

  /**
   * Handle a navigator.credentials.create() request intercepted by the
   * document_start MAIN-world fallback content script.
   * @param {object} message
   * @param {object} sender
   * @returns {Promise<object>}
   */
  static async handleContentCreateRequest(message, sender) {
    const requestDetails = await this.prepareContentRequestDetails(message?.requestDetails, sender);
    const skipReason = await this.getContentFallbackSkipReason(requestDetails.origin);
    if (skipReason) {
      return { skipped: true, reason: skipReason };
    }

    const result = await PasskeyWebauthnService.createCredential(requestDetails);
    await PasskeyVaultResourceService.createResourceForPasskey(requestDetails, result.secretDto);

    return result.credential;
  }

  /**
   * Handle a navigator.credentials.get() request intercepted by the
   * document_start MAIN-world fallback content script.
   * @param {object} message
   * @param {object} sender
   * @returns {Promise<object>}
   */
  static async handleContentGetRequest(message, sender) {
    const requestDetails = await this.prepareContentRequestDetails(message?.requestDetails, sender);
    const skipReason = await this.getContentFallbackSkipReason(requestDetails.origin);
    if (skipReason) {
      return { skipped: true, reason: skipReason };
    }

    const secretDto = await PasskeyVaultResourceService.findSecretForAssertion(requestDetails);
    const result = await PasskeyWebauthnService.getAssertion(requestDetails, secretDto);

    return result.credential;
  }

  /**
   * Handle PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
   * intercepted by the document_start MAIN-world fallback content script.
   * @param {object} message
   * @param {object} sender
   * @returns {Promise<object>}
   */
  static async handleContentUvpaaRequest(message, sender) {
    const requestDetails = await this.prepareContentRequestDetails(message?.requestDetails, sender);
    const skipReason = await this.getContentFallbackSkipReason(requestDetails.origin);
    if (skipReason) {
      return { skipped: true, reason: skipReason };
    }

    return { available: true };
  }

  /**
   * @param {object} requestDetails
   * @param {object} sender
   * @returns {Promise<object>}
   */
  static async prepareContentRequestDetails(requestDetails, sender) {
    return PasskeyContentFallbackService.prepareRequestDetails(requestDetails, sender);
  }

  /**
   * @param {object} sender
   * @returns {string|null}
   */
  static getSenderOrigin(sender) {
    return PasskeyContentFallbackService.getSenderOrigin(sender);
  }

  /**
   * Decide if the content-script fallback should yield to the page's native
   * WebAuthn implementation instead of Passly.
   * @param {string} origin
   * @returns {Promise<boolean>}
   */
  static async shouldSkipContentFallback(origin) {
    return PasskeyContentFallbackService.shouldSkip(origin, () => this.isEnabled());
  }

  /**
   * Explain why the content-script fallback should yield to native WebAuthn.
   * @param {string} origin
   * @returns {Promise<string|null>}
   */
  static async getContentFallbackSkipReason(origin) {
    return PasskeyContentFallbackService.getSkipReason(origin, () => this.isEnabled());
  }

  /**
   * React to the passkey provider kill switch being changed in local extension storage.
   * @param {object} changes
   * @param {string} areaName
   * @returns {Promise<void>}
   */
  static async handleStorageChanged(changes, areaName) {
    if (
      areaName !== "local" ||
      !Object.prototype.hasOwnProperty.call(changes, PasskeyWebAuthenticationProxyService.STORAGE_KEY_ENABLED)
    ) {
      return;
    }

    const change = changes[PasskeyWebAuthenticationProxyService.STORAGE_KEY_ENABLED];
    const enabled = change.newValue ?? PasskeyWebAuthenticationProxyService.DEFAULT_ENABLED;
    if (enabled) {
      await PasskeyWebAuthenticationProxyService.startKeepAliveIfEnabled();
      await PasskeyWebAuthenticationProxyService.attachIfEnabled(true);
    } else {
      await PasskeyWebAuthenticationProxyService.stopKeepAlive();
      await PasskeyWebAuthenticationProxyService.detach();
    }
  }

  /**
   * Handle navigator.credentials.create().
   * @param {object} requestInfo
   * @returns {Promise<void>}
   */
  static async handleCreateRequest(requestInfo) {
    const requestId = requestInfo?.requestId;
    if (!Number.isInteger(requestId)) {
      return;
    }

    try {
      const result = await PasskeyWebauthnService.createCredential(requestInfo.requestDetailsJson);
      await PasskeyVaultResourceService.createResourceForPasskey(requestInfo.requestDetailsJson, result.secretDto);
      await PasskeyWebAuthenticationProxyService.completeCreateRequestWithResponse(requestId, result.credential);
    } catch (error) {
      console.warn("Passly passkey create request failed.", error);
      await PasskeyWebAuthenticationProxyService.completeCreateRequestWithError(
        requestId,
        PasskeyWebAuthenticationProxyService.toWebAuthnError(error),
      );
    }
  }

  /**
   * Handle navigator.credentials.get().
   * @param {object} requestInfo
   * @returns {Promise<void>}
   */
  static async handleGetRequest(requestInfo) {
    const requestId = requestInfo?.requestId;
    if (!Number.isInteger(requestId)) {
      return;
    }

    try {
      const secretDto = await PasskeyVaultResourceService.findSecretForAssertion(requestInfo.requestDetailsJson);
      const result = await PasskeyWebauthnService.getAssertion(requestInfo.requestDetailsJson, secretDto);
      await PasskeyWebAuthenticationProxyService.completeGetRequestWithResponse(requestId, result.credential);
    } catch (error) {
      console.warn("Passly passkey get request failed.", error);
      await PasskeyWebAuthenticationProxyService.completeGetRequestWithError(
        requestId,
        PasskeyWebAuthenticationProxyService.toWebAuthnError(error),
      );
    }
  }

  /**
   * Handle PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().
   * @param {object} requestInfo
   * @returns {Promise<void>}
   */
  static async handleIsUvpaaRequest(requestInfo) {
    const requestId = requestInfo?.requestId;
    if (!Number.isInteger(requestId)) {
      return;
    }

    await PasskeyWebAuthenticationProxyService.completeIsUvpaaRequest(requestId, true);
  }

  /**
   * Track canceled requests so the service does not complete them after Chrome aborts them.
   * @param {number} requestId
   */
  static handleRequestCanceled(requestId) {
    if (Number.isInteger(requestId)) {
      PasskeyWebAuthenticationProxyService._canceledRequestIds.add(requestId);
    }
  }

  /**
   * Complete a create request with a WebAuthn DOMException.
   * @param {number} requestId
   * @returns {Promise<void>}
   */
  static async completeCreateRequestWithResponse(requestId, credential) {
    if (this.consumeCanceledRequest(requestId)) {
      return;
    }

    await this.getWebAuthenticationProxy().completeCreateRequest({
      requestId,
      responseJson: JSON.stringify(credential),
    });
  }

  /**
   * Complete a create request with a WebAuthn DOMException.
   * @param {number} requestId
   * @param {{name: string, message: string}} error
   * @returns {Promise<void>}
   */
  static async completeCreateRequestWithError(requestId, error = PASSKEY_PROVIDER_UNAVAILABLE_ERROR) {
    if (this.consumeCanceledRequest(requestId)) {
      return;
    }

    await this.getWebAuthenticationProxy().completeCreateRequest({
      requestId,
      error,
    });
  }

  /**
   * Complete a get request with a WebAuthn response.
   * @param {number} requestId
   * @param {object} credential
   * @returns {Promise<void>}
   */
  static async completeGetRequestWithResponse(requestId, credential) {
    if (this.consumeCanceledRequest(requestId)) {
      return;
    }

    await this.getWebAuthenticationProxy().completeGetRequest({
      requestId,
      responseJson: JSON.stringify(credential),
    });
  }

  /**
   * Complete a get request with a WebAuthn DOMException.
   * @param {number} requestId
   * @param {{name: string, message: string}} error
   * @returns {Promise<void>}
   */
  static async completeGetRequestWithError(requestId, error = PASSKEY_PROVIDER_UNAVAILABLE_ERROR) {
    if (this.consumeCanceledRequest(requestId)) {
      return;
    }

    await this.getWebAuthenticationProxy().completeGetRequest({
      requestId,
      error,
    });
  }

  /**
   * Complete a UVPAA request.
   * @param {number} requestId
   * @param {boolean} isUvpaa
   * @returns {Promise<void>}
   */
  static async completeIsUvpaaRequest(requestId, isUvpaa) {
    if (this.consumeCanceledRequest(requestId)) {
      return;
    }

    await this.getWebAuthenticationProxy().completeIsUvpaaRequest({
      requestId,
      isUvpaa,
    });
  }

  /**
   * @param {Error|object} error
   * @returns {{name: string, message: string}}
   */
  static toWebAuthnError(error) {
    return {
      name: error?.name || "UnknownError",
      message: error?.message || "Passly passkey request failed.",
    };
  }

  /**
   * @param {number} requestId
   * @returns {boolean} true if the request was already canceled.
   */
  static consumeCanceledRequest(requestId) {
    const wasCanceled = this._canceledRequestIds.has(requestId);
    this._canceledRequestIds.delete(requestId);

    return wasCanceled;
  }

  /**
   * @returns {boolean} true if Chrome exposes the WebAuthn proxy API.
   */
  static isSupported() {
    return Boolean(this.getWebAuthenticationProxy());
  }

  /**
   * @returns {object|null}
   */
  static getWebAuthenticationProxy() {
    if (typeof chrome === "undefined") {
      return null;
    }

    return chrome.webAuthenticationProxy || null;
  }

  /**
   * @returns {object|null}
   */
  static getChromeStorage() {
    if (typeof chrome === "undefined") {
      return null;
    }

    return chrome.storage || null;
  }

  /**
   * @returns {object|null}
   */
  static getChromeRuntime() {
    if (typeof chrome === "undefined") {
      return null;
    }

    return chrome.runtime || null;
  }

  /**
   * Reset runtime state for unit tests.
   */
  static flush() {
    this._listenersRegistered = false;
    this._storageChangeListenerRegistered = false;
    this._runtimeMessageListenerRegistered = false;
    this._runtimePortListenerRegistered = false;
    this._attached = false;
    this._suspendCount = 0;
    this._canceledRequestIds.clear();
  }
}

export { PASSKEY_PROVIDER_UNAVAILABLE_ERROR };
export default PasskeyWebAuthenticationProxyService;
