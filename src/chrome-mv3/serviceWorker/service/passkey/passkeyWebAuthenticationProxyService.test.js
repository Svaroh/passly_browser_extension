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
import PasskeyWebAuthenticationProxyService, {
  PASSKEY_PROVIDER_UNAVAILABLE_ERROR,
} from "./passkeyWebAuthenticationProxyService";
import PasskeyVaultResourceService from "./passkeyVaultResourceService";
import PasskeyWebauthnService from "./passkeyWebauthnService";
import PasskeyKeepAliveService from "./passkeyKeepAliveService";
import PasskeyContentScriptInjectionService from "./passkeyContentScriptInjectionService";
import GetActiveAccountService from "../../../../all/background_page/service/account/getActiveAccountService";

jest.mock("./passkeyKeepAliveService", () => ({
  __esModule: true,
  default: {
    start: jest.fn(() => Promise.resolve({ started: true })),
    stop: jest.fn(() => Promise.resolve({ started: false })),
  },
}));

jest.mock("./passkeyContentScriptInjectionService", () => ({
  __esModule: true,
  default: {
    injectIntoExistingTabs: jest.fn(() => Promise.resolve(0)),
  },
}));

function buildEvent() {
  const listeners = [];

  return {
    addListener: jest.fn((listener) => listeners.push(listener)),
    dispatch: async (...args) => Promise.all(listeners.map((listener) => listener(...args))),
    get listeners() {
      return listeners;
    },
  };
}

function buildWebAuthenticationProxyMock() {
  return {
    attach: jest.fn(() => Promise.resolve()),
    detach: jest.fn(() => Promise.resolve()),
    completeCreateRequest: jest.fn(() => Promise.resolve()),
    completeGetRequest: jest.fn(() => Promise.resolve()),
    completeIsUvpaaRequest: jest.fn(() => Promise.resolve()),
    onCreateRequest: buildEvent(),
    onGetRequest: buildEvent(),
    onIsUvpaaRequest: buildEvent(),
    onRequestCanceled: buildEvent(),
  };
}

function buildRuntimePortMock(name = PasskeyWebAuthenticationProxyService.PORT_NAME, sender = {}) {
  const messageListeners = [];
  const disconnectListeners = [];

  return {
    name,
    sender,
    onMessage: {
      addListener: jest.fn((listener) => messageListeners.push(listener)),
      removeListener: jest.fn((listener) => {
        const index = messageListeners.indexOf(listener);
        if (index !== -1) {
          messageListeners.splice(index, 1);
        }
      }),
    },
    onDisconnect: {
      addListener: jest.fn((listener) => disconnectListeners.push(listener)),
      removeListener: jest.fn((listener) => {
        const index = disconnectListeners.indexOf(listener);
        if (index !== -1) {
          disconnectListeners.splice(index, 1);
        }
      }),
    },
    postMessage: jest.fn(),
    disconnect: jest.fn(),
    get messageListeners() {
      return messageListeners;
    },
  };
}

describe("PasskeyWebAuthenticationProxyService", () => {
  beforeEach(() => {
    PasskeyWebAuthenticationProxyService.flush();
    PasskeyKeepAliveService.start.mockClear();
    PasskeyKeepAliveService.stop.mockClear();
    PasskeyContentScriptInjectionService.injectIntoExistingTabs.mockClear();
    chrome.webAuthenticationProxy = buildWebAuthenticationProxyMock();
    chrome.storage.onChanged = buildEvent();
    chrome.runtime.onMessage = buildEvent();
    chrome.runtime.onConnect = buildEvent();
    chrome.tabs = {
      create: jest.fn(() => Promise.resolve({ id: 7 })),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete chrome.webAuthenticationProxy;
    delete chrome.storage.onChanged;
    delete chrome.runtime.onMessage;
    delete chrome.runtime.onConnect;
    delete chrome.tabs;
  });

  describe("initialize", () => {
    it("does not fail when Chrome does not expose the WebAuthn proxy API", async () => {
      delete chrome.webAuthenticationProxy;

      await expect(PasskeyWebAuthenticationProxyService.initialize()).resolves.toBe(false);

      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(
        PasskeyWebAuthenticationProxyService.handleRuntimeMessage,
      );
      expect(chrome.runtime.onConnect.addListener).toHaveBeenCalledWith(
        PasskeyWebAuthenticationProxyService.handleRuntimePort,
      );
      expect(PasskeyContentScriptInjectionService.injectIntoExistingTabs).toHaveBeenCalledTimes(1);
      expect(PasskeyKeepAliveService.start).not.toHaveBeenCalled();
    });

    it("registers listeners and attaches the proxy by default", async () => {
      await expect(PasskeyWebAuthenticationProxyService.initialize()).resolves.toBe(true);

      expect(chrome.webAuthenticationProxy.onCreateRequest.addListener).toHaveBeenCalledWith(
        PasskeyWebAuthenticationProxyService.handleCreateRequest,
      );
      expect(chrome.webAuthenticationProxy.onGetRequest.addListener).toHaveBeenCalledWith(
        PasskeyWebAuthenticationProxyService.handleGetRequest,
      );
      expect(chrome.webAuthenticationProxy.onIsUvpaaRequest.addListener).toHaveBeenCalledWith(
        PasskeyWebAuthenticationProxyService.handleIsUvpaaRequest,
      );
      expect(chrome.webAuthenticationProxy.onRequestCanceled.addListener).toHaveBeenCalledWith(
        PasskeyWebAuthenticationProxyService.handleRequestCanceled,
      );
      expect(chrome.storage.onChanged.addListener).toHaveBeenCalledWith(
        PasskeyWebAuthenticationProxyService.handleStorageChanged,
      );
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(
        PasskeyWebAuthenticationProxyService.handleRuntimeMessage,
      );
      expect(chrome.runtime.onConnect.addListener).toHaveBeenCalledWith(
        PasskeyWebAuthenticationProxyService.handleRuntimePort,
      );
      expect(chrome.webAuthenticationProxy.attach).toHaveBeenCalledTimes(1);
      expect(PasskeyKeepAliveService.start).toHaveBeenCalledTimes(1);
      expect(PasskeyContentScriptInjectionService.injectIntoExistingTabs).toHaveBeenCalledTimes(1);
    });

    it("keeps the proxy detached when the hidden kill switch is disabled", async () => {
      await chrome.storage.local.set({
        [PasskeyWebAuthenticationProxyService.STORAGE_KEY_ENABLED]: false,
      });

      await expect(PasskeyWebAuthenticationProxyService.initialize()).resolves.toBe(false);

      expect(chrome.webAuthenticationProxy.attach).not.toHaveBeenCalled();
      expect(PasskeyKeepAliveService.start).not.toHaveBeenCalled();
    });

    it("toggles the proxy when the hidden kill switch changes", async () => {
      await chrome.storage.local.set({
        [PasskeyWebAuthenticationProxyService.STORAGE_KEY_ENABLED]: false,
      });

      await expect(PasskeyWebAuthenticationProxyService.initialize()).resolves.toBe(false);
      await chrome.storage.local.set({
        [PasskeyWebAuthenticationProxyService.STORAGE_KEY_ENABLED]: true,
      });
      await chrome.storage.onChanged.dispatch(
        {
          [PasskeyWebAuthenticationProxyService.STORAGE_KEY_ENABLED]: { oldValue: false, newValue: true },
        },
        "local",
      );

      expect(chrome.webAuthenticationProxy.attach).toHaveBeenCalledTimes(1);
      expect(PasskeyKeepAliveService.start).toHaveBeenCalledTimes(1);

      await chrome.storage.local.set({
        [PasskeyWebAuthenticationProxyService.STORAGE_KEY_ENABLED]: false,
      });
      await chrome.storage.onChanged.dispatch(
        {
          [PasskeyWebAuthenticationProxyService.STORAGE_KEY_ENABLED]: { oldValue: true, newValue: false },
        },
        "local",
      );

      expect(chrome.webAuthenticationProxy.detach).toHaveBeenCalledTimes(1);
      expect(PasskeyKeepAliveService.stop).toHaveBeenCalledTimes(1);
    });

    it("temporarily detaches and resumes the proxy through internal runtime messages", async () => {
      await expect(PasskeyWebAuthenticationProxyService.initialize()).resolves.toBe(true);
      const suspendResponse = new Promise((resolve) => {
        expect(
          PasskeyWebAuthenticationProxyService.handleRuntimeMessage(
            { name: PasskeyWebAuthenticationProxyService.MESSAGE_SUSPEND },
            {},
            resolve,
          ),
        ).toBe(true);
      });

      await expect(suspendResponse).resolves.toEqual({ ok: true, result: true });
      expect(chrome.webAuthenticationProxy.detach).toHaveBeenCalledTimes(1);

      const resumeResponse = new Promise((resolve) => {
        expect(
          PasskeyWebAuthenticationProxyService.handleRuntimeMessage(
            { name: PasskeyWebAuthenticationProxyService.MESSAGE_RESUME },
            {},
            resolve,
          ),
        ).toBe(true);
      });

      await expect(resumeResponse).resolves.toEqual({ ok: true, result: true });
      expect(chrome.webAuthenticationProxy.attach).toHaveBeenCalledTimes(2);
    });

    it("forces Chrome to detach even if the service worker lost the local attached state", async () => {
      await expect(PasskeyWebAuthenticationProxyService.initialize()).resolves.toBe(true);
      chrome.webAuthenticationProxy.detach.mockClear();
      PasskeyWebAuthenticationProxyService._attached = false;

      await expect(PasskeyWebAuthenticationProxyService.suspend()).resolves.toBe(true);

      expect(chrome.webAuthenticationProxy.detach).toHaveBeenCalledTimes(1);
    });

    it("forces Chrome to re-attach on resume when the local attached state is stale", async () => {
      await expect(PasskeyWebAuthenticationProxyService.initialize()).resolves.toBe(true);
      chrome.webAuthenticationProxy.attach.mockClear();
      chrome.webAuthenticationProxy.detach.mockClear();
      PasskeyWebAuthenticationProxyService._attached = true;

      await expect(PasskeyWebAuthenticationProxyService.resume()).resolves.toBe(true);

      expect(chrome.webAuthenticationProxy.detach).not.toHaveBeenCalled();
      expect(chrome.webAuthenticationProxy.attach).toHaveBeenCalledTimes(1);
    });

    it("keeps the proxy attached when the offscreen keepalive polls the service worker", async () => {
      await expect(PasskeyWebAuthenticationProxyService.initialize()).resolves.toBe(true);
      chrome.webAuthenticationProxy.attach.mockClear();
      PasskeyWebAuthenticationProxyService._attached = false;

      const keepAliveResponse = new Promise((resolve) => {
        expect(
          PasskeyWebAuthenticationProxyService.handleRuntimeMessage(
            { name: PasskeyWebAuthenticationProxyService.MESSAGE_KEEPALIVE },
            {},
            resolve,
          ),
        ).toBe(true);
      });

      await expect(keepAliveResponse).resolves.toEqual({ ok: true, result: true });
      expect(chrome.webAuthenticationProxy.attach).toHaveBeenCalledTimes(1);
    });

    it("forces a real Chrome attach when keepalive polls with stale local attached state", async () => {
      await expect(PasskeyWebAuthenticationProxyService.initialize()).resolves.toBe(true);
      chrome.webAuthenticationProxy.attach.mockClear();
      chrome.webAuthenticationProxy.detach.mockClear();
      PasskeyWebAuthenticationProxyService._attached = true;

      const keepAliveResponse = new Promise((resolve) => {
        expect(
          PasskeyWebAuthenticationProxyService.handleRuntimeMessage(
            { name: PasskeyWebAuthenticationProxyService.MESSAGE_KEEPALIVE },
            {},
            resolve,
          ),
        ).toBe(true);
      });

      await expect(keepAliveResponse).resolves.toEqual({ ok: true, result: true });
      expect(chrome.webAuthenticationProxy.detach).not.toHaveBeenCalled();
      expect(chrome.webAuthenticationProxy.attach).toHaveBeenCalledTimes(1);
    });
  });

  describe("request handling", () => {
    beforeEach(async () => {
      jest.spyOn(PasskeyWebauthnService, "createCredential").mockResolvedValue({
        credential: { id: "created-passkey", type: "public-key" },
        secretDto: { credential_id: "created-passkey" },
      });
      jest.spyOn(PasskeyVaultResourceService, "createResourceForPasskey").mockResolvedValue({});
      jest.spyOn(PasskeyVaultResourceService, "findSecretForAssertion").mockResolvedValue({
        credential_id: "stored-passkey",
      });
      jest.spyOn(PasskeyWebauthnService, "getAssertion").mockResolvedValue({
        credential: { id: "stored-passkey", type: "public-key" },
      });
      await PasskeyWebAuthenticationProxyService.initialize();
    });

    it("creates a passkey, stores it as a vault resource, and completes the create request", async () => {
      const requestDetailsJson = JSON.stringify({ challenge: "challenge" });
      await chrome.webAuthenticationProxy.onCreateRequest.dispatch({ requestId: 42, requestDetailsJson });

      expect(chrome.webAuthenticationProxy.completeCreateRequest).toHaveBeenCalledWith({
        requestId: 42,
        responseJson: JSON.stringify({ id: "created-passkey", type: "public-key" }),
      });
      expect(PasskeyWebauthnService.createCredential).toHaveBeenCalledWith(requestDetailsJson);
      expect(PasskeyVaultResourceService.createResourceForPasskey).toHaveBeenCalledWith(requestDetailsJson, {
        credential_id: "created-passkey",
      });
    });

    it("completes create requests with a WebAuthn DOMException when storing the resource fails", async () => {
      const error = new Error("The Passly API does not expose the v5-passkey resource type.");
      error.name = "NotSupportedError";
      jest.spyOn(PasskeyVaultResourceService, "createResourceForPasskey").mockRejectedValueOnce(error);

      await chrome.webAuthenticationProxy.onCreateRequest.dispatch({ requestId: 43, requestDetailsJson: "{}" });

      expect(chrome.webAuthenticationProxy.completeCreateRequest).toHaveBeenCalledWith({
        requestId: 43,
        error: {
          name: "NotSupportedError",
          message: "The Passly API does not expose the v5-passkey resource type.",
        },
      });
    });

    it("finds a vault passkey, signs the challenge, and completes the get request", async () => {
      const requestDetailsJson = JSON.stringify({ challenge: "challenge" });
      await chrome.webAuthenticationProxy.onGetRequest.dispatch({ requestId: 44, requestDetailsJson });

      expect(chrome.webAuthenticationProxy.completeGetRequest).toHaveBeenCalledWith({
        requestId: 44,
        responseJson: JSON.stringify({ id: "stored-passkey", type: "public-key" }),
      });
      expect(PasskeyVaultResourceService.findSecretForAssertion).toHaveBeenCalledWith(requestDetailsJson);
      expect(PasskeyWebauthnService.getAssertion).toHaveBeenCalledWith(requestDetailsJson, {
        credential_id: "stored-passkey",
      });
    });

    it("does not open a new page when a direct get request is confirmed while the vault is locked", async () => {
      const requestDetailsJson = JSON.stringify({ challenge: "challenge" });
      const lockedError = PasskeyWebauthnService.buildNotAllowedError(
        "Unlock Passly before using the passkey provider.",
      );
      PasskeyVaultResourceService.findSecretForAssertion.mockRejectedValueOnce(lockedError);

      await chrome.webAuthenticationProxy.onGetRequest.dispatch({ requestId: 48, requestDetailsJson });

      expect(chrome.tabs.create).not.toHaveBeenCalled();
      expect(chrome.webAuthenticationProxy.completeGetRequest).toHaveBeenCalledWith({
        requestId: 48,
        error: {
          name: "NotAllowedError",
          message: "Unlock Passly before using the passkey provider.",
        },
      });
    });

    it("reports that UVPAA is available while the Passly provider is attached", async () => {
      await chrome.webAuthenticationProxy.onIsUvpaaRequest.dispatch({ requestId: 45 });

      expect(chrome.webAuthenticationProxy.completeIsUvpaaRequest).toHaveBeenCalledWith({
        requestId: 45,
        isUvpaa: true,
      });
    });

    it("does not complete a request that Chrome has already canceled", async () => {
      await chrome.webAuthenticationProxy.onRequestCanceled.dispatch(46);
      await chrome.webAuthenticationProxy.onGetRequest.dispatch({ requestId: 46, requestDetailsJson: "{}" });

      expect(chrome.webAuthenticationProxy.completeGetRequest).not.toHaveBeenCalled();
    });

    it("can still complete requests with the default provider unavailable error", async () => {
      await PasskeyWebAuthenticationProxyService.completeGetRequestWithError(47);

      expect(chrome.webAuthenticationProxy.completeGetRequest).toHaveBeenCalledWith({
        requestId: 47,
        error: PASSKEY_PROVIDER_UNAVAILABLE_ERROR,
      });
    });
  });

  describe("content script fallback handling", () => {
    beforeEach(() => {
      jest.spyOn(GetActiveAccountService, "get").mockResolvedValue({
        domain: "https://passly.example.com",
      });
      jest.spyOn(PasskeyWebauthnService, "createCredential").mockResolvedValue({
        credential: { id: "created-passkey", type: "public-key" },
        secretDto: { credential_id: "created-passkey" },
      });
      jest.spyOn(PasskeyVaultResourceService, "createResourceForPasskey").mockResolvedValue({});
      jest.spyOn(PasskeyVaultResourceService, "findSecretForAssertion").mockResolvedValue({
        credential_id: "stored-passkey",
      });
      jest.spyOn(PasskeyWebauthnService, "getAssertion").mockResolvedValue({
        credential: { id: "stored-passkey", type: "public-key" },
      });
    });

    function buildContentCreateRequest(overrides = {}) {
      return {
        challenge: "challenge",
        origin: "https://spoofed.example.com",
        rp: {
          id: "login.example.com",
          name: "Example",
        },
        user: {
          id: "user-handle",
          name: "ada@example.com",
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        ...overrides,
      };
    }

    it("creates and stores a passkey from the document_start content fallback", async () => {
      const contentCreateResponse = new Promise((resolve) => {
        expect(
          PasskeyWebAuthenticationProxyService.handleRuntimeMessage(
            {
              name: PasskeyWebAuthenticationProxyService.MESSAGE_CONTENT_CREATE,
              requestDetails: buildContentCreateRequest(),
            },
            { url: "https://login.example.com/register" },
            resolve,
          ),
        ).toBe(true);
      });

      await expect(contentCreateResponse).resolves.toEqual({
        ok: true,
        result: { id: "created-passkey", type: "public-key" },
      });
      expect(PasskeyWebauthnService.createCredential).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: "https://login.example.com",
        }),
      );
      expect(PasskeyVaultResourceService.createResourceForPasskey).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: "https://login.example.com",
        }),
        { credential_id: "created-passkey" },
      );
    });

    it("creates and stores a passkey from the dedicated runtime port fallback", async () => {
      const port = buildRuntimePortMock(PasskeyWebAuthenticationProxyService.PORT_NAME, {
        url: "https://login.example.com/register",
      });

      expect(PasskeyWebAuthenticationProxyService.handleRuntimePort(port)).toBe(true);
      expect(port.onMessage.addListener).toHaveBeenCalledTimes(1);

      await port.messageListeners[0]({
        requestId: "request-1",
        name: PasskeyWebAuthenticationProxyService.MESSAGE_CONTENT_CREATE,
        requestDetails: buildContentCreateRequest(),
      });

      expect(port.postMessage).toHaveBeenCalledWith({
        requestId: "request-1",
        response: {
          ok: true,
          result: { id: "created-passkey", type: "public-key" },
        },
      });
      expect(PasskeyWebauthnService.createCredential).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: "https://login.example.com",
        }),
      );
      expect(PasskeyVaultResourceService.createResourceForPasskey).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: "https://login.example.com",
        }),
        { credential_id: "created-passkey" },
      );
    });

    it("finds and returns a passkey assertion from the document_start content fallback", async () => {
      const contentGetResponse = new Promise((resolve) => {
        expect(
          PasskeyWebAuthenticationProxyService.handleRuntimeMessage(
            {
              name: PasskeyWebAuthenticationProxyService.MESSAGE_CONTENT_GET,
              requestDetails: {
                challenge: "challenge",
                origin: "https://spoofed.example.com",
                rpId: "login.example.com",
              },
            },
            { url: "https://login.example.com/sign-in" },
            resolve,
          ),
        ).toBe(true);
      });

      await expect(contentGetResponse).resolves.toEqual({
        ok: true,
        result: { id: "stored-passkey", type: "public-key" },
      });
      expect(PasskeyVaultResourceService.findSecretForAssertion).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: "https://login.example.com",
        }),
      );
    });

    it("skips the content fallback on the active Passly application origin", async () => {
      const contentCreateResponse = new Promise((resolve) => {
        expect(
          PasskeyWebAuthenticationProxyService.handleRuntimeMessage(
            {
              name: PasskeyWebAuthenticationProxyService.MESSAGE_CONTENT_CREATE,
              requestDetails: buildContentCreateRequest(),
            },
            { url: "https://passly.example.com/auth/login" },
            resolve,
          ),
        ).toBe(true);
      });

      await expect(contentCreateResponse).resolves.toEqual({
        ok: true,
        result: { skipped: true, reason: "own-passly-domain" },
      });
      expect(PasskeyWebauthnService.createCredential).not.toHaveBeenCalled();
      expect(PasskeyVaultResourceService.createResourceForPasskey).not.toHaveBeenCalled();
    });

    it("returns the locked vault error without same-page unlock metadata", async () => {
      const lockedError = PasskeyWebauthnService.buildNotAllowedError(
        "Unlock Passly before using the passkey provider.",
      );
      PasskeyVaultResourceService.findSecretForAssertion.mockRejectedValue(lockedError);

      const response = new Promise((resolve) => {
        expect(
          PasskeyWebAuthenticationProxyService.handleRuntimeMessage(
            {
              name: PasskeyWebAuthenticationProxyService.MESSAGE_CONTENT_GET,
              requestDetails: {
                challenge: "challenge",
                origin: "https://login.example.com",
                rpId: "login.example.com",
              },
            },
            { url: "https://login.example.com/sign-in" },
            resolve,
          ),
        ).toBe(true);
      });

      await expect(response).resolves.toEqual({
        ok: false,
        error: {
          name: "NotAllowedError",
          message: "Unlock Passly before using the passkey provider.",
        },
      });
      expect(chrome.tabs.create).not.toHaveBeenCalled();
    });

    it("skips the content fallback when there is no active account", async () => {
      GetActiveAccountService.get.mockRejectedValueOnce(new Error("The user is not set"));

      const contentUvpaaResponse = new Promise((resolve) => {
        expect(
          PasskeyWebAuthenticationProxyService.handleRuntimeMessage(
            {
              name: PasskeyWebAuthenticationProxyService.MESSAGE_CONTENT_UVPAA,
              requestDetails: { origin: "https://login.example.com" },
            },
            { url: "https://login.example.com" },
            resolve,
          ),
        ).toBe(true);
      });

      await expect(contentUvpaaResponse).resolves.toEqual({
        ok: true,
        result: { skipped: true, reason: "no-active-account" },
      });
    });
  });
});
